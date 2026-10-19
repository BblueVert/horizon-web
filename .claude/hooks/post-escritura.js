#!/usr/bin/env node
// Hook PostToolUse (Write | Edit | MultiEdit) — chequeos después de escribir.
//  1. vercel.json tiene que seguir siendo JSON válido.
//  2. Toda página nueva en Pages/ necesita su rewrite en vercel.json.
//  3. Registra cada publicación en .claude/logs/actividad.log.
// exit 2 = le muestra el problema a Claude para que lo corrija.
'use strict';

const fs = require('fs');
const path = require('path');

const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
const filePath = (input.tool_input || {}).file_path || '';
if (!filePath) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = path.relative(root, filePath).split(path.sep).join('/');
const problems = [];

let vercel = null;
try {
  vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
} catch (err) {
  if (rel === 'vercel.json') problems.push(`vercel.json quedó inválido: ${err.message}`);
}

if (vercel && /^Pages\/.+\.html$/.test(rel)) {
  const routed = (vercel.rewrites || []).some(r => r.destination === `/${rel}`);
  if (!routed) problems.push(`/${rel} no tiene rewrite en vercel.json: en producción no existe. Agregalo.`);
}

try {
  const logDir = path.join(root, '.claude', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(path.join(logDir, 'actividad.log'), `${new Date().toISOString()}\t${input.tool_name}\t${rel}\n`);
} catch { /* el log nunca debe romper la sesión */ }

if (problems.length) {
  process.stderr.write(problems.join('\n') + '\n');
  process.exit(2);
}
