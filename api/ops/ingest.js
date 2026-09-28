'use strict';

// Avances automáticos desde GitHub → portal del cliente
//
// Lo llama el GitHub Action del repo del cliente (.github/workflows/horizon-portal.yml) en cada
// push a main. Busca el proyecto por projects.github_repo, traduce los commits a lenguaje simple
// (DeepSeek si hay DEEPSEEK_API_KEY; si no, limpia los mensajes) y publica un evento en el portal.
//
// POST /api/ops/ingest
//   Authorization: Bearer <OPS_INGEST_SECRET>
//   { repo: "Owner/Repo", ref: "refs/heads/main", compare: "https://github.com/...", commits: [{ id, message, url }] }
//
// Es servidor-a-servidor (no hay sesión de usuario), por eso usa SUPABASE_SERVICE_ROLE_KEY.

const crypto = require('crypto');
const { httpsRequest, rateLimit, getIp } = require('../shared');

// Commits que no le importan al cliente
const SKIP = /^(chore|debug|test|tests|ci|build|docs|refactor|wip)(\(.+\))?!?:|^merge (pull request|branch|remote)|^revert "/i;
const PREFIX = /^(feat|fix|perf|style|copy|data|content|ux|ui|seo)(\([^)]*\))?!?:\s*/i;

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function relevant(commits) {
  return commits
    .map(c => ({ ...c, subject: String(c.message || '').split('\n')[0].trim() }))
    .filter(c => c.subject && !SKIP.test(c.subject));
}

function fallbackText(commits) {
  const lines = commits.slice(0, 6).map(c => {
    const s = c.subject.replace(PREFIX, '');
    return '• ' + s.charAt(0).toUpperCase() + s.slice(1);
  });
  if (commits.length > 6) lines.push(`• y ${commits.length - 6} ajustes más`);
  return lines.join('\n');
}

async function humanize(commits, marca) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return fallbackText(commits);
  const system =
    `Eres el equipo de HORIZON contándole a la dueña de ${marca || 'la marca'} qué cambió hoy en su sitio web.\n` +
    'Convierte los commits en 1 a 4 viñetas breves (empiezan con "• "), en español cercano y claro, sin jerga técnica, ' +
    'sin nombres de archivos, variables ni herramientas. Enfócate en lo que ella o sus clientas ven o ganan. ' +
    'Si ningún cambio es visible o útil para ella, responde exactamente: NADA';
  try {
    const r = await httpsRequest('POST', 'https://api.deepseek.com/chat/completions',
      { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      { model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', max_tokens: 300, temperature: 0.3,
        messages: [{ role: 'system', content: system }, { role: 'user', content: commits.map(c => '- ' + c.subject).join('\n') }] },
      20_000);
    const txt = r.status === 200 ? JSON.parse(r.body).choices?.[0]?.message?.content?.trim() : '';
    if (txt === 'NADA') return null;
    return txt ? txt.substring(0, 1500) : fallbackText(commits);
  } catch {
    return fallbackText(commits);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (rateLimit(getIp(req), 60_000, 20)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const SECRET = process.env.OPS_INGEST_SECRET;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SECRET || !SB_URL || !SB_KEY) return res.status(503).json({ error: 'Ingesta no configurada' });

  const token = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !safeEqual(token, SECRET)) return res.status(401).json({ error: 'No autorizado' });

  const b = req.body || {};
  const repo = String(b.repo || '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return res.status(400).json({ error: 'repo inválido' });
  const commits = Array.isArray(b.commits) ? b.commits.slice(0, 100) : [];
  const url = [b.compare, commits[commits.length - 1]?.url].find(u => /^https:\/\/github\.com\//.test(String(u || ''))) || null;

  const auth = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  try {
    const pr = await httpsRequest('GET',
      `${SB_URL}/rest/v1/projects?github_repo=eq.${encodeURIComponent(repo)}&select=id,lead_id,brand&limit=1`, auth);
    const project = JSON.parse(pr.body || '[]')[0];
    if (!project) return res.status(404).json({ error: 'Ningún proyecto tiene ese repositorio' });

    const useful = relevant(commits);
    if (!useful.length) return res.json({ ok: true, skipped: 'sin cambios visibles para el cliente' });

    if (url) {   // idempotente: el mismo push no se publica dos veces
      const dup = await httpsRequest('GET',
        `${SB_URL}/rest/v1/portal_events?lead_id=eq.${encodeURIComponent(project.lead_id)}&url=eq.${encodeURIComponent(url)}&select=id&limit=1`, auth);
      if (JSON.parse(dup.body || '[]').length) return res.json({ ok: true, skipped: 'ya publicado' });
    }

    const contenido = await humanize(useful, project.brand?.nombre);
    if (!contenido) return res.json({ ok: true, skipped: 'sin cambios visibles para el cliente' });

    const ins = await httpsRequest('POST', `${SB_URL}/rest/v1/portal_events`,
      { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      { lead_id: project.lead_id, tipo: 'avance', autor: 'horizon', fuente: 'github', contenido, url });
    if (ins.status >= 300) throw new Error('supabase ' + ins.status);
    return res.status(201).json({ ok: true, publicado: contenido });
  } catch (err) {
    console.error('[ops/ingest]', err.message);
    return res.status(502).json({ error: 'No se pudo publicar' });
  }
};

module.exports._test = { relevant, fallbackText };
