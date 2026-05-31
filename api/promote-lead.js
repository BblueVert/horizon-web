'use strict';

const { sanitize, httpsRequest, rateLimit, getIp, uid } = require('./shared');

const MILESTONES_BASE = {
  plan01: ['Diagnóstico y diseño','Desarrollo y contenido','Deploy y entrega'],
  plan02: ['Diagnóstico y arquitectura','Desarrollo core','Integraciones','Deploy y entrega'],
  plan03: ['Auditoría del negocio','Infraestructura digital','Automatizaciones','Campañas activas','Entrega y handoff'],
  plan04: ['Diagnóstico técnico','Arquitectura del sistema','Desarrollo IA','Automatizaciones n8n','Testing y deploy'],
  plan05: ['Brief y entrenamiento','Desarrollo del agente','Testing y ajuste','Deploy y monitoreo'],
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 10)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Config incompleta' });

  const b = req.body || {};
  const leadId = sanitize(b.lead_id || '', 60);
  if (!leadId) return res.status(400).json({ error: 'lead_id requerido' });

  const auth    = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const headers = { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' };

  try {
    // Obtener lead
    const lr = await httpsRequest('GET',
      `${SB_URL}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&select=id,nombre,plan,status&limit=1`,
      auth
    );
    const leads = JSON.parse(lr.body || '[]');
    if (!leads.length) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = leads[0];

    // Verificar que no tenga ya un proyecto
    const pr = await httpsRequest('GET',
      `${SB_URL}/rest/v1/projects?lead_id=eq.${encodeURIComponent(leadId)}&select=id&limit=1`,
      auth
    );
    const existing = JSON.parse(pr.body || '[]');
    if (existing.length) return res.status(409).json({ error: 'Este lead ya tiene un proyecto activo', project_id: existing[0].id });

    // Crear proyecto
    const projectId = uid();
    await httpsRequest('POST', `${SB_URL}/rest/v1/projects`, headers, {
      id:          projectId,
      lead_id:     leadId,
      nombre:      lead.nombre || 'Proyecto',
      plan:        lead.plan   || '',
      estado:      'init',
    });

    // Crear milestones base según el plan
    const milestones = (MILESTONES_BASE[lead.plan] || MILESTONES_BASE.plan01).map((nombre, i) => ({
      id:         uid(),
      project_id: projectId,
      nombre,
      estado:     'pending',
      deliverables: [],
    }));
    for (const m of milestones) {
      await httpsRequest('POST', `${SB_URL}/rest/v1/project_milestones`, headers, m);
    }

    // Marcar el lead como activo
    await httpsRequest('PATCH',
      `${SB_URL}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`,
      { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      { status: 'activo' }
    );

    return res.status(201).json({ ok: true, project_id: projectId });
  } catch (err) {
    console.error('[promote-lead]', err.message);
    return res.status(503).json({ error: 'Error al crear el proyecto' });
  }
};
