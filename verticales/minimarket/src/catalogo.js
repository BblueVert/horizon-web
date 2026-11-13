// Catálogo: expansión del JSON demo (tramos mayoristas) y búsqueda de candidatos
// para el prompt. A la IA no se le manda el catálogo entero (son ~180 productos):
// solo los que calzan con lo que escribió el cliente, más los que ya están en el carrito.

import { normalizar, raiz } from './texto.js';

const redondear10 = (n) => Math.floor(n / 10) * 10;

// Regla de tramos por defecto (documentada en el README):
// - por kilo: mayorista desde 5 kg con -8%.
// - por unidad con caja: mayorista desde la mitad de la caja (tope 12) con -6%; caja completa con -12%.
// - por unidad sin caja: mayorista desde 6 con -5%.
export function tramosPorDefecto(unidad, precio, caja) {
  if (unidad === 'kg') return [[5, redondear10(precio * 0.92), 'mayorista']];
  if (caja && caja >= 2) {
    const mitad = Math.min(12, Math.max(2, Math.ceil(caja / 2)));
    const tramos = [[mitad, redondear10(precio * 0.94), 'mayorista']];
    if (caja > mitad) tramos.push([caja, redondear10(precio * 0.88), 'caja']);
    return tramos;
  }
  return [[6, redondear10(precio * 0.95), 'mayorista']];
}

export function expandirCatalogo(json) {
  const categorias = json.categorias.map(([id, nombre, orden]) => ({ id, nombre, orden }));
  const productos = json.productos.map(([sku, categoria_id, nombre, marca, formato, unidad, precio_detalle, unidades_caja, alias]) => {
    const manual = json.escalasManuales?.[sku];
    const escalas = (manual || tramosPorDefecto(unidad, precio_detalle, unidades_caja))
      .map(([cantidad_min, precio_unitario, etiqueta]) => ({ cantidad_min, precio_unitario, etiqueta }));
    const stockDefecto = unidad === 'kg' ? 40 : Math.max(24, (unidades_caja || 8) * 3);
    return {
      sku, categoria_id, nombre, marca, formato, unidad, precio_detalle,
      unidades_caja: unidades_caja || null,
      alias: alias || [],
      stock: json.stockManual?.[sku] ?? stockDefecto,
      activo: true,
      escalas,
    };
  });
  return { negocio: json.negocio, categorias, productos };
}

export function indexarCatalogo({ categorias, productos }) {
  const activos = productos.filter(p => p.activo !== false);
  const porSku = new Map(activos.map(p => [p.sku, p]));
  const catNombre = new Map(categorias.map(c => [c.id, c.nombre]));
  const indice = activos.map(p => {
    const texto = normalizar([p.nombre, p.marca, p.formato, catNombre.get(p.categoria_id), ...(p.alias || [])].join(' '));
    return { p, palabras: new Set(texto.split(' ').map(raiz)), texto };
  });
  return { categorias, productos: activos, porSku, indice };
}

const VACIAS = new Set(['que', 'los', 'las', 'del', 'una', 'uno', 'unos', 'unas', 'por', 'para', 'con', 'sin', 'tien', 'tiene', 'tienen', 'hay', 'quiero', 'necesito', 'mand', 'manda', 'cuanto', 'cuant', 'esta', 'estan', 'vale', 'valen', 'precio', 'hola', 'buena', 'buen', 'dia', 'tarde', 'noche', 'gracia', 'tard', 'noch', 'porfa', 'favor', 'kilo', 'kg', 'litro', 'caja', 'mas', 'tambien', 'pedido', 'llevar', 'lleva', 'dame', 'me', 'mi']);

export function buscarCandidatos(catalogo, mensaje, skusCarrito = [], limite = 40) {
  const palabras = normalizar(mensaje).split(' ')
    .filter(w => w.length >= 3 && !/^\d+$/.test(w))
    .map(raiz)
    .filter(w => !VACIAS.has(w));
  const frase = normalizar(mensaje);

  const puntaje = new Map();
  for (const { p, palabras: pp, texto } of catalogo.indice) {
    let s = 0;
    for (const w of palabras) {
      if (pp.has(w)) s += 3;
      else if (w.length >= 4 && texto.includes(w)) s += 1;
    }
    for (const a of p.alias || []) if (a.includes(' ') && frase.includes(normalizar(a))) s += 4;
    if (s > 0) puntaje.set(p.sku, s);
  }

  const elegidos = [...puntaje.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite).map(([sku]) => sku);
  for (const sku of skusCarrito) if (!elegidos.includes(sku)) elegidos.push(sku);
  return elegidos.map(sku => catalogo.porSku.get(sku)).filter(Boolean);
}

export function productosDeCategoria(catalogo, categoriaId, limite = 15) {
  return catalogo.productos.filter(p => p.categoria_id === categoriaId).slice(0, limite);
}
