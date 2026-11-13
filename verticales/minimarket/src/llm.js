// Llamada a la IA (capa 1). DeepSeek con API compatible con OpenAI.
// Lecciones de Mesa Cero: deepseek-v4-flash razona por defecto y se come el
// max_tokens si no se desactiva "thinking"; "deepseek-chat" ya no existe.

import { config } from './config.js';

// USD por millón de tokens (cache-miss) → CLP
export function costoClp(tokensEntrada, tokensSalida) {
  const usd = (tokensEntrada / 1e6) * config.llm.precioEntradaUsd + (tokensSalida / 1e6) * config.llm.precioSalidaUsd;
  return Math.round(usd * config.llm.dolarClp * 100) / 100;
}

export async function extraer(systemPrompt, mensaje) {
  if (!config.llm.apiKey) throw new Error('Falta DEEPSEEK_API_KEY en .env');
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model: config.llm.modelo,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: mensaje || '(mensaje vacío)' },
      ],
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`IA respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  let ext;
  try {
    ext = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch {
    ext = {};
  }
  return {
    ext,
    tokensEntrada: data?.usage?.prompt_tokens || 0,
    tokensSalida: data?.usage?.completion_tokens || 0,
  };
}
