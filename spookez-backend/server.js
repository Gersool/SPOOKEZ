/**
 * SPOOKEZ — Backend SQLite + Stripe Checkout (modo test)
 * -------------------------------------------------------
 * - Base de datos: data/spookez.db (SQLite nativo node:sqlite)
 * - Pagos: Stripe Checkout Session
 * - NUNCA se guardan números de tarjeta ni CVV
 *
 * Configura en .env:
 *   STRIPE_SECRET_KEY=sk_test_...
 *   PORT=3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { URL, URLSearchParams } = require('url');
const { DatabaseSync } = require('node:sqlite');

// Cargar .env manualmente (sin dependencia dotenv)
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) return;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  });
})();

const PORT = process.env.PORT || 3000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'spookez.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------
const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    order_number    TEXT UNIQUE NOT NULL,
    customer_name   TEXT NOT NULL,
    customer_email  TEXT NOT NULL,
    address         TEXT NOT NULL,
    city            TEXT NOT NULL,
    postal_code     TEXT NOT NULL,
    country         TEXT DEFAULT 'España',
    total_amount    REAL NOT NULL,
    currency        TEXT DEFAULT 'EUR',
    payment_status  TEXT NOT NULL DEFAULT 'pending',
    payment_method  TEXT,
    payment_last4   TEXT,
    payment_ref     TEXT,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      TEXT NOT NULL,
    product_name  TEXT NOT NULL,
    product_image TEXT,
    unit_price    REAL NOT NULL,
    quantity      INTEGER NOT NULL,
    line_total    REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    phone         TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_order_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders(payment_ref);
`);

function orderNumber() {
  return 'SPK-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Stripe API (HTTPS nativo, sin SDK)
// ---------------------------------------------------------------------------
function stripeRequest(method, apiPath, params) {
  return new Promise((resolve, reject) => {
    if (!STRIPE_SECRET_KEY) {
      reject(new Error('Falta STRIPE_SECRET_KEY en el archivo .env'));
      return;
    }

    const body = params ? new URLSearchParams(params).toString() : '';
    const req = https.request(
      {
        hostname: 'api.stripe.com',
        path: apiPath,
        method,
        headers: {
          Authorization: 'Bearer ' + STRIPE_SECRET_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            reject(new Error('Respuesta inválida de Stripe'));
            return;
          }
          if (res.statusCode >= 400) {
            const msg = data.error?.message || data.error?.code || 'Error de Stripe';
            reject(new Error(msg));
            return;
          }
          resolve(data);
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function savePaidOrder({ customer_name, customer_email, address, city, postal_code, country, items, payment_ref, payment_method, payment_last4 }) {
  let total = 0;
  const cleanItems = items.map((item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Number(item.price) || 0;
    const line = +(price * qty).toFixed(2);
    total += line;
    return {
      product_name: String(item.name || item.product_name || 'Producto').slice(0, 200),
      product_image: item.image || item.product_image || null,
      unit_price: price,
      quantity: qty,
      line_total: line
    };
  });
  total = +total.toFixed(2);

  // Evitar duplicados si el usuario recarga la página de éxito
  if (payment_ref) {
    const existing = db.prepare('SELECT * FROM orders WHERE payment_ref = ?').get(payment_ref);
    if (existing) {
      const existingItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existing.id);
      return { order: existing, items: existingItems, duplicate: true };
    }
  }

  const id = randomUUID();
  const num = orderNumber();
  const email = String(customer_email).trim().toLowerCase().slice(0, 200);
  const name = String(customer_name).trim().slice(0, 150);

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, order_number, customer_name, customer_email,
      address, city, postal_code, country,
      total_amount, payment_status, payment_method,
      payment_last4, payment_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_name, product_image, unit_price, quantity, line_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const upsertCustomer = db.prepare(`
    INSERT INTO customers (id, name, email, last_order_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      last_order_at = datetime('now')
  `);

  db.exec('BEGIN');
  try {
    insertOrder.run(
      id, num, name, email,
      String(address || '').trim().slice(0, 300),
      String(city || '').trim().slice(0, 100),
      String(postal_code || '').trim().slice(0, 20),
      String(country || 'España').trim().slice(0, 80),
      total,
      payment_method || 'stripe',
      payment_last4 || null,
      payment_ref || null
    );

    for (const item of cleanItems) {
      insertItem.run(id, item.product_name, item.product_image, item.unit_price, item.quantity, item.line_total);
    }

    upsertCustomer.run(randomUUID(), name, email);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return { order, items: orderItems, duplicate: false };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function send(res, status, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': typeof data === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function mime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC)) {
    send(res, 403, { ok: false, error: 'Forbidden' });
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, { ok: false, error: 'Not found' });
    return;
  }
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime(filePath) });
  res.end(data);
}

function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:' + PORT;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return proto + '://' + host;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      return send(res, 200, {
        ok: true,
        service: 'spookez-api',
        database: 'sqlite',
        stripe_configured: Boolean(STRIPE_SECRET_KEY),
        time: new Date().toISOString()
      });
    }

    // ---- Crear sesión de Stripe Checkout ----
    if (pathname === '/api/create-checkout-session' && req.method === 'POST') {
      if (!STRIPE_SECRET_KEY) {
        return send(res, 500, {
          ok: false,
          error: 'Stripe no está configurado. Crea el archivo .env con STRIPE_SECRET_KEY=sk_test_...'
        });
      }

      const body = await readBody(req);
      const {
        customer_name,
        customer_email,
        address,
        city,
        postal_code,
        country = 'España',
        items
      } = body;

      if (!customer_name || !customer_email || !address || !city || !postal_code) {
        return send(res, 400, { ok: false, error: 'Faltan datos de envío o del cliente.' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return send(res, 400, { ok: false, error: 'El carrito está vacío.' });
      }

      const baseUrl = getBaseUrl(req);

      // Metadata para recuperar los datos al confirmar
      const metadata = {
        customer_name: String(customer_name).slice(0, 450),
        customer_email: String(customer_email).slice(0, 200),
        address: String(address).slice(0, 450),
        city: String(city).slice(0, 100),
        postal_code: String(postal_code).slice(0, 20),
        country: String(country).slice(0, 80),
        items_json: JSON.stringify(items.map((i) => ({
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image || null
        }))).slice(0, 450)
      };

      // Stripe form-urlencoded: line_items[0][price_data][currency]=eur ...
      const params = {
        mode: 'payment',
        success_url: baseUrl + '/?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: baseUrl + '/?cancelled=1',
        customer_email: customer_email,
        'payment_method_types[0]': 'card',
        'metadata[customer_name]': metadata.customer_name,
        'metadata[customer_email]': metadata.customer_email,
        'metadata[address]': metadata.address,
        'metadata[city]': metadata.city,
        'metadata[postal_code]': metadata.postal_code,
        'metadata[country]': metadata.country,
        'metadata[items_json]': metadata.items_json
      };

      items.forEach((item, idx) => {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const unitAmount = Math.round((Number(item.price) || 0) * 100); // céntimos
        params[`line_items[${idx}][price_data][currency]`] = 'eur';
        params[`line_items[${idx}][price_data][product_data][name]`] = String(item.name || 'Producto').slice(0, 200);
        params[`line_items[${idx}][price_data][unit_amount]`] = String(unitAmount);
        params[`line_items[${idx}][quantity]`] = String(qty);
      });

      const session = await stripeRequest('POST', '/v1/checkout/sessions', params);

      return send(res, 200, {
        ok: true,
        url: session.url,
        session_id: session.id
      });
    }

    // ---- Confirmar sesión tras volver de Stripe ----
    if (pathname === '/api/confirm-session' && req.method === 'POST') {
      if (!STRIPE_SECRET_KEY) {
        return send(res, 500, { ok: false, error: 'Stripe no configurado' });
      }

      const body = await readBody(req);
      const sessionId = body.session_id;
      if (!sessionId) {
        return send(res, 400, { ok: false, error: 'Falta session_id' });
      }

      const session = await stripeRequest('GET', '/v1/checkout/sessions/' + encodeURIComponent(sessionId));

      if (session.payment_status !== 'paid') {
        return send(res, 400, {
          ok: false,
          error: 'El pago no está completado (estado: ' + session.payment_status + ')'
        });
      }

      let items = [];
      try {
        items = JSON.parse(session.metadata?.items_json || '[]');
      } catch {
        items = [];
      }

      // Si metadata truncó items, reconstruir desde line items de Stripe
      if (!items.length) {
        // Fallback mínimo
        items = [{ name: 'Pedido Spookez', price: (session.amount_total || 0) / 100, quantity: 1 }];
      }

      const result = savePaidOrder({
        customer_name: session.metadata?.customer_name || session.customer_details?.name || 'Cliente',
        customer_email: session.metadata?.customer_email || session.customer_email || session.customer_details?.email || 'sin-email@spookez.es',
        address: session.metadata?.address || '',
        city: session.metadata?.city || '',
        postal_code: session.metadata?.postal_code || '',
        country: session.metadata?.country || 'España',
        items,
        payment_ref: session.id,
        payment_method: 'stripe',
        payment_last4: null
      });

      return send(res, 200, {
        ok: true,
        order: {
          id: result.order.id,
          order_number: result.order.order_number,
          total_amount: result.order.total_amount,
          payment_status: result.order.payment_status,
          payment_ref: result.order.payment_ref
        },
        duplicate: result.duplicate
      });
    }

    // ---- Crear pedido directo (fallback demo sin Stripe) ----
    if (pathname === '/api/orders' && req.method === 'POST') {
      const body = await readBody(req);
      const result = savePaidOrder({
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        address: body.address,
        city: body.city,
        postal_code: body.postal_code,
        country: body.country || 'España',
        items: body.items || [],
        payment_ref: 'DEMO-' + orderNumber(),
        payment_method: body.payment_method || 'demo',
        payment_last4: null
      });
      return send(res, 201, {
        ok: true,
        order: {
          id: result.order.id,
          order_number: result.order.order_number,
          total_amount: result.order.total_amount,
          payment_status: result.order.payment_status,
          payment_ref: result.order.payment_ref
        }
      });
    }

    if (pathname === '/api/orders' && req.method === 'GET') {
      const orders = db.prepare(`
        SELECT o.*,
          (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
        FROM orders o
        ORDER BY o.created_at DESC
        LIMIT 200
      `).all();
      return send(res, 200, { ok: true, orders });
    }

    if (pathname.startsWith('/api/orders/') && req.method === 'GET') {
      const key = pathname.slice('/api/orders/'.length);
      const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(key, key);
      if (!order) return send(res, 404, { ok: false, error: 'Pedido no encontrado.' });
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return send(res, 200, { ok: true, order, items });
    }

    if (pathname === '/api/customers' && req.method === 'GET') {
      const customers = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM orders o WHERE o.customer_email = c.email) AS order_count,
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders o WHERE o.customer_email = c.email) AS total_spent
        FROM customers c
        ORDER BY c.last_order_at DESC
        LIMIT 200
      `).all();
      return send(res, 200, { ok: true, customers });
    }

    if (pathname === '/api/stats' && req.method === 'GET') {
      const stats = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM orders) AS total_orders,
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') AS revenue,
          (SELECT COUNT(*) FROM customers) AS total_customers,
          (SELECT COALESCE(SUM(quantity), 0) FROM order_items) AS total_items_sold
      `).get();
      return send(res, 200, { ok: true, stats });
    }

    if (pathname === '/api/download-db' && req.method === 'GET') {
      if (!fs.existsSync(DB_FILE)) return send(res, 404, { ok: false, error: 'BD no encontrada' });
      const data = fs.readFileSync(DB_FILE);
      res.writeHead(200, {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': 'attachment; filename="spookez.db"'
      });
      return res.end(data);
    }

    if (pathname === '/admin') {
      return serveStatic(req, res, '/admin.html');
    }

    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    send(res, 500, { ok: false, error: err.message || 'Error interno del servidor.' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  SPOOKEZ API (SQLite + Stripe)');
  console.log('  Tienda:     http://localhost:' + PORT);
  console.log('  Admin:      http://localhost:' + PORT + '/admin');
  console.log('  Base datos: ' + DB_FILE);
  console.log('  Stripe:     ' + (STRIPE_SECRET_KEY ? 'CONFIGURADO ✓' : 'NO CONFIGURADO — crea .env con STRIPE_SECRET_KEY'));
  console.log('');
});
