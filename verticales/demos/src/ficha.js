// Ficha de negocio = todo lo que el agente demo sabe. Formato en FICHA.md.

export const RUBROS = ['restaurante', 'cafeteria', 'minimarket', 'botilleria', 'panaderia', 'peluqueria', 'barberia', 'estetica', 'clinica', 'kinesiologia', 'veterinaria', 'gimnasio', 'tienda', 'ferreteria', 'servicios', 'otro'];
export const FLUJOS = ['pedidos', 'reservas', 'consultas'];
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;

export function slugDe(texto) {
  return String(texto || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 41);
}

// Devuelve { errores, avisos }. Con errores no se publica; los avisos son para Benja.
export function validarFicha(f) {
  const errores = [];
  const avisos = [];
  if (!f || typeof f !== 'object' || Array.isArray(f)) return { errores: ['la ficha debe ser un objeto JSON'], avisos };

  if (!SLUG.test(String(f.slug || ''))) errores.push('slug inválido: minúsculas, números y guiones (ej. "tia-julia")');
  if (!String(f.nombre || '').trim()) errores.push('falta "nombre"');
  if (!RUBROS.includes(f.rubro)) errores.push(`"rubro" debe ser uno de: ${RUBROS.join(', ')}`);
  if (!FLUJOS.includes(f.flujo)) errores.push(`"flujo" debe ser: ${FLUJOS.join(' | ')}`);

  if (f.motor !== undefined && !SLUG.test(String(f.motor))) errores.push('"motor" debe ser un nombre como "mesa-cero" o "minimarket"');

  const catalogo = Array.isArray(f.catalogo) ? f.catalogo : [];
  let items = 0;
  let sinPrecio = 0;
  catalogo.forEach((c, i) => {
    if (!String(c?.categoria || '').trim()) errores.push(`catalogo[${i}] sin "categoria"`);
    (Array.isArray(c?.items) ? c.items : []).forEach((it, j) => {
      items++;
      if (!String(it?.nombre || '').trim()) errores.push(`catalogo[${i}].items[${j}] sin "nombre"`);
      if (it?.precio !== null && it?.precio !== undefined && !(Number.isFinite(it.precio) && it.precio >= 0)) {
        errores.push(`"${it?.nombre}": precio debe ser número en CLP o null`);
      }
      if (it?.precio === null || it?.precio === undefined) sinPrecio++;
    });
  });

  if (!items && !f.motor) avisos.push('catálogo vacío: el agente solo podrá responder consultas generales');
  if (sinPrecio) avisos.push(`${sinPrecio} de ${items} productos/servicios sin precio: el agente dirá que lo confirma el local`);
  if (!Array.isArray(f.locales) || !f.locales.length) avisos.push('sin locales/dirección');
  if (!f.horario && !(f.locales || []).some(l => l.horario)) avisos.push('sin horario');
  if (!f.motor && (!Array.isArray(f.fuentes) || !f.fuentes.length)) avisos.push('sin fuentes: anota de dónde salió la información');
  const tamano = JSON.stringify(f).length;
  if (tamano > 60_000) errores.push(`ficha muy grande (${Math.round(tamano / 1000)} KB, máx. 60 KB): resume el catálogo`);
  else if (tamano > 30_000) avisos.push(`ficha grande (${Math.round(tamano / 1000)} KB): cada mensaje cuesta más`);

  return { errores, avisos, items, sinPrecio };
}

export function linkDemo(numero, ficha) {
  const texto = `Hola! Quiero probar el asistente de ${ficha.nombre} (demo: ${ficha.slug})`;
  return `https://wa.me/${String(numero || '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
}

// Detecta el código que trae el link: "... (demo: tia-julia)" o "demo tia-julia".
export function codigoDemo(texto) {
  const m = String(texto || '').match(/\bdemo[:\s]+([a-z0-9][a-z0-9-]{1,40})\b/i);
  return m ? m[1].toLowerCase() : null;
}
