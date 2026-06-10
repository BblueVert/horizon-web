'use strict';

const { httpsRequest, rateLimit, getIp } = require('../shared');

const SB_SAAS_URL = 'https://khvfhvpqhcchgxrtmrjo.supabase.co';
const SB_SAAS_KEY = process.env.SUPABASE_SAAS_SERVICE_KEY || process.env.SUPABASE_SAAS_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodmZodnBxaGNjaGd4cnRtcmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MzkwNTMsImV4cCI6MjA5NjExNTA1M30.lYHscLNuqaB1UObLDRbPLJH5vFm--WPTitN8lJXZeF4';

const sbHeaders = { apikey: SB_SAAS_KEY, Authorization: 'Bearer ' + SB_SAAS_KEY };

// ── Supabase helper ────────────────────────────────────────────────────────────
async function sbGet(path) {
  const r = await httpsRequest('GET', `${SB_SAAS_URL}/rest/v1${path}`, sbHeaders);
  return JSON.parse(r.body || '[]');
}

async function sbPatch(path, data) {
  const headers = { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  return httpsRequest('PATCH', `${SB_SAAS_URL}/rest/v1${path}`, headers, data);
}

async function sbInsert(table, rows) {
  const headers = { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const body = Array.isArray(rows) ? rows : [rows];
  return httpsRequest('POST', `${SB_SAAS_URL}/rest/v1/${table}`, headers, body);
}

// ── WhatsApp API ───────────────────────────────────────────────────────────────
async function sendWaMessage(phoneNumberId, token, to, message) {
  const cleanPhone = to.replace(/\D/g, '');
  const phone = cleanPhone.startsWith('56') ? cleanPhone : '56' + cleanPhone;

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  };
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { preview_url: false, body: message },
  };

  const r = await httpsRequest('POST',
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    headers, body
  );
  const parsed = JSON.parse(r.body || '{}');
  if (r.status >= 400) throw new Error(parsed?.error?.message || `HTTP ${r.status}`);
  return parsed?.messages?.[0]?.id;
}

// ── Renderizar plantilla ───────────────────────────────────────────────────────
function renderTemplate(body, vars = {}) {
  return body
    .replace(/\{nombre\}/g, vars.nombre || 'Cliente')
    .replace(/\{fecha\}/g, vars.fecha || '')
    .replace(/\{hora\}/g, vars.hora || '')
    .replace(/\{barbero\}/g, vars.barbero || '')
    .replace(/\{servicio\}/g, vars.servicio || '')
    .replace(/\{local\}/g, vars.local || '')
    .replace(/\{descuento\}/g, vars.descuento || '10')
    .replace(/\{link_reseña\}/g, vars.link_resena || '');
}

// ── Procesar recordatorios automáticos ────────────────────────────────────────
async function processReminders(tenantId) {
  const results = { sent: 0, skipped: 0, failed: 0, errors: [] };

  // Obtener datos del tenant
  const [tenantArr, templatesArr] = await Promise.all([
    sbGet(`/tenants?id=eq.${tenantId}&select=id,name,wa_token,wa_phone_number_id`),
    sbGet(`/biz_message_templates?tenant_id=eq.${tenantId}&active=eq.true`),
  ]);
  const tenant = tenantArr[0];
  if (!tenant) return { error: 'Tenant no encontrado' };

  const templates = {};
  templatesArr.forEach(t => { templates[t.trigger_key] = t; });

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const isoNow = now.toISOString();

  // ── 1. Recordatorios 24h ───────────────────────────────────────────────────
  if (templates.reminder_24h) {
    const from24 = new Date(now.getTime() + 23 * 3600000).toISOString();
    const to24   = new Date(now.getTime() + 25 * 3600000).toISOString();
    const appts = await sbGet(
      `/biz_appointments?tenant_id=eq.${tenantId}&start_time=gte.${from24}&start_time=lte.${to24}&status=eq.confirmed&select=id,start_time,client_id,staff_id,service_id,biz_clients(name,phone),biz_staff(name),biz_services(name)`
    );

    for (const appt of appts) {
      await sendTemplateMessage(tenant, templates.reminder_24h, appt, 'reminder_24h', results);
    }
  }

  // ── 2. Recordatorios 2h ────────────────────────────────────────────────────
  if (templates.reminder_2h) {
    const from2 = new Date(now.getTime() + 1.5 * 3600000).toISOString();
    const to2   = new Date(now.getTime() + 2.5 * 3600000).toISOString();
    const appts = await sbGet(
      `/biz_appointments?tenant_id=eq.${tenantId}&start_time=gte.${from2}&start_time=lte.${to2}&status=eq.confirmed&select=id,start_time,client_id,staff_id,service_id,biz_clients(name,phone),biz_staff(name),biz_services(name)`
    );
    for (const appt of appts) {
      await sendTemplateMessage(tenant, templates.reminder_2h, appt, 'reminder_2h', results);
    }
  }

  // ── 3. Post-servicio (2h después) ─────────────────────────────────────────
  if (templates.post_service) {
    const from = new Date(now.getTime() - 3 * 3600000).toISOString();
    const to   = new Date(now.getTime() - 1.5 * 3600000).toISOString();
    const appts = await sbGet(
      `/biz_appointments?tenant_id=eq.${tenantId}&start_time=gte.${from}&start_time=lte.${to}&status=eq.completed&select=id,start_time,client_id,staff_id,service_id,biz_clients(name,phone),biz_staff(name),biz_services(name)`
    );
    for (const appt of appts) {
      await sendTemplateMessage(tenant, templates.post_service, appt, 'post_service', results);
    }
  }

  // ── 4. Solicitud de reseña (24h después) ──────────────────────────────────
  if (templates.review_request) {
    const from = new Date(now.getTime() - 25 * 3600000).toISOString();
    const to   = new Date(now.getTime() - 23 * 3600000).toISOString();
    const appts = await sbGet(
      `/biz_appointments?tenant_id=eq.${tenantId}&start_time=gte.${from}&start_time=lte.${to}&status=eq.completed&select=id,start_time,client_id,staff_id,service_id,biz_clients(name,phone),biz_staff(name),biz_services(name)`
    );
    for (const appt of appts) {
      await sendTemplateMessage(tenant, templates.review_request, appt, 'review_request', results);
    }
  }

  // ── 5. Win-back 7 días ────────────────────────────────────────────────────
  if (templates.win_back_7d) {
    const cutoff7  = new Date(now.getTime() - 7  * 86400000).toISOString().slice(0,10);
    const cutoff8  = new Date(now.getTime() - 8  * 86400000).toISOString().slice(0,10);
    const clients = await sbGet(
      `/biz_clients?tenant_id=eq.${tenantId}&last_visit_at=gte.${cutoff8}&last_visit_at=lte.${cutoff7}&not.phone=is.null&select=id,name,phone`
    );
    for (const client of clients) {
      await sendWinBack(tenant, templates.win_back_7d, client, 'win_back_7d', results);
    }
  }

  // ── 6. Win-back 30 días ───────────────────────────────────────────────────
  if (templates.win_back_30d) {
    const cutoff30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0,10);
    const cutoff31 = new Date(now.getTime() - 31 * 86400000).toISOString().slice(0,10);
    const clients = await sbGet(
      `/biz_clients?tenant_id=eq.${tenantId}&last_visit_at=gte.${cutoff31}&last_visit_at=lte.${cutoff30}&not.phone=is.null&select=id,name,phone`
    );
    for (const client of clients) {
      await sendWinBack(tenant, templates.win_back_30d, client, 'win_back_30d', results);
    }
  }

  // ── 7. Envíos masivos pendientes ──────────────────────────────────────────
  if (tenant.wa_token && tenant.wa_phone_number_id) {
    const pending = await sbGet(
      `/biz_whatsapp_log?tenant_id=eq.${tenantId}&status=eq.pending&order=created_at.asc&limit=50`
    );
    for (const log of pending) {
      await dispatchLog(tenant, log, results);
      await new Promise(r => setTimeout(r, 2000)); // 2s delay entre mensajes
    }
  }

  return results;
}

async function sendTemplateMessage(tenant, template, appt, triggerKey, results) {
  const client = appt.biz_clients;
  if (!client?.phone) return;

  // Verificar si ya se envió este mensaje para esta cita
  const existing = await sbGet(
    `/biz_whatsapp_log?appointment_id=eq.${appt.id}&trigger_key=eq.${triggerKey}&status=in.(sent,pending)&limit=1`
  );
  if (existing.length) { results.skipped++; return; }

  const dt = new Date(appt.start_time);
  const fecha = dt.toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' });
  const hora  = dt.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });

  const message = renderTemplate(template.body, {
    nombre: client.name, fecha, hora,
    barbero: appt.biz_staff?.name || '',
    servicio: appt.biz_services?.name || '',
    local: tenant.name,
    descuento: template.discount_pct || '10',
  });

  const logRow = {
    tenant_id: appt.tenant_id || tenant.id,
    client_id: appt.client_id,
    appointment_id: appt.id,
    trigger_key: triggerKey,
    phone: client.phone,
    message,
    status: 'pending',
    scheduled_at: new Date().toISOString(),
  };

  if (tenant.wa_token && tenant.wa_phone_number_id) {
    try {
      const waId = await sendWaMessage(tenant.wa_phone_number_id, tenant.wa_token, client.phone, message);
      logRow.status = 'sent';
      logRow.wa_message_id = waId;
      logRow.sent_at = new Date().toISOString();
      results.sent++;
    } catch (err) {
      logRow.status = 'failed';
      logRow.error_msg = err.message;
      results.failed++;
      results.errors.push({ trigger: triggerKey, client: client.name, error: err.message });
    }
  }

  await sbInsert('biz_whatsapp_log', logRow);
}

async function sendWinBack(tenant, template, client, triggerKey, results) {
  if (!client.phone) return;
  const existing = await sbGet(
    `/biz_whatsapp_log?client_id=eq.${client.id}&trigger_key=eq.${triggerKey}&created_at=gte.${new Date(Date.now()-7*86400000).toISOString()}&limit=1`
  );
  if (existing.length) { results.skipped++; return; }

  const message = renderTemplate(template.body, {
    nombre: client.name, local: tenant.name, descuento: template.discount_pct || '10',
  });
  const logRow = { tenant_id: tenant.id, client_id: client.id, trigger_key: triggerKey, phone: client.phone, message, status: 'pending', scheduled_at: new Date().toISOString() };

  if (tenant.wa_token && tenant.wa_phone_number_id) {
    try {
      const waId = await sendWaMessage(tenant.wa_phone_number_id, tenant.wa_token, client.phone, message);
      logRow.status = 'sent'; logRow.wa_message_id = waId; logRow.sent_at = new Date().toISOString();
      results.sent++;
    } catch (err) {
      logRow.status = 'failed'; logRow.error_msg = err.message; results.failed++;
    }
  }
  await sbInsert('biz_whatsapp_log', logRow);
}

async function dispatchLog(tenant, log, results) {
  try {
    const waId = await sendWaMessage(tenant.wa_phone_number_id, tenant.wa_token, log.phone, log.message);
    await sbPatch(`/biz_whatsapp_log?id=eq.${log.id}`, { status: 'sent', wa_message_id: waId, sent_at: new Date().toISOString() });
    results.sent++;
  } catch (err) {
    await sbPatch(`/biz_whatsapp_log?id=eq.${log.id}`, { status: 'failed', error_msg: err.message });
    results.failed++;
  }
}

// ── Handler HTTP ───────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 30)) return res.status(429).json({ error: 'Rate limit' });

  const action = req.path?.split('/').pop() || '';

  // POST /api/saas/whatsapp/send — enviar un mensaje directo
  if (req.method === 'POST' && action === 'send') {
    const { phone, message, tenant_id } = req.body || {};
    if (!phone || !message || !tenant_id) return res.status(400).json({ error: 'Faltan parámetros' });

    const tenantArr = await sbGet(`/tenants?id=eq.${tenant_id}&select=wa_token,wa_phone_number_id`);
    const tenant = tenantArr[0];
    if (!tenant?.wa_token) return res.status(422).json({ error: 'WhatsApp no configurado para este tenant' });

    try {
      const waId = await sendWaMessage(tenant.wa_phone_number_id, tenant.wa_token, phone, message);
      return res.json({ ok: true, wa_message_id: waId });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // POST /api/saas/whatsapp/process — procesar recordatorios (llamado por n8n)
  if ((req.method === 'POST' || req.method === 'GET') && action === 'process') {
    const tenantId = req.body?.tenant_id || req.query?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    try {
      const results = await processReminders(tenantId);
      return res.json({ ok: true, ...results });
    } catch (err) {
      console.error('[whatsapp/process]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
