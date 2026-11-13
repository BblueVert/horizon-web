# Estructura — Guía de bienvenida

Reemplaza al "presupuesto de siempre" cuando el cliente dice que sí. Se envía junto con el contrato y el link del portal, antes del kickoff.

- Plantilla: `templates/guia.html` (no `base.html`): portada oscura con el logo original + páginas claras A4.
- Código: `HZ-{{AAAA}}-{{slug}}-GB`
- Tono: cálido y claro, tratando de **ustedes** (al negocio) o de tú si la ficha lo indica. Nunca voseo. No es un documento legal: no copia cláusulas, las explica simple.
- Variables de portada: `{{CLIENTE}}`, `{{PLAN_NOMBRE}}`, `{{TITULAR}}` (ej. "Bienvenidos<br>a HORIZON"), `{{CODIGO}}`, `{{FECHA}}`. Las páginas van en `{{PAGINAS}}`, cada una en `<section class="page">` con `.top` (sección · número) y `.pie-pag`.
- Ejemplo completo: pedir a Claude "muéstrame la guía de ejemplo" (se genera en `CONTENIDO/clientes/ejemplo-dental/`).

## Páginas
1. **Carta** (`.cita` + `.firma-carta`): gracias, el dolor en palabras del cliente (de "Diagnóstico" en la ficha, textual) y qué vamos a resolver. Firma de Benja.
2. **Tu proyecto en una página** (`.datos` + `.cards`): kickoff, entrega estimada, inversión, soporte desde el mes 2, quién aprueba; "Qué incluye" del plan (`Pages/plan-0N.html`) en tarjetas y "No incluye" en una línea.
3. **Cómo vamos a trabajar** (`.linea`): firma y anticipo → partida → diseño → aprobación (rondas de `condiciones.md`) → construcción → pruebas → entrega y capacitación → soporte incluido. Con fecha o semana en `.cuando`.
4. **Lo que necesitamos** (`.check`): insumos según el plan (misma lista de `orden-inicio.md`), con el plazo de `condiciones.md`.
5. **Comunicación** (`.portal` + `.cards` + tabla): link del portal `/c/<portal_token>`, WhatsApp y correo, y las reuniones del proyecto.
6. **Pagos y preguntas frecuentes** (tabla + `.faq`): anticipo, saldo y soporte según `condiciones.md`; 3 preguntas típicas del rubro.
7. **Próximos pasos** (`.pasos`): firmar el acuerdo · pagar el anticipo desde el portal · reunir la lista.

## Reglas
- Montos, plazos y condiciones solo de `ESTRATEGIA/HORIZON-ECOSISTEMA.md` y `condiciones.md`. Lo que falte: `<span class="pendiente">[[FALTA: …]]</span>`.
- Sin portal_token todavía: `[[FALTA: link del portal]]`.
- PDF: `node scripts/doc-pdf.js <archivo.html>` (8 páginas aprox.).
