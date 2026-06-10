const { createClient } = supabase;
const _sb = createClient(SAAS_CONFIG.supabase.url, SAAS_CONFIG.supabase.anonKey);

async function getSession() {
  const { data: { session } } = await _sb.auth.getSession();
  return session;
}

async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const { data: profile } = await _sb
    .from('user_profiles')
    .select('is_super_admin')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (profile?.is_super_admin) {
    // super_admin puede impersonar un tenant via ?t= en la URL
    const urlTenant = new URLSearchParams(window.location.search).get('t') ||
                      new URLSearchParams(window.location.search).get('tenant');
    let tenantId = urlTenant || null;
    let tenant   = null;

    // Si no hay parámetro, usar el primer tenant activo como fallback de prueba
    if (!tenantId) {
      const { data: first } = await _sb.from('tenants').select('id, name, slug, plan, status, mp_access_token, wa_token, wa_phone_number_id')
        .order('created_at').limit(1).maybeSingle();
      if (first) { tenantId = first.id; tenant = first; }
    } else {
      const { data: t } = await _sb.from('tenants').select('id, name, slug, plan, status, mp_access_token, wa_token, wa_phone_number_id')
        .eq('id', tenantId).maybeSingle();
      tenant = t;
    }

    return { ...session.user, role: 'super_admin', tenant_id: tenantId, tenant };
  }

  const { data: tenantUser } = await _sb
    .from('tenant_users')
    .select('tenant_id, role, tenants(name, slug, plan, status, mp_access_token, wa_token, wa_phone_number_id)')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!tenantUser) return null;

  return {
    ...session.user,
    role: tenantUser.role,
    tenant_id: tenantUser.tenant_id,
    tenant: tenantUser.tenants
  };
}

async function requireAuth(allowedRoles = []) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = SAAS_CONFIG.routes.login;
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = SAAS_CONFIG.routes.login;
    return null;
  }
  return user;
}

async function redirectByRole() {
  const user = await getCurrentUser();
  if (!user) return;
  const map = {
    super_admin: SAAS_CONFIG.routes.superAdmin,
    owner: SAAS_CONFIG.routes.tenantOwner,
    staff: SAAS_CONFIG.routes.tenantStaff
  };
  window.location.href = map[user.role] || SAAS_CONFIG.routes.login;
}

async function login(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function logout() {
  await _sb.auth.signOut();
  window.location.href = SAAS_CONFIG.routes.login;
}
