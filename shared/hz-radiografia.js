/* HORIZON — Radiografía de terreno: preguntas, puntaje, cálculo de lo que se escapa y resumen.
   La usan /terreno/radiografia y /visita/<negocio>. Precios de terreno: fuente de verdad en ESTRATEGIA/HORIZON-ACELERADORA-NOV-DIC-2026.md. */
(function () {
  var PACK = {
    esencial: { nm: 'Esencial', cl: 'Atiende y agenda', impl: 290000, mes: 99000 },
    pro:      { nm: 'Pro', cl: 'Llena la agenda y hace volver', impl: 490000, mes: 149000 }
  };
  // [clave, texto, puntos Esencial, puntos Pro]
  var Q = [
    { id: 'q1', t: 'En un día normal, ¿cuántos mensajes te llegan por WhatsApp o Instagram?', o: [['menos5', 'Menos de 5', 0, 0], ['5a20', 'Entre 5 y 20', 1, 0], ['mas20', 'Más de 20', 1, 1]] },
    { id: 'q2', t: 'Cuando estás atendiendo y te escriben, ¿qué pasa con ese mensaje?', o: [['tiro', 'Respondo al tiro', 0, 0], ['horas', 'Respondo horas después', 1, 0], ['algunos', 'Algunos se quedan sin responder', 2, 0]] },
    { id: 'q3', t: '¿Te escriben de noche o el fin de semana?', o: [['nunca', 'Casi nunca', 0, 0], ['aveces', 'A veces', 1, 0], ['todos', 'Todos los días', 2, 0]] },
    { id: 'q4', t: '¿Cómo tomas hoy las horas o los pedidos?', o: [['sistema', 'Con un sistema', 0, 0], ['whatsapp', 'Por WhatsApp, a mano', 1, 0], ['cuaderno', 'En un cuaderno o de memoria', 2, 0]] },
    { id: 'q5', t: 'De cada 10 personas que te preguntan precio, ¿cuántas terminan reservando o comprando?', o: [['casitodas', 'Casi todas', 0, 0], ['mitad', 'Como la mitad', 0, 1], ['pocas', 'Pocas', 0, 2], ['nose', 'No sé', 0, 2]] },
    { id: 'q6', t: '¿Te pasa que reservan y no llegan?', o: [['nunca', 'Casi nunca', 0, 0], ['1a2', '1 o 2 veces por semana', 0, 1], ['varias', 'Varias veces por semana', 0, 2], ['sinhoras', 'No trabajo con horas', 0, 0]] },
    { id: 'q7', t: '¿Tus clientes vuelven solos?', o: [['mayoria', 'Sí, la mayoría', 0, 0], ['algunos', 'Algunos', 0, 1], ['unavez', 'Vienen una vez y no los veo más', 0, 2], ['unicavez', 'Mi negocio es de una sola vez', 0, 0]] },
    { id: 'q8', t: '¿Sabes cuánto vendiste el mes pasado y de dónde llegaron tus clientes?', o: [['exacto', 'Sí, exacto', 0, 0], ['masomenos', 'Más o menos', 0, 1], ['noidea', 'No tengo idea', 0, 2]] }
  ];
  var TICKETS = [10000, 20000, 30000, 50000];

  function clp(n) { return '$' + Math.round(n).toLocaleString('es-CL'); }
  function opt(qid, key) {
    var q = Q.filter(function (x) { return x.id === qid; })[0];
    return q ? q.o.filter(function (o) { return o[0] === key; })[0] : null;
  }

  // r = { q1: 'mas20', ... }, ticket = número
  function calc(r, ticket) {
    var e = 0, p = 0;
    Q.forEach(function (q) { var o = opt(q.id, r[q.id]); if (o) { e += o[2]; p += o[3]; } });
    var vol = { menos5: 3, '5a20': 12, mas20: 25 }[r.q1] || 0;
    var frac = ({ tiro: 0, horas: 0.05, algunos: 0.1 }[r.q2] || 0) + ({ nunca: 0, aveces: 0.03, todos: 0.06 }[r.q3] || 0);
    var perdidas = Math.round(vol * 6 * frac);
    var noshow = { nunca: 0, '1a2': 1.5, varias: 3, sinhoras: 0 }[r.q6] || 0;
    var t = ticket || 0;
    var total = Math.round((perdidas * 4 * 0.3 * t + noshow * 4 * t) / 10000) * 10000;
    var rec = (r.q1 === 'menos5' && e + p < 2) ? 'no' : (p >= 4 ? 'pro' : 'esencial');
    var m = [];
    m.push(['Ficha de Google completa y una web con botón directo a tu WhatsApp, para que te encuentren y te escriban.', 'e']);
    if (r.q2 !== 'tiro') m.push(['Responder en menos de un minuto, también mientras atiendes, con un agente que conoce tus precios y horarios.', 'e']);
    if (r.q3 === 'aveces' || r.q3 === 'todos') m.push(['Atender de noche y el fin de semana, y dejar agendado lo que hoy se pierde.', 'e']);
    if (r.q4 !== 'sistema') m.push(['Pasar las horas y pedidos a un panel: todo en un solo lugar y no en el chat o el cuaderno.', 'e']);
    if (r.q5 && r.q5 !== 'casitodas') m.push(['Volver a escribirle a quien preguntó y no reservó, al día siguiente y a los 3 días.', 'p']);
    if (r.q6 === '1a2' || r.q6 === 'varias') m.push(['Mandar un recordatorio el día antes para bajar las inasistencias.', 'p']);
    if (r.q7 === 'algunos' || r.q7 === 'unavez') m.push(['Escribirle cada mes a los clientes que no vuelven hace 30 a 60 días.', 'p']);
    if (r.q8 && r.q8 !== 'exacto') m.push(['Medir cuántas consultas llegan, cuántas se agendan y de dónde viene cada cliente.', 'p']);
    return { e: e, p: p, perdidas: perdidas, noshow: noshow, total: total, rec: rec, mejoras: m };
  }

  // ctx = { nombre, negocio, elegido, decision, portal }
  function resumen(ctx, c) {
    var pk = PACK[ctx.elegido || (c.rec === 'pro' ? 'pro' : 'esencial')];
    var L = [];
    L.push('Hola ' + (ctx.nombre || '') + ', soy Benja de HORIZON. Te dejo la radiografía de ' + (ctx.negocio || 'tu negocio') + '.');
    L.push('');
    if (c.total > 0) {
      L.push('Lo que se te escapa hoy: cerca de ' + clp(c.total) + ' al mes');
      if (c.perdidas) L.push('- ' + c.perdidas + ' consultas por semana sin respuesta a tiempo');
      if (c.noshow) L.push('- ' + String(c.noshow).replace('.', ',') + ' personas por semana que reservan y no llegan');
      L.push('');
    }
    L.push('Plan de acción:');
    c.mejoras.forEach(function (m, i) { L.push((i + 1) + '. ' + m[0]); });
    L.push('');
    if (c.rec === 'no') {
      L.push('Por ahora no te recomiendo invertir en un sistema. Con estos pasos ya puedes ordenar mucho. Cuando te escriban más, conversamos.');
    } else {
      L.push('Te recomiendo el Pack ' + pk.nm + ': ' + clp(pk.impl) + ' de implementación y ' + clp(pk.mes) + ' al mes desde el mes 2.');
      if (ctx.decision === 'partimos') {
        L.push('Hoy te llegan a tu correo la cotización formal y el contrato.');
        if (ctx.portal) L.push('Tu portal de cliente: ' + ctx.portal);
      } else {
        L.push('Cualquier duda, me escribes por acá.');
      }
    }
    return L.join('\n');
  }

  function normPhone(t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.indexOf('56') === 0) return d;
    if (d.length === 9 && d[0] === '9') return '56' + d;
    if (d.length === 8) return '569' + d;
    return d;
  }

  window.HZRX = { PACK: PACK, Q: Q, TICKETS: TICKETS, calc: calc, resumen: resumen, normPhone: normPhone, clp: clp };
})();
