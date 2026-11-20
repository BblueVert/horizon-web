// Configuración desde .env (ver .env.example).
import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

// MOTORES="mesa-cero=http://...,minimarket=http://..." — agentes reales que atienden
// las fichas con "motor". Por defecto, los dos que corren en el mismo equipo.
function motores(v) {
  const base = {
    'mesa-cero': 'http://localhost:5678/webhook/wa-mesacero-v2',
    // Agentes por rubro (mesa-cero/_workflows-n8n/rubros): misma base, cada uno adaptado a su modelo de negocio.
    sushi: 'http://localhost:5678/webhook/wa-sushi',
    hamburguesas: 'http://localhost:5678/webhook/wa-hamburguesas',
    pasteleria: 'http://localhost:5678/webhook/wa-pasteleria',
    minimarket: 'http://localhost:3100/mensaje',
  };
  for (const par of String(v || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const i = par.indexOf('=');
    if (i > 0) base[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
  return base;
}

export const config = {
  api: {
    url: (process.env.DEMOS_API || 'https://www.horizonweb.cl/api/demos').replace(/\/$/, ''),
    token: process.env.DEMOS_TOKEN || '',
    syncSeg: num(process.env.DEMOS_SYNC_SEG, 20),
  },
  llm: {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    modelo: process.env.LLM_MODELO || 'deepseek-v4-flash',
    // Por defecto la IA pasa por el n8n local (workflow n8n/demo-ia.json), que ya tiene
    // la credencial DeepSeek de Mesa Cero: el bot no necesita clave propia.
    // LLM_VIA=deepseek + DEEPSEEK_API_KEY para llamar directo sin n8n.
    via: process.env.LLM_VIA || 'n8n',
    n8nUrl: process.env.LLM_N8N_URL || 'http://localhost:5678/webhook/demo-ia',
  },
  motores: motores(process.env.MOTORES),
  // Pantalla de pago simulado (Pages/pago-demo en horizon-web). No cobra nada.
  pagoDemoUrl: process.env.PAGO_DEMO_URL || 'https://www.horizonweb.cl/pago-demo',
  motorToken: process.env.AGENTE_TOKEN || '',
  // Pruebas de 15 días de Mesa Cero (prueba-xxxxxx): el chat se conecta solo a la carta de esa prueba.
  // La anon key es pública (es la misma del panel); solo lee licencia_prueba_estado().
  mesaCero: {
    url: (process.env.MESA_CERO_URL || 'https://wpljybwutgxvjjlmbdxc.supabase.co').replace(/\/$/, ''),
    anon: process.env.MESA_CERO_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbGp5Ynd1dGd4dmpqbG1iZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NjI5MDIsImV4cCI6MjEwMzUzODkwMn0.bGCgjoMqTwO-NQ0DZJQtcVyAn1r-e_1IW24BLR1qrcY',
  },
  // Web de Mesa Cero: el vendedor (ficha con "crear_prueba") crea ahí la prueba de 15 días del lead.
  // MESA_CERO_BOT_TOKEN = PRUEBA_BOT_TOKEN de Vercel (mesa-cero): salta el tope por IP, que es para el formulario.
  mesaCeroWeb: {
    url: (process.env.MESA_CERO_WEB || 'https://mesa-cero.vercel.app').replace(/\/$/, ''),
    token: process.env.MESA_CERO_BOT_TOKEN || '',
  },
  bot: {
    carpetaSesion: process.env.WA_CARPETA_SESION || './.wa-sesion',
    carpetaDatos: process.env.DEMOS_CARPETA_DATOS || './datos',
    carpetaFichas: process.env.DEMOS_CARPETA_FICHAS || './fichas',
    // Dónde llega el aviso "así le llega al dueño": chat (al mismo prospecto) | yo (tu chat contigo) | ambos
    aviso: process.env.DEMO_AVISO || 'chat',
    // Demo que responde chats sin demo asignada. Vacío = esos chats no se responden (número compartido).
    porDefecto: process.env.DEMO_POR_DEFECTO || '',
    venceHoras: num(process.env.DEMO_VENCE_HORAS, 72),
    // Minutos que una demo activada con #slug en tu chat espera al próximo número nuevo
    armadaMin: num(process.env.DEMO_ARMADA_MIN, 60),
    esperaAgruparMs: num(process.env.ESPERA_AGRUPAR_MS, 6000),
    pausaHumanoMin: num(process.env.PAUSA_HUMANO_MIN, 30),
    historial: num(process.env.DEMO_HISTORIAL, 20),
  },
};
