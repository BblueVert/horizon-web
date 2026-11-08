/* HORIZON — Radiografía de terreno: preguntas por tipo de negocio, cálculo de lo que se escapa,
   recomendación del pack y resumen. La usan /terreno/radiografia y /visita/<negocio>.
   Precios de terreno: fuente de verdad en ESTRATEGIA/HORIZON-ACELERADORA-NOV-DIC-2026.md.

   Cómo decide:
   - Las preguntas 1 a 4 miden la ATENCIÓN (responder, horario, cómo se anota). Eso lo resuelve el agente,
     que es el mismo en los dos packs. Con eso se calcula "lo que recupera el agente".
   - Las preguntas 5 a 8 miden lo que pasa DESPUÉS de la conversación (quien no compra, quien no llega,
     quien no vuelve, si sabe sus números). Eso lo resuelve solo el Pro: "lo que recupera además el Pro".
   - Se recomienda el Pro si lo que recupera además el Pro es al menos el doble de lo que cuesta de más.
   - "Todavía no" si todo lo que se recupera no alcanza a pagar la mensualidad del Esencial. */
(function () {
  var PACK = {
    esencial: { nm: 'Esencial', cl: 'Atiende y agenda', impl: 290000, mes: 99000 },
    pro:      { nm: 'Pro', cl: 'Llena la agenda y hace volver', impl: 490000, mes: 149000 }
  };
  // Lo que cuesta de más el Pro al mes: diferencia de mensualidad + diferencia de implementación en 12 meses.
  var EXTRA_PRO = (PACK.pro.mes - PACK.esencial.mes) + (PACK.pro.impl - PACK.esencial.impl) / 12;

  // Claves de respuesta iguales en todos los modelos; cambia cómo se pregunta y algunos números.
  // o: [clave, texto]   ·   num: estimaciones semanales que usa el cálculo.
  var MODELOS = {
    general: {
      nm: 'Otro negocio',
      unidad: 'cliente',
      q: {
        q1: ['En un día normal, ¿cuántos mensajes te llegan por WhatsApp o Instagram?', ['Menos de 5', 'Entre 5 y 20', 'Más de 20']],
        q2: ['Cuando estás atendiendo y te escriben, ¿qué pasa con ese mensaje?', ['Respondo al tiro', 'Respondo horas después', 'Algunos se quedan sin responder']],
        q3: ['¿Te escriben de noche o el fin de semana?', ['Casi nunca', 'A veces', 'Todos los días']],
        q4: ['¿Cómo tomas hoy las horas o los pedidos?', ['Con un sistema', 'Por WhatsApp, a mano', 'En un cuaderno o de memoria']],
        q5: ['De cada 10 personas que te preguntan precio, ¿cuántas terminan comprando o agendando?', ['Casi todas', 'Como la mitad', 'Pocas', 'No sé']],
        q6: ['¿Te pasa que reservan y no llegan?', ['Casi nunca', '1 o 2 veces por semana', 'Varias veces por semana', 'No trabajo con horas']],
        q7: ['¿Tus clientes vuelven solos?', ['Sí, la mayoría', 'Algunos', 'Vienen una vez y no los veo más', 'Mi negocio es de una sola vez']],
        q8: ['¿Sabes cuánto vendiste el mes pasado y de dónde llegaron tus clientes?', ['Sí, exacto', 'Más o menos', 'No tengo idea']]
      },
      ticket: ['¿Cuánto vale en promedio lo que te piden por WhatsApp?', 'Lo que compra o agenda alguien que te escribe.', [10000, 20000, 30000, 50000]],
      noshow: [0, 1.5, 3, 0]
    },
    pasteleria: {
      nm: 'Pastelería o café',
      unidad: 'encargo',
      q: {
        q1: ['En un día normal, ¿cuántos mensajes te llegan preguntando por tortas, encargos o precios?', ['Menos de 5', 'Entre 5 y 20', 'Más de 20']],
        q2: ['Cuando estás en la cocina o atendiendo el mesón y te escriben, ¿qué pasa con ese mensaje?', ['Respondo al tiro', 'Lo respondo horas después', 'Algunos se me quedan sin responder']],
        q3: ['¿Te escriben para encargar de noche o el fin de semana, cuando ya cerraste?', ['Casi nunca', 'A veces', 'Todos los días']],
        q4: ['¿Cómo anotas hoy los encargos de tortas?', ['En un sistema o planilla', 'En el WhatsApp, buscando en el chat', 'En un cuaderno o de memoria']],
        q5: ['De cada 10 personas que te preguntan el precio de una torta, ¿cuántas terminan encargando?', ['Casi todas', 'Como la mitad', 'Pocas', 'No sé']],
        q6: ['¿Te pasa que encargan y después no retiran, o cambian la fecha a última hora?', ['Casi nunca', '1 o 2 veces al mes', 'Varias veces al mes', 'No trabajo con encargos']],
        q7: ['¿Las clientas que te encargaron una torta vuelven para el próximo cumpleaños?', ['Sí, la mayoría', 'Algunas', 'Encargan una vez y no las veo más', 'Casi todo es venta de mesón']],
        q8: ['¿Sabes cuántos encargos tuviste el mes pasado y de dónde llegaron (Instagram, recomendación, Google)?', ['Sí, exacto', 'Más o menos', 'No tengo idea']]
      },
      ticket: ['¿Cuánto vale en promedio un encargo que te piden por WhatsApp?', 'Piensa en las tortas y encargos, no en el café del mesón: eso es lo que llega por WhatsApp.', [15000, 25000, 35000, 50000]],
      noshow: [0, 0.4, 1, 0]
    },
    comida: {
      nm: 'Comida (hamburguesas, sushi, delivery)',
      unidad: 'pedido',
      q: {
        q1: ['En un día normal, ¿cuántos pedidos o consultas te llegan por WhatsApp o Instagram?', ['Menos de 5', 'Entre 5 y 20', 'Más de 20']],
        q2: ['En la hora punta, con la cocina a full, si alguien escribe para pedir, ¿qué pasa con ese mensaje?', ['Lo respondemos al tiro', 'Lo respondemos tarde, cuando se calma', 'Algunos se quedan sin responder']],
        q3: ['¿Te escriben antes de abrir o después de cerrar preguntando si atienden o para pedir?', ['Casi nunca', 'A veces', 'Todos los días']],
        q4: ['¿Cómo toman hoy los pedidos que llegan por WhatsApp?', ['Entran a un sistema o panel', 'Alguien los copia desde el chat', 'En comanda de papel o de memoria']],
        q5: ['De cada 10 que preguntan por la carta, las promos o el delivery, ¿cuántos terminan pidiendo?', ['Casi todos', 'Como la mitad', 'Pocos', 'No sé']],
        q6: ['¿Te pasa que piden para retiro y no lo vienen a buscar?', ['Casi nunca', '1 o 2 veces por semana', 'Varias veces por semana', 'Solo hacemos delivery por apps']],
        q7: ['¿Tus clientes vuelven a pedir solos, o tienes que estar subiendo promos para que vuelvan?', ['Vuelven solos', 'Algunos, sobre todo con promos', 'Piden una vez y no los veo más', 'Casi todo es por apps de delivery']],
        q8: ['¿Sabes qué día y qué producto te dejan más plata, y de dónde llegan tus clientes?', ['Sí, exacto', 'Más o menos', 'No tengo idea']]
      },
      ticket: ['¿Cuánto es en promedio un pedido por WhatsApp?', 'Con todo lo que suele pedir una persona o una familia: bebida, papas, promo.', [12000, 18000, 25000, 35000]],
      noshow: [0, 1.5, 3, 0]
    },
    clinica: {
      nm: 'Clínica o servicio con hora',
      unidad: 'paciente',
      q: {
        q1: ['En un día normal, ¿cuántos mensajes o llamadas te llegan pidiendo hora o preguntando precios?', ['Menos de 5', 'Entre 5 y 20', 'Más de 20']],
        q2: ['Cuando recepción está atendiendo o el profesional está con un paciente y escriben, ¿qué pasa con ese mensaje?', ['Se responde al tiro', 'Se responde horas después', 'Algunos se quedan sin responder']],
        q3: ['¿Te escriben de noche o el fin de semana pidiendo hora o por una urgencia?', ['Casi nunca', 'A veces', 'Todos los días']],
        q4: ['¿Cómo agendan hoy las horas?', ['Con un software de agenda', 'Por WhatsApp, a mano', 'En agenda de papel o planilla']],
        q5: ['De cada 10 personas que preguntan el precio de un tratamiento, ¿cuántas terminan agendando?', ['Casi todas', 'Como la mitad', 'Pocas', 'No sé']],
        q6: ['¿Te pasa que pacientes agendan y no llegan, sin avisar?', ['Casi nunca', '1 o 2 veces por semana', 'Varias veces por semana', 'No trabajamos con hora']],
        q7: ['¿Tus pacientes vuelven a sus controles y limpiezas sin que los llames?', ['Sí, la mayoría', 'Algunos', 'Vienen una vez y no vuelven', 'Casi todo es de una sola atención']],
        q8: ['¿Sabes cuántos pacientes nuevos llegaron el mes pasado y por qué medio te conocieron?', ['Sí, exacto', 'Más o menos', 'No tengo idea']]
      },
      ticket: ['¿Cuánto vale en promedio una atención que te piden por WhatsApp?', 'La primera atención o el tratamiento más común, no el más caro.', [25000, 40000, 60000, 100000]],
      noshow: [0, 1.5, 3, 0]
    }
  };
  // Claves internas de cada opción (iguales para todos los modelos).
  var CLAVES = {
    q1: ['menos5', '5a20', 'mas20'],
    q2: ['tiro', 'horas', 'algunos'],
    q3: ['nunca', 'aveces', 'todos'],
    q4: ['sistema', 'whatsapp', 'cuaderno'],
    q5: ['casitodas', 'mitad', 'pocas', 'nose'],
    q6: ['nunca', '1a2', 'varias', 'sinhoras'],
    q7: ['mayoria', 'algunos', 'unavez', 'unicavez'],
    q8: ['exacto', 'masomenos', 'noidea']
  };
  var ORDEN = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];

  function modelo(m) { return MODELOS[m] ? m : 'general'; }
  function preguntas(m) {
    var M = MODELOS[modelo(m)];
    return ORDEN.map(function (id) {
      return { id: id, t: M.q[id][0], o: CLAVES[id].map(function (k, i) { return [k, M.q[id][1][i]]; }) };
    });
  }
  function etiqueta(m, id, key) {
    var M = MODELOS[modelo(m)], i = CLAVES[id] ? CLAVES[id].indexOf(key) : -1;
    return i >= 0 ? M.q[id][1][i] : '';
  }
  function clp(n) { return '$' + Math.round(n).toLocaleString('es-CL'); }
  function redondo(n) { return Math.round(n / 10000) * 10000; }

  // r = { q1: 'mas20', ... }, ticket = número, m = modelo
  function calc(r, ticket, m) {
    m = modelo(m);
    var M = MODELOS[m], t = ticket || 0;
    var vol = { menos5: 3, '5a20': 12, mas20: 25 }[r.q1] || 0;            // mensajes por día
    var semana = vol * 6;
    // 1) Atención: mensajes que hoy se pierden o se responden tarde; 3 de cada 10 habrían comprado.
    var frac = ({ tiro: 0, horas: 0.05, algunos: 0.1 }[r.q2] || 0) + ({ nunca: 0, aveces: 0.03, todos: 0.06 }[r.q3] || 0);
    var perdidas = Math.round(semana * frac);
    var agente = perdidas * 4 * 0.3 * t;
    // 2) Seguimiento: 4 de cada 10 mensajes preguntan precio; de los que no compran, el seguimiento recupera 1 de cada 20.
    var noCompra = { casitodas: 0.1, mitad: 0.5, pocas: 0.8, nose: 0.6 }[r.q5] || 0;
    var seguimiento = semana * 0.4 * noCompra * 0.05 * 4 * t;
    // 3) Recordatorio: de los que no llegan o no retiran, el recordatorio salva la mitad.
    var noshow = M.noshow[CLAVES.q6.indexOf(r.q6)] || 0;
    var recordatorio = noshow * 4 * 0.5 * t;
    // 4) Clientes que vuelven: compras extra al mes con el mensaje de reactivación, según el tamaño del negocio.
    var base = { menos5: 1, '5a20': 2, mas20: 4 }[r.q1] || 0;
    var vuelven = ({ algunos: 0.5, unavez: 1 }[r.q7] || 0) * base * t;
    var pro = seguimiento + recordatorio + vuelven;
    var rec = (agente + pro < PACK.esencial.mes) ? 'no' : (pro >= 2 * EXTRA_PRO ? 'pro' : 'esencial');

    // Por qué: las respuestas que pesaron, con sus palabras.
    var porque = [];
    function dijo(id) { var e = etiqueta(m, id, r[id]); if (e) porque.push('«' + e + '»'); }
    if (rec === 'pro') { if (r.q6 === 'varias' || r.q6 === '1a2') dijo('q6'); if (r.q7 === 'unavez' || r.q7 === 'algunos') dijo('q7'); if (r.q5 && r.q5 !== 'casitodas') dijo('q5'); if (r.q8 === 'noidea') dijo('q8'); }
    else if (rec === 'esencial') { if (r.q2 !== 'tiro') dijo('q2'); if (r.q3 === 'todos' || r.q3 === 'aveces') dijo('q3'); if (r.q4 !== 'sistema') dijo('q4'); }

    var mj = [];
    mj.push(['Ficha de Google completa y una web con botón directo a tu WhatsApp, para que te encuentren y te escriban.', 'e']);
    if (r.q2 !== 'tiro') mj.push(['Responder en menos de un minuto, también en la hora punta, con un agente que conoce tus precios y horarios.', 'e']);
    if (r.q3 === 'aveces' || r.q3 === 'todos') mj.push(['Atender de noche y el fin de semana, y dejar tomado lo que hoy se pierde.', 'e']);
    if (r.q4 !== 'sistema') mj.push(['Que cada ' + M.unidad + ' quede en un panel, y no en el chat o el cuaderno.', 'e']);
    if (r.q5 && r.q5 !== 'casitodas') mj.push(['Volver a escribirle a quien preguntó y no compró, al día siguiente y a los 3 días.', 'p']);
    if (r.q6 === '1a2' || r.q6 === 'varias') mj.push(['Confirmar y recordar el día antes, para que no se pierdan ' + M.unidad + 's ya tomados.', 'p']);
    if (r.q7 === 'algunos' || r.q7 === 'unavez') mj.push(['Escribirle cada mes a quienes no vuelven hace 30 a 60 días.', 'p']);
    if (r.q8 && r.q8 !== 'exacto') mj.push(['Medir cuántas consultas llegan, cuántas se cierran y de dónde viene cada ' + M.unidad + '.', 'p']);

    return {
      perdidas: perdidas, noshow: noshow,
      agente: redondo(agente), pro: redondo(pro), extraPro: redondo(EXTRA_PRO),
      total: redondo(agente + pro), rec: rec, porque: porque.slice(0, 3), mejoras: mj,
      // compatibilidad con el puntaje anterior (se guarda en OPS)
      e: 0, p: 0
    };
  }

  // ctx = { nombre, negocio, elegido, decision, portal }
  function resumen(ctx, c) {
    var pk = PACK[ctx.elegido || (c.rec === 'pro' ? 'pro' : 'esencial')];
    var L = [];
    L.push('Hola ' + (ctx.nombre || '') + ', soy Benja de HORIZON. Te dejo la radiografía de ' + (ctx.negocio || 'tu negocio') + '.');
    L.push('');
    if (c.total > 0) {
      L.push('Lo que se te escapa hoy: cerca de ' + clp(c.total) + ' al mes');
      if (c.agente) L.push('- ' + clp(c.agente) + ' por mensajes que se responden tarde o no se responden');
      if (c.pro) L.push('- ' + clp(c.pro) + ' por quienes preguntan y no compran, no llegan o no vuelven');
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

  window.HZRX = {
    PACK: PACK, MODELOS: MODELOS, modelo: modelo, preguntas: preguntas, etiqueta: etiqueta,
    Q: preguntas('general'), TICKETS: MODELOS.general.ticket[2],
    calc: calc, resumen: resumen, normPhone: normPhone, clp: clp
  };
})();
