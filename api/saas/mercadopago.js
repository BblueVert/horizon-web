'use strict';

const { httpsRequest, rateLimit, getIp } = require('../shared');

const SB_SAAS_URL = 'https://khvfhvpqhcchgxrtmrjo.supabase.co';
const SB_SAAS_KEY = process.env.SUPABASE_SAAS_SERVICE_KEY || process.env.SUPABASE_SAAS_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodmZodnBxaGNjaGd4cnRtcmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MzkwNTMsImV4cCI6MjA5NjExNTA1M30.lYHscLNuqaB1UObLDRbPLJH5vFm--WPTitN8lJXZeF4';

const sbHeaders = { apikey: SB_SAAS_KEY, Authorization: 'Bearer ' + SB_SAAS_KEY };

async function sbGet(path) {
  const r = await httpsRequest('GET', `${SB_SAAS_URL}/rest/v1${path}`, sbHeaders);
  return JSON.parse(r.body || '[]');
}

async function sbPatch(path, data) {
  const headers = { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  return httpsRequest('PATCH', `${SB_SAAS_URL}/rest/v1${path}`, headers, data);
}

// ── Crear preferencia de pago en MercadoPago ──────────────────────────────────
async function createPreference(accessToken, sale, items, tenant, origin) {
  const mpItems = items.map(i => ({
    title: i.name,
    quantity: i.qty,
    unit_price: i.price,
    currency_id: 'CLP',
  }));

  const preference = {
    items: mpItems,
    external_reference: sale.id,
    back_urls: {
      success: `${origin}/verticales/peluquerias/ventas.html?mp=success&sale_id=${sale.id}`,
      failure: `${origin}/verticales/peluquerias/ventas.html?mp=failure&sale_id=${sale.id}`,
      pending: `${origin}/verticales/peluquerias/ventas.html?mp=pending&sale_id=${sale.id}`,
    },
    auto_return: 'approved',
    notification_url: `${origin}/api/saas/mp/webhook?tenant_id=${tenant.id}`,
    statement_descriptor: tenant.name || 'HORIZON SaaS',
    expires: false,
  };

  const headers = {
    Authorization: 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': sale.id,
  };

  const r = await httpsRequest('POST', 'https://api.mercadopago.com/checkout/preferences', headers, preference);
  const parsed = JSON.parse(r.body || '{}');
  if (r.status >= 400) throw new Error(parsed?.message || `MP error ${r.status}`);
  return parsed;
}

// ── Handler HTTP ───────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 30)) return res.status(429).json({ error: 'Rate limit' });

  const action = req.params?.action || req.path?.split('/').pop() || '';

  // ── POST /api/saas/mp/create-preference ────────────────────────────────────
  if (req.method === 'POST' && action === 'create-preference') {
    const { sale_id, tenant_id } = req.body || {};
    if (!sale_id || !tenant_id) return res.status(400).json({ error: 'sale_id y tenant_id requeridos' });

    const [tenantArr, saleArr, itemsArr] = await Promise.all([
      sbGet(`/tenants?id=eq.${tenant_id}&select=id,name,mp_access_token`),
      sbGet(`/biz_sales?id=eq.${sale_id}&select=id,total,subtotal,discount`),
      sbGet(`/biz_sale_items?sale_id=eq.${sale_id}&select=name,qty,price`),
    ]);

    const tenant = tenantArr[0];
    const sale   = saleArr[0];

    if (!tenant?.mp_access_token) return res.status(422).json({ error: 'MercadoPago no configurado' });
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

    const origin = `${req.protocol || 'http'}://${req.get('host')}`;

    try {
      const pref = await createPreference(tenant.mp_access_token, sale, itemsArr, tenant, origin);

      // Guardar preference_id en la venta
      await sbPatch(`/biz_sales?id=eq.${sale_id}`, {
        mp_preference_id: pref.id,
        payment_status: 'pending',
      });

      return res.json({
        ok: true,
        preference_id: pref.id,
        checkout_url: pref.init_point,
        sandbox_url:  pref.sandbox_init_point,
      });
    } catch (err) {
      console.error('[mp/create-preference]', err.message);
      return res.status(502).json({ error: err.message });
    }
  }

  // ── POST /api/saas/mp/webhook — notificación de pago ──────────────────────
  if (req.method === 'POST' && action === 'webhook') {
    const { type, data } = req.body || {};

    if (type === 'payment' && data?.id) {
      const tenantId = req.query?.tenant_id;
      if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });

      const tenantArr = await sbGet(`/tenants?id=eq.${tenantId}&select=mp_access_token`);
      const mpToken   = tenantArr[0]?.mp_access_token;
      if (!mpToken) return res.status(422).json({ error: 'Tenant sin token MP' });

      // Consultar el pago en MP
      try {
        const headers = { Authorization: 'Bearer ' + mpToken };
        const r = await httpsRequest('GET', `https://api.mercadopago.com/v1/payments/${data.id}`, headers);
        const payment = JSON.parse(r.body || '{}');

        if (payment.status === 'approved' && payment.external_reference) {
          await sbPatch(`/biz_sales?id=eq.${payment.external_reference}`, {
            payment_status: 'paid',
            mp_payment_id:  String(payment.id),
          });
        }
      } catch (err) {
        console.error('[mp/webhook] error consultando pago:', err.message);
      }
    }

    return res.status(200).json({ ok: true });
  }

  // ── GET /api/saas/mp/payment-status — consulta manual del estado ──────────
  if (req.method === 'GET' && action === 'payment-status') {
    const { sale_id } = req.query;
    if (!sale_id) return res.status(400).json({ error: 'sale_id requerido' });

    const saleArr = await sbGet(`/biz_sales?id=eq.${sale_id}&select=id,payment_status,mp_payment_id,total`);
    const sale = saleArr[0];
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

    return res.json({ ok: true, status: sale.payment_status, mp_payment_id: sale.mp_payment_id, total: sale.total });
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
