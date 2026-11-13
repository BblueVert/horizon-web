// Utilidades de texto y formato compartidas por el motor, el prompt y el puente.

export function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "fideos" → "fideo", "tomates" → "tomate". Suficiente para buscar en un catálogo chico.
export function raiz(palabra) {
  if (palabra.length > 4 && palabra.endsWith('es')) return palabra.slice(0, -2);
  if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1);
  return palabra;
}

export const dinero = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CL');

export function cantidadTexto(cantidad, unidad) {
  if (unidad === 'kg') {
    const kg = Number(cantidad);
    if (kg < 1) return `${Math.round(kg * 1000)} g`;
    return `${kg.toLocaleString('es-CL')} kg`;
  }
  return `${cantidad}`;
}

export function nombreProducto(p) {
  const repetida = p.marca && normalizar(p.nombre).includes(normalizar(p.marca));
  const marca = p.marca && !repetida && !['Granel', 'Del día'].includes(p.marca) ? ` ${p.marca}` : '';
  const formato = p.unidad === 'kg' ? '' : ` ${p.formato}`;
  return `${p.nombre}${marca}${formato}`.trim();
}

export function primerNombre(nombre) {
  return String(nombre || '').trim().split(/\s+/)[0] || '';
}
