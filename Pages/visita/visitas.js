/* HORIZON — Negocios con visita armada (/visita/<slug>).
   web: demo publicada en horizon-propuestas · chat: slug de demo_fichas con "web": true (responde /api/demo-chat)
   chatEnWeb: el agente vive dentro de la web (motor Mesa Cero) · panel: panel real para abrir en otra pestaña.
   Un negocio nuevo: agrega una entrada. Si no está aquí, la página intenta igual con /api/demo-chat?slug=<slug>. */
window.HZ_VISITAS = {
  'que-rolls': {
    nombre: 'Qué Rolls',
    rubro: 'Sushi · Rancagua',
    color: '#D7263D',
    web: 'https://horizon-propuestas-git-claude-plan-acele-694a99-horizon-landing.vercel.app/que-rolls/',
    chat: null,
    chatEnWeb: true,
    panel: 'https://mesa-cero.vercel.app/panel/que-rolls',
    sugerencias: ['¿Qué promos tienen hoy?', 'Quiero pedir para retiro', '¿Hacen delivery a mi casa?']
  },
  'cake-boutique': {
    nombre: 'Andrea Escobar Cake Boutique',
    rubro: 'Pastelería y café · Rancagua',
    color: '#B5838D',
    web: 'https://horizon-propuestas-git-claude-plan-acele-694a99-horizon-landing.vercel.app/cake-boutique/',
    chat: 'cafe-boutique',
    sugerencias: ['¿Qué tortas tienen?', 'Quiero una torta para 15 personas el sábado', '¿Hasta qué hora atienden?']
  },
  'hospital-burgers': {
    nombre: 'Hospital Burgers',
    rubro: 'Smash burgers · Rancagua',
    color: '#D62828',
    web: null,
    chat: 'hospital-burgers',
    sugerencias: ['¿Qué hamburguesas tienen?', 'Quiero una Hospital Smoke para retiro', '¿Hasta qué hora atienden?']
  },
  'clinica-dental-recreo': {
    nombre: 'Clínica Dental Recreo',
    rubro: 'Clínica dental · Rancagua',
    color: '#B08D57',
    web: null,
    chat: 'clinica-dental-recreo',
    sugerencias: ['¿La evaluación es gratis?', 'Me duele una muela, ¿me pueden atender hoy?', 'Quiero agendar una limpieza']
  },
  'medic-center-dental': {
    nombre: 'Medic Center · Clínica Dental',
    rubro: 'Clínica dental · Rancagua',
    color: '#2E9E7A',
    web: null,
    chat: 'medic-center-dental',
    sugerencias: ['¿Cuánto cuesta una limpieza?', 'Tengo dolor, ¿me pueden ver hoy?', 'Quiero agendar una evaluación']
  }
};
