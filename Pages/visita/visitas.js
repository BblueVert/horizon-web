/* HORIZON — Negocios con visita armada (/visita/<slug>).
   web: demo publicada en horizon-propuestas · chat: slug de demo_fichas con "web": true (responde /api/demo-chat)
   chatEnWeb: el agente vive dentro de la web (motor Mesa Cero) · panel: panel real para abrir en otra pestaña.
   Un negocio nuevo: agrega una entrada. Si no está aquí, la página intenta igual con /api/demo-chat?slug=<slug>. */
window.HZ_VISITAS = {
  'que-rolls': {
    nombre: 'Qué Rolls',
    rubro: 'Sushi · Rancagua',
    color: '#D7263D',
    web: 'https://horizon-propuestas.vercel.app/que-rolls/',
    chat: null,
    chatEnWeb: true,
    panel: 'https://mesa-cero.vercel.app/panel/que-rolls',
    sugerencias: ['¿Qué promos tienen hoy?', 'Quiero pedir para retiro', '¿Hacen delivery a mi casa?']
  },
  'cake-boutique': {
    nombre: 'Andrea Escobar Cake Boutique',
    rubro: 'Pastelería y café · Rancagua',
    color: '#B5838D',
    web: 'https://horizon-propuestas.vercel.app/cake-boutique/',
    chat: 'cafe-boutique',
    sugerencias: ['¿Qué tortas tienen?', 'Quiero una torta para 15 personas el sábado', '¿Hasta qué hora atienden?']
  }
};
