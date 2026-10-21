// Datos de marca de HORIZON para el manual de identidad.
// Plantilla: .claude/skills/documentos-cliente/templates/marca/manual-identidad.html
// Generar PDF: node scripts/marca-pdf.js Identidad/manual
window.MARCA = {
  nombre: 'HORIZON',
  version: 'Versión 1.0 · octubre 2026',
  documento: 'Manual de identidad',
  hecho_por: 'HORIZON · Rancagua',
  fuentes_google: 'family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500',

  uso: {
    para_que: 'Esta guía reúne las reglas para que HORIZON se vea y suene igual en la web, en OPS, en el portal, en los reels y en cada documento.',
    quien: 'Benja y cualquier persona que diseñe, escriba o publique en nombre de HORIZON.',
    archivos: 'Los archivos originales viven en el repositorio, carpeta Identidad/. El capítulo 8 dice qué hay y cómo respaldarlo.'
  },

  esencia: {
    frase: 'No te faltan clientes. Te falta un sistema que no los deje escapar.',
    frase_destacar: 'un sistema',
    posicionamiento: 'Para dueños de negocios de servicio de Rancagua y O’Higgins que pierden clientes entre el primer mensaje y el pago, HORIZON instala el recorrido completo (web, agenda, portal, cobro y CRM), a diferencia de quienes venden piezas sueltas, porque lo aplicó primero en su propio negocio.',
    cliente: {
      quien: 'Dueño o dueña de un negocio de servicio local, 28 a 50 años, con 1 a 6 personas de equipo.',
      dolor: 'Responde tarde, agenda a mano y cobra persiguiendo transferencias.',
      quiere: 'Que el negocio funcione sin estar encima del celular.',
      frase: '“No puede ser que todo dependa de que yo conteste.”'
    },
    palabras: [
      { p: 'Ordenado', d: 'Cada paso tiene su lugar: agenda, portal, pago y entrega.' },
      { p: 'Cercano', d: 'Hablamos como alguien de la zona que sabe del tema, no como una empresa.' },
      { p: 'Directo', d: 'Decimos el precio, el plazo y lo que no incluye. Sin vueltas.' },
      { p: 'Local', d: 'Rancagua y O’Higgins: casos que puedes ir a ver.' },
      { p: 'Probado', d: 'Lo usamos primero en HORIZON. Si no funciona aquí, no se vende.' }
    ]
  },

  logo: {
    principal: { src: '../Logo HORIZON.svg', nombre: 'Logo horizontal', uso: 'La versión principal. Úsala siempre que haya espacio.' },
    simbolo:   { src: '../Logo ISO.png', nombre: 'Símbolo', uso: 'Foto de perfil, favicon, sellos y espacios cuadrados chicos.' },
    fondo_obligatorio: 'oscuro',
    regla: 'El logo original tiene letras blancas y la O en degradado. Va siempre sobre fondo oscuro.',
    margen: 'El margen de respeto (x) es la altura de la letra H. Ningún texto, borde ni imagen entra en ese espacio.',
    minimos: [
      { version: 'Logo horizontal', px: 120, cm: '3 cm' },
      { version: 'Símbolo', px: 24, cm: '0,8 cm' }
    ],
    fondos: [
      { nombre: 'Tinta', css: '#1A1626', ok: true },
      { nombre: 'Superficie profunda', css: 'linear-gradient(135deg,#1E1744 0%,#34276E 55%,#5A2F8C 100%)', ok: true },
      { nombre: 'Foto oscurecida', img: 'IMG-13', overlay: 'rgba(26,22,38,.55)', ok: true }
    ],
    incorrectos: [
      { nombre: 'Sobre fondo claro', estilo: 'bg-claro', porque: 'Las letras blancas desaparecen.' },
      { nombre: 'Letras recoloreadas', estilo: 'recolor', porque: 'Pierde la O en degradado que lo identifica.' },
      { nombre: 'Estirado', estilo: 'estirar', porque: 'Deforma las letras.' },
      { nombre: 'Con sombra o efectos', estilo: 'sombra', porque: 'Ensucia el trazo.' },
      { nombre: 'Rotado', estilo: 'rotar', porque: 'Pierde lectura y estabilidad.' },
      { nombre: 'Sobre fondo recargado', estilo: 'recargado', porque: 'Compite con la imagen.' }
    ]
  },

  // La paleta HORIZON es un atardecer: del amarillo del sol al violeta de la noche. Los neutros la sostienen.
  paleta_idea: 'Nuestros colores son un atardecer: el sol amarillo baja por el naranja y el rojo, se vuelve rosa y violeta y termina en la noche. Los neutros (tinta, crema y arena) le dan descanso.',
  colores: [
    { nombre: 'Amarillo', hex: '#FBE396', grupo: 'atardecer', uso: 'El sol. Brillos sobre fondo oscuro; nunca texto sobre crema.', prop: 2 },
    { nombre: 'Naranja',  hex: '#F2690C', grupo: 'atardecer', rol: 'acento', uso: 'Acento: botones, cifras y lo que hay que mirar primero.', prop: 8 },
    { nombre: 'Rojo',     hex: '#CC3253', grupo: 'atardecer', uso: 'Centro de la O. Alertas y detalles; no como fondo grande.', prop: 2 },
    { nombre: 'Rosa',     hex: '#C4467A', grupo: 'atardecer', uso: 'Mitad del degradado y detalles.', prop: 4 },
    { nombre: 'Violeta',  hex: '#7B3FA0', grupo: 'atardecer', uso: 'Cierre del degradado.', prop: 4 },
    { nombre: 'Noche',    hex: '#1E1744', grupo: 'atardecer', uso: 'Portadas, separadores y superficies destacadas.', prop: 8 },
    { nombre: 'Tinta',    hex: '#1A1626', grupo: 'neutro', rol: 'tinta', uso: 'Texto, header, footer y fondo del logo.', prop: 16 },
    { nombre: 'Crema',    hex: '#FFFBF6', grupo: 'neutro', rol: 'fondo', uso: 'Fondo principal de la web, OPS y documentos.', prop: 42 },
    { nombre: 'Arena',    hex: '#FFF4EA', grupo: 'neutro', rol: 'fondo2', uso: 'Fondo secundario y tarjetas.', prop: 14 }
  ],
  degradado_simbolo: { nombre: 'Degradado del símbolo', css: 'linear-gradient(95deg,#FBE396 0%,#F2690C 14%,#CC3253 48%,#561739 84%,#A0246B 100%)', uso: 'Solo vive en la O del logo. No se copia en otras piezas.' },
  degradado: { nombre: 'Degradado atardecer', css: 'linear-gradient(95deg,#F2690C 0%,#C4467A 55%,#7B3FA0 100%)', uso: 'El atardecer en una sola pieza: palabras clave, botones, barras de progreso y superficies destacadas. Nunca en textos largos.' },
  contrastes: [
    ['#1A1626', '#FFFBF6'], ['#5F5970', '#FFFBF6'], ['#FFFFFF', '#F2690C'], ['#1A1626', '#F2690C'], ['#FFFFFF', '#7B3FA0'], ['#FFFFFF', '#1E1744'], ['#FFFBF6', '#1A1626'], ['#1A1626', '#FBE396'], ['#FFFFFF', '#CC3253']
  ],

  tipografias: [
    { familia: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans', sans-serif", rol: 'Títulos y texto', pesos: '800 títulos · 600 subtítulos · 400 texto', peso_muestra: 800 },
    { familia: 'DM Mono', css: "'DM Mono', monospace", rol: 'Etiquetas, cifras y códigos', pesos: '500 etiquetas · 400 datos', peso_muestra: 500 }
  ],
  jerarquia: [
    { rol: 'Título', spec: 'Plus Jakarta Sans 800 · 64 px · interlineado 1,02 · tracking −3 %', css: "font:800 64px/1.02 'Plus Jakarta Sans';letter-spacing:-.03em", ej: 'Tu negocio en un solo link.' },
    { rol: 'Etiqueta', spec: 'DM Mono 500 · 15 px · mayúsculas · tracking 16 % · naranja', css: "font:500 15px/1.4 'DM Mono';letter-spacing:.16em;text-transform:uppercase;color:#F2690C", ej: 'Diagnóstico gratis · 30 min' },
    { rol: 'Texto', spec: 'Plus Jakarta Sans 400 · 20 px · interlineado 1,55 · tinta 2', css: "font:400 20px/1.55 'Plus Jakarta Sans';color:#5F5970", ej: 'Agendas en un minuto, te llega tu portal y pagas desde ahí. Tu entrega se libera sola.' },
    { rol: 'Botón', spec: 'Plus Jakarta Sans 700 · 17 px · fondo degradado', css: "font:700 17px/1 'Plus Jakarta Sans'", ej: 'Agenda tu diagnóstico', boton: true }
  ],

  canva: 'Las dos son gratuitas en Google Fonts. En Canva, búscalas por su nombre; si no aparecen, súbelas en Marca → Fuentes o usa Montserrat (títulos) y Courier Prime (etiquetas).',

  voz: {
    resumen: 'Le hablamos al cliente de tú a tú, en segunda persona y en tuteo chileno. Directo, concreto y sin promesas que no podamos probar.',
    escalas: [
      { izq: 'Cercano', der: 'Formal', pos: 22 },
      { izq: 'Directo', der: 'Rebuscado', pos: 12 },
      { izq: 'Concreto', der: 'Inspiracional', pos: 18 },
      { izq: 'Local', der: 'Global', pos: 25 },
      { izq: 'Serio', der: 'Con humor', pos: 38 }
    ],
    whatsapp: [
      { etiqueta: 'Bienvenida', texto: '¡Hola! Soy Benja, de HORIZON. Cuéntame qué negocio tienes y dónde sientes que se te escapan clientes: al responder, al agendar o al cobrar.' },
      { etiqueta: 'Fuera de horario', texto: 'Ahora estoy en una reunión, pero tu mensaje quedó aquí. Te respondo hoy mismo. Si quieres avanzar, agenda tu diagnóstico en horizonweb.cl/agendar.' },
      { etiqueta: 'Agendar', texto: 'Lo vemos en un diagnóstico de 30 minutos, gratis. Elige tu hora aquí: horizonweb.cl/agendar. Antes de la reunión te mando un video corto revisando tu web y tus redes.' }
    ],
    tabla: [
      ['Lleva tu negocio al siguiente nivel.', 'Responde a tiempo, agenda y cobra sin perseguir a nadie.'],
      ['Dejé de perseguir pagos por WhatsApp.', '¿Sigues persiguiendo pagos por WhatsApp?'],
      ['Le llega su portal.', 'Te llega tu portal.'],
      ['Soluciones digitales innovadoras.', 'Web, agenda y cobro en un solo link.'],
      ['Que no se te escape ningún cliente.', '¿Dónde se te escapan? Lo vemos en 30 minutos.'],
      ['Vos podés agendar acá.', 'Puedes agendar aquí.']
    ]
  },

  fotografia: [
    { titulo: 'Pantallas reales', texto: 'Se muestran capturas del sitio o del sistema funcionando, nunca maquetas inventadas.', img: '../casos/vitalkine.webp' },
    { titulo: 'Negocios de la zona', texto: 'Casos y personas de Rancagua y la región. Se nombra al cliente solo con su permiso.', img: 'IMG-11' },
    { titulo: 'Luz y orden', texto: 'Luz natural, fondo limpio y un solo protagonista por imagen. El celular derecho y de frente.', img: 'IMG-12' }
  ],

  fotografia_celular: [
    'Limpia el lente antes de cada foto.',
    'Luz de ventana, de lado. Nunca flash.',
    'Fondo despejado: saca lo que no aporta.',
    'Celular derecho y a la altura del pecho. Activa la cuadrícula de la cámara.',
    'Vertical para stories y reels; 4:5 para el feed.'
  ],

  aplicaciones: {
    post: { etiqueta: 'Diagnóstico gratis', titulo: 'No te faltan clientes.', titulo2: 'Te falta un sistema.' },
    story: { titulo: '¿Dónde se te escapan?', cta: 'Agenda en horizonweb.cl' },
    catalogo: [
      { nombre: 'Diagnóstico', detalle: '30 min · por videollamada', precio: 'Gratis', img: 'IMG-15' },
      { nombre: 'Kit Responde y Agenda', detalle: 'Guía, 30 mensajes y planilla', precio: '$29.990', img: 'IMG-16' },
      { nombre: 'Plan 01 · Presencia Digital', detalle: 'Web, agenda y portal', precio: 'Desde $490.000', img: 'IMG-17' }
    ],
    destacadas: [ ['i-wallet', 'Planes'], ['i-calendar', 'Agenda'], ['i-layers', 'Casos'], ['i-pin', 'Rancagua'] ],
    tarjeta: { nombre: 'Benjamín Vera Yáñez', cargo: 'Fundador · HORIZON', web: 'horizonweb.cl', whatsapp: '+56 9 7696 2659', qr: 'https://www.horizonweb.cl/agendar' }
  },

  archivos: {
    raiz: 'Identidad/',
    arbol: [
      ['Logo HORIZON.svg', 'Logo horizontal, vectorial. Es el original.'],
      ['Logo ISO.png', 'Símbolo con fondo transparente.'],
      ['Logo-Vertical-png.png', 'Logo en PNG de alta resolución.'],
      ['og-image.png', 'Imagen para compartir enlaces.'],
      ['casos/', 'Capturas reales de los casos (1200 × 750).'],
      ['manual/', 'Este manual: datos (marca.js), HTML y PDF.']
    ],
    pasos: [
      ['Copia principal', 'El repositorio de GitHub, carpeta Identidad/.'],
      ['Segunda copia', 'Una carpeta en Google Drive con los mismos archivos, actualizada en cada cambio.'],
      ['Quién la cuida', 'Benja. Si alguien más diseña para HORIZON, recibe una copia, no los originales.']
    ],
    respaldo: 'El repositorio de GitHub es la copia principal. Ante cualquier cambio de logo o color, se actualiza primero aquí y después en la web, OPS y plantillas.'
  },

  // Imágenes: basta con dejarlas en img/IMG-NN.webp (el script las detecta). Aquí solo si una vive en otra ruta.
  // Sin imagen, la página muestra el espacio con su código (ver prompts-imagenes.md).
  imagenes: {},
  // Punto focal del recorte (background-position) cuando el centro no sirve.
  imagenes_pos: { 'IMG-01': '0 150px', 'IMG-05': '85% 40%', 'IMG-11': '70% 60%' },

  contacto: { lineas: ['horizonweb.cl', 'WhatsApp +56 9 7696 2659', 'Rancagua · Región de O’Higgins'] }
};
