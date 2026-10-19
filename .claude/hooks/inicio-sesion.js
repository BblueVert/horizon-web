#!/usr/bin/env node
// Hook SessionStart — carga contexto fresco al empezar. Lo que se imprime entra al contexto de Claude.
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = cmd => { try { return execSync(`git ${cmd}`, { cwd: root, encoding: 'utf8' }).trim(); } catch { return '—'; } };

const migraciones = fs.readdirSync(root)
  .map(f => (f.match(/^supabase-migration-(\d{3})-/) || [])[1])
  .filter(Boolean).map(Number);
const siguiente = String(Math.max(0, ...migraciones) + 1).padStart(3, '0');

let contenido = 0;
const dir = path.join(root, 'CONTENIDO');
if (fs.existsSync(dir)) {
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (fs.statSync(p).isDirectory()) contenido += fs.readdirSync(p).length;
  }
}

console.log([
  'Contexto HORIZON (hook inicio-sesion):',
  `- Rama: ${git('branch --show-current')}`,
  `- Últimos commits:\n${git('log --oneline -3').replace(/^/gm, '    ')}`,
  `- Cambios sin commitear: ${git('status --porcelain').split('\n').filter(Boolean).length}`,
  `- Próxima migración Supabase: ${siguiente}`,
  `- Piezas en CONTENIDO/: ${contenido}`,
].join('\n'));
