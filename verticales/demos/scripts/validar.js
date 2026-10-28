// Revisa una ficha antes de publicarla. Uso: npm run validar -- fichas/tia-julia.json
import { readFileSync } from 'node:fs';
import { validarFicha } from '../src/ficha.js';
import { construirPrompt } from '../src/agente.js';

const ruta = process.argv[2];
if (!ruta) { console.error('Uso: npm run validar -- <ficha.json>'); process.exit(1); }
const ficha = JSON.parse(readFileSync(ruta, 'utf8'));
const { errores, avisos, items, sinPrecio } = validarFicha(ficha);
for (const e of errores) console.log(`error: ${e}`);
for (const a of avisos) console.log(`aviso: ${a}`);
const tokens = Math.round(construirPrompt(ficha).length / 3.5);
console.log(`${ficha.nombre}: ${items} ítems (${sinPrecio} sin precio), prompt ≈ ${tokens} tokens`);
process.exit(errores.length ? 1 : 0);
