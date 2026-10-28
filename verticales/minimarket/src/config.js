// Configuración desde variables de entorno (.env, ver .env.example).
import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const lista = (v) => String(v || '').split(',').map(s => s.replace(/\D/g, '')).filter(Boolean);

export const config = {
  db: {
    modo: process.env.DB_MODO || (process.env.SUPABASE_URL ? 'supabase' : 'memoria'),
    supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  llm: {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    modelo: process.env.LLM_MODELO || 'deepseek-v4-flash',
    precioEntradaUsd: num(process.env.LLM_PRECIO_ENTRADA_USD, 0.14),
    precioSalidaUsd: num(process.env.LLM_PRECIO_SALIDA_USD, 0.28),
    dolarClp: num(process.env.DOLAR_CLP, 950),
  },
  agente: {
    puerto: num(process.env.AGENTE_PUERTO, 3100),
    token: process.env.AGENTE_TOKEN || '',
  },
  puente: {
    agenteUrl: process.env.AGENTE_URL || `http://localhost:${num(process.env.AGENTE_PUERTO, 3100)}/mensaje`,
    carpetaSesion: process.env.WA_CARPETA_SESION || './.wa-sesion',
    soloNumeros: lista(process.env.SOLO_NUMEROS),
    esperaAgruparMs: num(process.env.ESPERA_AGRUPAR_MS, 2500),
    pausaHumanoMin: num(process.env.PAUSA_HUMANO_MIN, 30),
  },
};
