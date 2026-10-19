#!/usr/bin/env node
// Hook PreToolUse (Write | Edit | MultiEdit) — guardrails deterministas, sin IA.
//  1. Bloquea secretos de servidor (service_role de Supabase, claves sk-...) fuera de .env.
//  2. Bloquea copy con frases de ChatGPT en archivos de CONTENIDO/.
// exit 2 = bloquea la acción y le devuelve el motivo a Claude.
'use strict';

const fs = require('fs');
const path = require('path');

const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
const ti = input.tool_input || {};
const filePath = ti.file_path || '';
const text = [ti.content, ti.new_string, ...(ti.edits || []).map(e => e.new_string)]
  .filter(Boolean)
  .join('\n');

if (!filePath || !text) process.exit(0);

const base = path.basename(filePath);
const rel = path.relative(process.env.CLAUDE_PROJECT_DIR || process.cwd(), filePath).split(path.sep).join('/');
const problems = [];

// ── 1. Secretos ──────────────────────────────────────────────────────────────
const isEnvFile = /^\.env(\.|$)/.test(base) && base !== '.env.example';
if (!isEnvFile) {
  for (const jwt of text.match(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]+/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
      if (payload.role === 'service_role') problems.push('Contiene una service_role key de Supabase: va solo en .env (servidor).');
    } catch { /* no es un JWT válido */ }
  }
  if (/\bsk-[A-Za-z0-9_-]{20,}/.test(text)) problems.push('Contiene una API key (sk-...): va en .env, nunca en el código.');
}

// ── 2. Copy anti-ChatGPT ─────────────────────────────────────────────────────
if (/(^|\/)contenido\//i.test(rel)) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const body = norm(text);
  const phrases = fs.readFileSync(path.join(__dirname, 'frases-ia.txt'), 'utf8')
    .split('\n').map(l => norm(l.trim())).filter(l => l && !l.startsWith('#'));
  const hits = phrases.filter(p => body.includes(p));
  if (hits.length) problems.push(`Suena a ChatGPT. Reescribe sin: ${hits.map(h => `"${h}"`).join(', ')}.`);
}

// ── 2b. Tuteo chileno: sin voseo en el copy ──────────────────────────────────
if (/^(Pages|OPS|api|verticales|CONTENIDO)\//i.test(rel) || /(^|\/)contenido\//i.test(rel)) {
  const lista = path.join(__dirname, 'voseo.txt');
  if (fs.existsSync(lista)) {
    const formas = fs.readFileSync(lista, 'utf8').split('\n').map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'));
    const low = text.toLowerCase();
    const L = 'a-záéíóúñü';
    const hits = formas.filter(f => new RegExp(`(^|[^${L}])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![${L}])`, 'i').test(low));
    if (hits.length) problems.push(`Voseo detectado (Benja es chileno, usa tuteo): ${hits.map(h => `"${h}"`).join(', ')}. Ej.: "tenés" → "tienes", "agendá" → "agenda", "escribinos" → "escríbenos".`);
  }
}

// ── 3. Diagnóstico antes de proponer ─────────────────────────────────────────
// Propuesta o contrato solo si la ficha tiene dolor, impacto y decisor (o "Saltar diagnóstico: sí").
if (/^CONTENIDO\/clientes\/[^/]+\/[^/]*(propuesta|contrato)[^/]*\.html$/i.test(rel)) {
  const fichaPath = path.join(path.dirname(filePath), 'ficha.md');
  const ficha = fs.existsSync(fichaPath) ? fs.readFileSync(fichaPath, 'utf8') : '';
  if (!/saltar diagn[oó]stico:\s*s[ií]/i.test(ficha)) {
    const campo = nombre => {
      const m = ficha.match(new RegExp(`^- ${nombre}[^:\\n]*:[ \\t]*(.*)$`, 'mi'));
      return m && m[1].trim() && !m[1].includes('[[FALTA') ? m[1].trim() : '';
    };
    const faltan = ['Dolor en sus palabras', 'Impacto', 'Decisor'].filter(c => !campo(c));
    if (faltan.length) {
      problems.push(
        `Diagnóstico incompleto en la ficha (falta: ${faltan.join(', ')}). Primero escuchar, después proponer. ` +
        'Dile a Benja qué falta y dale 2–3 preguntas de .claude/skills/documentos-cliente/referencias/preguntas-diagnostico.md. ' +
        'Si él decide seguir igual, anota "- Saltar diagnóstico: sí (motivo)" en la ficha.'
      );
    }
  }
}

if (problems.length) {
  process.stderr.write(`Bloqueado por hook (${rel}):\n- ${problems.join('\n- ')}\n`);
  process.exit(2);
}
