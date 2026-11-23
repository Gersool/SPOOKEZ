# SPOOKEZ — Accesibilidad, idiomas y vídeos

## Arquitectura

- Frontend estático en `public/` (HTML/CSS/JS).
- Backend Node (`server.js`) con SQLite + Stripe Checkout (sin dependencias npm).
- i18n propio en `public/i18n.js` (sin librerías externas).
- Vídeos: iframe oficial **youtube-nocookie.com** (sin descargas ni extensiones).

## 1. Accesibilidad (WCAG 2.2 orientado a AA)

Implementado:

- Enlace “Saltar al contenido” visible al foco.
- Navegación por teclado y `:focus-visible`.
- `aria-label` / roles en controles principales.
- Textos alternativos en imágenes de producto.
- Preferencias persistentes: alto contraste, texto grande, reducir animaciones.
- Respeto a `prefers-reduced-motion`.
- Formularios con `<label>` asociados.
- Panel admin legible y con contraste oscuro.

Limitaciones (documentadas, no resolubles al 100 % en este stack):

- El iframe de YouTube es un componente de terceros: el control total AA/AAA del reproductor depende de Google.
- Login/registro sigue siendo demo local (localStorage), no autenticación real accesible de servidor.
- Contraste AAA en todas las combinaciones decorativas no se fuerza (prioridad AA usable + modo alto contraste).

## 2. Multilingüe (ES / EN / 中文 / DE)

- Selector de idioma en la cabecera (persistencia en `localStorage`).
- Traducción de menús, botones, textos, formularios, toasts y mensajes de vídeo.
- `document.documentElement.lang` se actualiza (`zh-Hans` para chino).

## 3–5. YouTube

- Reproductor oficial, sin conversión ni códecs locales.
- Carga diferida: el iframe solo se inserta al pulsar “Cargar vídeo”.
- Parámetros: `cc_load_policy=1`, `cc_lang_pref`, `hl`, `playsinline=1`, `rel=0`.
- Cambio de idioma de subtítulos actualiza iframes ya cargados.
- Errores de carga no bloquean el resto de la página.

### Traducción de vídeo (limitación técnica)

- **Subtítulos**: se usan pistas de YouTube (manuales o auto-traducidas si existen).
- **Doblaje IA / pistas de audio multilingües arbitrarias**: YouTube **no expone** un API pública estable en el embed para forzar doblaje IA en cualquier vídeo de terceros. No se implementa un pipeline de IA propio (requeriría servicios de pago, almacenamiento de audio y posibles problemas legales de copyright del contenido de YouTube).
- El usuario puede volver al audio original desde los controles nativos de YouTube.

Sustituye los `data-youtube-id` en `index.html` por los IDs reales de tus vídeos de marca.

## 6. Portabilidad

Incluido en el proyecto: HTML, CSS, JS, i18n, imágenes, servidor Node, SQLite.

Externos necesarios:

- YouTube (vídeos).
- Stripe API (pagos test).
- Google Fonts (opcional; si falla la red, el sistema usa fuentes fallback).

No requiere extensiones de navegador ni códecs instalados por el usuario.

## 7. Rendimiento

- Lazy load de iframes bajo demanda.
- `content-visibility` / contención en CSS donde aplica.
- Animaciones desactivables.
- Sin frameworks pesados.

## 8. Pruebas recomendadas

1. Teclado solo (Tab / Enter / Escape) en tienda, carrito, checkout, vídeos y panel a11y.
2. Lighthouse / axe en Chrome: comprobar contraste y nombres accesibles.
3. Cambiar ES→EN→中文→DE y recargar: el idioma se mantiene.
4. Cargar vídeo, cambiar idioma de subtítulos, comprobar que el iframe no tumba la página con red lenta (DevTools → Network → Slow 3G).
5. Firefox, Chrome, Edge, Safari.
6. Pago test Stripe + `/admin`.

## Despliegue (Render)

1. Subir el contenido del proyecto a GitHub (sin `.env`).
2. Web Service Node, Start: `node server.js`, Root Directory si aplica.
3. Env: `STRIPE_SECRET_KEY`, `NODE_VERSION=22`, `PORT=10000`.
4. URL pública + `/admin`.
