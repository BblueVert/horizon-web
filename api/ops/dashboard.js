'use strict';

const { httpsRequest, rateLimit, getIp } = require('../shared');

const PLAN_PRICES = { plan01:290000, plan02:490000, plan03:690000, plan04:890000, plan05:null };
const PIPELINE_STATUSES = ['new','contactado','propuesta','arranque'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 60)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Config incompleta' });

  const auth = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  try {
    const leadsR = await httpsRequest('GET',
      `${SB_URL}/rest/v1/leads?select=id,nombre,plan,status,tipoprecio,mrr,reunion_fecha,updated_at,created_at&order=updated_at.desc`,
      auth
    );
    const leads = JSON.parse(leadsR.body || '[]');

    const activosConMrr = leads.filter(l => l.status === 'activo' && l.mrr > 0);
    const mrr = { total: activosConMrr.reduce((s,l) => s+(l.mrr||0), 0), count: activosConMrr.length };

    const enPipeline = leads.filter(l => PIPELINE_STATUSES.includes(l.status));
    const pipeline = {
      total: enPipeline.reduce((s,l) => s + (l.tipoprecio==='fundador' ? (PLAN_PRICES[l.plan]||0) : 0), 0),
      count: enPipeline.length,
    };

    const proyectosR = await httpsRequest('GET', `${SB_URL}/rest/v1/projects?estado=neq.entregado&select=id`, auth);
    const proyectos = (JSON.parse(proyectosR.body || '[]')).length;

    const desde = new Date().toISOString();
    const hasta = new Date(Date.now() + 7*86400*1000).toISOString();
    const reuniones = leads.filter(l => l.reunion_fecha && l.reunion_fecha >= desde && l.reunion_fecha <= hasta)
      .sort((a,b) => new Date(a.reunion_fecha) - new Date(b.reunion_fecha));

    return res.json({ mrr, pipeline, proyectos, leads, reuniones });
  } catch (err) {
    console.error('[ops/dashboard]', err.message);
    return res.status(503).json({ error: 'Error al obtener datos' });
  }
};
