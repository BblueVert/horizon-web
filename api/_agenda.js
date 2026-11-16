'use strict';

// Agenda de las demos de reservas (/demo/<slug>): de la ficha saca los días y horas en que se
// puede reservar, y con las horas ya tomadas en Mesa Cero arma la disponibilidad.
//   - Horario de atención: local.horario ("lunes a viernes 9:00 a 19:00, sábado 9:00 a 13:00").
//   - Horas para reservar: reservas.horarios, en una de estas formas:
//       "cada 40 minutos entre 10:00 y 19:20" · "cada 30 minutos en horario de atención"
//       "lunes a viernes 10:00, 12:00 y 15:00; sábado 10:00" · "bloques de mañana (9:00 a 13:00) y tarde (14:00 a 19:00)"
//     Si no calza ninguna, cada 60 min dentro del horario de atención.
//   - Duración del servicio: su descripción ("40 min", "2 h", "1 h 30 min"); si no dice, 30 min.
// Todo en hora de Chile.

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const sinTilde = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const aMin = (h) => { const [a, b] = String(h).split(':'); return Number(a) * 60 + Number(b || 0); };
const aHora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// "lunes a viernes", "sábado y domingo", "lunes, miércoles y viernes", "todos los días" → [1..5]
function diasDe(txt) {
  const t = sinTilde(txt);
  if (/todos los dias|diario|cada dia/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const set = new Set();
  const rango = /(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+a\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/g;
  let m; let resto = t;
  while ((m = rango.exec(t))) {
    let i = DIAS.indexOf(m[1]); const f = DIAS.indexOf(m[2]);
    for (let k = 0; k < 7; k++) { set.add(i); if (i === f) break; i = (i + 1) % 7; }
    resto = resto.replace(m[0], ' ');
  }
  for (const d of DIAS) if (new RegExp(`\\b${d}s?\\b`).test(resto)) set.add(DIAS.indexOf(d));
  return [...set];
}

// Horario de atención → { díaSemana: [[ini, fin], ...] } en minutos.
function atencion(txt) {
  const out = {};
  const partes = String(txt || '').split(/[;,](?=\s*(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|todos|urgencias))/i);
  for (const p of partes) {
    if (/urgencia/i.test(p)) continue;
    const dias = diasDe(p);
    const h = p.match(/(\d{1,2}:\d{2})\s*(?:a|-|–|hasta)\s*(\d{1,2}:\d{2})/);
    if (!dias.length || !h) continue;
    for (const d of dias) (out[d] = out[d] || []).push([aMin(h[1]), aMin(h[2])]);
  }
  return out;
}

// Plantilla semanal de horas reservables: { díaSemana: [{ hora: 'HH:MM', etiqueta? }] }
function plantilla(ficha) {
  const loc = (ficha.locales || [])[0] || {};
  const abierto = atencion(loc.horario || ficha.horario || 'lunes a viernes 9:00 a 19:00, sábado 10:00 a 14:00');
  const r = String((ficha.reservas || {}).horarios || '');
  const out = {};
  const poner = (d, hora, etiqueta) => { (out[d] = out[d] || []).push(etiqueta ? { hora, etiqueta } : { hora }); };

  if (/(mañana|tarde|noche)\s*\(\d{1,2}:\d{2}\s*a\s*\d{1,2}:\d{2}\)/i.test(r)) {
    const bloques = [...r.matchAll(/(mañana|tarde|noche)\s*\((\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})\)/gi)];
    for (const d of Object.keys(abierto)) for (const b of bloques) {
      const ini = aMin(b[2]); if (abierto[d].some(([a, f]) => ini >= a && ini < f)) poner(+d, aHora(ini), `${b[1][0].toUpperCase()}${b[1].slice(1)} (${b[2]} a ${b[3]})`);
    }
  } else {
    // Frases ("visitas: …. Llamadas: …" → solo las que no son de llamadas) y, dentro, tramos por días.
    for (const frase of r.split(/[.;](?!\d)/)) {
      if (/llamad/i.test(frase)) continue;
      const cadaF = sinTilde(frase).match(/cada\s+(\d{1,3})\s*min|cada\s+hora/);
      const pasoF = cadaF ? (cadaF[1] ? Math.max(10, Number(cadaF[1])) : 60) : null;
      for (const tramo of frase.split(/,(?=\s*(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))/i)) {
        const dias = diasDe(tramo).length ? diasDe(tramo) : Object.keys(abierto).map(Number);
        const rango = tramo.match(/entre\s*(\d{1,2}:\d{2})\s*y\s*(\d{1,2}:\d{2})/i) || tramo.match(/(\d{1,2}:\d{2})\s*(?:a|hasta|-|–)\s*(\d{1,2}:\d{2})/);
        const horas = tramo.match(/\d{1,2}:\d{2}/g) || [];
        if (pasoF || (rango && horas.length === 2)) {
          const paso = pasoF || 60;
          for (const d of dias) {
            const tramos = rango ? [[aMin(rango[1]), aMin(rango[2])]] : (abierto[d] || []);
            for (const [a, f] of tramos) {
              const ultimo = rango && /entre/i.test(tramo) ? f : f - paso; // "entre 10:00 y 19:20": 19:20 es la última hora
              for (let m = a; m <= ultimo; m += paso) poner(d, aHora(m));
            }
          }
        } else if (horas.length) {
          for (const d of dias) for (const h of horas) poner(d, aHora(aMin(h)));
        }
      }
    }
  }
  for (const d of Object.keys(out)) out[d] = out[d].filter((x, k, arr) => arr.findIndex(y => y.hora === x.hora) === k);
  if (!Object.keys(out).length) {
    for (const d of Object.keys(abierto)) for (const [a, f] of abierto[d]) for (let m = a; m + 60 <= f; m += 60) poner(+d, aHora(m));
  }
  for (const d of Object.keys(out)) out[d].sort((x, y) => aMin(x.hora) - aMin(y.hora));
  return out;
}

// "45 min", "2 h", "1 h 30 min", "1 hora" → minutos (30 si no dice)
function duracion(item) {
  const t = sinTilde(`${(item && item.descripcion) || ''} ${(item && item.nombre) || ''}`);
  const h = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h\b|hrs?\b|horas?\b)/);
  const m = t.match(/(\d{1,3})\s*min/);
  const total = (h ? Math.round(parseFloat(h[1].replace(',', '.')) * 60) : 0) + (m ? Number(m[1]) : 0);
  return Math.min(480, Math.max(10, total || 30));
}

// Hoy en Chile: { fecha: 'AAAA-MM-DD', min: minutos desde medianoche }
function hoyChile() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaSemana = (f) => new Date(f + 'T12:00:00Z').getUTCDay();

// Disponibilidad de los próximos `dias` días para un servicio de `dur` minutos.
// ocupados: [{ fecha, hora, duracion_min }]
function disponibilidad(ficha, dur, ocupados, dias = 21) {
  const plan = plantilla(ficha);
  const hoy = hoyChile();
  const tomadas = {};
  for (const o of ocupados || []) (tomadas[o.fecha] = tomadas[o.fecha] || []).push([aMin(o.hora), aMin(o.hora) + (o.duracion_min || 30)]);
  const out = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(hoy.fecha, i);
    const slots = (plan[diaSemana(fecha)] || []).map(s => {
      const ini = aMin(s.hora), fin = ini + dur;
      const pasada = i === 0 && ini < hoy.min + 30;
      const choca = (tomadas[fecha] || []).some(([a, b]) => a < fin && ini < b);
      return { ...s, libre: !pasada && !choca };
    }).filter(s => !(i === 0 && aMin(s.hora) < hoy.min));
    out.push({ fecha, dia: diaSemana(fecha), slots });
  }
  return out;
}

// ¿Esa fecha y hora es una hora reservable y libre?
function esLibre(ficha, fecha, hora, dur, ocupados) {
  const dia = disponibilidad(ficha, dur, ocupados, 62).find(d => d.fecha === fecha);
  return !!(dia && dia.slots.some(s => s.hora === hora && s.libre));
}

module.exports = { plantilla, atencion, diasDe, duracion, disponibilidad, esLibre, hoyChile, sumarDias };
