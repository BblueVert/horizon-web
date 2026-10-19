# Casos reales (portafolio)

Fuente de verdad de los proyectos que se muestran en la landing (`Pages/HORIZON_Landing_2026.html`, sección `#casos`, un `<article class="case">` por proyecto) y que se usan en contenido. Datos reales > promesas.

| Caso | Estado | Link | Qué se hizo |
|---|---|---|---|
| VitalKine | En producción | https://vitalkine.com | Plan 02 · Ecosistema Digital. Sitio a medida con reservas propias, SEO local. Kinesiología a domicilio, Rancagua. |
| Floremané | En producción | https://floremane.cl | HORIZON × GO. Identidad, packaging y e-commerce editorial de carteras de cuero full-grain importadas de Italia. Repo: `BblueVert/Floremane`. |
| VitalFit | En producción | https://vitalfit-landing-alpha.vercel.app | Landing del gimnasio (24/5, Rancagua), puerta de entrada de FITT. Vive en `BblueVert/Fitt` → `8vo-Semestre/Gestion-de-Diseno/Landing-VitalFit/`. Cambiar el link si pasa a dominio propio. |
| FITT | En desarrollo | https://fitt-prototipo.vercel.app (prototipo) | Producto propio: acompañamiento y retención de socios para gimnasios independientes. Caso VitalFit (Rancagua): +2.000 membresías, deserción 5–10%. PWA + Supabase + n8n + WhatsApp API. Repo: `BblueVert/Fitt` (proyecto de título). |

## Cómo actualizar
- **Avance de FITT:** en la tarjeta de FITT, la lista `.milestones` marca cada hito con `class="done"` (hecho) o `class="now"` (en curso). Hitos actuales: Investigación en terreno ✓ · Concepto y marca ✓ · Prototipo PWA ✓ · Producto MVP (en curso). Cuando salga en vivo: cambiar el estado a "En producción", agregar el link y una captura en `Identidad/casos/fitt.webp`.
- **Capturas:** `Identidad/casos/<caso>.webp`, 1200×750, tomadas del sitio real (no mockups).
- **Caso nuevo:** copiar un `<article class="case">`, sumar un `<i>` a los puntos `.dots[data-rail="casesRail"]` y agregar la fila en esta tabla.
- No publicar métricas de clientes sin su permiso; las de FITT vienen de la investigación de campo en VitalFit.
