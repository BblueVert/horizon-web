/* HORIZON — Negocios con visita armada (/visita/<slug>).
   web: demo publicada en horizon-propuestas · chat: slug de demo_fichas con "web": true (responde /api/demo-chat)
   chatEnWeb: el agente vive dentro de la web (motor Mesa Cero) · panel: panel real para abrir en otra pestaña.
   rubroFoto: rubro de la radiografía (fotos de los documentos). Demos genéricas "Tu …": sin nombre real.
   Un negocio nuevo: agrega una entrada. Si no está aquí, la página intenta igual con /api/demo-chat?slug=<slug>. */
window.HZ_VISITAS = {
  'hamburgueseria': {
    modelo: 'comida',
    rubroFoto: 'comida',
    nombre: 'Tu Hamburguesería',
    rubro: 'Hamburguesería · Rancagua',
    color: '#E2231A',
    web: null,
    chat: 'hamburgueseria',
    sugerencias: ['¿Qué hamburguesas tienen?', 'Quiero una doble para retiro', '¿Hasta qué hora atienden?']
  },
  'sushi': {
    modelo: 'comida',
    rubroFoto: 'comida',
    nombre: 'Tu Sushi',
    rubro: 'Sushi · Rancagua',
    color: '#E21B23',
    web: null,
    chat: 'sushi',
    sugerencias: ['¿Qué promos tienen hoy?', 'Quiero pedir para delivery', '¿Tienen handrolls?']
  },
  'sangucheria': {
    modelo: 'comida',
    rubroFoto: 'comida',
    nombre: 'Tu Sanguchería',
    rubro: 'Sanguchería · Rancagua',
    color: '#C8102E',
    web: null,
    chat: 'sangucheria',
    sugerencias: ['¿Cuánto cuesta un churrasco?', 'Quiero una chorrillana para retiro', '¿Hacen delivery?']
  },
  'pasteleria-cafe': {
    modelo: 'pasteleria',
    rubroFoto: 'pasteleria',
    nombre: 'Tu Pastelería y Café',
    rubro: 'Pastelería y café · Rancagua',
    color: '#B5838D',
    web: null,
    chat: 'pasteleria-cafe',
    sugerencias: ['¿Qué tortas tienen?', 'Quiero una torta para 15 personas el sábado', '¿Hasta qué hora atienden?']
  },
  'clinica-dental': {
    modelo: 'clinica',
    rubroFoto: 'dental',
    nombre: 'Tu Clínica Dental',
    rubro: 'Clínica dental · Rancagua',
    color: '#B08D57',
    web: null,
    chat: 'clinica-dental',
    sugerencias: ['¿La evaluación es gratis?', 'Me duele una muela, ¿me pueden atender hoy?', 'Quiero agendar una limpieza']
  },
  'centro-dental': {
    modelo: 'clinica',
    rubroFoto: 'dental',
    nombre: 'Tu Centro Dental',
    rubro: 'Clínica dental · Rancagua',
    color: '#2E9E7A',
    web: null,
    chat: 'centro-dental',
    sugerencias: ['¿Cuánto cuesta una limpieza?', 'Tengo dolor, ¿me pueden ver hoy?', 'Quiero agendar una evaluación']
  }
};
