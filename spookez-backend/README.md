# SPOOKEZ — Tienda accesible + multilingüe + SQLite + Stripe

## Qué incluye

- Tienda streetwear (HTML/CSS/JS)
- **4 idiomas**: Español, English, 中文, Deutsch (`public/i18n.js`)
- **Accesibilidad**: skip link, teclado, alto contraste, texto grande, reducir animaciones
- **Vídeos YouTube** oficiales con lazy load y subtítulos por idioma
- **SQLite** (`data/spookez.db`) + panel `/admin`
- **Stripe Checkout** modo test

Ver detalle técnico y limitaciones en `docs/ACCESIBILIDAD-Y-MULTILINGUE.md`.

## Arranque local

Requisito: **Node.js 22+**

```bash
# .env
PORT=3000
STRIPE_SECRET_KEY=sk_test_...

node server.js
```

- Tienda: http://localhost:3000  
- Admin: http://localhost:3000/admin  
- Tarjeta test: `4242 4242 4242 4242`

## Render

- Start command: `node server.js`
- Env: `STRIPE_SECRET_KEY`, `NODE_VERSION=22`
- Si los archivos están en subcarpeta: Root Directory = esa carpeta
- No subir `.env` ni `node_modules`

## Autor

Manuel Gersol Megía
