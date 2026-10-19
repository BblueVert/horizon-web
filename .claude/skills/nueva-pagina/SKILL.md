---
name: nueva-pagina
description: Crea una página pública nueva del sitio HORIZON (landing, plan, recurso, caso) con los tokens de marca y su ruta en vercel.json. Usar cuando pidan "nueva página", "landing para X", "página de caso" o "agregar una ruta al sitio".
---

# Nueva página HORIZON

## Pasos
1. Pedí (si falta): slug, objetivo de conversión (diagnóstico / recurso / WhatsApp) y modo de voz (1, 2 o 3).
2. Copiá `templates/pagina-base.html` a `Pages/<slug>.html` (o `Pages/<slug>/index.html` si va a tener subrutas).
3. Completá `<title>`, `meta description` y `og:*`. La og-image por defecto es `/Identidad/og-image.png`.
4. Agregá el rewrite en `vercel.json`, junto a las otras de `Pages/`:
   `{ "source": "/<slug>", "destination": "/Pages/<slug>.html" }`
5. Si la página llama a un dominio externo nuevo: agregalo a la CSP en `vercel.json` **y** en `server.js`.
6. Si tiene formulario: POST a `/api/leads` (no inventes endpoints).
7. Pasale la página al subagente `page-auditor` antes de dar por cerrado.

## Reglas
- Solo tokens CSS existentes (ver `.claude/memoria/naming.md`). Nada de colores sueltos.
- Mobile first. Probar a 360px.
- Un CTA principal por pantalla.
- Copy con voseo, sin frases de IA.
