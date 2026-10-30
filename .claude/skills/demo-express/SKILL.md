---
name: demo-express
description: Arma en minutos un agente demo de WhatsApp para un negocio que Benja va a visitar (restaurante, local, servicio), investigando en internet su carta, precios, locales y horario, y lo publica en el número Horizon Pruebas para mostrarlo en vivo. Usar cuando digan "voy a llegar a…", "demo express", "arma un agente para…", "agente demo", "quiero mostrarle un bot a…" o dicten datos de un negocio para probar un agente.
---

# Demo express

Benja va manejando o caminando, a ~5 minutos del local. Objetivo: **demo funcionando en el número Horizon Pruebas (+56 9 7696 2659, el de la consultoría y Mesa Cero) antes de que entre**. Velocidad primero, sin inventar nada.

## 1. Arranque (respuesta inmediata, 1 línea)
Confirma qué entendiste: nombre del negocio, comuna y rubro. Si falta el nombre o la comuna, pregunta **solo eso**. Lo demás lo buscas tú.

## 2. Investiga (máx. ~2 min, todo en paralelo)
Lanza en el mismo turno 3–4 búsquedas (WebSearch `standard`):
- `"<nombre>" <comuna> carta menú precios` (o `servicios precios` si no es comida)
- `"<nombre>" <comuna> horario dirección`
- `"<nombre>" instagram` · `"<nombre>" pedidosya` / `ubereats` / `agendapro` / `fresha` según rubro
Después lee las 1–2 páginas con más datos (sitio propio > carta en PDF > app de delivery > Instagram > Google). Si no hay nada en internet, sigue con lo que dictó Benja.

## 3. Arma la ficha
Formato en `verticales/demos/FICHA.md` (ejemplo: `verticales/demos/fichas/ejemplo-sangucheria.json`).
- `flujo`: comida/tienda → `pedidos` · peluquería/clínica/estética/mesas → `reservas` · resto → `consultas`.
- Lo que dictó Benja sobre cómo funciona el negocio y su gente va a `reglas`, `tono` y `descripcion`. Lo que dijo de las personas (dueño, problemas, sensaciones) va a `notas_internas`, nunca al bot.
- **Precios:** solo los encontrados. Sin fuente → `"precio": null`. Si vienen de una app de delivery, anótalo en `fuentes` y `notas_internas` ("precios PedidosYa, suelen ser más altos").
- Cartas grandes: deja todas las categorías y los 5–8 productos más representativos de cada una.
- `asistente`: un nombre corto que calce con la marca. `saludo`: en su tono, tuteo chileno.
- Guarda en `CONTENIDO/demos/<slug>.json` (no se versiona: el repo es público).

## 4. Valida y publica
```bash
cd verticales/demos && npm install --silent   # solo la primera vez en la sesión
npm run validar -- ../../CONTENIDO/demos/<slug>.json
npm run publicar -- ../../CONTENIDO/demos/<slug>.json --qr ../../CONTENIDO/demos/<slug>-qr.png
```
- `publicar` necesita `DEMOS_TOKEN` en el entorno. Si no está: dile a Benja que falta configurarlo (ver `verticales/demos/README.md`) y mándale el JSON con SendUserFile para que lo copie a `fichas/` del bot y escriba `#demos recargar`.
- Si dice `bot: SIN CONEXIÓN` o `nunca se ha conectado`: avísale primero, antes que todo lo demás. La ficha queda guardada y el bot la toma apenas se conecte.

Si es una sanguchería o restaurante que encaja con Mesa Cero y Benja quiere mostrar el agente real con carta de Tía Julia, no armes ficha: el link de la demo `tia-julia` ya existe (motor `mesa-cero`).

## 5. Entrega (corto, se lee en el celular)
Envía el QR con SendUserFile y responde con este formato:

```
✅ Demo lista: <Nombre> (<n> productos, <m> sin precio)
🔗 <link wa.me>
Pruébala tú: escríbete "#demo <slug>" en tu chat contigo mismo en Horizon Pruebas.

Para mostrarla:
1. "<pregunta típica de cliente 1>"
2. "<pedido o reserva típica>"
3. "<pregunta que muestre una regla del negocio>"

⚠️ <lo que no se encontró: precios, horario…> (solo si aplica)
```

## Ajustes en vivo
"Agrega X", "cambia el precio de Y", "que salude distinto": edita el JSON y vuelve a correr `publicar`. El bot lo toma en ≤ 20 s y los chats abiertos siguen con la ficha nueva.

## Reglas
- Nada de datos inventados: ni precios, ni horarios, ni promociones.
- Copy del bot y de la respuesta: español de Chile con tuteo, nunca voseo.
- No es un agente de producción: es para mostrar. Si el cliente compra, el agente real se construye aparte (ej. `verticales/minimarket/`).
