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


// ── Diseño: diagramación del pack de plantillas con la identidad HORIZON (landing 2026):
// crema + tinta, degradado de marca, titulares 800 con tracking negativo, etiquetas DM Mono, íconos del sprite.
// Logo oficial solo sobre fondo oscuro. Co-branding: fotos reales y color del negocio (horizon-propuestas).
const LOGO = '/Identidad/Logo%20HORIZON.svg';
const SPRITE = '/shared/hz-sprite.svg';
const CONTACTO = { correo: 'soportebinks@gmail.com', whatsapp: '+56 9 7696 2659', web: 'horizonweb.cl' };
const PROP = 'https://horizon-propuestas.vercel.app/';
// Fotos reales de cada negocio (las mismas de su web demo). Sin fotos, el diseño usa composiciones de marca.
const MEDIA = {
  'cake-boutique': { base: PROP + 'cake-boutique/', hero: 'img/hero-mesa.jpg', fotos: ['img/cumpleanos.jpg', 'img/cat-tortas.jpg', 'img/iced-matcha.jpg', 'img/box-uno.jpg', 'img/torta-bizcocho.jpg', 'img/mini-torta.jpg'], logo: 'iso-ae.svg', fondo: '#F6E6EA' },
  'que-rolls': { base: PROP + 'que-rolls/', hero: 'hero.png', fotos: ['burg.png', 'p50.png', 'acev.png', 'gopo.png', 'palt.png', 'burs.png'], logo: '', fondo: '#0B0B0B' },
};
const CASOS = [
  ['VitalKine', 'Kinesiología a domicilio · Rancagua', 'Sitio a medida con reservas propias y SEO local.', '/Identidad/casos/vitalkine.webp'],
  ['Floremané', 'E-commerce de carteras de cuero', 'Identidad, packaging y tienda online editorial.', '/Identidad/casos/floremane.webp'],
];
const ico = (n, cls) => `<svg class="ico ${cls || ''}" aria-hidden="true"><use href="${SPRITE}#${n}"/></svg>`;

const BASE_CSS = `
:root{--bg:#FFFBF6;--bg2:#FFF4EA;--surface:#fff;--ink:#1A1626;--ink2:#5F5970;--ink3:#9C96AB;--line:#F0E7DC;--line2:#E6DACB;--acc:#F2690C;--violet:#7B3FA0;
--grad:linear-gradient(95deg,#F2690C 0%,#C4467A 55%,#7B3FA0 100%);
--deep:radial-gradient(120% 90% at 100% 100%,rgba(242,105,12,.55),transparent 55%),linear-gradient(155deg,#1E1744 0%,#34276E 30%,#5A2F8C 58%,#9A3A84 82%,#C4467A 100%);
--f:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif;--m:'DM Mono',ui-monospace,monospace}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0}body{background:#DCD6CE;color:var(--ink);font:400 10pt/1.55 var(--f)}
.ico{width:1.25em;height:1.25em;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
.eb{font:500 .78em/1 var(--m);letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);display:inline-flex;align-items:center;gap:.7em}
.eb::before{content:'';width:1.8em;height:1.5px;background:var(--acc)}
.dk .eb{color:#E4DDF5}
.g{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.acc{color:var(--acc);font-weight:700}
.acciones{position:sticky;top:0;z-index:50;display:flex;gap:10px;justify-content:center;padding:12px;background:#1A1626}
.acciones button{font:700 14px var(--f);border:0;border-radius:12px;padding:12px 18px;cursor:pointer;background:linear-gradient(95deg,#F2690C,#CC3253 50%,#7B3FA0);color:#fff}
@media print{.acciones{display:none}body{background:#fff}}`;

function shell({ titulo, cuerpo, css, color }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow"><title>${h(titulo)} — HORIZON</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${BASE_CSS}:root{--cli:${color}}${css}</style></head><body>
<div class="acciones"><button onclick="window.print()">Guardar en PDF o imprimir</button></div>
${cuerpo}</body></html>`;
}

function medios(D) {
  const m = MEDIA[D.rx.negocio_slug] || null;
  if (!m) return { hero: '', fotos: [], logo: '', fondo: '' };
  return { hero: m.base + m.hero, fotos: m.fotos.map(f => m.base + f), logo: m.logo ? m.base + m.logo : '', fondo: m.fondo };
}
// Mensajes de ejemplo del agente según el tipo de negocio (se muestran como maqueta, no como datos del cliente).
function charla(modelo) {
  if (modelo === 'pasteleria') return [['in', 'Hola! ¿Tienen torta para 15 personas para el sábado?'], ['out', '¡Hola! 😊 Sí, para el sábado alcanzamos. ¿La buscas de bizcocho, hojarasca o congelada?'], ['in', 'Bizcocho, la de chocolate'], ['out', 'Perfecto. Te la dejo anotada para el sábado. ¿Retiras o te la enviamos?']];
  if (modelo === 'comida') return [['in', 'Hola, ¿están atendiendo? Quiero pedir para retiro'], ['out', '¡Hola! Sí, hasta las 23:30 🙌 ¿Qué te preparo?'], ['in', 'Una promo para dos'], ['out', 'Listo, queda para retiro en 25 minutos. Te mando el resumen.']];
  if (modelo === 'clinica') return [['in', 'Hola, me duele una muela, ¿me pueden atender hoy?'], ['out', 'Hola, lo siento. Tengo una hora hoy a las 17:00. ¿Te la reservo?'], ['in', 'Sí, por favor'], ['out', 'Listo, quedó agendada. Te recuerdo mañana temprano.']];
  return [['in', 'Hola, ¿qué precio tiene y cómo agendo?'], ['out', '¡Hola! Te cuento al tiro los valores. ¿Para qué día lo necesitas?'], ['in', 'Para el jueves'], ['out', 'El jueves tengo a las 11:00 y a las 16:00. ¿Cuál te acomoda?']];
}

// ── Propuesta: diapositivas 16:9. En pantalla se apilan; en el celular pasan a una columna.
const PROP_CSS = `
@page{size:338.7mm 190.5mm;margin:0}
.sl{position:relative;width:min(100%,1180px);aspect-ratio:16/9;margin:24px auto;background:var(--bg);overflow:hidden;box-shadow:0 30px 60px -30px rgba(26,22,38,.35);break-after:page;font-size:clamp(9px,1.06vw,12.6px)}
.sl h1,.sl h2,.sl h3{margin:0;font-weight:800;letter-spacing:-.035em;line-height:1.02}
.dk{background:var(--deep);color:#fff}
.pg-n{position:absolute;right:3.2%;bottom:4%;font:500 .8em var(--m);color:var(--ink3);z-index:3}.dk .pg-n,.ph .pg-n{color:rgba(255,255,255,.7)}
.lg{height:2.3em;width:auto;display:block}
.orb{position:absolute;border-radius:50%;filter:blur(40px);opacity:.55;pointer-events:none}
.ring{position:absolute;border-radius:50%;border:.9em solid transparent;background:linear-gradient(var(--bg),var(--bg)) padding-box,var(--grad) border-box;opacity:.9}
.img{background-size:cover;background-position:center}
/* 1 portada */
.s1 .img{position:absolute;inset:0}
.s1 .veil{position:absolute;inset:0;background:linear-gradient(90deg,rgba(30,23,68,.96) 0%,rgba(52,39,110,.9) 38%,rgba(90,47,140,.55) 62%,rgba(196,70,122,.05) 100%)}
.s1 .in{position:relative;z-index:2;height:100%;padding:5% 6%;display:grid;grid-template-rows:auto 1fr auto;color:#fff;max-width:64%}
.s1 h1{font-size:5.6em;align-self:end}.s1 h1 small{display:block;font:500 .2em var(--m);letter-spacing:.16em;text-transform:uppercase;color:#E4DDF5;margin-bottom:1.2em}
.s1 .tags{display:flex;flex-wrap:wrap;gap:.6em;margin-top:2em}
.pill{display:inline-flex;align-items:center;gap:.6em;padding:.55em 1em;border-radius:99px;font:600 .9em var(--f);background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);color:#fff;backdrop-filter:blur(8px)}
.pill img{height:1.4em;width:auto;background:#fff;border-radius:99px;padding:.2em .5em}.pill i{width:.7em;height:.7em;border-radius:50%;background:var(--cli)}
/* 2 hola */
.s2{display:grid;grid-template-columns:1fr 1fr}
.s2 .tx{padding:6% 5% 6% 7%;display:flex;flex-direction:column;justify-content:center;gap:1.2em;position:relative;z-index:2}
.s2 h2{font-size:4.4em}.s2 p{margin:0;color:var(--ink2);font-size:1.12em;max-width:32em}
.col{position:relative}
.col .a{position:absolute;left:4%;top:9%;width:52%;height:62%;border-radius:22px;box-shadow:0 30px 50px -25px rgba(26,22,38,.5)}
.col .b{position:absolute;right:6%;top:4%;width:38%;height:44%;border-radius:22px;box-shadow:0 30px 50px -25px rgba(26,22,38,.5)}
.col .c{position:absolute;right:10%;bottom:8%;width:46%;height:42%;border-radius:22px;box-shadow:0 30px 50px -25px rgba(26,22,38,.5)}
.sticker{position:absolute;left:6%;bottom:12%;z-index:3;background:var(--ink);color:#fff;border-radius:18px;padding:1em 1.2em;max-width:40%;font-size:.95em;box-shadow:0 20px 40px -20px rgba(26,22,38,.6)}
.sticker b{display:block;font-size:1.05em;margin-bottom:.2em}
.brandcol{position:absolute;inset:8% 8% 8% 4%;border-radius:28px;background:var(--deep);display:grid;place-items:center;color:#fff;text-align:center;font-size:2.4em;font-weight:800;letter-spacing:-.03em;padding:1em}
/* 3 lo que vimos */
.s3{display:grid;grid-template-columns:.95fr 1.05fr}
.s3 .l{padding:6% 5% 6% 7%;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:2}
.s3 h2{font-size:3.6em}.s3 .big{font-size:6.4em;font-weight:800;letter-spacing:-.05em;line-height:.95}
.s3 .big small{font-size:.22em;letter-spacing:0;font-weight:600;color:#E4DDF5;-webkit-text-fill-color:#E4DDF5}
.s3 .r{padding:6% 6% 6% 0;display:flex;flex-direction:column;justify-content:center;gap:1em;position:relative;z-index:2}
.gl{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:1.2em 1.4em;display:grid;grid-template-columns:2.6em 1fr;gap:1em;align-items:start;backdrop-filter:blur(10px)}
.gl .n{width:2.6em;height:2.6em;border-radius:12px;background:var(--grad);display:grid;place-items:center;font:600 .9em var(--m)}
.gl p{margin:0;font-size:1.08em;line-height:1.45}
/* 4 sistema */
.s4{display:grid;grid-template-columns:.9fr 1.1fr}
.s4 .l{padding:6% 3% 6% 7%;display:flex;flex-direction:column;justify-content:center;gap:1.2em}
.s4 h2{font-size:3.8em}.s4 p{margin:0;color:var(--ink2);font-size:1.08em}
.steps{display:grid;gap:.55em;margin-top:.6em}.stp{display:grid;grid-template-columns:2.4em 1fr auto;gap:.8em;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:.6em .9em}
.stp .ic{width:2.4em;height:2.4em;border-radius:10px;background:var(--bg2);color:var(--acc);display:grid;place-items:center}.stp b{font-size:.98em}
.stp em{font:500 .7em var(--m);font-style:normal;text-transform:uppercase;letter-spacing:.08em;padding:.3em .6em;border-radius:99px;background:var(--bg2);color:var(--ink2)}
.stp.pro em{background:var(--cli);color:#fff}.stp.pro .ic{background:var(--ink);color:#fff}
.stage{position:relative}
.phone{position:absolute;left:8%;top:7%;width:40%;height:86%;border-radius:2.4em;background:#0E0B14;padding:.7em;box-shadow:0 40px 70px -30px rgba(26,22,38,.7);z-index:2}
.scr{height:100%;border-radius:1.9em;overflow:hidden;background:#ECE5DD;display:flex;flex-direction:column}
.wah{background:#075E54;color:#fff;display:flex;align-items:center;gap:.6em;padding:.9em .9em .7em}.wah .av{width:2.2em;height:2.2em;border-radius:50%;background:#fff;display:grid;place-items:center;overflow:hidden}.wah .av img{width:80%}.wah b{font-size:.9em;display:block}.wah small{font-size:.72em;opacity:.8}
.wab{flex:1;padding:.8em;display:flex;flex-direction:column;gap:.5em;font-size:.82em}
.bb{max-width:84%;padding:.55em .75em;border-radius:.8em;line-height:1.35;box-shadow:0 1px 1px rgba(0,0,0,.08)}.bb.in{background:#fff;align-self:flex-start}.bb.out{background:#DCF8C6;align-self:flex-end}
.card{position:absolute;right:5%;width:50%;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 30px 60px -30px rgba(26,22,38,.45);padding:1em 1.2em;z-index:3}
.card .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.6em}
.ok{font:500 .7em var(--m);text-transform:uppercase;letter-spacing:.06em;padding:.3em .6em;border-radius:6px;background:#DDF5E6;color:#15803D}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.5em}.kpis div{background:var(--bg2);border-radius:10px;padding:.5em .6em}.kpis small{display:block;font:500 .65em var(--m);text-transform:uppercase;color:var(--ink3)}.kpis b{font-size:1.4em}
.ph-bg{position:absolute;inset:0 0 0 18%;border-radius:0}
/* 5 propuesta */
.s5{display:grid;grid-template-columns:.78fr 1.22fr}
.s5 .ph{position:relative}.s5 .ph .img{position:absolute;inset:0}.s5 .ph::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(26,22,38,.85))}
.s5 .ph .cap{position:absolute;left:8%;right:8%;bottom:7%;z-index:2;color:#fff}.s5 .ph .cap h2{font-size:3.6em}
.s5 .body{padding:5% 5.5%;display:grid;grid-template-rows:auto auto 1fr auto;gap:1.1em}
.s5 .obj{margin:0;font-size:1.15em;color:var(--ink2);max-width:42em}
.ents{display:grid;grid-template-columns:1fr 1fr;gap:.7em 1.4em;align-content:start}
.ent{display:grid;grid-template-columns:2em 1fr;gap:.7em}.ent .ck{width:2em;height:2em;border-radius:9px;background:var(--bg2);color:var(--acc);display:grid;place-items:center}
.ent b{display:block;font-size:.98em}.ent span{color:var(--ink2);font-size:.88em;line-height:1.4}
.price{border-radius:20px;padding:2px;background:var(--grad)}.price>div{background:var(--surface);border-radius:18px;padding:1em 1.4em;display:grid;grid-template-columns:1fr 1.3fr 1.3fr;gap:1.2em;align-items:center}
.price small{display:block;font:500 .7em var(--m);letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}.price b{font-size:1.9em;letter-spacing:-.03em}.price em{font-style:normal;color:var(--ink2);font-size:.85em}
/* 6 a tener en cuenta */
.s6 .in{padding:5.5% 6% 6% 7%;height:100%;display:grid;grid-template-rows:auto 1fr;gap:2em}
.s6 h2{font-size:3.8em}.s6 .hd{display:flex;justify-content:space-between;gap:2em;align-items:end}
.s6 .when{background:var(--ink);color:#fff;border-radius:18px;padding:1em 1.3em;max-width:22em}.s6 .when b{display:block;font-size:1.4em}
.c4{display:grid;grid-template-columns:repeat(4,1fr);gap:1em;align-self:end}
.tc{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:1.3em;display:flex;flex-direction:column;gap:.7em;min-height:15em}
.tc .ic{width:2.8em;height:2.8em;border-radius:12px;background:var(--grad);color:#fff;display:grid;place-items:center}.tc b{font-size:1.15em}.tc p{margin:0;color:var(--ink2);font-size:.95em}
/* 7 proceso */
.s7 .in{padding:5.5% 6% 6% 7%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:4em}
.s7 h2{font-size:3.8em}
.tl{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:1.4em}
.tl::before{content:'';position:absolute;left:0;right:0;top:1.6em;height:3px;border-radius:3px;background:var(--grad)}
.nd{position:relative;padding-top:4em}.nd .dot{position:absolute;top:0;left:0;width:3.2em;height:3.2em;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font:600 .95em var(--m);box-shadow:0 0 0 .5em var(--bg)}
.nd.on .dot{background:var(--grad)}.nd b{font-size:1.25em;display:block}.nd small{font:500 .75em var(--m);letter-spacing:.1em;text-transform:uppercase;color:var(--acc)}.nd p{margin:.5em 0 0;color:var(--ink2)}
/* 8 casos */
.s8 .in{padding:5.5% 6% 6% 7%;height:100%;display:grid;grid-template-rows:auto 1fr;gap:1.6em}
.s8 h2{font-size:3.8em}.cs{display:grid;grid-template-columns:1fr 1fr .8fr;gap:1.2em}
.cz{border-radius:22px;overflow:hidden;background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column}
.cz .img{flex:1;min-height:12em}.cz div.t{padding:1em 1.2em}.cz b{font-size:1.25em;display:block}.cz small{font:500 .72em var(--m);letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}.cz p{margin:.3em 0 0;color:var(--ink2);font-size:.95em}
.cq{border-radius:22px;background:var(--deep);color:#fff;padding:1.6em;display:flex;flex-direction:column;justify-content:space-between}.cq p{font-size:1.9em;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin:0}
/* 9 cierre */
.s9 .img{position:absolute;inset:0}.s9 .veil{position:absolute;inset:0;background:linear-gradient(90deg,rgba(30,23,68,.97) 0%,rgba(52,39,110,.92) 45%,rgba(154,58,132,.55) 75%,rgba(242,105,12,.25) 100%)}
.s9 .in{position:relative;z-index:2;height:100%;display:grid;grid-template-columns:1.1fr .9fr;gap:3em;padding:5.5% 6%;color:#fff}
.s9 h2{font-size:4.8em;align-self:center}
.s9 .r{align-self:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24);border-radius:24px;padding:1.6em;backdrop-filter:blur(12px)}
.ps{list-style:none;margin:.8em 0 1.4em;padding:0;counter-reset:p}.ps li{counter-increment:p;display:grid;grid-template-columns:2.4em 1fr;padding:.65em 0;border-top:1px solid rgba(255,255,255,.22)}.ps li::before{content:'0' counter(p);font:500 .9em var(--m);color:#FFB27A}
.ct{display:grid;grid-template-columns:auto 1fr;gap:.4em 1.2em;font-size:.95em}.ct span:nth-child(odd){font:500 .72em var(--m);letter-spacing:.12em;text-transform:uppercase;color:#E4DDF5;padding-top:.3em}
.sig{margin-top:1.4em;border-top:1px solid rgba(255,255,255,.5);padding-top:.6em;font-size:.88em;color:#E4DDF5}
@media screen and (max-width:760px){
 .sl{aspect-ratio:auto;width:auto;margin:0 0 12px;font-size:13px;display:block}
 .s1{min-height:92vh}.s1 .in{max-width:none;min-height:92vh}.s1 h1{font-size:3em}.s1 .veil{background:linear-gradient(180deg,rgba(30,23,68,.55),rgba(30,23,68,.97) 60%)}
 .s2 .tx,.s3 .l,.s3 .r,.s4 .l,.s5 .body,.s6 .in,.s7 .in,.s8 .in{padding:28px 20px}
 .col,.stage{height:420px}.s5 .ph{height:360px}.s3 .r{padding-top:0}
 .card{width:60%}.phone{width:56%;left:4%}
 .ents,.price>div,.c4,.cs,.tl,.s9 .in{grid-template-columns:1fr}.tl::before{display:none}.s6 .hd{flex-direction:column;align-items:start}.s9{min-height:100vh}.s9 .in{min-height:100vh}.pg-n{display:none}}
@media print{.sl{margin:0;width:338.7mm;height:190.5mm;aspect-ratio:auto;box-shadow:none;font-size:12.6px}}`;

function propuesta(lead) {
  const D = datos(lead), { pk, rx, k } = D, M = medios(D);
  const F = i => M.fotos[i % (M.fotos.length || 1)];
  const bg = u => u ? `style="background-image:url('${h(u)}')"` : '';
  const lecturas = Array.isArray(rx.lecturas) && rx.lecturas.length ? rx.lecturas.slice(0, 3) : (rx.mejoras || []).slice(1, 4);
  const pasos = [['i-search', 'Le encuentran en Google y en su web'], ['i-chat', 'Le escriben por WhatsApp'], ['i-agent', 'El agente responde y agenda'], ['i-panel', 'Todo queda en su panel']];
  if (k === 'pro') pasos.push(['i-bell', 'Seguimiento y recordatorios'], ['i-users', 'Sus clientes vuelven']);
  const msgs = charla(rx.modelo);
  const icEnt = ['i-web', 'i-search', 'i-agent', 'i-panel', 'i-bell', 'i-users', 'i-spark', 'i-layers'];
  const first = D.nombre.split(' ')[0] || '';
  const cover = M.hero
    ? `<div class="img" ${bg(M.hero)}></div><div class="veil"></div>`
    : `<div class="dk" style="position:absolute;inset:0"></div><span class="ring" style="right:-8%;top:-20%;width:62%;aspect-ratio:1;--bg:transparent;background:none;border:1.2em solid rgba(255,255,255,.12)"></span>`;
  const s = [];
  s.push(`<section class="sl s1">${cover}<div class="in">
    <div style="display:flex;justify-content:space-between;align-items:center"><img class="lg" src="${LOGO}" alt="HORIZON"></div>
    <h1><small>Propuesta · ${h(pk.nm)}</small>${h(D.negocio)}</h1>
    <div><p style="margin:0;max-width:34em;color:#E4DDF5;font-size:1.15em">Un sistema que atiende, agenda y ordena su negocio, armado con lo que vimos en su local.</p>
    <div class="tags"><span class="pill">${M.logo ? `<img src="${h(M.logo)}" alt="">` : '<i></i>'}HORIZON × ${h(D.negocio)}</span><span class="pill">${h(D.fechaCorta)}</span><span class="pill">Válida por 15 días</span></div></div></div></section>`);
  s.push(`<section class="sl s2"><div class="tx"><span class="eb">Rancagua · ${h(D.fechaLarga)}</span>
    <h2>Hola${first ? ', ' + h(first) : ''}.<br><span class="g">Esto es para usted.</span></h2>
    <p>Gracias por recibirnos en ${h(D.negocio)}. Esta propuesta no es genérica: está armada con lo que vimos en su local y con sus propias respuestas a la radiografía.</p>
    <p>La idea es simple: que ningún cliente que le escriba se pierda, y que cada consulta tenga la oportunidad de convertirse en venta.</p></div>
    <div class="col">${M.fotos.length ? `<div class="img a" ${bg(F(0))}></div><div class="img b" ${bg(F(1))}></div><div class="img c" ${bg(F(2))}></div>` : `<div class="brandcol">HORIZON ×<br>${h(D.negocio)}</div>`}
    <div class="sticker"><b>Armado para ${h(D.negocio)}</b>Con su información, sus precios y su forma de atender.</div></div><span class="pg-n">02</span></section>`);
  s.push(`<section class="sl s3 dk"><span class="orb" style="width:40%;height:60%;left:-10%;bottom:-20%;background:#F2690C"></span>
    <div class="l"><div><span class="eb">Diagnóstico</span><h2 style="margin-top:.5em">Lo que vimos en su negocio</h2></div>
    ${rx.escape_mes ? `<div><span class="eb">Se escapa hoy, aprox.</span><div class="big g" style="margin-top:.2em">${clp(rx.escape_mes)}<small> al mes</small></div><p style="margin:.6em 0 0;color:#CFC6E6;font-size:.9em;max-width:30em">Estimación a la baja con sus respuestas. No es una promesa: es lo que hoy no está entrando.</p></div>` : ''}</div>
    <div class="r">${lecturas.map((x, i) => `<div class="gl"><span class="n">0${i + 1}</span><p>${h(x)}</p></div>`).join('')}</div><span class="pg-n">03</span></section>`);
  s.push(`<section class="sl s4"><div class="l"><span class="eb">Cómo funciona</span><h2>Su negocio, <span class="g">atendiendo solo.</span></h2>
    <p>Cada pieza le pasa la información a la siguiente. Nada queda suelto en el chat ni en el cuaderno.</p>
    <div class="steps">${pasos.map((p, i) => `<div class="stp${i > 3 ? ' pro' : ''}"><span class="ic">${ico(p[0])}</span><b>${h(p[1])}</b><em>${i > 3 ? 'Pro' : 'Incluido'}</em></div>`).join('')}</div></div>
    <div class="stage">${M.fotos.length ? `<div class="img ph-bg" ${bg(F(3))} ></div><div class="ph-bg" style="background:linear-gradient(90deg,var(--bg),rgba(255,251,246,.3))"></div>` : `<span class="orb" style="width:60%;height:70%;right:0;top:10%;background:#C4467A"></span>`}
      <div class="phone"><div class="scr"><div class="wah"><span class="av">${M.logo ? `<img src="${h(M.logo)}" alt="">` : ''}</span><div><b>${h(D.negocio)}</b><small>en línea</small></div></div>
      <div class="wab">${msgs.map(m => `<div class="bb ${m[0]}">${h(m[1])}</div>`).join('')}</div></div></div>
      <div class="card" style="top:14%"><div class="top"><b style="font-size:.95em">Panel · Hoy</b><span class="ok">Confirmado</span></div>
      <div class="kpis"><div><small>Consultas</small><b>24</b></div><div><small>Agendadas</small><b>17</b></div><div><small>Sin resp.</small><b>0</b></div></div></div>
      <div class="card" style="bottom:12%;width:44%"><div class="top"><b style="font-size:.95em">🔔 Aviso al dueño</b></div><span style="font-size:.85em;color:var(--ink2)">Nuevo pedido confirmado por el agente, con cliente, detalle y hora.</span></div>
    </div><span class="pg-n">04</span></section>`);
  s.push(`<section class="sl s5"><div class="ph"><div class="img" ${bg(F(4) || M.hero)} ${M.fotos.length ? '' : 'style="background:var(--deep)"'}></div><div class="cap"><span class="eb" style="color:#fff">Nuestra propuesta</span><h2 style="margin-top:.4em">${h(pk.nm)}</h2></div></div>
    <div class="body"><span class="eb">${k === 'pro' ? 'Llena la agenda y hace volver' : 'Atiende y agenda'}</span>
    <p class="obj">${k === 'pro' ? 'Un agente que atiende y agenda 24/7, y un sistema que sigue trabajando después de la conversación: hace seguimiento, recuerda las horas y trae de vuelta a sus clientes.' : 'Un agente que atiende y agenda 24/7, con la web y el panel donde queda registrado cada contacto. Ninguna consulta sin respuesta.'}</p>
    <div class="ents">${pk.incluye.map(([a, b], i) => `<div class="ent"><span class="ck">${ico(icEnt[i % icEnt.length])}</span><div><b>${h(a)}</b><span>${h(b)}</span></div></div>`).join('')}</div>
    <div class="price"><div><div><small>Plazo</small><b>${h(pk.plazo)}</b></div><div><small>Implementación · pago único</small><b class="g">${clp(pk.impl)}</b><em>50% al firmar · 50% antes de la entrega</em></div><div><small>Mensualidad desde el mes 2</small><b>${clp(pk.mes)}</b><em>Mes a mes, sin permanencia</em></div></div></div></div></section>`);
  s.push(`<section class="sl s6"><span class="ring" style="width:26%;aspect-ratio:1;left:-9%;bottom:-16%"></span><div class="in"><div class="hd"><div><span class="eb">Modalidad de pago y forma de trabajo</span><h2 style="margin-top:.4em">A tener en cuenta</h2></div>
    <div class="when"><span class="eb" style="color:#E4DDF5">Inicio</span><b>48 horas</b>desde el pago inicial, con el kickoff.</div></div>
    <div class="c4"><div class="tc"><span class="ic">${ico('i-wallet')}</span><b>Pago</b><p><span class="acc">50%</span> al firmar y <span class="acc">50%</span> antes de la entrega final, desde su portal de cliente.</p></div>
    <div class="tc"><span class="ic">${ico('i-layers')}</span><b>Revisiones</b><p>Se incluyen <span class="acc">2 rondas</span> de cambios sobre el diseño antes de construir.</p></div>
    <div class="tc"><span class="ic">${ico('i-clock')}</span><b>Respuestas</b><p><span class="acc">5 días hábiles</span> para entregar insumos o aprobar. Si se atrasa, la entrega se corre en los mismos días.</p></div>
    <div class="tc"><span class="ic">${ico('i-shield')}</span><b>Garantía y soporte</b><p>Primer mes incluido y <span class="acc">30 días</span> de garantía. Después, ${clp(pk.mes)} al mes, sin permanencia.</p></div></div></div><span class="pg-n">06</span></section>`);
  s.push(`<section class="sl s7" style="background:var(--bg2)"><div class="in"><div><span class="eb">Paso a paso</span><h2 style="margin-top:.4em">Nuestro proceso</h2></div>
    <div class="tl">${[['01', 'Diagnóstico', 'Hoy', 'Vimos su negocio, probó su agente y respondió la radiografía.', true], ['02', 'Kickoff', '48 horas', 'Reunimos su información, fotos, precios y accesos.'], ['03', 'Construcción', pk.plazo, 'Web, agente y panel. Usted aprueba el diseño antes de construir.'], ['04', 'Entrega y soporte', 'Mes a mes', 'Lo dejamos funcionando y lo ajustamos cada mes con sus conversaciones reales.']]
      .map(r => `<div class="nd${r[4] ? ' on' : ''}"><span class="dot">${r[0]}</span><small>${h(r[2])}</small><b>${h(r[1])}</b><p>${h(r[3])}</p></div>`).join('')}</div></div><span class="pg-n">07</span></section>`);
  s.push(`<section class="sl s8"><div class="in"><div><span class="eb">Trabajo real, en Rancagua</span><h2 style="margin-top:.4em">Casos</h2></div>
    <div class="cs">${CASOS.map(c => `<div class="cz"><div class="img" ${bg(c[3])}></div><div class="t"><small>${h(c[1])}</small><b>${h(c[0])}</b><p>${h(c[2])}</p></div></div>`).join('')}
    <div class="cq"><span class="eb" style="color:#E4DDF5">HORIZON</span><p>Sistemas que atienden, ordenan y venden mientras usted trabaja.</p></div></div></div><span class="pg-n">08</span></section>`);
  s.push(`<section class="sl s9 dk">${M.fotos.length ? `<div class="img" ${bg(F(5))}></div>` : ''}<div class="veil"></div><div class="in">
    <div style="display:flex;flex-direction:column;justify-content:space-between"><img class="lg" src="${LOGO}" alt="HORIZON"><h2>Está a un paso de que su negocio <span style="color:#FFB27A">atienda solo.</span></h2><span></span></div>
    <div class="r"><span class="eb">Próximos pasos</span><ol class="ps"><li>Aceptar esta propuesta.</li><li>Firmar el contrato y pagar el 50% desde su portal.</li><li>Kickoff en 48 horas.</li></ol>
    <div class="ct"><span>Correo</span><span>${CONTACTO.correo}</span><span>WhatsApp</span><span>${CONTACTO.whatsapp}</span><span>Web</span><span>${CONTACTO.web}</span></div>
    <div class="sig"><b style="color:#fff">Acepto la propuesta</b><br>${h(D.nombre)} · ${h(D.negocio)} · HZ-${D.anio}-${h(D.slug)}-PRO</div></div></div></section>`);
  return shell({ titulo: 'Propuesta · ' + D.negocio, cuerpo: s.join('\n'), css: PROP_CSS, color: D.color });
}

// ── Contrato: carta vertical con la diagramación del "Acuerdo de trabajo" y la identidad HORIZON.
const CON_CSS = `
@page{size:letter;margin:0}
.pg{position:relative;width:min(100%,816px);min-height:1056px;margin:24px auto;background:#fff;box-shadow:0 30px 60px -30px rgba(26,22,38,.35);display:flex;flex-direction:column;break-after:page;overflow:hidden}
.pg::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--grad)}
.band{background:var(--ink);color:#B9B3CC;display:flex;justify-content:space-between;align-items:center;padding:18px 56px;font:500 7.5pt var(--m);letter-spacing:.12em;text-transform:uppercase}
.band img{height:17px}.band i{width:8px;height:8px;border-radius:50%;background:var(--cli);display:inline-block;margin-right:8px}
.in{padding:34px 56px 26px;flex:1}
.foot{display:flex;justify-content:space-between;padding:14px 56px 22px;border-top:1px solid var(--line);font:500 7pt var(--m);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}.foot b{color:var(--ink);font-weight:500}
.cover{padding:0;background:var(--ink)}.cover::before{display:none}
.cover .photo{height:46%;min-height:430px;background-size:cover;background-position:center;position:relative}
.cover .photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(26,22,38,.15),rgba(30,23,68,.95))}
.cover .photo .lg{position:absolute;left:56px;top:44px;height:30px;z-index:2}
.cover .photo .cb{position:absolute;right:56px;top:40px;z-index:2;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);border-radius:99px;padding:6px 14px 6px 6px;color:#fff;font:600 9pt var(--f)}
.cover .photo .cb img{height:22px;background:#fff;border-radius:99px;padding:3px 8px}
.cover .body{flex:1;background:var(--deep);color:#fff;padding:40px 56px 48px;display:flex;flex-direction:column;justify-content:space-between}
.cover h1{font:800 44pt/1 var(--f);letter-spacing:-.04em;margin:0}.cover h1 span{color:#FFB27A}
.cover .sub{margin:12px 0 0;color:#E4DDF5;font-size:12pt}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-top:28px}
.party{border-top:1px solid rgba(255,255,255,.4);padding-top:10px}.party small{display:block;font:500 7.5pt var(--m);letter-spacing:.14em;text-transform:uppercase;color:#E4DDF5;margin-bottom:4px}.party b{font-size:10.5pt}
h2.sec{display:flex;align-items:center;gap:10px;font:800 15pt/1 var(--f);letter-spacing:-.02em;margin:4px 0 14px}
h2.sec::before{content:'';width:22px;height:3px;border-radius:3px;background:var(--grad)}
.in p{margin:0 0 11px;text-align:justify;line-height:1.66}
.cl{display:grid;grid-template-columns:34px 1fr;gap:10px}.cl .nn{width:28px;height:28px;border-radius:8px;background:var(--bg2);color:var(--acc);font:600 8.5pt var(--m);display:grid;place-items:center;margin-top:1px}
.cl p{margin:0 0 12px}.cl b.t{font-weight:800;letter-spacing:.02em}
.boxes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:2px 0 14px 44px}
.box{border-radius:14px;padding:2px;background:var(--grad)}.box>div{background:#fff;border-radius:12px;padding:10px 14px}.box small{display:block;font:500 7pt var(--m);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:2px}.box b{font-size:11.5pt}
.ents{margin:0 0 16px 44px;padding:12px 16px;border:1px solid var(--line2);border-radius:14px;background:var(--bg);display:grid;grid-template-columns:1fr 1fr;gap:6px 22px}
.ents div{display:flex;gap:8px;align-items:center;font-size:9.5pt}.ents .ico{color:var(--acc)}
.firm{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:22px}
.fc{border:1px solid var(--line2);border-radius:16px;padding:16px;background:var(--bg)}
.fc h3{font:800 11pt var(--f);margin:0 0 12px;display:flex;justify-content:space-between;align-items:center}.fc h3 span{font:500 7pt var(--m);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.fld{display:block;margin-bottom:10px}.fld small{display:block;font:500 7pt var(--m);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:3px}.fld div{background:#fff;border:1px solid var(--line2);border-radius:8px;min-height:30px;padding:7px 10px;font-size:9.5pt}.fld div.sig{min-height:72px}
.const{margin-top:16px;border-radius:12px;padding:12px 14px;font-size:9pt;color:#fff;background:var(--deep)}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:9.5pt;margin:6px 0 14px;border:1px solid var(--line2);border-radius:14px;overflow:hidden}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}th{font:500 7pt var(--m);letter-spacing:.12em;text-transform:uppercase;color:#fff;background:var(--ink)}
.pend{background:#FFF1E8;color:#B4441A;padding:0 4px;border-radius:3px;font:500 8.5pt var(--m)}
@media screen and (max-width:760px){.pg{margin:0 0 10px;min-height:auto}.band,.in,.foot{padding-left:20px;padding-right:20px}.cover .photo{min-height:300px}.cover .photo .lg{left:20px}.cover .photo .cb{right:20px}.cover .body{padding:28px 20px}.cover h1{font-size:30pt}.boxes,.firm,.parties,.ents{grid-template-columns:1fr}.boxes,.ents{margin-left:0}}
@media print{.pg{margin:0;width:8.5in;height:11in;min-height:0;box-shadow:none}}`;

function contrato(lead) {
  const D = datos(lead), { pk, c } = D, M = medios(D);
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
  const band = `<div class="band"><img src="${LOGO}" alt="HORIZON"><span><i></i>HORIZON × ${h(D.negocio)}</span></div>`;
  const foot = n => `<div class="foot"><span>/ Contrato de prestación de servicios · ${h(codigo)}</span><span><b>${n}</b> / 05</span></div>`;
  const cl = (n, t, p) => `<div class="cl"><span class="nn">${String(n).padStart(2, '0')}</span><p><b class="t">${t.toUpperCase()}.</b> ${p}</p></div>`;
  const fld = (l, v, sig) => `<label class="fld"><small>${l}</small><div class="${sig ? 'sig' : ''}">${v || ''}</div></label>`;
  const photo = M.hero ? `style="background-image:url('${h(M.hero)}')"` : 'style="background:var(--deep)"';

  const portada = `<section class="pg cover"><div class="photo" ${photo}><img class="lg" src="${LOGO}" alt="HORIZON">
    <span class="cb">${M.logo ? `<img src="${h(M.logo)}" alt="">` : ''}HORIZON × ${h(D.negocio)}</span></div>
    <div class="body"><div><span class="eb">${h(codigo)}</span><h1 style="margin-top:14px">Contrato de prestación<br>de servicios<span>.</span></h1><p class="sub">Implementación ${h(pk.nm)} para ${h(D.negocio)}</p></div>
    <div class="parties"><div class="party"><small>/ Cliente</small><b>${h(clienteNom)}</b></div><div class="party"><small>/ Prestador</small><b>HORIZON · ${PREST}</b></div>
    <div class="party"><small>/ Servicio</small><b>${h(pk.nm)} · ${h(pk.plazo)}</b></div><div class="party"><small>/ Fecha</small><b>${h(D.fechaLarga)}</b></div></div></div></section>`;

  const p2 = `<section class="pg">${band}<div class="in">
    <h2 class="sec">Identificación de las partes</h2>
    <p>En Rancagua, a ${D.fechaLarga}, comparecen: por una parte, <strong>${PREST}</strong>, RUT ${pRut}, con domicilio en ${pDom}, que opera bajo el nombre comercial HORIZON, en adelante "el Prestador"; y por la otra, ${cliente}, en adelante "el Cliente". Las partes acuerdan el siguiente contrato:</p>
    <h2 class="sec" style="margin-top:20px">Términos del contrato</h2>
    ${cl(1, 'Objeto', `El Prestador se obliga a diseñar, construir, configurar y entregar funcionando el ${pk.nm} para el negocio del Cliente, según el alcance detallado en el Anexo A, que forma parte integrante de este contrato.`)}
    <div class="boxes"><div class="box"><div><small>Servicio contratado</small><b>${h(pk.nm)}</b></div></div><div class="box"><div><small>Tiempo estimado de entrega</small><b>${h(pk.plazo)}</b></div></div></div>
    <div class="ents">${pk.incluye.map(([a]) => `<div>${ico('i-check')}${h(a)}</div>`).join('')}</div>
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

  const p4 = `<section class="pg">${band}<div class="in">
    ${cl(13, 'Término anticipado', 'Si el Cliente pone término al contrato antes de la entrega, pagará el trabajo realizado a la fecha y el anticipo no se reembolsará. Cualquiera de las partes podrá terminarlo si la otra incumple gravemente sus obligaciones y no lo corrige dentro de 10 días desde que se le notifique por escrito.')}
    ${cl(14, 'Domicilio y firma', 'Para todos los efectos de este contrato, las partes fijan su domicilio en la ciudad de Rancagua y se someten a la competencia de sus tribunales. Este contrato podrá firmarse en papel, en dos ejemplares, o mediante firma electrónica simple conforme a la Ley N° 19.799, con igual valor.')}
    <h2 class="sec" style="margin-top:24px">Firmas</h2>
    <div class="firm">
      <div class="fc"><h3>El Cliente <span>${h(D.negocio)}</span></h3>${fld('Nombre', h(clienteNom) + (c.razon_social ? ' · p.p. ' + h(D.nombre) : ''))}${fld('RUT', cRut)}${fld('Firma', '', true)}</div>
      <div class="fc"><h3>El Prestador <span>HORIZON</span></h3>${fld('Nombre', PREST)}${fld('RUT', pRut)}${fld('Firma', '', true)}</div>
    </div>
    <div class="const">Para constancia, se firma en Rancagua, a ${D.fechaLarga}.</div>
    </div>${foot('04')}</section>`;

  const p5 = `<section class="pg">${band}<div class="in">
    <h2 class="sec">Anexo A · Alcance del servicio</h2>
    <div class="boxes" style="margin-left:0"><div class="box"><div><small>Plan contratado</small><b>${h(pk.nm)}</b></div></div><div class="box"><div><small>Plazo</small><b>${h(pk.plazo)} desde el kickoff</b></div></div></div>
    <table><tr><th>Incluye</th><th>Detalle</th></tr>${pk.incluye.map(([a, b]) => `<tr><td><b>${h(a)}</b></td><td>${h(b)}</td></tr>`).join('')}</table>
    <p><b>No incluido:</b> ${h(pk.no)}</p>
    <div class="firm"><div class="fc">${fld('Iniciales del Cliente', '')}</div><div class="fc">${fld('Iniciales del Prestador', '')}</div></div>
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
