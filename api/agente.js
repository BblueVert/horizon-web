'use strict';

const https = require('https');
const { sanitize, rateLimit, getIp } = require('./shared');

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const SYSTEM_PROMPTS = {
  socio: `Sos el consultor estratégico interno de HORIZON, una consultoría de ecosistemas digitales con IA para PyMEs de la Región de O'Higgins, Chile.
Ayudás a Benja (el founder) a tomar decisiones comerciales y operativas.
Tenés acceso a los datos reales del negocio que se te pasan como contexto JSON.
Respondés siempre en español, tuteo chileno. Sos directo, concreto, sin rodeos ni relleno.
Si te preguntan algo que no está en el contexto, decilo claramente en vez de inventar.
No hagas listas largas cuando una frase directa alcanza.`,

  tecnico: `Sos el líder técnico interno de HORIZON. Ayudás a Benja a planificar y ejecutar los proyectos que está construyendo para sus clientes.
El stack habitual: Express + Vanilla JS + Supabase + n8n + Claude API.
Analizás el estado del proyecto que se te pasa como contexto y dás recomendaciones específicas y ejecutables.
Respondés en español, tuteo chileno. Directo al punto — nada de intro genérica.
Si detectás un riesgo o bloqueante, decilo primero. No suavices los problemas.`,
};

function buildSystemPrompt(modo, contexto) {
  const base = SYSTEM_PROMPTS[modo] || SYSTEM_PROMPTS.socio;
  const ctx  = contexto ? '\n\nContexto actual:\n' + JSON.stringify(contexto, null, 2) : '';
  return base + ctx;
}

function callClaude(apiKey, systemPrompt, messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      timeout: 30_000,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 10)) return res.status(429).json({ error: 'Máximo 10 consultas por minuto.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Agente no configurado. Falta ANTHROPIC_API_KEY.' });

  const b = req.body || {};
  const modo      = ['socio', 'tecnico'].includes(b.modo) ? b.modo : 'socio';
  const mensaje   = sanitize(b.mensaje || '', 2000);
  const contexto  = b.contexto || null;
  const historial = Array.isArray(b.historial) ? b.historial.slice(-10) : [];

  if (!mensaje.trim()) return res.status(400).json({ error: 'Mensaje vacío.' });

  // Construir el array de mensajes para Claude
  const messages = [
    ...historial.map(h => ({
      role: h.role === 'agente' ? 'assistant' : 'user',
      content: sanitize(String(h.content || ''), 2000),
    })),
    { role: 'user', content: mensaje },
  ];

  try {
    const r    = await callClaude(apiKey, buildSystemPrompt(modo, contexto), messages);
    const data = JSON.parse(r.body);

    if (r.status !== 200) {
      console.error('[agente] Claude error:', r.status, data?.error?.message);
      return res.status(502).json({ error: data?.error?.message || 'Error del modelo.' });
    }

    const respuesta = data.content?.[0]?.text || '';
    return res.json({ ok: true, respuesta });
  } catch (err) {
    console.error('[agente] error:', err.message);
    return res.status(503).json({ error: 'Error al conectar con el Agente.' });
  }
};
