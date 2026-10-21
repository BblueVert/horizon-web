#!/usr/bin/env node
// Hook UserPromptSubmit — si el mensaje es largo (dictado por audio, prompt pegado) o arranca un proyecto nuevo,
// le recuerda a Claude pasar el pedido por la skill ordenar-prompt (Rol · Tarea · Contexto · Razonamiento · Formato · Finalización).
'use strict';

const fs = require('fs');

let prompt = '';
try { prompt = JSON.parse(fs.readFileSync(0, 'utf8') || '{}').prompt || ''; } catch { process.exit(0); }

const LARGO = 600;
const PROYECTO = /proyecto nuevo|nuevo proyecto|arrancamos (con|un|el)|empecemos (con|un|el)|ordena (este|el|mi) prompt|arma (el|un) prompt|mejora (este|el) prompt/i;
if (prompt.length < LARGO && !PROYECTO.test(prompt)) process.exit(0);

console.log([
  'Recordatorio (hook): este pedido es largo o arranca un proyecto. Usa la skill `ordenar-prompt`:',
  '- Ordénalo en Rol · Tarea · Contexto · Razonamiento · Formato de salida · Condiciones de finalización.',
  '- Si falta algo que cambia el resultado, máximo 3 preguntas cortas; si no, ejecuta y cierra verificando las condiciones.',
].join('\n'));
