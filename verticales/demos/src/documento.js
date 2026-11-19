// Documento PDF de una demo (propuesta, cotización): se completa una plantilla con los datos
// que juntó el agente y se manda por WhatsApp al confirmar. El diseño vive en la plantilla
// (scripts/medir-plantilla.js la arma desde HTML y mide los espacios); aquí solo se escribe encima.

import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const FUENTES = { medio: 'AlbertSans-500.ttf', negrita: 'AlbertSans-700.ttf', serif: 'Gloock.ttf' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const hex = (h, d = '#231A1F') => {
  const m = String(h || d).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i) || d.slice(1).match(/(..)(..)(..)/);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
};

export function fechaLarga(fecha = new Date()) {
  const p = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(fecha);
  const v = (t) => Number(p.find(x => x.type === t)?.value);
  return `${v('day')} de ${MESES[v('month') - 1]} de ${v('year')}`;
}

// El documento se manda solo si la ficha lo tiene y la acción confirmada es de las que lo llevan.
export function llevaDocumento(ficha, accion) {
  return Boolean(ficha?.documento?.plantilla && accion && (ficha.documento.al || ['consulta']).includes(accion.tipo));
}

const esSi = (v) => v === true || /^(s[ií]|true|1|incluid[oa])$/i.test(String(v ?? '').trim());

// Texto que va en cada espacio: los datos del agente, la fecha de emisión y las marcas sí/no.
function valorDe(campo, datos, doc, fecha) {
  if (campo.clave === 'emision') return { texto: fechaLarga(fecha) };
  const v = datos?.[campo.clave];
  if (campo.marca || typeof v === 'boolean') {
    const marcas = { si: 'Incluido', no: '—', ...(doc.marcas || {}) };
    return esSi(v) ? { texto: marcas.si, si: true } : { texto: marcas.no, no: true };
  }
  if (v === null || v === undefined || String(v).trim() === '') return null;
  return { texto: String(v).replace(/\s+/g, ' ').trim() };
}

async function cargarPlantilla(ruta) {
  if (/^https?:\/\//.test(ruta)) {
    const r = await fetch(ruta, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`plantilla ${ruta} respondió ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  return readFile(isAbsolute(ruta) ? ruta : join(RAIZ, ruta));
}

// Devuelve { buffer, nombre } listo para mandar como documento de WhatsApp.
export async function generarDocumento(ficha, datos = {}, { fecha = new Date() } = {}) {
  const doc = ficha.documento;
  const pdf = await PDFDocument.load(await cargarPlantilla(doc.plantilla));
  pdf.registerFontkit(fontkit);
  const fuentes = {};
  const fuente = async (nombre) => {
    const archivo = FUENTES[nombre] || FUENTES.medio;
    fuentes[archivo] ||= await pdf.embedFont(await readFile(join(RAIZ, 'plantillas', 'fuentes', archivo)), { subset: true });
    return fuentes[archivo];
  };
  const paginas = pdf.getPages();

  for (const campo of doc.campos || []) {
    const valor = valorDe(campo, datos, doc, fecha);
    const pagina = paginas[campo.pagina];
    if (!valor || !pagina) continue;
    const f = await fuente(valor.si ? 'negrita' : campo.fuente);
    // Si no cabe, se achica hasta 7 pt y, en último caso, se corta con "…".
    let tam = campo.tam || (campo.alinear === 'centro' ? 9.5 : 11);
    let texto = valor.texto;
    while (tam > 7 && f.widthOfTextAtSize(texto, tam) > campo.ancho) tam -= 0.5;
    while (texto.length > 1 && f.widthOfTextAtSize(texto, tam) > campo.ancho) texto = texto.slice(0, -2) + '…';
    const w = f.widthOfTextAtSize(texto, tam);
    const x = campo.alinear === 'centro' ? campo.x + (campo.ancho - w) / 2 : campo.alinear === 'derecha' ? campo.x + campo.ancho - w : campo.x;
    const color = valor.si ? (doc.colorSi || '#24382E') : valor.no ? '#B3A9AD' : (campo.color || doc.color || '#231A1F');
    pagina.drawText(texto, { x, y: campo.y, size: tam, font: f, color: hex(color) });
  }

  pdf.setTitle(`${doc.titulo || 'Propuesta'} · ${ficha.nombre}`);
  pdf.setAuthor(ficha.nombre);
  const buffer = Buffer.from(await pdf.save());
  const nombre = (doc.archivo || `${doc.titulo || 'Propuesta'} ${ficha.nombre}.pdf`)
    .replace(/\{(\w+)\}/g, (_, k) => String(datos?.[k] ?? '').trim())
    .replace(/[\\/:*?"<>|]+/g, '').replace(/\s+-\s*\.pdf$/, '.pdf').replace(/\s+/g, ' ').trim();
  return { buffer, nombre: nombre.endsWith('.pdf') ? nombre : `${nombre}.pdf` };
}

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

// Datos del PDF, de menos a más confiable:
// 1. Reglas de la ficha (documento.extraer) sobre lo que escribió el cliente: así el resumen del
//    cotizador de una web llega al PDF aunque la IA no lo repita.
// 2. Lo que mandó la IA suelto en accion.datos con el nombre de un campo.
// 3. Lo que mandó la IA en accion.datos.documento (lo pedido en el prompt).
// Al final, documento.alias rellena lo que siga vacío con otro dato de la IA (ej. novios ← cliente).
export function datosDocumento(ficha, accion, mensajesCliente = []) {
  const doc = ficha.documento || {};
  const out = {};
  const texto = mensajesCliente.join('\n');
  for (const [clave, reglas] of Object.entries(doc.extraer || {})) {
    for (const regla of [].concat(reglas)) {
      let m;
      try { m = texto.match(new RegExp(regla.re, 'iu')); } catch { continue; }
      if (!m) continue;
      out[clave] = regla.valor === undefined ? (m[1] ?? m[0]).trim()
        : typeof regla.valor === 'string' ? regla.valor.replace(/\$(\d)/g, (_, n) => (m[n] ?? '').trim()) : regla.valor;
      break;
    }
  }
  const d = accion?.datos && typeof accion.datos === 'object' ? accion.datos : {};
  const claves = new Set([...Object.keys(doc.datos || {}), ...(doc.campos || []).map(c => c.clave)]);
  for (const k of claves) if (!vacio(d[k])) out[k] = d[k];
  if (d.documento && typeof d.documento === 'object') {
    for (const [k, v] of Object.entries(d.documento)) if (!vacio(v)) out[k] = v;
  }
  for (const [k, alias] of Object.entries(doc.alias || {})) {
    if (!vacio(out[k])) continue;
    const v = [].concat(alias).map(a => d[a]).find(x => !vacio(x));
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Instrucciones para el agente: qué datos poner en accion.datos.documento.
export function promptDocumento(ficha) {
  const doc = ficha.documento;
  if (!doc?.plantilla || !doc.datos) return null;
  const lineas = Object.entries(doc.datos).map(([k, d]) => `  - "${k}": ${d}`);
  return `Documento: al confirmar (${(doc.al || ['consulta']).join(' o ')}), el sistema le manda al cliente ${doc.titulo ? `la ${doc.titulo.toLowerCase()}` : 'una propuesta'} en PDF con sus datos; los valores en pesos los completa el negocio después. Avísale con naturalidad que se la mandas por aquí, sin prometer precios.
Antes del resumen consigue los datos de texto que falten (uno por mensaje). En "accion.datos" agrega "documento" con estas claves (texto corto, como lo diría el cliente; true/false donde se indica):
${lineas.join('\n')}`;
}
