# Arquitectura — cómo encaja todo

## Negocio (2 capas)
- **HORIZON Agencia**: 4 planes (01 Presencia Digital · 02 Ecosistema Digital · 03 Sistema con IA · 04 Agente IA). Detalle: `ESTRATEGIA/HORIZON-ECOSISTEMA.md`.
- **HORIZON Vertical SaaS**: Binks Barber (`verticales/peluquerias/`), multi-tenant en Supabase con RLS.
- **HORIZON OPS**: herramienta interna (pipeline, proyectos, tareas, agente IA) en `OPS/` + `api/ops/`.

## Stack
- Front: HTML/CSS/JS vanilla, sin bundler. Fuentes: Bebas Neue, Plus Jakarta Sans, DM Mono.
- Back: `server.js` (Express, local/Docker) **y** funciones serverless en `api/` (Vercel). Toda ruta nueva debe funcionar en ambos.
- Routing público: `vercel.json` → `rewrites`. Página nueva sin rewrite = página que no existe en producción.
- Datos: Supabase. Proyecto principal `dkitbnrpwmwrfnmztdfc` (OPS, leads, portal) y SaaS `khvfhvpqhcchgxrtmrjo` (peluquerías).
- Automatización: n8n vía webhooks (`N8N_WEBHOOK_URL`, `N8N_BOOKING_WEBHOOK`).
- IA del Agente OPS: DeepSeek (`api/ops/agente.js`), contexto sin emails/teléfonos/RUT.

## Seguridad
- Helpers comunes en `api/shared.js`: `sanitize`, `sanitizeEmail`, `rateLimit`, `getIp`, `httpsPost`. Úsalos, no reimplementes.
- CSP y headers duplicados en `server.js` y `vercel.json`: si agregás un dominio externo, actualizá **los dos**.
- La anon key de Supabase es pública (va en el front). La `service_role` **solo** en servidor.
- Toda tabla nueva: RLS activado + policies explícitas.

## WhatsApp
- Consultoría: **+56 9 7696 2659** (todas las páginas HORIZON). El +56 9 4651 3068 es personal: solo queda en las demos de Binks Barber y en landings viejas de otros repos.
- El mismo número de la consultoría se usa **a veces** para demos en vivo de Mesa Cero (repo `mesa-cero`): bot con el kit Baileys `mesa-cero-whatsapp-bot` (fuera de los repos) → webhook n8n `wa-mesacero-v2`. Mientras el kit está vinculado, el bot responde **todos** los chats, también los de prospectos de HORIZON. Benja avisa antes de cada demo; al terminar, desvincular el dispositivo en WhatsApp.
