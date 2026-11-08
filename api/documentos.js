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
    color: /^#[0-9a-f]{6}$/i.test(String(rx.color || '')) ? rx.color : '#F2690C',
  };
}


// ── Diseño: diagramación del pack de plantillas (acuerdo y propuesta) con la identidad HORIZON.
// Logo oficial solo sobre fondo oscuro (manual de marca). Co-branding: color del negocio en acentos.
const LOGO = '/Identidad/Logo%20HORIZON.svg';
const CONTACTO = { correo: 'soportebinks@gmail.com', whatsapp: '+56 9 7696 2659', web: 'horizonweb.cl' };

const BASE_CSS = `
:root{--bg:#FFFBF6;--bg2:#FFF4EA;--surface:#fff;--ink:#1A1626;--ink2:#5F5970;--ink3:#9C96AB;--line:#EDE3D8;--line2:#E2D5C7;--acc:#F2690C;
--deep:radial-gradient(120% 90% at 100% 100%,rgba(242,105,12,.55),transparent 55%),linear-gradient(155deg,#1E1744 0%,#34276E 30%,#5A2F8C 58%,#9A3A84 82%,#C4467A 100%);
--grad:linear-gradient(95deg,#F2690C 0%,#C4467A 55%,#7B3FA0 100%);--f:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif;--m:'DM Mono',ui-monospace,monospace}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0}body{background:#E9E4DD;color:var(--ink);font:400 10pt/1.6 var(--f)}
.lbl{font:500 7.5pt/1.3 var(--m);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.acc{color:var(--acc);font-weight:700}
.chipc{display:inline-flex;align-items:center;gap:8px}.chipc i{width:10px;height:10px;border-radius:50%;background:var(--cli);display:inline-block}
.acciones{position:sticky;top:0;z-index:50;display:flex;gap:10px;justify-content:center;padding:12px;background:#1A1626}
.acciones button{font:700 14px var(--f);border:0;border-radius:12px;padding:12px 18px;cursor:pointer;background:linear-gradient(95deg,#F2690C,#CC3253 50%,#7B3FA0);color:#fff}
@media print{.acciones{display:none}body{background:#fff}}`;

function shell({ titulo, cuerpo, css, color }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow"><title>${h(titulo)} — HORIZON</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${BASE_CSS}:root{--cli:${color}}${css}</style></head><body>
<div class="acciones"><button onclick="window.print()">Guardar en PDF o imprimir</button></div>
${cuerpo}</body></html>`;
}

// ── Propuesta: diapositivas 16:9 (en pantalla se apilan; en el celular se adaptan a una columna).
const PROP_CSS = `
@page{size:338.7mm 190.5mm;margin:0}
.slide{position:relative;width:min(100%,1180px);aspect-ratio:16/9;margin:22px auto;background:var(--bg);overflow:hidden;box-shadow:0 2px 24px rgba(26,22,38,.08);display:grid;break-after:page;font-size:clamp(9px,1.05vw,12.5px)}
.slide .pad{padding:5.2% 6%}
.num{position:absolute;left:3.2%;bottom:4%;font:500 .8em var(--m);color:var(--ink3)}
.side{position:absolute;left:2.2%;top:6%;writing-mode:vertical-rl;transform:rotate(180deg);font:500 .72em var(--m);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
h1,h2,h3{margin:0;font-weight:300;letter-spacing:-.02em;line-height:1.05}
.dark{background:var(--deep);color:#fff}.dark .lbl,.dark .num{color:#E4DDF5}
.logo{height:2.2em;width:auto;display:block}
/* 1 portada */
.s-cover{grid-template-rows:auto 1fr auto}
.s-cover .top{display:flex;justify-content:space-between;align-items:flex-start}
.s-cover h1{font-size:5.4em;align-self:end}.s-cover h1 b{font-weight:700;display:block}
.s-cover .bot{display:flex;justify-content:space-between;gap:20px;border-top:1px solid rgba(255,255,255,.35);padding-top:1.2em;margin-top:2em;font-size:.95em}
/* 2 hola */
.s-hola{grid-template-columns:1.05fr .95fr}
.s-hola h2{font-size:3.4em;margin:1.4em 0 .8em}.s-hola p{max-width:34em;color:var(--ink2);font-size:1.05em}
.cli{background:var(--cli);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:6%}
.cli .big{font-size:3.2em;font-weight:300;line-height:1.05}.cli .x{font:500 .85em var(--m);letter-spacing:.14em;text-transform:uppercase;opacity:.85}
/* 3 lo que vimos */
.s-vimos{grid-template-columns:.8fr 1.2fr}
.s-vimos .lft{padding:6% 6% 6% 8%;display:flex;flex-direction:column;justify-content:space-between}
.s-vimos .lft h2{font-size:3.2em}.s-vimos .lft .big{font-size:3.6em;font-weight:700;letter-spacing:-.03em}
.rows{padding:6% 6% 6% 0;align-self:center}
.row{display:grid;grid-template-columns:3.2em 1fr;gap:1em;padding:1.1em 0;border-top:1px solid var(--line2)}.row:last-child{border-bottom:1px solid var(--line2)}
.row .n{font:500 .9em var(--m);color:var(--acc)}.row p{margin:0;font-size:1.05em}
/* 4 sistema */
.s-sis h2{font-size:3em;margin-bottom:.4em}
.flow{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:.8em;margin-top:2.2em}
.st{border-top:2px solid var(--ink);padding-top:.9em}.st.pro{border-color:var(--cli)}
.st .n{font:500 .85em var(--m);color:var(--ink3)}.st b{display:block;font-size:1.15em;margin:.3em 0 .4em;font-weight:600}.st p{margin:0;color:var(--ink2);font-size:.92em}
.st .t{display:inline-block;margin-top:.7em;font:500 .7em var(--m);letter-spacing:.08em;text-transform:uppercase;padding:.25em .6em;border-radius:99px;background:var(--bg2);color:var(--ink2)}
.st.pro .t{background:var(--cli);color:#fff}
/* 5 propuesta */
.s-prop{grid-template-columns:.32fr 1fr}
.s-prop .lab{background:var(--bg2);padding:6% 10%;display:grid;grid-template-rows:auto 1fr auto auto;gap:1em}
.s-prop .lab h2{font-size:2.2em}.s-prop .lab .lbl{padding-top:.8em;border-top:1px solid var(--line2)}
.s-prop .body{padding:5% 6%;display:grid;grid-template-rows:auto auto 1fr auto;gap:1.2em}
.tag{justify-self:start;font:500 .8em var(--m);letter-spacing:.1em;text-transform:uppercase;padding:.45em .9em;border-radius:99px;background:var(--ink);color:#fff}
.obj{font-size:1.15em;border-bottom:1px solid var(--line2);padding-bottom:1em;margin:0}
.ent{columns:2;column-gap:2.4em;margin:0;padding:0;list-style:none}.ent li{break-inside:avoid;margin:0 0 .75em;padding-left:1.1em;position:relative}
.ent li::before{content:'';position:absolute;left:0;top:.55em;width:.45em;height:.45em;border-radius:50%;background:var(--cli)}.ent b{display:block;font-weight:600}.ent span{color:var(--ink2);font-size:.92em}
.inv{display:grid;grid-template-columns:1fr 1.4fr 1.4fr;border-top:1px solid var(--ink);padding-top:1em;gap:1.5em}
.inv b{display:block;font-size:1.5em;font-weight:700;letter-spacing:-.02em}.inv .acc2{color:var(--acc)}
/* 6 a tener en cuenta */
.s-cuenta h2{font-size:3em}.s-cuenta .head{display:flex;justify-content:space-between;align-items:flex-start;gap:2em}
.s-cuenta .fecha{border-left:1px solid var(--line2);padding-left:1.4em;max-width:20em;font-size:.95em}
.cols4{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line2);margin-top:auto}
.cols4 div{padding:1.2em 1.4em 0 0}.cols4 div+div{border-left:1px solid var(--line2);padding-left:1.4em}.cols4 p{margin:.5em 0 0;font-size:.95em}
.s-cuenta .pad{display:flex;flex-direction:column;height:100%}
/* 7 proceso */
.s-proc{background:var(--bg2)}.s-proc h2{font-size:3em;margin-bottom:1em}
.proc{border-top:1px solid var(--ink)}.prow{display:grid;grid-template-columns:4em 1fr 1fr 1.6fr;gap:1.4em;padding:1em 0;border-bottom:1px solid var(--line2);align-items:start}
.prow .n{font-size:1.6em;font-weight:300}.prow b{font-weight:600}.prow p{margin:0;color:var(--ink2)}
/* 8 casos */
.s-casos{grid-template-columns:1fr 1fr}.s-casos h2{font-size:3em;margin-bottom:1.2em}
.caso{border-top:1px solid var(--line2);padding:1.2em 0}.caso b{font-size:1.3em;font-weight:600;display:block}.caso p{margin:.3em 0 0;color:var(--ink2)}
.s-casos .q{background:var(--ink);color:#fff;padding:8%;display:flex;flex-direction:column;justify-content:flex-end}.s-casos .q p{font-size:2.2em;font-weight:300;line-height:1.15;margin:0}
/* 9 cierre */
.s-fin{grid-template-columns:1fr 1fr}
.s-fin .l{padding:7%;display:flex;flex-direction:column;justify-content:space-between}
.s-fin h2{font-size:3.6em}
.s-fin .r{background:var(--bg);color:var(--ink);padding:7%;display:flex;flex-direction:column;justify-content:space-between}
.pasos{list-style:none;padding:0;margin:0;counter-reset:p}.pasos li{counter-increment:p;display:grid;grid-template-columns:2.4em 1fr;padding:.8em 0;border-top:1px solid var(--line2)}
.pasos li::before{content:'0' counter(p);font:500 .9em var(--m);color:var(--acc)}
.kv{display:grid;grid-template-columns:auto 1fr;gap:.5em 1.4em;border-top:1px solid rgba(255,255,255,.35);padding-top:1em}.kv span:nth-child(odd){font:500 .75em var(--m);letter-spacing:.12em;text-transform:uppercase;color:#E4DDF5;padding-top:.25em}
.firmaok{border-top:1px solid var(--ink);padding-top:.6em;margin-top:2.4em;font-size:.9em}
@media screen and (max-width:760px){
 .slide{aspect-ratio:auto;width:auto;margin:0 0 10px;font-size:13px;grid-template-columns:1fr!important}
 .slide .pad,.s-vimos .lft,.rows,.s-prop .lab,.s-prop .body,.s-fin .l,.s-fin .r,.cli,.s-casos .q{padding:28px 20px}
 .s-cover{min-height:88vh}.s-cover h1{font-size:2.8em}.flow{grid-template-columns:1fr 1fr}.cols4{grid-template-columns:1fr 1fr}.cols4 div+div{border-left:0;padding-left:0}
 .ent{columns:1}.inv{grid-template-columns:1fr}.prow{grid-template-columns:2.4em 1fr}.prow p{grid-column:2}.side,.num{display:none}.s-cuenta .head{flex-direction:column}}
@media print{.slide{margin:0;width:338.7mm;height:190.5mm;aspect-ratio:auto;box-shadow:none;font-size:12.5px}}`;

function propuesta(lead) {
  const D = datos(lead), { pk, rx, k } = D;
  const lecturas = Array.isArray(rx.lecturas) && rx.lecturas.length ? rx.lecturas.slice(0, 4) : (rx.mejoras || []).slice(1, 5);
  const pasos = [
    ['Le encuentran', 'Web y ficha de Google al día, con botón directo a WhatsApp.'],
    ['Le escriben', 'Una sola puerta de entrada: su WhatsApp.'],
    ['El agente atiende', 'Responde 24/7, agenda la hora o toma el pedido y lo confirma.'],
    ['Queda en su panel', 'Cada consulta, hora y pedido, con su estado.'],
  ];
  if (k === 'pro') pasos.push(['Seguimiento', 'A quien preguntó y no agendó, al día siguiente y a los 3 días.'], ['Recordatorio', 'El día antes de cada hora o encargo.'], ['Vuelven', 'Mensaje mensual a quienes no vuelven hace 30 a 60 días.']);
  const n = '<span class="side">Propuesta · ' + h(D.negocio) + '</span>';
  const slides = [
    `<section class="slide dark s-cover"><div class="pad" style="display:grid;grid-template-rows:auto 1fr auto;height:100%">
      <div class="top"><img class="logo" src="${LOGO}" alt="HORIZON"><span class="lbl">Propuesta válida por 15 días</span></div>
      <h1>Propuesta para<b>${h(D.negocio)}</b></h1>
      <div class="bot"><span>${h(D.fechaCorta)}</span><span class="chipc"><i></i>HORIZON × ${h(D.negocio)}</span><span>${h(pk.nm)}</span></div></div></section>`,
    `<section class="slide s-hola">${n}<div class="pad"><span class="lbl">Rancagua · ${h(D.fechaLarga)}</span>
      <h2>¡Hola, ${h(D.nombre.split(' ')[0] || 'equipo')}!</h2>
      <p>Gracias por recibirnos en ${h(D.negocio)} y por mostrarnos cómo funciona su negocio por dentro.</p>
      <p>Lo que sigue no es una propuesta genérica: está armada con lo que vimos en la visita y con sus propias respuestas a la radiografía. El objetivo es simple: que ningún cliente que le escriba se pierda, y que cada consulta tenga la oportunidad de convertirse en venta.</p></div>
      <div class="cli"><span class="x">HORIZON ×</span><span class="big">${h(D.negocio)}</span><span class="x">Sistema digital con agente IA</span></div><span class="num">02</span></section>`,
    `<section class="slide s-vimos">${n}<div class="lft"><div><span class="lbl">Diagnóstico</span><h2 style="margin-top:.4em">Lo que vimos</h2></div>
      ${rx.escape_mes ? `<div><span class="lbl">Se escapa hoy, aprox.</span><div class="big acc">${clp(rx.escape_mes)}<span style="font-size:.35em;font-weight:500;color:var(--ink2)"> / mes</span></div><p style="color:var(--ink3);font-size:.85em;margin:.4em 0 0">Estimación a la baja con sus respuestas. No es una promesa.</p></div>` : ''}</div>
      <div class="rows">${lecturas.map((x, i) => `<div class="row"><span class="n">0${i + 1} /</span><p>${h(x)}</p></div>`).join('')}</div><span class="num">03</span></section>`,
    `<section class="slide s-sis">${n}<div class="pad"><span class="lbl">Cómo funciona</span><h2 style="margin-top:.4em">Su sistema, de la búsqueda a la venta</h2>
      <p style="color:var(--ink2);max-width:46em;margin:0">Cada pieza le pasa la información a la siguiente. Nada queda suelto en el chat ni en el cuaderno.</p>
      <div class="flow" style="--n:${pasos.length}">${pasos.map((p, i) => `<div class="st${i > 3 ? ' pro' : ''}"><span class="n">0${i + 1}</span><b>${h(p[0])}</b><p>${h(p[1])}</p><span class="t">${i > 3 ? 'Pro' : 'Incluido'}</span></div>`).join('')}</div></div><span class="num">04</span></section>`,
    `<section class="slide s-prop"><div class="lab"><h2>Propuesta</h2><span></span><span class="lbl">+ Duración aprox.</span><span class="lbl">+ Inversión</span></div>
      <div class="body"><span class="tag">${h(pk.nm)}</span>
      <p class="obj">${k === 'pro' ? 'Un agente que atiende y agenda 24/7, y un sistema que sigue trabajando después de la conversación: hace seguimiento, recuerda las horas y trae de vuelta a los clientes.' : 'Un agente que atiende y agenda 24/7, con la web y el panel donde queda registrado cada contacto. Ninguna consulta sin respuesta.'}</p>
      <ul class="ent">${pk.incluye.map(([a, b]) => `<li><b>${h(a)}</b><span>${h(b)}</span></li>`).join('')}</ul>
      <div class="inv"><div><span class="lbl">Duración</span><b>${h(pk.plazo)}</b></div><div><span class="lbl">Implementación · pago único</span><b class="acc2">${clp(pk.impl)}</b><span style="color:var(--ink2);font-size:.9em">50% al firmar · 50% antes de la entrega</span></div><div><span class="lbl">Mensualidad desde el mes 2</span><b>${clp(pk.mes)} / mes</b><span style="color:var(--ink2);font-size:.9em">Mes a mes, sin permanencia</span></div></div></div></section>`,
    `<section class="slide s-cuenta">${n}<div class="pad"><div class="head"><div><h2>A tener en cuenta</h2><p class="lbl" style="margin-top:.8em">Modalidad de pago y forma de trabajo</p></div>
      <div class="fecha"><span class="lbl">Inicio aproximado</span><p style="margin:.4em 0 0">Kickoff dentro de 48 horas desde el pago inicial.</p><p style="margin:.4em 0 0;color:var(--ink3);font-size:.85em">Los valores son brutos, con boleta de honorarios.</p></div></div>
      <div class="cols4"><div><span class="lbl">Método de pago</span><p><b>50%</b> al firmar para reservar el inicio y <b>50%</b> antes de la entrega final, desde su portal de cliente.</p></div>
      <div><span class="lbl">Revisiones</span><p>Se incluyen <b class="acc">2 rondas de cambios</b> sobre el diseño antes de construir.</p></div>
      <div><span class="lbl">Respuestas</span><p>Usted tiene <b class="acc">5 días hábiles</b> para entregar insumos o aprobar. Si se atrasa, la entrega se corre en los mismos días.</p></div>
      <div><span class="lbl">Entrega y soporte</span><p>Primer mes de mensualidad incluido y <b>30 días</b> de garantía. Después, ${clp(pk.mes)} al mes, sin permanencia.</p></div></div></div><span class="num">06</span></section>`,
    `<section class="slide s-proc">${n}<div class="pad"><h2>Nuestro proceso</h2><div class="proc">
      ${[['01', 'Diagnóstico', '/ Hoy, en su local', 'Vimos su negocio, probó su agente y respondió la radiografía. De ahí sale esta propuesta.'],
         ['02', 'Kickoff', '/ 48 horas', 'Reunimos su información, fotos, precios y accesos. Usted ve el plan en su portal.'],
         ['03', 'Construcción', '/ ' + pk.plazo, 'Armamos la web, entrenamos su agente y conectamos el panel. Usted aprueba el diseño antes de construir.'],
         ['04', 'Entrega y soporte', '/ Mes a mes', 'Lo dejamos funcionando y lo ajustamos cada mes con sus conversaciones reales.']]
        .map(r => `<div class="prow"><span class="n">${r[0]}.</span><b>${h(r[1])}</b><span class="lbl" style="padding-top:.3em">${h(r[2])}</span><p>${h(r[3])}</p></div>`).join('')}
      </div></div><span class="num">07</span></section>`,
    `<section class="slide s-casos">${n}<div class="pad"><h2>Casos reales</h2>
      <div class="caso"><span class="lbl">Kinesiología · Rancagua · vitalkine.com</span><b>VitalKine</b><p>Sitio a medida con reservas propias y SEO local para kinesiología a domicilio.</p></div>
      <div class="caso"><span class="lbl">E-commerce · floremane.cl</span><b>Floremané</b><p>Identidad, packaging y tienda online editorial de carteras de cuero importadas de Italia.</p></div></div>
      <div class="q"><span class="lbl" style="color:#B9B3CC;margin-bottom:1.4em">HORIZON · Rancagua</span><p>Sistemas que atienden, ordenan y venden mientras usted trabaja.</p></div><span class="num">08</span></section>`,
    `<section class="slide s-fin"><div class="l dark"><img class="logo" src="${LOGO}" alt="HORIZON"><h2>Está a un paso de que su negocio atienda solo.</h2>
      <div class="kv"><span>Correo</span><span>${CONTACTO.correo}</span><span>WhatsApp</span><span>${CONTACTO.whatsapp}</span><span>Web</span><span>${CONTACTO.web}</span></div></div>
      <div class="r"><div><span class="lbl">Próximos pasos</span><ol class="pasos" style="margin-top:1em"><li>Aceptar esta propuesta.</li><li>Firmar el contrato y pagar el 50% de inicio desde su portal.</li><li>Kickoff en 48 horas.</li></ol></div>
      <div class="firmaok"><b>Acepto la propuesta</b><br>${h(D.nombre)} · ${h(D.negocio)}<br><span class="lbl">Código ${h(`HZ-${D.anio}-${D.slug}-PRO`)}</span></div></div></section>`,
  ];
  return shell({ titulo: 'Propuesta · ' + D.negocio, cuerpo: slides.join('\n'), css: PROP_CSS, color: D.color });
}

// ── Contrato: carta vertical. Portada oscura con el logo; páginas interiores con banda oscura (logo) y pie.
const CON_CSS = `
@page{size:letter;margin:0}
.pg{position:relative;width:min(100%,816px);min-height:1056px;margin:22px auto;background:#fff;box-shadow:0 2px 24px rgba(26,22,38,.08);display:flex;flex-direction:column;break-after:page}
.band{background:var(--ink);color:#B9B3CC;display:flex;justify-content:space-between;align-items:center;padding:18px 56px;font:500 8pt var(--m);letter-spacing:.1em;text-transform:uppercase}
.band img{height:18px}
.in{padding:34px 56px 30px;flex:1}
.foot{display:flex;justify-content:space-between;padding:14px 56px 22px;border-top:1px solid var(--line);font:500 7.5pt var(--m);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.foot b{color:var(--ink2);font-weight:500}
/* portada */
.cover{background:var(--deep);color:#fff;padding:56px;justify-content:space-between}
.cover .top{display:flex;justify-content:space-between;align-items:flex-start;font:500 8pt/1.5 var(--m);letter-spacing:.12em;text-transform:uppercase;color:#E4DDF5}
.cover img{height:30px}
.cover h1{font:300 46pt/1 var(--f);letter-spacing:-.03em;margin:0}.cover h1 b{font-weight:700;display:block}
.cover .sub{margin:14px 0 0;color:#E4DDF5;font-size:12pt}
.parties{border-top:1px solid rgba(255,255,255,.4)}
.party{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.4);font-size:10pt}
.party span:first-child{font:500 8pt var(--m);letter-spacing:.14em;text-transform:uppercase;color:#E4DDF5;padding-top:2px}
.party span:last-child{text-align:right;font-weight:600}
/* interior */
h2.sec{font:500 8.5pt var(--m);letter-spacing:.14em;text-transform:uppercase;margin:6px 0 14px;padding-bottom:6px;border-bottom:1px solid var(--ink);display:inline-block}
.in p{margin:0 0 12px;text-align:justify;line-height:1.65}
.cl b.t{font-weight:700}.cl .nn{color:var(--acc);font:500 9pt var(--m);margin-right:2px}
.boxes{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;margin:4px 0 16px}
.box{border:1px solid var(--line2);border-radius:10px;padding:10px 14px}.box .lbl{display:block;margin-bottom:4px}.box b{font-size:11pt}
.ents{border:1px solid var(--line2);border-radius:10px;padding:12px 16px 4px;margin:0 0 18px;columns:2;column-gap:28px;list-style:none}
.ents li{break-inside:avoid;margin:0 0 8px;padding-left:14px;position:relative;font-size:9.5pt}.ents li::before{content:'—';position:absolute;left:0;color:var(--ink3)}
.firm{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px}
.firm h3{font:600 9pt var(--m);letter-spacing:.12em;text-transform:uppercase;margin:0 0 10px;border-bottom:1px solid var(--ink);padding-bottom:6px}
.fld{display:block;margin-bottom:12px}.fld .lbl{display:block;margin-bottom:4px}.fld div{border:1px solid var(--line2);border-radius:8px;min-height:34px;padding:8px 10px;font-size:9.5pt}.fld div.sig{min-height:70px}
.const{margin-top:18px;border:1px solid var(--line2);border-radius:8px;padding:10px 12px;font-size:9pt;color:var(--ink2)}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:6px 0 14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 7.5pt var(--m);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);background:var(--bg2)}
.pend{background:#FFF1E8;color:#B4441A;padding:0 4px;border-radius:3px;font:500 8.5pt var(--m)}
@media screen and (max-width:760px){.pg{margin:0 0 10px;min-height:auto}.band,.in,.foot{padding-left:20px;padding-right:20px}.cover{padding:28px 20px;min-height:90vh}.cover h1{font-size:32pt}.boxes,.firm{grid-template-columns:1fr}.ents{columns:1}}
@media print{.pg{margin:0;width:8.5in;height:11in;min-height:0;box-shadow:none;overflow:hidden}}`;

function contrato(lead) {
  const D = datos(lead), { pk, c } = D;
  const PREST = 'Benjamín Jesús Vera Yáñez';
  const pend = t => `<span class="pend">${h(t)}</span>`;
  const pRut = process.env.PRESTADOR_RUT ? h(process.env.PRESTADOR_RUT) : pend('RUT del Prestador');
  const pDom = process.env.PRESTADOR_DOMICILIO ? h(process.env.PRESTADOR_DOMICILIO) : pend('domicilio del Prestador');
  const cRut = c.rut ? h(c.rut) : pend('RUT del Cliente');
  const cDom = c.direccion ? h(c.direccion) : pend('domicilio del Cliente');
  const clienteNom = c.razon_social || D.nombre;
  const cliente = c.razon_social
    ? `<strong>${h(c.razon_social)}</strong>, RUT ${cRut}, representada por ${h(D.nombre)}, con domicilio en ${cDom}`
    : `<strong>${h(D.nombre)}</strong>, RUT ${cRut}, con domicilio en ${cDom}`;
  const codigo = `HZ-${D.anio}-${D.slug}-CON`;
  const band = `<div class="band"><img src="${LOGO}" alt="HORIZON"><span>${h(codigo)}</span></div>`;
  const foot = n => `<div class="foot"><span>/ Contrato de prestación de servicios</span><span><b>HORIZON × ${h(D.negocio)}</b> · ${n}</span></div>`;
  const cl = (n, t, p) => `<p class="cl"><span class="nn">${String(n).padStart(2, '0')} |</span> <b class="t">${t.toUpperCase()}:</b> ${p}</p>`;

  const portada = `<section class="pg cover">
    <div class="top"><img src="${LOGO}" alt="HORIZON"><span style="text-align:right">Sistemas de crecimiento digital<br>${CONTACTO.web}</span></div>
    <div><h1>Contrato de<b>prestación de servicios</b></h1><p class="sub">Implementación ${h(pk.nm)} · ${h(D.negocio)}</p></div>
    <div class="parties">
      <div class="party"><span>/ Cliente</span><span>${h(clienteNom)}</span></div>
      <div class="party"><span>/ Prestador</span><span>HORIZON · ${PREST}</span></div>
      <div class="party"><span>/ Servicio</span><span>${h(pk.nm)}</span></div>
      <div class="party"><span>/ Fecha · código</span><span>${h(D.fechaCorta)} · ${h(codigo)}</span></div>
    </div></section>`;

  const p2 = `<section class="pg">${band}<div class="in">
    <h2 class="sec">Identificación de las partes</h2>
    <p>En Rancagua, a ${D.fechaLarga}, comparecen: por una parte, <strong>${PREST}</strong>, RUT ${pRut}, con domicilio en ${pDom}, que opera bajo el nombre comercial HORIZON, en adelante "el Prestador"; y por la otra, ${cliente}, en adelante "el Cliente". Las partes acuerdan el siguiente contrato:</p>
    <h2 class="sec" style="margin-top:14px">Términos del contrato</h2>
    ${cl(1, 'Objeto', `El Prestador se obliga a diseñar, construir, configurar y entregar funcionando el ${pk.nm} para el negocio del Cliente, según el alcance detallado en el Anexo A, que forma parte integrante de este contrato.`)}
    <div class="boxes"><div class="box"><span class="lbl">Servicio contratado</span><b>${h(pk.nm)}</b></div><div class="box"><span class="lbl">Tiempo estimado de entrega</span><b>${h(pk.plazo)}</b></div></div>
    <span class="lbl" style="display:block;margin-bottom:6px">Entregables</span>
    <ul class="ents">${pk.incluye.map(([a]) => `<li>${h(a)}</li>`).join('')}</ul>
    ${cl(2, 'Alcance', 'Los servicios comprenden exclusivamente lo indicado en el Anexo A. Todo trabajo no incluido en él se considera adicional y se cotizará por separado antes de realizarse. Lo que el Anexo A señala como "No incluido" no forma parte de este contrato.')}
    ${cl(3, 'Plazo de implementación', `El plazo estimado es de <span class="acc">${pk.plazo}</span> contadas desde la reunión de inicio (kickoff), que se realizará una vez recibido el pago inicial y los insumos indicados en la Orden de Inicio. Si el Cliente entrega insumos, accesos o aprobaciones fuera del plazo de <span class="acc">5 días hábiles</span>, el plazo de entrega se extenderá en los mismos días de atraso.`)}
    ${cl(4, 'Precio y forma de pago', `El precio de la implementación es de <span class="acc">${clp(pk.impl)} (${pk.palabras} pesos)</span>, monto bruto, con boleta de honorarios. Se pagará de la siguiente forma: <span class="acc">50%</span> al firmar este contrato para reservar el inicio y <span class="acc">50%</span> antes de la entrega final. Los pagos se realizarán por transferencia bancaria a la cuenta que el Prestador indique por escrito. El Prestador emitirá boleta de honorarios por cada pago recibido.`)}
    </div>${foot('02')}</section>`;

  const p3 = `<section class="pg">${band}<div class="in">
    ${cl(5, 'Soporte mensual', `El primer mes de soporte posterior a la entrega está incluido en el precio. Desde el segundo mes, el Cliente podrá contratar el soporte ${pk.soporte} por <span class="acc">${clp(pk.mes)} mensuales</span>, pagaderos al inicio del mes que cubren, entre el día 25 y el día 5 del mes siguiente. El soporte es mes a mes y sin permanencia: cualquiera de las partes puede ponerle término avisando por escrito con <span class="acc">15 días corridos</span> de anticipación al siguiente período.`)}
    ${cl(6, 'Revisiones y aprobaciones', 'El diseño se presentará al Cliente para su aprobación antes de construirse. Se incluyen <span class="acc">2 rondas</span> de cambios sobre el diseño. Las aprobaciones podrán darse por correo electrónico o WhatsApp y se entenderán definitivas. Los cambios posteriores a una aprobación o que excedan las rondas incluidas se cotizarán aparte.')}
    ${cl(7, 'Obligaciones del Cliente', 'El Cliente se obliga a: (a) entregar oportunamente la información, contenidos, imágenes y accesos necesarios; (b) designar una persona de contacto con facultades para aprobar; (c) pagar el precio en la forma convenida; y (d) garantizar que los contenidos que entrega no infringen derechos de terceros.')}
    ${cl(8, 'Servicios y costos de terceros', 'El dominio, el hosting y las cuentas en plataformas de terceros (Google, Meta, WhatsApp Business API, proveedores de inteligencia artificial u otros) quedarán a nombre del Cliente y sus costos serán de su cargo, salvo que el Anexo A indique otra cosa. La inversión en publicidad se paga directamente a la plataforma correspondiente. El Prestador no responde por cambios, caídas o políticas de dichas plataformas.')}
    ${cl(9, 'Propiedad y uso', 'Pagado íntegramente el precio, el Cliente será dueño del sitio, los contenidos y las configuraciones entregadas para su negocio. El Prestador conserva la propiedad de sus metodologías, plantillas, componentes y herramientas reutilizables, y otorga al Cliente una licencia de uso indefinida sobre aquellos incorporados en la entrega. El Prestador podrá mostrar el proyecto en su portafolio solo con autorización escrita del Cliente.')}
    ${cl(10, 'Confidencialidad y datos personales', 'Las partes mantendrán reserva sobre la información comercial de la otra a la que accedan con motivo de este contrato. El Prestador tratará los datos personales de clientes del Cliente solo para prestar los servicios contratados y conforme a la Ley N° 19.628 sobre protección de la vida privada y sus modificaciones.')}
    ${cl(11, 'Garantía', 'El Prestador corregirá sin costo los errores de funcionamiento atribuibles a su trabajo que se reporten dentro de los <span class="acc">30 días</span> siguientes a la entrega.')}
    ${cl(12, 'Resultados', 'El Prestador se obliga a entregar los servicios descritos con diligencia profesional. Las ventas, el posicionamiento en buscadores o el rendimiento de campañas dependen también de factores ajenos al Prestador, por lo que no se garantizan resultados comerciales específicos.')}
    </div>${foot('03')}</section>`;

  const fld = (l, v, sig) => `<label class="fld"><span class="lbl">${l}</span><div class="${sig ? 'sig' : ''}">${v || ''}</div></label>`;
  const p4 = `<section class="pg">${band}<div class="in">
    ${cl(13, 'Término anticipado', 'Si el Cliente pone término al contrato antes de la entrega, pagará el trabajo realizado a la fecha y el anticipo no se reembolsará. Cualquiera de las partes podrá terminarlo si la otra incumple gravemente sus obligaciones y no lo corrige dentro de 10 días desde que se le notifique por escrito.')}
    ${cl(14, 'Domicilio y firma', 'Para todos los efectos de este contrato, las partes fijan su domicilio en la ciudad de Rancagua y se someten a la competencia de sus tribunales. Este contrato podrá firmarse en papel, en dos ejemplares, o mediante firma electrónica simple conforme a la Ley N° 19.799, con igual valor.')}
    <div class="firm">
      <div><h3>El Cliente</h3>${fld('Nombre', h(clienteNom) + (c.razon_social ? ' · p.p. ' + h(D.nombre) : ''))}${fld('RUT', cRut)}${fld('Firma', '', true)}</div>
      <div><h3>El Prestador</h3>${fld('Nombre', PREST + ' · HORIZON')}${fld('RUT', pRut)}${fld('Firma', '', true)}</div>
    </div>
    <div class="const">Para constancia, se firma en Rancagua, a ${D.fechaLarga}.</div>
    </div>${foot('04')}</section>`;

  const p5 = `<section class="pg">${band}<div class="in">
    <h2 class="sec">Anexo A — Alcance del servicio</h2>
    <div class="boxes"><div class="box"><span class="lbl">Plan contratado</span><b>${h(pk.nm)}</b></div><div class="box"><span class="lbl">Plazo</span><b>${h(pk.plazo)} desde el kickoff</b></div></div>
    <table><tr><th>Incluye</th><th>Detalle</th></tr>${pk.incluye.map(([a, b]) => `<tr><td><b>${h(a)}</b></td><td>${h(b)}</td></tr>`).join('')}</table>
    <p><b>No incluido:</b> ${h(pk.no)}</p>
    <div class="firm"><div>${fld('Iniciales del Cliente', '')}</div><div>${fld('Iniciales del Prestador', '')}</div></div>
    </div>${foot('05')}</section>`;

  return shell({ titulo: 'Contrato · ' + D.negocio, cuerpo: portada + p2 + p3 + p4 + p5, css: CON_CSS, color: D.color });
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
