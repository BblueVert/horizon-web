'use strict';

// Documentos formales de un cliente de terreno, armados con su radiografía y sus datos.
//   GET /c/<portal_token>/propuesta  → Propuesta comercial
//   GET /c/<portal_token>/contrato   → Contrato de prestación de servicios + Anexo A
// (rewrite a /api/documentos?t=<token>&doc=<doc>). HTML imprimible: el cliente lo guarda en PDF desde el navegador.
// Texto del contrato: literal de .claude/skills/documentos-cliente/estructuras/contrato.md; solo cambian las variables.
// Datos privados del prestador (RUT, domicilio) vienen de variables de entorno, nunca del repo.

const { httpsRequest, rateLimit, getIp } = require('./shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Precios y alcance de terreno: misma fuente que shared/hz-radiografia.js y Pages/terreno/*.html.
const PACKS = {
  esencial: {
    nm: 'Pack Esencial', impl: 290000, palabras: 'doscientos noventa mil', mes: 99000, plazo: '2 a 3 semanas',
    soporte: 'mensual del Pack Esencial (agente IA y sistema)',
    incluye: [
      ['Web del negocio', 'Servicios, precios, ubicación, horarios y botón directo a WhatsApp, pensada para el celular.'],
      ['Google Business optimizado', 'Ficha completa y ordenada para aparecer en Maps y en búsquedas de la zona.'],
      ['Agente IA completo en WhatsApp', 'Entrenado con la información real del negocio. Responde 24/7, agenda la hora o toma el pedido y lo confirma.'],
      ['Panel de leads y agenda', 'Cada consulta registrada con su estado, las horas o pedidos del día y cuántas consultas no terminaron en reserva.'],
      ['Aviso al dueño', 'Si una conversación necesita a una persona, el agente avisa por WhatsApp con el resumen.'],
      ['Primer mes de mensualidad incluido', 'Soporte, ajustes del agente con las preguntas reales y corrección de errores.'],
    ],
    no: 'Seguimiento automático a quien no agendó, recordatorios el día antes, reactivación de clientes, CRM con historial y dashboard de métricas (Pack Pro). Campañas pagadas y producción de contenido para redes.',
  },
  pro: {
    nm: 'Pack Pro', impl: 490000, palabras: 'cuatrocientos noventa mil', mes: 149000, plazo: '3 a 4 semanas',
    soporte: 'mensual del Pack Pro (agente IA y sistema completo)',
    incluye: [
      ['Todo lo del Pack Esencial', 'Web, Google Business, agente IA completo en WhatsApp, panel de leads y agenda, y aviso al dueño.'],
      ['Seguimiento automático', 'A quien preguntó y no agendó, con mensajes que retoman su consulta al día siguiente y a los 3 días.'],
      ['Confirmación y recordatorio', 'Al agendar y el día antes, con opción de confirmar o cambiar la hora.'],
      ['Reactivación mensual', 'Mensaje a los clientes que no vuelven hace 30 a 60 días.'],
      ['CRM con historial de cada cliente', 'Qué pidió, cuándo vino y cuántas veces ha vuelto.'],
      ['Dashboard y reporte mensual', 'Consultas, horas agendadas, inasistencias y origen de cada cliente, con una revisión mensual de 15 minutos.'],
      ['Primer mes de mensualidad incluido', 'Soporte, ajustes del agente con las conversaciones reales y corrección de errores.'],
    ],
    no: 'Campañas pagadas, producción de contenido para redes e integraciones con sistemas contables. Se cotizan aparte si se necesitan.',
  },
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const clp = n => '$' + Math.round(n).toLocaleString('es-CL');
const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const falta = t => `<span class="pendiente">${h(t)}</span>`;

function pagina({ titulo, subtitulo, codigo, fecha, cuerpo }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${h(titulo)} — HORIZON</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#14121F;--ink2:#4B4862;--ink3:#8A87A3;--line:#E4E1EE;--soft:#F6F4FB;--h1:#FF6B35;--h4:#E8637A;--h6:#7B3FA0;--font-d:'Bebas Neue','Arial Narrow',sans-serif;--font-m:'DM Mono',ui-monospace,monospace;--font-b:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif}
@page{size:A4;margin:18mm 16mm 20mm}*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:10.5pt/1.55 var(--font-b)}
.doc{max-width:178mm;margin:0 auto;padding:8mm 0}
.bar{height:4px;border-radius:4px;background:linear-gradient(90deg,var(--h1),var(--h4),var(--h6))}
header{display:flex;justify-content:space-between;align-items:flex-end;padding:14px 0 18px;border-bottom:1px solid var(--line);margin-bottom:22px}
.brand{font:26pt/1 var(--font-d);letter-spacing:.06em}.meta{text-align:right;font:8.5pt/1.6 var(--font-m);color:var(--ink2)}
h1{font:30pt/1 var(--font-d);letter-spacing:.02em;margin:0 0 4px}.sub{color:var(--ink2);margin:0 0 22px}
h2{font:600 11.5pt/1.3 var(--font-b);margin:22px 0 8px;break-after:avoid}h2 .n{font-family:var(--font-m);color:var(--h1);margin-right:6px}
p{margin:0 0 8px;text-align:justify}ul,ol{margin:0 0 10px;padding-left:18px}li{margin-bottom:3px}
table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:9.5pt;break-inside:avoid}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 8pt/1.3 var(--font-m);text-transform:uppercase;letter-spacing:.06em;color:var(--ink2);background:var(--soft)}
td.monto{text-align:right;white-space:nowrap}tr.total td{font-weight:700;border-top:2px solid var(--ink)}
.box{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0 14px;break-inside:avoid}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:46px;break-inside:avoid}.firma{border-top:1px solid var(--ink);padding-top:8px;font-size:9pt}.firma strong{display:block}
.pendiente{background:#FFF1E8;color:#B4441A;padding:0 3px;border-radius:3px;font-family:var(--font-m);font-size:8.5pt}
.anexo{break-before:page}
footer{margin-top:30px;padding-top:10px;border-top:1px solid var(--line);font:8pt/1.5 var(--font-m);color:var(--ink3);display:flex;justify-content:space-between}
.acciones{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;padding:12px;background:#14121F}
.acciones button{font:700 14px var(--font-b);border:0;border-radius:12px;padding:12px 18px;cursor:pointer;background:linear-gradient(95deg,#F2690C,#CC3253 50%,#7B3FA0);color:#fff}
@media screen{body{background:#ECEAF3}.doc{background:#fff;padding:18mm 16mm;margin:24px auto;box-shadow:0 2px 24px rgba(20,18,31,.08)}}
@media screen and (max-width:640px){.doc{margin:0;padding:20px 16px}.firmas{grid-template-columns:1fr}}
@media print{.acciones{display:none}}
</style></head><body>
<div class="acciones"><button onclick="window.print()">Guardar en PDF o imprimir</button></div>
<div class="doc"><div class="bar"></div>
<header><div class="brand">HORIZON</div><div class="meta">${h(codigo)}<br>${h(fecha)} · Rancagua, Chile</div></header>
<h1>${h(titulo)}</h1><p class="sub">${h(subtitulo)}</p>
<main>${cuerpo}</main>
<footer><span>HORIZON · Sistemas de crecimiento digital</span><span>${h(codigo)}</span></footer></div>
</body></html>`;
}

function datos(lead) {
  const rx = (lead.hooks_respuestas && lead.hooks_respuestas.radiografia) || {};
  const k = rx.elegido === 'pro' || lead.plan === 'terreno-pro' ? 'pro' : 'esencial';
  const c = rx.contrato || {};
  const d = new Date();
  const slug = String(rx.negocio_slug || lead.empresa || 'cliente').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'cliente';
  return {
    rx, k, pk: PACKS[k], c, slug,
    negocio: lead.empresa || lead.nombre || 'el negocio',
    nombre: lead.nombre || '',
    fechaCorta: `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`,
    fechaLarga: `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`,
    anio: d.getFullYear(),
  };
}

function propuesta(lead) {
  const D = datos(lead), { pk, rx } = D;
  const lecturas = Array.isArray(rx.lecturas) && rx.lecturas.length ? rx.lecturas.slice(0, 3) : (rx.mejoras || []).slice(1, 4);
  const cuerpo = `
<h2><span class="n">1.</span>Lo que vimos</h2>
<div class="box">${lecturas.length ? '<ul>' + lecturas.map(x => `<li>${h(x)}</li>`).join('') + '</ul>' : '<p>Diagnóstico realizado en la visita al negocio.</p>'}
${rx.escape_mes ? `<p>Con las respuestas de la radiografía, estimamos que hoy se escapan cerca de <strong>${clp(rx.escape_mes)} al mes</strong>. Es una estimación a la baja, no una promesa.</p>` : ''}</div>
<h2><span class="n">2.</span>Lo que proponemos</h2>
<p>El <strong>${pk.nm}</strong>. ${D.k === 'pro' ? 'Además de atender y agendar, el sistema hace el seguimiento a quien no compró, recuerda las horas y trae de vuelta a los clientes.' : 'Un agente que atiende y agenda 24/7, con la web y el panel donde queda registrado cada contacto.'}</p>
<h2><span class="n">3.</span>Qué recibe</h2>
<table><tr><th>Entregable</th><th>Detalle</th></tr>${pk.incluye.map(([a, b]) => `<tr><td>${h(a)}</td><td>${h(b)}</td></tr>`).join('')}</table>
<h2><span class="n">4.</span>No incluye</h2><p>${h(pk.no)}</p>
<h2><span class="n">5.</span>Inversión</h2>
<table><tr><th>Concepto</th><th class="monto">Monto</th></tr>
<tr><td>Implementación ${h(pk.nm)} (pago único)</td><td class="monto">${clp(pk.impl)}</td></tr>
<tr><td>50% al firmar</td><td class="monto">${clp(pk.impl / 2)}</td></tr>
<tr><td>50% antes de la entrega final</td><td class="monto">${clp(pk.impl / 2)}</td></tr>
<tr class="total"><td>Mensualidad desde el mes 2</td><td class="monto">${clp(pk.mes)} / mes</td></tr></table>
<p>Valores brutos, con boleta de honorarios. El primer mes de mensualidad va incluido; después es mes a mes, sin permanencia.</p>
<h2><span class="n">6.</span>Plazo</h2><p>${pk.plazo} desde la reunión de inicio (kickoff), que se realiza una vez recibido el pago inicial.</p>
<h2><span class="n">7.</span>Forma de pago</h2><p>50% al firmar para reservar el inicio y 50% antes de la entrega final. Los pagos se hacen desde el portal del cliente.</p>
<h2><span class="n">8.</span>Próximos pasos</h2><ol><li>Aceptar esta propuesta.</li><li>Firmar el contrato y pagar el 50% de inicio.</li><li>Kickoff en 48 horas.</li></ol>
<p>Esta propuesta es válida por 15 días corridos desde su fecha.</p>
<div class="firmas" style="grid-template-columns:1fr"><div class="firma"><strong>Acepto la propuesta</strong>${h(D.nombre)} · ${h(D.negocio)}</div></div>`;
  return pagina({ titulo: 'Propuesta Comercial', subtitulo: `${pk.nm} para ${D.negocio}`, codigo: `HZ-${D.anio}-${D.slug}-PRO`, fecha: D.fechaCorta, cuerpo });
}

function contrato(lead) {
  const D = datos(lead), { pk, c } = D;
  const PREST = 'Benjamín Jesús Vera Yáñez';
  const pRut = process.env.PRESTADOR_RUT ? h(process.env.PRESTADOR_RUT) : falta('RUT del Prestador');
  const pDom = process.env.PRESTADOR_DOMICILIO ? h(process.env.PRESTADOR_DOMICILIO) : falta('domicilio del Prestador');
  const cRut = c.rut ? h(c.rut) : falta('RUT del Cliente');
  const cDom = c.direccion ? h(c.direccion) : falta('domicilio del Cliente');
  const cliente = c.razon_social
    ? `<strong>${h(c.razon_social)}</strong>, RUT ${cRut}, representada por ${h(D.nombre)}, con domicilio en ${cDom}`
    : `<strong>${h(D.nombre)}</strong>, RUT ${cRut}, con domicilio en ${cDom}`;
  const cl = (n, t, p) => `<h2><span class="n">${n}.</span>${t}</h2><p>${p}</p>`;
  const cuerpo = `
<p><strong>Comparecencia.</strong> En Rancagua, a ${D.fechaLarga}, comparecen: por una parte, <strong>${PREST}</strong>, RUT ${pRut}, con domicilio en ${pDom}, que opera bajo el nombre comercial HORIZON, en adelante "el Prestador"; y por la otra, ${cliente}, en adelante "el Cliente". Las partes acuerdan el siguiente contrato:</p>
${cl(1, 'Objeto', `El Prestador se obliga a diseñar, construir, configurar y entregar funcionando el ${pk.nm} para el negocio del Cliente, según el alcance detallado en el Anexo A, que forma parte integrante de este contrato.`)}
${cl(2, 'Alcance', 'Los servicios comprenden exclusivamente lo indicado en el Anexo A. Todo trabajo no incluido en él se considera adicional y se cotizará por separado antes de realizarse. Lo que el Anexo A señala como "No incluido" no forma parte de este contrato.')}
${cl(3, 'Plazo de implementación', `El plazo estimado es de ${pk.plazo} contadas desde la reunión de inicio (kickoff), que se realizará una vez recibido el pago inicial y los insumos indicados en la Orden de Inicio. Si el Cliente entrega insumos, accesos o aprobaciones fuera del plazo de 5 días hábiles, el plazo de entrega se extenderá en los mismos días de atraso.`)}
${cl(4, 'Precio y forma de pago', `El precio de la implementación es de <strong>${clp(pk.impl)} (${pk.palabras} pesos)</strong>, monto bruto, con boleta de honorarios. Se pagará de la siguiente forma: 50% al firmar este contrato para reservar el inicio y 50% antes de la entrega final. Los pagos se realizarán por transferencia bancaria a la cuenta que el Prestador indique por escrito. El Prestador emitirá boleta de honorarios por cada pago recibido.`)}
${cl(5, 'Soporte mensual', `El primer mes de soporte posterior a la entrega está incluido en el precio. Desde el segundo mes, el Cliente podrá contratar el soporte ${pk.soporte} por <strong>${clp(pk.mes)} mensuales</strong>, pagaderos al inicio del mes que cubren, entre el día 25 y el día 5 del mes siguiente. El soporte es mes a mes y sin permanencia: cualquiera de las partes puede ponerle término avisando por escrito con 15 días corridos de anticipación al siguiente período.`)}
${cl(6, 'Revisiones y aprobaciones', 'El diseño se presentará al Cliente para su aprobación antes de construirse. Se incluyen 2 rondas de cambios sobre el diseño. Las aprobaciones podrán darse por correo electrónico o WhatsApp y se entenderán definitivas. Los cambios posteriores a una aprobación o que excedan las rondas incluidas se cotizarán aparte.')}
${cl(7, 'Obligaciones del Cliente', 'El Cliente se obliga a: (a) entregar oportunamente la información, contenidos, imágenes y accesos necesarios; (b) designar una persona de contacto con facultades para aprobar; (c) pagar el precio en la forma convenida; y (d) garantizar que los contenidos que entrega no infringen derechos de terceros.')}
${cl(8, 'Servicios y costos de terceros', 'El dominio, el hosting y las cuentas en plataformas de terceros (Google, Meta, WhatsApp Business API, proveedores de inteligencia artificial u otros) quedarán a nombre del Cliente y sus costos serán de su cargo, salvo que el Anexo A indique otra cosa. La inversión en publicidad se paga directamente a la plataforma correspondiente. El Prestador no responde por cambios, caídas o políticas de dichas plataformas.')}
${cl(9, 'Propiedad y uso', 'Pagado íntegramente el precio, el Cliente será dueño del sitio, los contenidos y las configuraciones entregadas para su negocio. El Prestador conserva la propiedad de sus metodologías, plantillas, componentes y herramientas reutilizables, y otorga al Cliente una licencia de uso indefinida sobre aquellos incorporados en la entrega. El Prestador podrá mostrar el proyecto en su portafolio solo con autorización escrita del Cliente.')}
${cl(10, 'Confidencialidad y datos personales', 'Las partes mantendrán reserva sobre la información comercial de la otra a la que accedan con motivo de este contrato. El Prestador tratará los datos personales de clientes del Cliente solo para prestar los servicios contratados y conforme a la Ley N° 19.628 sobre protección de la vida privada y sus modificaciones.')}
${cl(11, 'Garantía', 'El Prestador corregirá sin costo los errores de funcionamiento atribuibles a su trabajo que se reporten dentro de los 30 días siguientes a la entrega.')}
${cl(12, 'Resultados', 'El Prestador se obliga a entregar los servicios descritos con diligencia profesional. Las ventas, el posicionamiento en buscadores o el rendimiento de campañas dependen también de factores ajenos al Prestador, por lo que no se garantizan resultados comerciales específicos.')}
${cl(13, 'Término anticipado', 'Si el Cliente pone término al contrato antes de la entrega, pagará el trabajo realizado a la fecha y el anticipo no se reembolsará. Cualquiera de las partes podrá terminarlo si la otra incumple gravemente sus obligaciones y no lo corrige dentro de 10 días desde que se le notifique por escrito.')}
${cl(14, 'Domicilio y firma', 'Para todos los efectos de este contrato, las partes fijan su domicilio en la ciudad de Rancagua y se someten a la competencia de sus tribunales. Este contrato podrá firmarse en papel, en dos ejemplares, o mediante firma electrónica simple conforme a la Ley N° 19.799, con igual valor.')}
<div class="firmas"><div class="firma"><strong>El Prestador</strong>${PREST}<br>RUT ${pRut}</div><div class="firma"><strong>El Cliente</strong>${h(c.razon_social || D.nombre)}${c.razon_social ? '<br>p.p. ' + h(D.nombre) : ''}<br>RUT ${cRut}</div></div>
<div class="anexo"><h2>Anexo A — Alcance del servicio</h2>
<p><strong>Plan contratado:</strong> ${pk.nm} · <strong>Plazo:</strong> ${pk.plazo} desde el kickoff.</p>
<table><tr><th>Incluye</th><th>Detalle</th></tr>${pk.incluye.map(([a, b]) => `<tr><td>${h(a)}</td><td>${h(b)}</td></tr>`).join('')}</table>
<p><strong>No incluido:</strong> ${h(pk.no)}</p>
<div class="firmas"><div class="firma">Prestador (iniciales)</div><div class="firma">Cliente (iniciales)</div></div></div>`;
  return pagina({ titulo: 'Contrato de Prestación de Servicios', subtitulo: `Implementación ${pk.nm} — ${D.negocio}`, codigo: `HZ-${D.anio}-${D.slug}-CON`, fecha: D.fechaCorta, cuerpo });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (rateLimit(getIp(req), 60_000, 30)) return res.status(429).send('Demasiadas solicitudes');
  const q = req.query || {};
  const token = String(q.t || q.token || ''), doc = String(q.doc || '');
  if (!UUID_RE.test(token) || !['propuesta', 'contrato'].includes(doc)) return res.status(404).send('Documento no encontrado');
  const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(503).send('Config incompleta');
  try {
    const r = await httpsRequest('GET', `${SB_URL}/rest/v1/leads?portal_token=eq.${token}&select=nombre,empresa,email,plan,hooks_respuestas&limit=1`,
      { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });
    const lead = r.status === 200 ? JSON.parse(r.body || '[]')[0] : null;
    if (!lead || !(lead.hooks_respuestas && lead.hooks_respuestas.radiografia)) return res.status(404).send('Documento no encontrado');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(doc === 'contrato' ? contrato(lead) : propuesta(lead));
  } catch (e) {
    return res.status(500).send('Error interno');
  }
};

module.exports.propuesta = propuesta;
module.exports.contrato = contrato;
