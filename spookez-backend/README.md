# SPOOKEZ — SQLite + Stripe Checkout

## Qué incluye

- **Base de datos SQLite** (`data/spookez.db`) con tablas `orders`, `order_items`, `customers`
- **Pasarela de pago Stripe** (modo test: no cobra dinero real)
- Panel admin en `/admin`

## Configurar Stripe (obligatorio para pagar)

1. Entra en https://dashboard.stripe.com/test/apikeys
2. Copia la **Secret key** (`sk_test_...`)
3. Crea el archivo `.env` en esta carpeta:

```
PORT=3000
STRIPE_SECRET_KEY=sk_test_tu_clave_aqui
```

4. Arranca:

```bash
node server.js
```

## Probar un pago

1. http://localhost:3000 → añade productos → checkout
2. Te redirige a Stripe
3. Tarjeta de prueba: `4242 4242 4242 4242`
   - Fecha: cualquier futura (ej. 12/34)
   - CVV: 123
4. Tras pagar vuelves a la tienda y el pedido se guarda en SQLite
5. Véalo en http://localhost:3000/admin

## Requisitos

- Node.js **22+** (usa `node:sqlite` nativo)
- Cuenta Stripe en modo **Test**

## Importante

- No uses claves `sk_live_` hasta estar en producción
- Nunca subas el archivo `.env` a GitHub
- No se almacenan números de tarjeta
