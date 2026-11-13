# Estructura — Guía de bienvenida

Reemplaza al "presupuesto de siempre" cuando el cliente acepta. Se envía junto con el contrato y el link del portal, antes de la reunión de inicio.

- Plantilla: `templates/guia.html` — misma familia visual que `base.html` (propuesta, contrato, actas). Portada oscura con el logo original y páginas blancas con barra de degradado, encabezado y pie.
- Código: `HZ-{{AAAA}}-{{slug}}-GB`
- Tono: profesional y cercano, tratando de **ustedes**. Sin eslóganes, sin emojis, nunca voseo. No reemplaza al contrato: lo explica en términos prácticos.
- Portada: `{{CLIENTE}}`, `{{PLAN_NOMBRE}}`, `{{PREPARADA_PARA}}` (contraparte), `{{DOCUMENTOS}}` (códigos PRO y CON), `{{FECHA}}`, `{{CODIGO}}`.
- Interior en `{{PAGINAS}}`: cada página es `<section class="page"><div class="bar"></div><header>…</header> … <div class="pie">…</div></section>` (ver el ejemplo). 4 páginas + portada.

## Secciones (numeradas `<h2><span class="n">0N</span>…`)
1. **Bienvenida:** saludo a la contraparte, para qué sirve la guía, `.box` "El objetivo del proyecto" con la frase textual del diagnóstico, y firma de Benja.
2. **Resumen del proyecto:** tabla clave/valor — servicio, canales o alcance, reunión de inicio, entrega estimada, inversión, soporte, contraparte del cliente y de HORIZON.
3. **Metodología y cronograma:** tabla (n° · etapa · fecha · qué ocurre · resultado): formalización → reunión de inicio → diseño → revisión y aprobación (rondas de `condiciones.md`) → construcción → pruebas → entrega y capacitación → acompañamiento. Cierra con la regla del plazo del cliente.
4. **Información y accesos requeridos:** tabla ítem · detalle, según el plan (lista de `orden-inicio.md`). Nota: cuentas a nombre del cliente y contraseñas por canal seguro.
5. **Comunicación y reuniones:** tabla de canales (portal `/c/<portal_token>`, WhatsApp con horario, correo) + tabla de reuniones.
6. **Pagos y soporte:** tabla anticipo/saldo/soporte y costos de terceros, según `condiciones.md`.
7. **Preguntas frecuentes:** 3, propias del rubro y del plan.
8. **Próximos pasos:** tabla acción · responsable · plazo + `.box` de contacto.

## Reglas
- Montos, plazos y condiciones solo de `ESTRATEGIA/HORIZON-ECOSISTEMA.md` y `condiciones.md`. Lo que falte: `<span class="pendiente">[[FALTA: …]]</span>`.
- Sin portal_token todavía: `[[FALTA: link del portal]]`.
- PDF: `node scripts/doc-pdf.js <archivo.html>`.
