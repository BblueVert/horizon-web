// Chat de prueba en la terminal, sin WhatsApp. Usa la IA real (DEEPSEEK_API_KEY)
// y la base que diga DB_MODO (por defecto memoria, con db/catalogo.json).
// Uso: npm run simular   ·   "/pedidos" muestra lo creado, "/salir" termina.

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { crearDb } from '../src/db/index.js';
import { crearAgente } from '../src/agente.js';
import { extraer } from '../src/llm.js';
import { config } from '../src/config.js';

const db = crearDb();
const agente = crearAgente({ db, extraer });
const telefono = process.env.SIM_TELEFONO || '56900000000';
const rl = createInterface({ input: stdin, output: stdout });

console.log(`Simulador del minimarket (db: ${config.db.modo}, tel: ${telefono}). Escribe como cliente.\n`);
while (true) {
  const msg = (await rl.question('Tú: ')).trim();
  if (!msg) continue;
  if (msg === '/salir') break;
  if (msg === '/pedidos') { console.log(JSON.stringify(db.pedidos || '(solo en modo memoria)', null, 2)); continue; }
  const t0 = Date.now();
  const { replyChunks } = await agente.manejarMensaje({ telefono, mensaje: msg });
  for (const c of replyChunks) console.log(`\nBot: ${c}`);
  const ult = db.interacciones?.at(-1);
  console.log(`\n   (${Date.now() - t0} ms${ult ? ` · ${ult.tokens_entrada}+${ult.tokens_salida} tokens · $${ult.costo_clp} CLP` : ''})\n`);
}
rl.close();
