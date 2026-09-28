'use strict';

// Portal del cliente (/c/:token)
//
// GET  /api/portal?token=<uuid>
//      → lead (sin datos sensibles), proyecto (con co-branding), hitos, actividad, comentarios
//        y, si el proyecto lo tiene activo, el catálogo con las fichas ya completadas.
//
// POST /api/portal  { token, action, ... }
//      brief    { brief }                          guarda el brief pre-diagnóstico
//      reorder  { ids: [milestone_id, ...] }        el cliente prioriza lo que viene
//      comment  { milestone_id?, contenido }        comentario del cliente (general o de un hito)
//      product  { product_id, data, estado }        ficha de producto (medidas y detalles)
//
// Usa la anon key: las políticas RLS dejan ver y tocar solo el proyecto cuyo portal_token viene
// en el header x-portal-token, y los permisos por columna limitan qué campos puede escribir.
// Además se filtra explícitamente por proyecto en cada query.

const { httpsRequest, rateLimit, getIp } = require('./shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRIEF_KEYS = ['negocio', 'problema', 'objetivo', 'intentos'];

// Ficha de producto: campos que acepta el servidor (el formulario del portal usa los mismos)
const NUM = (max) => ({ type: 'num', max });
const TXT = (max) => ({ type: 'txt', max });
const ONE = (...opts) => ({ type: 'enum', opts });
const PRODUCT_FIELDS = {
  alto_cm: NUM(300), ancho_cm: NUM(300), fondo_cm: NUM(300),
  asa_cm: NUM(300), correa_cm: NUM(300), correa_regulable: ONE('si', 'no', 'no_aplica'),
  peso_g: NUM(20000),
  cierre: ONE('cremallera', 'iman', 'broche', 'solapa', 'hebilla', 'abierto', 'otro'),
  compartimentos: TXT(300), forro: TXT(200),
  herrajes: ONE('dorado', 'plateado', 'bronce', 'negro', 'sin_herrajes', 'otro'),
  notas: TXT(1000),
};

function cleanProductData(src) {
  const out = {};
  for (const [k, spec] of Object.entries(PRODUCT_FIELDS)) {
    const v = src?.[k];
    if (v === undefined || v === null || v === '') continue;
    if (spec.type === 'num') {
      const n = Number(String(v).replace(',', '.'));
      if (Number.isFinite(n) && n >= 0 && n <= spec.max) out[k] = Math.round(n * 10) / 10;
    } else if (spec.type === 'enum') {
      if (spec.opts.includes(v)) out[k] = v;
    } else {
      out[k] = String(v).substring(0, spec.max);
    }
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  if (rateLimit(getIp(req), 60_000, req.method === 'GET' ? 40 : 60)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const ANON   = process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !ANON) return res.status(503).json({ error: 'Config incompleta' });

  const token = String((req.method === 'GET' ? req.query?.token : req.body?.token) || '');
  if (!UUID_RE.test(token)) return res.status(404).json({ error: 'Portal no encontrado' });

  const h = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'x-portal-token': token };
  const hw = (prefer) => ({ ...h, 'Content-Type': 'application/json', Prefer: prefer });
  const get = async (path) => {
    const r = await httpsRequest('GET', `${SB_URL}/rest/v1/${path}`, h);
    if (r.status !== 200) throw new Error('supabase ' + r.status + ' ' + path.split('?')[0]);
    return JSON.parse(r.body || '[]');
  };
  const write = async (method, path, body, prefer = 'return=minimal') => {
    const r = await httpsRequest(method, `${SB_URL}/rest/v1/${path}`, hw(prefer), body);
    if (r.status >= 300) throw new Error('supabase ' + r.status + ' ' + path.split('?')[0]);
    return r.body ? JSON.parse(r.body) : null;
  };

  try {
    const leads = await get(
      `leads?portal_token=eq.${token}&select=id,nombre,empresa,status,reunion_fecha,brief,created_at&limit=1`);
    if (!leads.length) return res.status(404).json({ error: 'Portal no encontrado' });
    const lead = leads[0];
    const leadId = encodeURIComponent(lead.id);
    const firstName = String(lead.nombre || '').split(' ')[0] || 'Cliente';

    const projects = await get(
      `projects?lead_id=eq.${leadId}&select=id,nombre,estado,fecha_inicio,fecha_fin,descripcion,brand,catalog_enabled` +
      `&order=created_at.asc&limit=1`);
    const project = projects[0] || null;

    if (req.method === 'POST') {
      const b = req.body || {};
      const action = b.action || (b.brief ? 'brief' : '');

      if (action === 'brief') {
        const brief = {};
        for (const k of BRIEF_KEYS) brief[k] = String(b.brief?.[k] || '').substring(0, 2000);
        await write('PATCH', `leads?portal_token=eq.${token}`, { brief });
        return res.json({ ok: true });
      }

      if (!project) return res.status(409).json({ error: 'Este portal aún no tiene proyecto' });
      const pid = project.id;

      if (action === 'reorder') {
        const ids = Array.isArray(b.ids) ? b.ids.filter(id => UUID_RE.test(String(id))) : [];
        if (!ids.length || ids.length > 100) return res.status(400).json({ error: 'Orden inválido' });
        const ms = await get(`project_milestones?project_id=eq.${pid}&select=id,nombre,estado,orden`);
        const byId = new Map(ms.map(m => [m.id, m]));
        const movable = ids.filter(id => byId.has(id) && !['done', 'hecho'].includes(byId.get(id).estado));
        if (!movable.length) return res.status(400).json({ error: 'Orden inválido' });
        const base = Math.max(0, ...ms.filter(m => !movable.includes(m.id)).map(m => m.orden || 0));
        for (let i = 0; i < movable.length; i++) {
          await write('PATCH', `project_milestones?id=eq.${movable[i]}&project_id=eq.${pid}`, { orden: base + i + 1 });
        }
        await write('POST', 'portal_events', {
          lead_id: lead.id, tipo: 'prioridad', autor: 'cliente', fuente: 'cliente',
          contenido: `${firstName} cambió las prioridades: ${movable.map(id => byId.get(id).nombre).join(' → ')}`,
        });
        return res.json({ ok: true });
      }

      if (action === 'comment') {
        const contenido = String(b.contenido || '').trim().substring(0, 2000);
        if (!contenido) return res.status(400).json({ error: 'Comentario vacío' });
        const milestoneId = UUID_RE.test(String(b.milestone_id || '')) ? b.milestone_id : null;
        const rows = await write('POST', 'portal_comments', {
          project_id: pid, milestone_id: milestoneId, autor: 'cliente', nombre: firstName, contenido,
        }, 'return=representation');
        return res.json({ ok: true, comment: Array.isArray(rows) ? rows[0] : rows });
      }

      if (action === 'product') {
        if (!project.catalog_enabled) return res.status(409).json({ error: 'Fichas no habilitadas' });
        const productId = String(b.product_id || '').substring(0, 60);
        if (!/^[A-Za-z0-9_-]+$/.test(productId)) return res.status(400).json({ error: 'Producto inválido' });
        const row = {
          project_id: pid, product_id: productId,
          data: cleanProductData(b.data || {}),
          estado: b.estado === 'listo' ? 'listo' : 'borrador',
          updated_at: new Date().toISOString(),
        };
        await write('POST', 'product_details?on_conflict=project_id,product_id', row,
          'resolution=merge-duplicates,return=minimal');
        return res.json({ ok: true, data: row.data, estado: row.estado, updated_at: row.updated_at });
      }

      return res.status(400).json({ error: 'Acción desconocida' });
    }

    // GET
    const [events, milestones, comments] = await Promise.all([
      get(`portal_events?lead_id=eq.${leadId}&select=tipo,autor,fuente,contenido,url,milestone_id,created_at&order=created_at.desc&limit=200`),
      project
        ? get(`project_milestones?project_id=eq.${project.id}` +
            `&select=id,nombre,descripcion,fecha_inicio,fecha_target,estado,orden,deliverables&order=orden.asc,fecha_target.asc.nullslast,created_at.asc`)
        : [],
      project
        ? get(`portal_comments?project_id=eq.${project.id}&select=id,milestone_id,autor,nombre,contenido,created_at&order=created_at.asc&limit=500`)
        : [],
    ]);

    let catalog = null;
    if (project?.catalog_enabled) {
      const [items, details] = await Promise.all([
        get(`catalog_items?project_id=eq.${project.id}&select=id,nombre,marca,categoria,modelo,color,imagen_url&order=orden.asc`),
        get(`product_details?project_id=eq.${project.id}&select=product_id,data,estado,updated_at`),
      ]);
      catalog = { items, details: Object.fromEntries(details.map(d => [d.product_id, d])) };
    }

    delete lead.id;
    if (project) delete project.id;
    return res.json({ lead, project, milestones, events, comments, catalog });
  } catch (err) {
    console.error('[portal]', err.message);
    return res.status(502).json({ error: 'No se pudo cargar el portal' });
  }
};

module.exports.PRODUCT_FIELDS = PRODUCT_FIELDS;
module.exports.cleanProductData = cleanProductData;
