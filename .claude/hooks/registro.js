#!/usr/bin/env node
// Hook Stop / SubagentStop — deja registro de cada cierre de turno o de subagente.
// Uso: node registro.js <evento>
'use strict';

const fs = require('fs');
const path = require('path');

const evento = process.argv[2] || 'evento';
let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* sin input */ }

try {
  const logDir = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const quien = input.agent_type || input.subagent_type || '';
  fs.appendFileSync(path.join(logDir, 'actividad.log'), `${new Date().toISOString()}\t${evento}\t${quien}\n`);
} catch { /* el log nunca debe romper la sesión */ }
