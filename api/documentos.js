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
  'que-rolls': { base: PROP + 'que-rolls/', hero: 'hero.png', fotos: ['burg.png', 'p50.png', 'acev.png', 'gopo.png', 'palt.png', 'burs.png'], logo: '', fondo: '#0B0B0B',
    // Paleta del negocio (su web es negra y roja): la propuesta la toma y HORIZON queda como sello.
    tema: '--bg:#0D0D0D;--bg2:#171717;--surface:#1C1C1C;--ink:#F4F1EC;--ink2:#BDB8B2;--ink3:#8A8580;--line:#2B2B2B;--line2:#353535;--acc:#E21B23;--deepS:linear-gradient(150deg,#000 0%,#1A0506 55%,#4A070B 100%);--deep:linear-gradient(150deg,#000 0%,#1A0506 55%,#4A070B 100%);--hot:linear-gradient(120deg,#E21B23,#FF5A36);--grad:linear-gradient(95deg,#E21B23,#FF5A36);--dark:#000;--chip:#2A0A0C;--chipb:#7A1015' },
};
const CASOS = [
  ['VitalKine', 'Kinesiología a domicilio · Rancagua', 'Sitio a medida con reservas propias y SEO local.', '/Identidad/casos/vitalkine.webp'],
  ['Floremané', 'E-commerce de carteras de cuero', 'Identidad, packaging y tienda online editorial.', '/Identidad/casos/floremane.webp'],
];
const ico = (n, cls) => `<svg class="ico ${cls || ''}" aria-hidden="true"><use href="${SPRITE}#${n}"/></svg>`;

const BASE_CSS = `
:root{--bg:#FFFBF6;--bg2:#FFF4EA;--surface:#fff;--ink:#1A1626;--ink2:#5F5970;--ink3:#9C96AB;--line:#F0E7DC;--line2:#E6DACB;--acc:#F2690C;--violet:#7B3FA0;
--grad:linear-gradient(95deg,#F2690C 0%,#C4467A 55%,#7B3FA0 100%);
--deep:linear-gradient(150deg,#1E1744 0%,#2C2160 35%,#4A2A85 70%,#6B2F8E 100%);
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

function shell({ titulo, cuerpo, css, color, tema }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow"><title>${h(titulo)} — HORIZON</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${BASE_CSS}:root{--cli:${color}}${css}${tema ? `:root{${tema}}.fotoFondo{background-size:contain!important;background-repeat:no-repeat;background-color:var(--bg)}` : ''}</style></head><body>
<div class="acciones"><button onclick="window.print()">Guardar en PDF o imprimir</button></div>
${cuerpo}</body></html>`;
}

function medios(D) {
  const m = MEDIA[D.rx.negocio_slug] || null;
  if (!m) return { hero: '', fotos: [], logo: '', fondo: '', tema: '' };
  return { hero: m.base + m.hero, fotos: m.fotos.map(f => m.base + f), logo: m.logo ? m.base + m.logo : '', fondo: m.fondo, tema: m.tema || '' };
}
// Mensajes de ejemplo del agente según el tipo de negocio (se muestran como maqueta, no como datos del cliente).
function charla(modelo) {
  if (modelo === 'pasteleria') return [['in', 'Hola! ¿Tienen torta para 15 personas para el sábado?'], ['out', '¡Hola! 😊 Sí, para el sábado alcanzamos. ¿La buscas de bizcocho, hojarasca o congelada?'], ['in', 'Bizcocho, la de chocolate'], ['out', 'Perfecto. Te la dejo anotada para el sábado. ¿Retiras o te la enviamos?']];
  if (modelo === 'comida') return [['in', 'Hola, ¿están atendiendo? Quiero pedir para retiro'], ['out', '¡Hola! Sí, hasta las 23:30 🙌 ¿Qué te preparo?'], ['in', 'Una promo para dos'], ['out', 'Listo, queda para retiro en 25 minutos. Te mando el resumen.']];
  if (modelo === 'clinica') return [['in', 'Hola, me duele una muela, ¿me pueden atender hoy?'], ['out', 'Hola, lo siento. Tengo una hora hoy a las 17:00. ¿Te la reservo?'], ['in', 'Sí, por favor'], ['out', 'Listo, quedó agendada. Te recuerdo mañana temprano.']];
  return [['in', 'Hola, ¿qué precio tiene y cómo agendo?'], ['out', '¡Hola! Te cuento al tiro los valores. ¿Para qué día lo necesitas?'], ['in', 'Para el jueves'], ['out', 'El jueves tengo a las 11:00 y a las 16:00. ¿Cuál te acomoda?']];
}

// Íconos del sprite HORIZON incrustados (los <use> a un archivo externo no se ven en varios visores de PDF).
const ICONOS = {
  'i-check': '<path d="M5 12.5l4.2 4.2L19 7"/>',
  'i-clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  'i-shield': '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
  'i-calendar': '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>',
  'i-chat': '<path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5z"/><path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" stroke-width="2.4"/>',
  'i-wallet': '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16.5" height="11" rx="2.5"/><path d="M16.5 13.5h.01" stroke-width="2.6"/>',
  'i-users': '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14a5.6 5.6 0 0 1 3.5 5.5"/>',
  'i-bell': '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  'i-web': '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01"/><path d="M7 13h6M7 16h4"/>',
  'i-layers': '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 17l9 5 9-5" opacity=".7"/>',
  'i-spark': '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>',
  'i-agent': '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 7V4M9.5 4h5"/><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"/><path d="M2 12v3M22 12v3"/>',
  'i-search': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  'i-panel': '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 16v-3M11 16V9M15 16v-5M19 8l-3 3"/>',
  'i-flow': '<rect x="3" y="4" width="6" height="5" rx="1.5"/><rect x="15" y="4" width="6" height="5" rx="1.5"/><rect x="9" y="15" width="6" height="5" rx="1.5"/><path d="M9 6.5h6M18 9v2.5a2 2 0 0 1-2 2h-1.5L12 15M6 9v2.5a2 2 0 0 0 2 2h1.5"/>',
  'i-arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icn = (n, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n] || ''}</svg>`;

// ── Propuesta: diapositivas 16:9. Solo colores sólidos y degradados opacos sobre fotos sin velos
// (las capas transparentes, desenfoques y vidrio no se ven bien en los visores de PDF del celular).
const PROP_CSS = `
:root{--dark:#1A1626;--chip:#2C2160;--chipb:#5B4A9E;--deepS:linear-gradient(150deg,#1E1744 0%,#2C2160 35%,#4A2A85 70%,#6B2F8E 100%);--hot:linear-gradient(120deg,#F2690C,#C4467A)}
@page{size:338.7mm 190.5mm;margin:0}
.sl{position:relative;width:min(100%,1180px);aspect-ratio:16/9;margin:24px auto;background:var(--bg);overflow:hidden;box-shadow:0 30px 60px -30px rgba(26,22,38,.35);break-after:page;font-size:clamp(9px,1.06vw,12.6px)}
.sl h1,.sl h2,.sl h3{margin:0;font-weight:800;letter-spacing:-.035em;line-height:1.02}
.pg-n{position:absolute;right:2.6%;bottom:3.6%;font:500 .8em var(--m);color:var(--ink3);z-index:3}
.lg{height:2.4em;width:auto;display:block}
.img{background-size:cover;background-position:center}
.ico{stroke-width:1.8}
.chipI{width:2.6em;height:2.6em;border-radius:12px;background:var(--hot);color:#fff;display:grid;place-items:center;flex:none}.chipI .ico{width:1.3em;height:1.3em}
.deep{background:var(--deepS);color:#fff}.deep .eb{color:#E4DDF5}
/* 1 portada: panel sólido + foto nítida */
.s1{display:grid;grid-template-columns:46% 54%}
.s1 .l{padding:5.5% 6%;display:grid;grid-template-rows:auto 1fr auto;gap:1.5em}
.s1 h1{font-size:5em;align-self:end}.s1 h1 small{display:block;font:500 .19em var(--m);letter-spacing:.16em;text-transform:uppercase;color:#FFB27A;margin-bottom:1.3em}
.s1 .sub{margin:1em 0 0;color:#E4DDF5;font-size:1.15em;max-width:26em}
.tg{display:inline-flex;align-items:center;gap:.6em;padding:.55em 1em;border-radius:99px;font:600 .88em var(--f);background:var(--chip);border:1px solid var(--chipb);color:#fff;margin:0 .5em .5em 0}
.s1 .r{position:relative}.s1 .r .img{position:absolute;inset:0}
.cb{position:absolute;left:5%;bottom:6%;background:#fff;border-radius:16px;padding:.7em 1.1em;display:flex;align-items:center;gap:.8em;box-shadow:0 20px 40px -20px rgba(26,22,38,.5);font-weight:700;font-size:.95em}
.cb img{height:1.9em;width:auto}.cb i{width:.8em;height:.8em;border-radius:50%;background:var(--cli)}.cb span{font:500 .78em var(--m);letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);display:block}
/* 2 hola (se mantiene) */
.s2{display:grid;grid-template-columns:1fr 1fr}
.s2 .tx{padding:6% 5% 6% 7%;display:flex;flex-direction:column;justify-content:center;gap:1.2em}
.s2 h2{font-size:4.4em}.s2 p{margin:0;color:var(--ink2);font-size:1.12em;max-width:32em}
.col{position:relative}
.col .a{position:absolute;left:4%;top:9%;width:52%;height:62%;border-radius:22px;box-shadow:0 30px 50px -25px rgba(26,22,38,.5)}
.col .b{position:absolute;right:6%;top:4%;width:38%;height:44%;border-radius:22px;box-shadow:0 30px 50px -25px rgba(26,22,38,.5)}
.col .c{position:absolute;right:10%;bottom:8%;width:46%;height:42%;border-radius:22px;box-shadow:0 30px 50px -25px rgba(26,22,38,.5)}
.sticker{position:absolute;left:6%;bottom:12%;z-index:3;background:var(--dark);color:#fff;border-radius:18px;padding:1em 1.2em;max-width:40%;font-size:.95em}
.sticker b{display:block;font-size:1.05em;margin-bottom:.2em}
.brandcol{position:absolute;inset:8% 8% 8% 4%;border-radius:28px;background:var(--deepS);display:grid;place-items:center;color:#fff;text-align:center;font-size:2.4em;font-weight:800;letter-spacing:-.03em;padding:1em}
/* 3 lo que vimos */
.s3{display:grid;grid-template-columns:.92fr 1.08fr;gap:3%;padding:5% 5.5% 5% 6.5%}
.s3 .l{display:flex;flex-direction:column;gap:1.6em}.s3 h2{font-size:3.8em}
.money{flex:1;border-radius:26px;background:var(--deepS);color:#fff;padding:1.8em 2em;display:flex;flex-direction:column;justify-content:space-between}
.money .v{font-size:5.6em;font-weight:800;letter-spacing:-.05em;line-height:.95;color:#FFB27A}.money .v small{font-size:.24em;letter-spacing:0;color:#fff;font-weight:600}
.money p{margin:0;color:#D7CFEA;font-size:.95em}
.s3 .r{display:flex;flex-direction:column;justify-content:center;gap:1em}
.rd{background:var(--surface);border:1px solid var(--line);border-left:6px solid var(--cli);border-radius:18px;padding:1.3em 1.5em;display:grid;grid-template-columns:3em 1fr;gap:1.1em;align-items:center;box-shadow:0 18px 36px -26px rgba(26,22,38,.4)}
.rd .n{width:3em;height:3em;border-radius:14px;background:var(--hot);color:#fff;display:grid;place-items:center;font:600 1em var(--m)}
.rd p{margin:0;font-size:1.18em;line-height:1.4;font-weight:500}
/* 4 sistema */
.s4{display:grid;grid-template-columns:.82fr 1.18fr}
.s4 .l{padding:5.5% 3% 5.5% 7%;display:flex;flex-direction:column;justify-content:center;gap:1em}
.s4 h2{font-size:3.6em}.s4 p{margin:0;color:var(--ink2);font-size:1.05em}
.steps{display:grid;gap:.5em;margin-top:.4em}.stp{display:grid;grid-template-columns:2.4em 1fr auto;gap:.8em;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:.55em .8em}
.stp .ic{width:2.4em;height:2.4em;border-radius:10px;background:var(--bg2);color:var(--acc);display:grid;place-items:center}.stp b{font-size:.96em}
.stp em{font:500 .68em var(--m);font-style:normal;text-transform:uppercase;letter-spacing:.08em;padding:.3em .6em;border-radius:99px;background:var(--bg2);color:var(--ink2)}
.stp.pro em{background:var(--dark);color:#fff}.stp.pro .ic{background:var(--dark);color:#fff}
.stage{position:relative;margin:4% 4% 4% 0;border-radius:28px;background:var(--bg2)}
.phn{position:absolute;top:11%;height:78%;aspect-ratio:9/19;border-radius:2.2em;background:#111;padding:.55em;box-shadow:0 40px 60px -30px rgba(26,22,38,.6)}
.phn .scr{width:100%;height:100%;border-radius:1.75em;overflow:hidden;background:#fff}
.phn .scr img{width:100%;display:block}
.phn.web{left:4%}.phn.wa{left:31%;z-index:2}
.wa .scr{background:#EFE7DE;display:flex;flex-direction:column}
.wah{background:#008069;color:#fff;display:flex;align-items:center;gap:.5em;padding:1.4em .7em .6em}.wah .av{width:2em;height:2em;border-radius:50%;background:#fff;display:grid;place-items:center;overflow:hidden;flex:none}.wah .av img{width:82%}.wah b{font-size:.78em;display:block;line-height:1.2}.wah small{font-size:.62em;opacity:.85}
.wab{flex:1;padding:.6em .55em;display:flex;flex-direction:column;gap:.42em;font-size:.68em}
.day{align-self:center;background:#fff;border-radius:6px;padding:.15em .6em;font-size:.85em;color:#54656F}
.bb{max-width:86%;padding:.45em .6em .3em;border-radius:.6em;line-height:1.3;box-shadow:0 1px .5px rgba(11,20,26,.13);color:#111B21}.bb.in{background:#fff;align-self:flex-start;border-top-left-radius:0}.bb.out{background:#D9FDD3;align-self:flex-end;border-top-right-radius:0}
.bb time{display:block;text-align:right;font-size:.78em;color:#667781;margin-top:.1em}.bb.out time::after{content:' ✓✓';color:#53BDEB}
.wai{display:flex;gap:.4em;padding:.45em;align-items:center}.wai div{flex:1;background:#fff;border-radius:99px;padding:.45em .7em;font-size:.62em;color:#8696A0}.wai span{width:2em;height:2em;border-radius:50%;background:#00A884;flex:none}
.pnl{position:absolute;right:3%;top:9%;width:33%;background:var(--surface);border-radius:18px;box-shadow:0 30px 50px -28px rgba(26,22,38,.55);overflow:hidden;z-index:3}
.pnl .hd{background:var(--dark);color:#fff;padding:.7em .9em;display:flex;justify-content:space-between;align-items:center;font-size:.8em}.pnl .hd small{font:500 .8em var(--m);color:#B9B3CC}
.pnl .kp{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line)}.pnl .kp div{padding:.6em .7em}.pnl .kp div+div{border-left:1px solid var(--line)}.pnl small{display:block;font:500 .6em var(--m);text-transform:uppercase;color:var(--ink3)}.pnl .kp b{font-size:1.3em}
.pnl .it{padding:.7em .9em;font-size:.78em;display:grid;gap:.2em}.pnl .it .tp{display:flex;justify-content:space-between;align-items:center}.ok{font:500 .7em var(--m);text-transform:uppercase;padding:.25em .5em;border-radius:6px;background:#DDF5E6;color:#15803D}
.avs{position:absolute;right:3%;bottom:9%;width:33%;background:var(--dark);color:#fff;border-radius:16px;padding:.8em 1em;font-size:.78em;z-index:3}.avs b{display:block;margin-bottom:.2em}
/* 5 propuesta */
.s5{display:grid;grid-template-columns:.74fr 1.26fr}
.s5 .ph{position:relative}.s5 .ph .img{position:absolute;inset:0}
.s5 .ph .cap{position:absolute;left:6%;right:6%;bottom:5%;background:var(--dark);color:#fff;border-radius:18px;padding:1em 1.2em}.s5 .ph .cap h2{font-size:2.6em}
.s5 .body{padding:4.5% 5% 4.5% 4.5%;display:grid;grid-template-rows:auto 1fr auto;gap:1.1em}
.s5 .hd2{display:flex;justify-content:space-between;align-items:flex-end;gap:1em;border-bottom:2px solid var(--ink);padding-bottom:.8em}
.s5 .hd2 h2{font-size:3em}.s5 .hd2 p{margin:.3em 0 0;color:var(--ink2);max-width:36em}
.ents{display:grid;grid-template-columns:1fr 1fr;gap:.8em 1.4em;align-content:center}
.ent{display:grid;grid-template-columns:2.6em 1fr;gap:.8em;align-items:start}.ent b{display:block;font-size:1em}.ent span{color:var(--ink2);font-size:.88em;line-height:1.4}
.price{border-radius:22px;background:var(--deepS);color:#fff;display:grid;grid-template-columns:1fr 1.3fr 1.3fr;gap:1.2em;padding:1.1em 1.6em;align-items:center}
.price small{display:block;font:500 .7em var(--m);letter-spacing:.1em;text-transform:uppercase;color:#D7CFEA}.price b{font-size:2em;letter-spacing:-.03em}.price .o{color:#FFB27A}.price em{font-style:normal;color:#D7CFEA;font-size:.82em}
/* 6 a tener en cuenta */
.s6{display:grid;grid-template-columns:1.55fr .85fr;gap:2.4%;padding:5% 5.5% 5% 6.5%}
.s6 .l{display:grid;grid-template-rows:auto 1fr;gap:1.4em}.s6 h2{font-size:3.6em}
.g4{display:grid;grid-template-columns:1fr 1fr;gap:1em}
.tc{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:1.3em 1.4em;display:grid;grid-template-columns:auto 1fr;gap:.4em 1em;align-content:start}
.tc .big{grid-column:1/-1;font-size:2.6em;font-weight:800;letter-spacing:-.04em;line-height:1;color:var(--ink)}.tc .big span{color:var(--acc)}
.tc b{font-size:1.05em;align-self:center}.tc p{grid-column:1/-1;margin:0;color:var(--ink2);font-size:.95em}
.s6 .r{display:grid;grid-template-rows:1fr 1fr;gap:1em}
.dc{border-radius:22px;padding:1.5em;display:flex;flex-direction:column;justify-content:space-between}
.dc .v{font-size:3.4em;font-weight:800;letter-spacing:-.04em;line-height:1}.dc p{margin:0;font-size:.98em}
.dc.a{background:var(--deepS);color:#fff}.dc.a .v{color:#FFB27A}.dc.a p{color:#D7CFEA}.dc.b{background:var(--dark);color:#fff}.dc.b p{color:#B9B3CC}
/* 7 proceso */
.s7{padding:4.5% 5.5% 4.5% 6.5%;display:grid;grid-template-rows:auto 1fr;gap:1.6em}
.s7 .hd{display:flex;justify-content:space-between;align-items:flex-end;gap:2em}.s7 h2{font-size:3.6em}.s7 .hd p{margin:0;max-width:30em;color:var(--ink2)}
.pc{display:grid;grid-template-columns:repeat(4,1fr);gap:1em}
.pk{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:1.3em;display:grid;grid-template-rows:auto auto auto 1fr auto;gap:.6em;position:relative}
.pk.on{background:var(--deepS);color:#fff;border:0}.pk.on .who{color:#D7CFEA}.pk.on li{color:#fff}
.pk .nn{font-size:3em;font-weight:800;letter-spacing:-.05em;line-height:1;background:var(--hot);-webkit-background-clip:text;background-clip:text;color:transparent}
.pk.on .nn{background:none;-webkit-text-fill-color:#FFB27A;color:#FFB27A}
.pk h3{font-size:1.5em}.pk .du{justify-self:start;font:500 .72em var(--m);letter-spacing:.08em;text-transform:uppercase;padding:.35em .7em;border-radius:99px;background:var(--bg2);color:var(--acc)}
.pk.on .du{background:var(--chip);color:#FFB27A}
.pk ul{list-style:none;margin:0;padding:0;display:grid;gap:.4em;align-content:start}.pk li{display:grid;grid-template-columns:1.2em 1fr;gap:.5em;font-size:.92em;color:var(--ink)}.pk li .ico{width:1.1em;height:1.1em;color:var(--acc);margin-top:.15em}
.who{border-top:1px dashed var(--line2);padding-top:.6em;font-size:.86em;color:var(--ink2)}.who b{color:inherit}
/* 8 dudas */
.s8{padding:4.5% 5.5% 4.5% 6.5%;display:grid;grid-template-rows:auto 1fr;gap:1.6em;background:var(--bg2)}
.s8 h2{font-size:3.6em}.s8 h2 span{color:var(--acc)}
.qa{display:grid;grid-template-columns:repeat(3,1fr);gap:1em}
.q{background:var(--surface);border-radius:22px;padding:1.3em 1.4em;display:flex;flex-direction:column;gap:.6em;border:1px solid var(--line)}
.q b{font-size:1.15em;letter-spacing:-.01em}.q p{margin:0;color:var(--ink2);font-size:.95em}.q .tag2{align-self:flex-start;font:500 .7em var(--m);letter-spacing:.08em;text-transform:uppercase;padding:.3em .6em;border-radius:6px;background:var(--dark);color:#fff}
/* 9 contraportada */
.s9{display:grid;grid-template-columns:1fr 1fr}
.s9 .l{padding:6% 6.5%;display:grid;grid-template-rows:auto 1fr auto;gap:1.5em}
.s9 h2{font-size:4.2em;align-self:center}.s9 h2 span{color:#FFB27A}
.ct{display:grid;grid-template-columns:auto 1fr;gap:.45em 1.4em;border-top:1px solid var(--chipb);padding-top:1em;font-size:.98em}.ct span:nth-child(odd){font:500 .72em var(--m);letter-spacing:.12em;text-transform:uppercase;color:#D7CFEA;padding-top:.3em}
.s9 .r{display:grid;grid-template-rows:44% 1fr}.s9 .r .img{border-bottom-left-radius:0}
.s9 .r .bx{padding:5% 7%;display:flex;flex-direction:column;justify-content:space-between}
.ps{list-style:none;margin:.6em 0 0;padding:0;counter-reset:p}.ps li{counter-increment:p;display:grid;grid-template-columns:2.6em 1fr;padding:.6em 0;border-top:1px solid var(--line2);font-weight:500}.ps li::before{content:'0' counter(p);font:600 .9em var(--m);color:var(--acc)}
.sig{border-top:2px solid var(--ink);padding-top:.6em;font-size:.9em}.sig small{display:block;font:500 .72em var(--m);letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-top:.3em}
@media screen and (max-width:760px){
 .sl{aspect-ratio:auto;width:auto;margin:0 0 12px;font-size:13px;display:block;padding:0}
 .s1 .r,.col,.s5 .ph,.s9 .r .img{height:340px}.s1 .r{position:relative}.s1 h1{font-size:3em}
 .s1 .l,.s2 .tx,.s4 .l,.s5 .body,.s9 .l,.s9 .r .bx{padding:28px 20px}.s3,.s6,.s7,.s8{padding:28px 20px}
 .s3,.s6{display:grid;grid-template-columns:1fr;gap:16px}.stage{height:460px;margin:0 16px 20px}.phn{height:88%}.phn.web{left:4%}.phn.wa{left:auto;right:4%}.pnl,.avs{display:none}
 .ents,.price,.g4,.pc,.qa,.s9{grid-template-columns:1fr}.s7 .hd{flex-direction:column;align-items:start}.pg-n{display:none}}
@media print{.sl{margin:0;width:338.7mm;height:190.5mm;aspect-ratio:auto;box-shadow:none;font-size:12.6px}}`;

function propuesta(lead) {
  const D = datos(lead), { pk, rx, k } = D, M = medios(D);
  const F = i => M.fotos.length ? M.fotos[i % M.fotos.length] : '';
  const bg = u => u ? `style="background-image:url('${h(u)}')"` : 'style="background:var(--deepS)"';
  const lecturas = Array.isArray(rx.lecturas) && rx.lecturas.length ? rx.lecturas.slice(0, 3) : (rx.mejoras || []).slice(1, 4);
  const pasos = [['i-search', 'Le encuentran en Google y en su web'], ['i-chat', 'Le escriben por WhatsApp'], ['i-agent', 'El agente responde y agenda'], ['i-panel', 'Todo queda en su panel']];
  if (k === 'pro') pasos.push(['i-bell', 'Seguimiento y recordatorios'], ['i-users', 'Sus clientes vuelven']);
  const msgs = charla(rx.modelo);
  const icEnt = ['i-web', 'i-search', 'i-agent', 'i-panel', 'i-bell', 'i-users', 'i-spark', 'i-layers'];
  const first = D.nombre.split(' ')[0] || '';
  const shot = rx.negocio_slug && MEDIA[rx.negocio_slug] ? `/Identidad/demos/${rx.negocio_slug}-web.jpg` : '';
  const horas = ['10:41', '10:41', '10:42', '10:42'];
  const s = [];
  s.push(`<section class="sl s1"><div class="l deep"><img class="lg" src="${LOGO}" alt="HORIZON">
    <h1><small>Propuesta · ${h(pk.nm)}</small>${h(D.negocio)}</h1>
    <div><p class="sub">Un sistema que atiende, agenda y ordena su negocio, armado con lo que vimos en su local.</p>
    <div style="margin-top:1.4em"><span class="tg">${h(D.fechaCorta)}</span><span class="tg">Válida por 15 días</span><span class="tg">Rancagua</span></div></div></div>
    <div class="r"><div class="img" ${bg(M.hero)}></div><div class="cb">${M.logo ? `<img src="${h(M.logo)}" alt="">` : '<i></i>'}<div><span>HORIZON ×</span>${h(D.negocio)}</div></div></div></section>`);
  s.push(`<section class="sl s2"><div class="tx"><span class="eb">Rancagua · ${h(D.fechaLarga)}</span>
    <h2>Hola${first ? ', ' + h(first) : ''}.<br><span class="g">Esto es para usted.</span></h2>
    <p>Gracias por recibirnos en ${h(D.negocio)}. Esta propuesta no es genérica: está armada con lo que vimos en su local y con sus propias respuestas a la radiografía.</p>
    <p>La idea es simple: que ningún cliente que le escriba se pierda, y que cada consulta tenga la oportunidad de convertirse en venta.</p></div>
    <div class="col">${M.fotos.length ? `<div class="img a" ${bg(F(0))}></div><div class="img b" ${bg(F(1))}></div><div class="img c" ${bg(F(2))}></div>` : `<div class="brandcol">HORIZON ×<br>${h(D.negocio)}</div>`}
    <div class="sticker"><b>Armado para ${h(D.negocio)}</b>Con su información, sus precios y su forma de atender.</div></div><span class="pg-n">02</span></section>`);
  s.push(`<section class="sl s3"><div class="l"><div><span class="eb">Diagnóstico</span><h2 style="margin-top:.4em">Lo que vimos<br>en su negocio</h2></div>
    ${rx.escape_mes ? `<div class="money"><span class="eb">Se escapa hoy, aprox.</span><div><div class="v">${clp(rx.escape_mes)}<small> al mes</small></div><p style="margin-top:.8em">Estimación a la baja con sus respuestas. No es una promesa: es lo que hoy no está entrando.</p></div></div>` : ''}</div>
    <div class="r">${lecturas.map((x, i) => `<div class="rd"><span class="n">0${i + 1}</span><p>${h(x)}</p></div>`).join('')}</div><span class="pg-n">03</span></section>`);
  s.push(`<section class="sl s4"><div class="l"><span class="eb">Cómo funciona</span><h2>Su negocio,<br><span class="g">atendiendo solo.</span></h2>
    <p>Cada pieza le pasa la información a la siguiente. Nada queda suelto en el chat ni en el cuaderno.</p>
    <div class="steps">${pasos.map((p, i) => `<div class="stp${i > 3 ? ' pro' : ''}"><span class="ic">${icn(p[0])}</span><b>${h(p[1])}</b><em>${i > 3 ? 'Pro' : 'Incluido'}</em></div>`).join('')}</div></div>
    <div class="stage">${shot ? `<div class="phn web"><div class="scr"><img src="${shot}" alt="Web de ${h(D.negocio)}"></div></div>` : ''}
      <div class="phn wa" ${shot ? '' : 'style="left:12%"'}><div class="scr"><div class="wah"><span class="av">${M.logo ? `<img src="${h(M.logo)}" alt="">` : ''}</span><div><b>${h(D.negocio)}</b><small>en línea</small></div></div>
      <div class="wab"><span class="day">HOY</span>${msgs.map((m, i) => `<div class="bb ${m[0]}">${h(m[1])}<time>${horas[i]}</time></div>`).join('')}</div><div class="wai"><div>Mensaje</div><span></span></div></div></div>
      <div class="pnl"><div class="hd"><b>Panel · Hoy</b><small>${h(D.negocio.split(' ')[0])}</small></div><div class="kp"><div><small>Consultas</small><b>24</b></div><div><small>Agendadas</small><b>17</b></div><div><small>Sin resp.</small><b>0</b></div></div>
      <div class="it"><div class="tp"><b>Nuevo ${rx.modelo === 'clinica' ? 'paciente' : 'pedido'}</b><span class="ok">Confirmado</span></div><span style="color:var(--ink2)">Tomado por el agente a las 10:42</span></div></div>
      <div class="avs"><b>🔔 Aviso al dueño</b>Le llega a su WhatsApp con el cliente, el detalle y la hora.</div>
    </div><span class="pg-n">04</span></section>`);
  s.push(`<section class="sl s5"><div class="ph"><div class="img" ${bg(F(4) || M.hero)}></div><div class="cap"><span class="eb" style="color:#D7CFEA">Nuestra propuesta</span><h2 style="margin-top:.3em">${h(pk.nm)}</h2></div></div>
    <div class="body"><div class="hd2"><div><span class="eb">${k === 'pro' ? 'Llena la agenda y hace volver' : 'Atiende y agenda'}</span><h2 style="margin-top:.3em">Qué recibe</h2>
    <p>${k === 'pro' ? 'Un agente que atiende y agenda 24/7, y un sistema que sigue trabajando después de la conversación.' : 'Un agente que atiende y agenda 24/7, con la web y el panel donde queda cada contacto.'}</p></div></div>
    <div class="ents">${pk.incluye.map(([a, b], i) => `<div class="ent"><span class="chipI">${icn(icEnt[i % icEnt.length])}</span><div><b>${h(a)}</b><span>${h(b)}</span></div></div>`).join('')}</div>
    <div class="price"><div><small>Plazo</small><b>${h(pk.plazo)}</b></div><div><small>Implementación · pago único</small><b class="o">${clp(pk.impl)}</b><br><em>50% al firmar · 50% antes de la entrega</em></div><div><small>Mensualidad desde el mes 2</small><b>${clp(pk.mes)}</b><br><em>Mes a mes, sin permanencia</em></div></div></div><span class="pg-n">05</span></section>`);
  s.push(`<section class="sl s6"><div class="l"><div><span class="eb">Modalidad de pago y forma de trabajo</span><h2 style="margin-top:.4em">A tener en cuenta</h2></div>
    <div class="g4"><div class="tc"><span class="chipI">${icn('i-wallet')}</span><b>Pago</b><div class="big">50<span>/</span>50</div><p>50% al firmar para reservar el inicio y 50% antes de la entrega final, desde su portal de cliente.</p></div>
    <div class="tc"><span class="chipI">${icn('i-layers')}</span><b>Revisiones</b><div class="big">2 <span>rondas</span></div><p>De cambios sobre el diseño, antes de construir.</p></div>
    <div class="tc"><span class="chipI">${icn('i-clock')}</span><b>Sus respuestas</b><div class="big">5 <span>días</span></div><p>Hábiles para entregar información o aprobar. Si se atrasa, la entrega se corre en los mismos días.</p></div>
    <div class="tc"><span class="chipI">${icn('i-shield')}</span><b>Garantía</b><div class="big">30 <span>días</span></div><p>De corrección de errores después de la entrega, con el primer mes de soporte incluido.</p></div></div></div>
    <div class="r"><div class="dc a"><span class="eb">Inicio</span><div><div class="v">48 h</div><p>Desde el pago inicial, con la reunión de kickoff.</p></div></div>
    <div class="dc b"><span class="eb" style="color:#B9B3CC">Mensualidad</span><div><div class="v">${clp(pk.mes)}</div><p>Desde el mes 2. Mes a mes, sin permanencia.</p></div></div></div><span class="pg-n">06</span></section>`);
  const etapas = [
    ['01', 'Diagnóstico', 'Hoy', ['Visitamos su local', 'Probó su agente', 'Radiografía del negocio'], 'Usted: conversar 15 minutos.', true],
    ['02', 'Kickoff', '48 horas', ['Ordenamos precios, fotos y horarios', 'Creamos su panel y su portal', 'Fijamos las fechas'], 'Usted: una reunión y su información.'],
    ['03', 'Construcción', pk.plazo, ['Diseñamos y usted aprueba', 'Entrenamos al agente con su negocio', 'Conectamos web, WhatsApp y panel'], 'Usted: aprobar el diseño (2 rondas).'],
    ['04', 'Entrega y soporte', 'Mes a mes', ['Lo dejamos funcionando', 'Le enseñamos a usar el panel', 'Ajustamos el agente cada mes'], 'Usted: atender a los clientes que llegan.'],
  ];
  s.push(`<section class="sl s7"><div class="hd"><div><span class="eb">Paso a paso</span><h2 style="margin-top:.4em">Cómo trabajamos juntos</h2></div><p>Nosotros hacemos el trabajo técnico. A usted le pedimos poco tiempo y decisiones claras.</p></div>
    <div class="pc">${etapas.map(e => `<div class="pk${e[5] ? ' on' : ''}"><span class="nn">${e[0]}</span><h3>${h(e[1])}</h3><span class="du">${h(e[2])}</span><ul>${e[3].map(x => `<li>${icn('i-check')}<span>${h(x)}</span></li>`).join('')}</ul><div class="who">${h(e[4])}</div></div>`).join('')}</div><span class="pg-n">07</span></section>`);
  const dudas = [
    ['¿Tengo que saber de tecnología?', 'No. Nosotros lo instalamos y lo dejamos funcionando. Usted solo aprueba y usa el panel desde el celular.', 'Sin curva'],
    ['¿Y si el agente responde mal?', 'Se entrena con su información real y lo ajustamos cada mes con sus conversaciones. Si algo necesita a una persona, le avisa a usted.', 'Ajuste mensual'],
    ['¿Me amarro a un contrato largo?', 'No. La mensualidad es mes a mes y sin permanencia. Si quiere terminar, avisa con 15 días.', 'Sin permanencia'],
    ['¿Y si no me sirve?', 'Tiene 30 días de garantía después de la entrega, con el primer mes de soporte incluido.', '30 días'],
    ['¿La web y los datos son míos?', 'Sí. Pagado el proyecto, el sitio, los contenidos y las cuentas quedan a su nombre.', 'Todo suyo'],
    ['¿Cuánto tiempo me toma a mí?', 'Una reunión de inicio y aprobar el diseño. Le damos 5 días hábiles para cada respuesta.', 'Poco tiempo'],
  ];
  s.push(`<section class="sl s8"><div><span class="eb">Sin letra chica</span><h2 style="margin-top:.4em">Lo que suele preocupar <span>(y por qué no debería)</span></h2></div>
    <div class="qa">${dudas.map(d => `<div class="q"><span class="tag2">${h(d[2])}</span><b>${h(d[0])}</b><p>${h(d[1])}</p></div>`).join('')}</div><span class="pg-n">08</span></section>`);
  s.push(`<section class="sl s9"><div class="l deep"><img class="lg" src="${LOGO}" alt="HORIZON"><h2>Está a un paso de que su negocio <span>atienda solo.</span></h2>
    <div class="ct"><span>Correo</span><span>${CONTACTO.correo}</span><span>WhatsApp</span><span>${CONTACTO.whatsapp}</span><span>Web</span><span>${CONTACTO.web}</span></div></div>
    <div class="r"><div class="img" ${bg(F(5) || M.hero)}></div><div class="bx"><div><span class="eb">Próximos pasos</span><ol class="ps"><li>Aceptar esta propuesta.</li><li>Firmar el contrato y pagar el 50% desde su portal.</li><li>Kickoff en 48 horas.</li></ol></div>
    <div class="sig"><b>Acepto la propuesta</b> · ${h(D.nombre)}<small>${h(D.negocio)} · HZ-${D.anio}-${h(D.slug)}-PRO</small></div></div></div></section>`);
  return shell({ titulo: 'Propuesta · ' + D.negocio, cuerpo: s.join('\n'), css: PROP_CSS, color: D.color, tema: M.tema });
}

// ── Contrato: carta vertical con la diagramación del "Acuerdo de trabajo" y la identidad HORIZON.
const CON_CSS = `
@page{size:letter;margin:0}
.pg{position:relative;width:min(100%,816px);min-height:1056px;margin:24px auto;background:var(--surface);box-shadow:0 30px 60px -30px rgba(26,22,38,.35);display:flex;flex-direction:column;break-after:page;overflow:hidden}
.pg::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--grad)}
.band{background:var(--ink);color:#B9B3CC;display:flex;justify-content:space-between;align-items:center;padding:18px 56px;font:500 7.5pt var(--m);letter-spacing:.12em;text-transform:uppercase}
.band img{height:17px}.band i{width:8px;height:8px;border-radius:50%;background:var(--cli);display:inline-block;margin-right:8px}
.in{padding:34px 56px 26px;flex:1}
.foot{display:flex;justify-content:space-between;padding:14px 56px 22px;border-top:1px solid var(--line);font:500 7pt var(--m);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}.foot b{color:var(--ink);font-weight:500}
.cover{padding:0;background:var(--ink)}.cover::before{display:none}
.cover .photo{height:40%;min-height:380px;background-size:cover;background-position:center;position:relative}
.cover .top{background:var(--ink);display:flex;justify-content:space-between;align-items:center;padding:22px 56px}.cover .top img{height:26px}

.cover .cb{display:flex;align-items:center;gap:10px;background:#fff;border-radius:99px;padding:6px 14px 6px 6px;color:var(--ink);font:600 9pt var(--f)}
.cover .cb img{height:22px;padding:0 6px}.cover .cb i{width:10px;height:10px;border-radius:50%;background:var(--cli);margin-left:6px}
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
.ents .ico{width:14px;height:14px}
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

  const portada = `<section class="pg cover"><div class="top"><img src="${LOGO}" alt="HORIZON"><span class="cb">${M.logo ? `<img src="${h(M.logo)}" alt="">` : '<i></i>'}HORIZON × ${h(D.negocio)}</span></div><div class="photo" ${photo}></div>
    <div class="body"><div><span class="eb">${h(codigo)}</span><h1 style="margin-top:14px">Contrato de prestación<br>de servicios<span>.</span></h1><p class="sub">Implementación ${h(pk.nm)} para ${h(D.negocio)}</p></div>
    <div class="parties"><div class="party"><small>/ Cliente</small><b>${h(clienteNom)}</b></div><div class="party"><small>/ Prestador</small><b>HORIZON · ${PREST}</b></div>
    <div class="party"><small>/ Servicio</small><b>${h(pk.nm)} · ${h(pk.plazo)}</b></div><div class="party"><small>/ Fecha</small><b>${h(D.fechaLarga)}</b></div></div></div></section>`;

  const p2 = `<section class="pg">${band}<div class="in">
    <h2 class="sec">Identificación de las partes</h2>
    <p>En Rancagua, a ${D.fechaLarga}, comparecen: por una parte, <strong>${PREST}</strong>, RUT ${pRut}, con domicilio en ${pDom}, que opera bajo el nombre comercial HORIZON, en adelante "el Prestador"; y por la otra, ${cliente}, en adelante "el Cliente". Las partes acuerdan el siguiente contrato:</p>
    <h2 class="sec" style="margin-top:20px">Términos del contrato</h2>
    ${cl(1, 'Objeto', `El Prestador se obliga a diseñar, construir, configurar y entregar funcionando el ${pk.nm} para el negocio del Cliente, según el alcance detallado en el Anexo A, que forma parte integrante de este contrato.`)}
    <div class="boxes"><div class="box"><div><small>Servicio contratado</small><b>${h(pk.nm)}</b></div></div><div class="box"><div><small>Tiempo estimado de entrega</small><b>${h(pk.plazo)}</b></div></div></div>
    <div class="ents">${pk.incluye.map(([a]) => `<div>${icn('i-check')}${h(a)}</div>`).join('')}</div>
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
