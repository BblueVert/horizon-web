// Prueba una demo en la terminal, sin WhatsApp, con la IA real.
// Uso: npm run simular -- fichas/tia-julia.json
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { responder, avisoDueno } from '../src/agente.js';

const ficha = JSON.parse(readFileSync(process.argv[2] || 'fichas/ejemplo-sangucheria.json', 'utf8'));
const historial = [];
const rl = createInterface({ input: stdin, output: stdout });
console.log(`Demo: ${ficha.nombre}. Escribe como cliente ("/salir" para terminar).\n`);
while (true) {
  const msg = (await rl.question('Tú: ')).trim();
  if (!msg) continue;
  if (msg === '/salir') break;
  const r = await responder(ficha, historial, msg);
  historial.push({ role: 'user', content: msg }, { role: 'assistant', content: JSON.stringify(r) });
  for (const t of r.respuestas) console.log(`\nBot: ${t}`);
  if (r.accion) console.log(`\n--- aviso al dueño ---\n${avisoDueno(ficha, r.accion, '56900000000')}`);
  console.log();
}
rl.close();
