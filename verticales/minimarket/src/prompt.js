// Capa 1 — comprensión. La IA lee el mensaje y devuelve SOLO un JSON con lo que
// entendió. No calcula precios, no confirma stock, no arma totales: eso lo hace
// el motor (capa 2) con los datos reales de la base.

import { nombreProducto } from './texto.js';

export function construirPrompt({ negocio, catalogo, candidatos, contexto, cliente }) {
  const carrito = (contexto.carrito || []).map(i => {
    const p = catalogo.porSku.get(i.sku);
    return p ? `${i.cantidad} ${p.unidad === 'kg' ? 'kg' : 'x'} ${nombreProducto(p)} [${i.sku}]` : null;
  }).filter(Boolean);

  const productos = candidatos.map(p =>
    `- ${p.sku} | ${nombreProducto(p)} | se vende por ${p.unidad === 'kg' ? 'kilo' : 'unidad'}${p.unidades_caja ? ` | caja de ${p.unidades_caja}` : ''}`).join('\n');
  const categorias = catalogo.categorias.map(c => `${c.id} (${c.nombre})`).join(', ');

  const estado = {
    carrito: carrito.length ? carrito : '(vacío)',
    nombreCliente: contexto.nombre || cliente?.nombre || null,
    entrega: contexto.entrega || null,
    direccion: contexto.direccion || null,
    pago: contexto.pago || null,
    esperandoConfirmacion: !!contexto.esperandoConfirmacion,
    ultimasOpcionesOfrecidas: contexto.ultimasOpciones || [],
  };

  const systemPrompt = `Eres el motor de comprensión del bot de pedidos por WhatsApp de ${negocio.nombre}, un minimarket de barrio en ${negocio.comuna} que vende al detalle y al por mayor. Lee el último mensaje del cliente y devuelve SOLO un objeto JSON (sin markdown ni texto extra) con esta forma exacta:

{
  "items": [{"sku": "SKU o null", "mencionado": "lo que dijo el cliente", "cantidad": numero o null, "accion": "agregar" | "quitar" | "cambiar", "opciones": ["SKU", "..."]}],
  "consultaPrecios": ["SKU"],
  "consultaCategoria": "id de categoría o null",
  "consulta": "horario" | "despacho" | "mayorista" | "pago" | "ubicacion" | null,
  "verCarrito": boolean,
  "entrega": "retiro" | "despacho" | null,
  "direccion": "texto o null",
  "pago": "efectivo" | "transferencia" | "tarjeta" | null,
  "nombre": "nombre del cliente si lo dijo en ESTE mensaje, o null",
  "confirmar": "si" | "no" | null,
  "cancelar": boolean,
  "saludo": boolean,
  "fueraDeTema": boolean,
  "reply": ["mensaje corto"]
}

Reglas:
- "items" solo cuando el cliente quiere agregar, quitar o cambiar productos del pedido. Si solo pregunta precio o si hay algo, usa "consultaPrecios" con los SKU y deja "items" vacío.
- Usa únicamente SKU de la lista de productos de abajo. Nunca inventes un SKU. Si lo que pide no está en la lista: "sku": null y "mencionado" con sus palabras.
- Si el producto es ambiguo (ej. "leche" y hay varias), deja "sku": null y pon en "opciones" los SKU que calzan (máximo 5). Si hay una sola opción razonable, usa ese SKU directo.
- Si el cliente elige entre las "ultimasOpcionesOfrecidas" (ej. "la Soprole", "la primera"), devuelve ese SKU.
- "cantidad": número de unidades, o kilos si el producto se vende por kilo ("medio kilo" = 0.5, "un cuarto" = 0.25, "una docena" = 12, "una caja" = el número de "caja de N" del producto). null si no la dijo.
- "accion": "cambiar" cuando corrige una cantidad ("mejor que sean 3"), "quitar" cuando saca algo ("sácame la coca").
- "confirmar": "si" solo si "esperandoConfirmacion" es true y el cliente acepta (sí, dale, ya, confirmo, ok). "no" si lo rechaza o quiere cambiar algo.
- "consultaCategoria": cuando pregunta qué tienen de un tipo ("¿qué golosinas tienen?"). Categorías: ${categorias}.
- "fueraDeTema": true solo si el mensaje no tiene nada que ver con comprar en el minimarket.
- "reply": 1 mensaje corto, cálido, en español de Chile con tuteo ("tú tienes", "puedes", "escríbeme"). Nunca voseo ("vos", "tenés", "podés"). Nunca menciones precios, totales ni stock en "reply": esos los agrega el sistema. Solo úsalo para saludar o derivar si es fuera de tema.
- Máximo un emoji por mensaje.

Productos que calzan con este mensaje (SKU | producto | unidad):
${productos || '(ninguno calzó con la búsqueda)'}

Estado de la conversación: ${JSON.stringify(estado)}`;

  return systemPrompt;
}
