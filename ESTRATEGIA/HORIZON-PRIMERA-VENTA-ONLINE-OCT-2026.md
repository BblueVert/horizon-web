# HORIZON — Primera venta online · 21 al 31 de octubre 2026

> Objetivo: que alguien llegue a horizonweb.cl, entienda la oferta y **pague ahí mismo**, sin conversación previa.
> Se construye sobre lo que ya funciona: cobro con Mercado Pago (probado con pago real), portal del cliente, OPS y los 3 creativos.
> Lo que falta construir está marcado como **[construir]**.

---

## 1. La meta

| | Qué significa | En caja |
|---|---|---|
| **Mínimo** | 1 Kit vendido 100% online (llega, paga, recibe solo) | $29.990 |
| **Meta alta** | 10 Kits + 1 Plan 01 contratado online (anticipo del 50%) | $299.900 + $245.000 = **$544.900** |

Una venta online cuenta solo si la persona compró sola desde la web. Si hubo que escribirle o convencerla por chat, no cuenta.

---

## 2. La escalera de valor (lo que se vende y en qué orden)

```
Ve un reel o anuncio
  → Kit Responde y Agenda · $29.990 (compra en 1 minuto, entrega automática)
     → Diagnóstico gratis de 30 min, con video-auditoría previa por WhatsApp
        → Plan 01 · $490.000 (los $29.990 del Kit se descuentan si contrata en 30 días)
           → Plan 02, 03 o 04
```

### El producto de entrada: Kit Responde y Agenda ($29.990)
Producto digital para ordenar cómo un negocio de servicio responde, agenda y cobra por WhatsApp, hecho en una tarde y sin depender de nadie.

1. **Guía paso a paso:** WhatsApp Business bien configurado (perfil, catálogo, etiquetas, respuestas rápidas, bienvenida y ausencia).
2. **30 mensajes listos para copiar:**
   - Atención: bienvenida, precios, agendar, confirmar.
   - Antes de la hora: recordatorio de 24 h, reagendar, no llegó.
   - Cobro: cobrar el abono.
   - Después: seguimiento y pedir reseña en Google.
3. **Planilla de consultas perdidas:** anotas las consultas de una semana y te dice cuántas se escapan y cuánto suman al mes.
4. **Checklist de perfil:** Google Business y bio de Instagram con link de agenda.
5. **Crédito de $29.990** para el Plan 01, válido por 30 días, más el diagnóstico gratis con video-auditoría previa.

**Tu tiempo por venta: 0 minutos.** La entrega es automática.

---

## 3. Paso a paso, desde lo más básico

Cada escalón depende del anterior. No se salta ninguno.

### Escalón 1 · La oferta escrita (mié 21) — Claude
- [ ] Nombre, promesa, qué incluye, precio, crédito y garantía, en un solo texto.
- [ ] Garantía simple y real: si el Kit no te sirve, escríbenos dentro de 7 días y te devolvemos el dinero.

### Escalón 2 · El producto (mié 21 – jue 22) — Claude crea, Benja revisa
- [ ] Guía y 30 mensajes (Google Docs, en tu Drive).
- [ ] Planilla de consultas perdidas (Google Sheets).
- [ ] Checklist de Google Business e Instagram.
- [ ] Benja lo lee una vez y corrige lo que no suene a ti.

### Escalón 3 · La página de venta `horizonweb.cl/kit` (jue 22) — Claude [construir]
- [ ] Arriba: el problema en una línea y el precio a la vista.
- [ ] Qué recibes (5 puntos), para quién es y para quién no.
- [ ] Preguntas frecuentes y garantía.
- [ ] Botón "Comprar el Kit · $29.990".
- [ ] En celular primero, con los mismos colores y letras del sitio.

### Escalón 4 · El pago (jue 22) — Claude [construir] + Benja (SQL)
- [ ] Formulario corto: nombre, email, WhatsApp, rubro.
- [ ] Mercado Pago Checkout Pro, el mismo que ya funciona en el portal. El monto lo pone el servidor, nunca el navegador.
- [ ] El webhook confirma el pago con la API de Mercado Pago y registra la venta.
- [ ] Tabla `ventas_online` (migración 015, la corres tú en Supabase).
- [ ] Cada compra entra a OPS como lead con `origen = kit`.

### Escalón 5 · La entrega automática (jue 22) — Claude [construir]
- [ ] Página de gracias que verifica el pago y muestra los links del Kit y el crédito para el Plan 01.
- [ ] Botón "Agenda tu diagnóstico" en la misma página: el siguiente escalón.
- [ ] Los links del Kit no quedan en el repo público: viven en variables de entorno de Vercel.

### Escalón 6 · Medición (jue 22) — Benja pasa el ID, Claude lo activa
- [ ] Pixel de Meta con eventos `ViewContent` (ve /kit), `InitiateCheckout` (aprieta comprar) y `Purchase` ($29.990 CLP).
- [ ] Sin Pixel no se sabe qué anuncio vende: este paso no se salta.

### Escalón 7 · Prueba real (vie 23) — Benja
- [ ] Compras tú el Kit con otra cuenta de Mercado Pago, como invitado (igual que la prueba del portal).
- [ ] Revisas: llegó el pago, apareció en OPS, viste los links, el Pixel marcó `Purchase`.
- [ ] Si algo falla, se arregla antes de pagar un peso en anuncios.

### Escalón 8 · Tráfico (vie 23 → vie 30)
- [ ] **Anuncios:** los 3 creativos con un final nuevo ("Kit Responde y Agenda · $29.990 · horizonweb.cl/kit"). Claude re-renderiza solo la última escena.
- [ ] **Campaña:** objetivo **Ventas**, evento `Purchase`, 1 conjunto con 3 anuncios. Si en 3 días no hay ninguna compra, cambia a optimizar `InitiateCheckout`.
- [ ] **Instagram:** link de la bio a `/kit`, 1 story diaria mostrando el Kit por dentro y 1 reel orgánico.
- [ ] **Estado de WhatsApp**, todos los días.
- [ ] **Red cercana y lista de 68 negocios:** en vez de pedir una reunión, mandas el link del Kit con una línea de contexto.

### Escalón 9 · Plan 01 contratado online (lun 26) — Claude [construir]
- [ ] Botón "Contratar online" en `/plan-01`: formulario → pago del anticipo de $245.000 → se crea su portal → completa el brief.
- [ ] Si trae el crédito del Kit, se descuentan los $29.990 del anticipo.

### Escalón 10 · Diagnóstico con video-auditoría (desde hoy) — Benja
- [ ] Cada diagnóstico agendado: en menos de 24 h grabas un video de 3–5 min revisando su web y redes y se lo mandas por WhatsApp.
- [ ] La confirmación de la agenda lo avisa: "Antes de la reunión te mando un video corto revisando tu web y redes" (Claude cambia ese texto).

---

## 4. Los números (para no engañarnos)

Una página de venta de un producto barato convierte entre 1% y 3% de las visitas. Es un punto de partida: lo corregimos con los datos del Pixel.

| Meta | Visitas a /kit necesarias | De dónde salen |
|---|---|---|
| 1 Kit | 35–100 | Anuncios con $20.000 (unas 40–60 visitas) + bio de Instagram + WhatsApp |
| 10 Kits | 350–1.000 | Lo anterior + **subir los anuncios a $50.000** + lista de 68 negocios + red cercana + contenido diario |

Lectura: con $20.000 en anuncios, 1 o 2 ventas es lo esperable. Para 10 hay que sumar más presupuesto y empujar todos los días por canales propios.

---

## 5. Controles

| Día | Qué miras | Si va mal |
|---|---|---|
| Vie 23 | La prueba real funcionó de punta a punta | No se lanza nada hasta que funcione |
| Lun 26 | Visitas a /kit, `InitiateCheckout`, compras | Muchas visitas y pocas compras: cambiar la página (arriba y precio visible). Pocas visitas: cambiar el anuncio |
| Jue 29 | Costo por compra | Si un Kit cuesta más de $29.990 en anuncios, se apaga el anuncio más caro y el presupuesto pasa al mejor |
| Sáb 31 | Ventas reales, de qué canal y cuántas pidieron diagnóstico | Ese dato decide noviembre |

---

## 6. Qué hace cada uno

| Benja | Claude |
|---|---|
| ID del Pixel | Oferta, contenido del Kit, página `/kit`, pago, entrega y Pixel |
| Correr la migración 015 en Supabase | Final nuevo de los 3 videos |
| Revisar el Kit y la página (que suene a ti) | Botón de Plan 01 online |
| Hacer la compra de prueba | Leer los números en cada control y ajustar |
| Subir la campaña, stories y estados | Texto de la confirmación con el video-auditoría |
| Video-auditoría de cada diagnóstico | |
