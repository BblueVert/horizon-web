#!/usr/bin/env node
// Hook UserPromptSubmit — en mensajes de terreno/ventas inyecta el ancla del consultor:
// escuchar → preguntar → reflejar → diagnosticar → proponer. Lo que se imprime entra al contexto de Claude.
'use strict';

const fs = require('fs');
const path = require('path');

let prompt = '';
try { prompt = JSON.parse(fs.readFileSync(0, 'utf8') || '{}').prompt || ''; } catch { process.exit(0); }

const TERRENO = /terreno|visita|reuni[oó]n|cliente|negocio|diagn[oó]stico|propuesta|contrato|cotiz|precio|objeci[oó]n|cierre|llamada/i;
if (!TERRENO.test(prompt)) process.exit(0);

const anclas = fs.readFileSync(path.join(__dirname, 'anclas.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const ancla = anclas[Math.floor(Math.random() * anclas.length)];

console.log([
  'Recordatorio consultor HORIZON (hook): Benja pidió que SIEMPRE le recuerdes escuchar y preguntar antes de diagnosticar o proponer, y mantenerse presente.',
  `- Empezá tu respuesta con esta línea en cursiva, tal cual: _🧭 ${ancla}_`,
  '- Si pide propuesta, precio o documento y la ficha no tiene diagnóstico (dolor en palabras del cliente, impacto y decisor): respondé lo que pidió, pero sumá 2–3 preguntas concretas para hacer ahora y volver a escuchar.',
  '- Una sola línea de recordatorio: acompañá, no sermonees.',
].join('\n'));
