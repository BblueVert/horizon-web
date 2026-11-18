# Formato de la ficha de demo

Un archivo JSON por negocio. Es todo lo que sabe el agente: lo que no esté aquí, no lo inventa.
Ejemplo completo: `fichas/ejemplo-sangucheria.json`.

| Campo | Obligatorio | Qué va |
|---|---|---|
| `slug` | sí | Minúsculas y guiones, único: `tia-julia`, `barberia-el-tano` |
| `nombre` | sí | Nombre comercial tal como lo usa el negocio |
| `rubro` | sí | `restaurante` `cafeteria` `minimarket` `botilleria` `panaderia` `peluqueria` `barberia` `estetica` `clinica` `kinesiologia` `veterinaria` `gimnasio` `tienda` `ferreteria` `servicios` `otro` |
| `flujo` | sí | `pedidos` (comida, tiendas) · `reservas` (peluquería, clínica, mesas) · `consultas` (servicios, cotizaciones) |
| `asistente` | no | Nombre del asistente ("Julia", "Tano") |
| `descripcion` | no | 1–3 líneas: qué venden, a quién, qué los hace distintos |
| `tono` | no | Cómo habla el negocio ("cercano y rápido", "formal y tranquilo") |
| `saludo` | no | Primer mensaje sugerido |
| `locales[]` | no | `{ nombre, direccion, comuna, horario, telefono, referencia, lat, lng, mapa }`. Con `lat`/`lng` el bot manda el **pin nativo de WhatsApp**; sin ellas, un link de Google Maps |
| `horario` | no | Si es igual para todos los locales |
| `catalogo[]` | no | `{ categoria, items: [{ nombre, precio, descripcion, variantes: [{ nombre, precio }] }] }` |
| `entrega` | no | `{ retiro, delivery, zonas, costo, minimo, apps }` |
| `reservas` | no | `{ activo, datos: ["nombre","servicio","día","hora"], horarios, notas }` |
| `pago_online` | no | `{ activo: true }` = link de pago por el total · `{ activo: true, porcentaje: 30 }` = abono. Pantalla simulada `/pago-demo`, no cobra |
| `color` | no | Hex del negocio (`#B4527A`) para la pantalla de pago |
| `pagos[]` | no | Medios de pago |
| `faq[]` | no | `{ p, r }` preguntas típicas con su respuesta |
| `reglas[]` | no | Cómo funciona el negocio y la atención ("siempre ofrece bebida", "reservas con 24 h") |
| `datos_pedido[]` | no | Qué pedir para cerrar ("nombre", "dirección", "hora de retiro") |
| `derivar_a` | no | Qué decir cuando no sabe algo |
| `documento` | no | PDF que el bot manda al confirmar (propuesta, cotización): `{ titulo, plantilla, archivo, mensaje, al, marcas, datos, campos }`. Ver abajo |
| `fuentes[]` | recomendado | URLs o "dictado por Benja" de donde salió cada dato |
| `notas_internas` | no | Para Benja, el bot no lo usa |
| `activa` | no | `false` apaga la demo |

## Reglas de datos
- **Precios:** número en CLP (`6990`) o `null` si no se encontró. Nunca un precio "aproximado" escrito como si fuera real.
- Precios de apps (PedidosYa, Uber Eats) suelen estar inflados: si es la única fuente, anótalo en `fuentes` y en `notas_internas`.
- Máx. 60 KB. Para cartas enormes, deja las categorías y los productos más pedidos.

## Documento PDF (`documento`)
Al confirmar una acción (por defecto `consulta`), el bot completa una plantilla PDF con los datos que juntó el agente y la manda como documento de WhatsApp. Los montos no se inventan: la plantilla deja esos espacios para el negocio.

1. Diseña la plantilla en HTML (A4, una `<section class="pag">` por página) y marca cada espacio con `data-campo="<clave>"`: un elemento con línea inferior (el texto se apoya encima) o una celda `<td>` (el texto va centrado).
2. `node scripts/medir-plantilla.js plantilla.html plantillas/<slug>.pdf` → crea el PDF base e imprime `campos` (página, x, y en puntos PDF, ancho). Necesita Playwright y `pdftotext`; el bot no los necesita.
3. En la ficha:

| Campo | Qué va |
|---|---|
| `plantilla` | Ruta relativa a `verticales/demos` (ej. `plantillas/eventos.pdf`) o URL |
| `campos[]` | Lo que imprimió el script. Opcionales: `tam` (pt), `fuente` (`medio` · `negrita` · `serif`), `color`, `alinear` (`izquierda` · `centro` · `derecha`), `marca: true` (sí/no) |
| `datos` | `{ clave: "qué poner" }`: lo que el agente debe juntar y mandar en `accion.datos.documento`. `emision` se llena sola con la fecha |
| `marcas` | Texto de las marcas: `{ "si": "Incluido", "no": "—" }` |
| `archivo` | Nombre del PDF; acepta `{clave}` (ej. `Propuesta - {novios}.pdf`) |
| `mensaje` | Texto que acompaña al PDF |
| `al` | Acciones que lo disparan (por defecto `["consulta"]`) |
