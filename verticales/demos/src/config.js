// Configuración desde .env (ver .env.example).
import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

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
    esperaAgruparMs: num(process.env.ESPERA_AGRUPAR_MS, 2500),
    pausaHumanoMin: num(process.env.PAUSA_HUMANO_MIN, 30),
    historial: num(process.env.DEMO_HISTORIAL, 20),
  },
};
