/* HORIZON OPS — Auth Helper (Supabase Auth) */
const OPS_SB_URL  = 'https://dkitbnrpwmwrfnmztdfc.supabase.co';
const OPS_SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRraXRibnJwd213cmZubXp0ZGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzk4OTUsImV4cCI6MjA5NDgxNTg5NX0.ToIz8RM5phcWTa7LY1VbmQZXGIhgkDL1UKxwPJdO3x4';

// Cliente Supabase — requiere que el SDK esté cargado antes de este script
let _sb = null;
function getSB() {
  if (!_sb) _sb = window.supabase.createClient(OPS_SB_URL, OPS_SB_ANON);
  return _sb;
}

// Verifica la sesión y redirige al login si no hay ninguna.
// Devuelve el objeto session o null.
async function opsRequireAuth() {
  const sb = getSB();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = '/ops/login';
    return null;
  }
  return session;
}

// Devuelve los headers de autorización para llamar a las APIs OPS.
async function opsAuthHeaders() {
  const sb = getSB();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return {};
  return {
    'Authorization': 'Bearer ' + session.access_token,
    'Content-Type': 'application/json',
  };
}

// Cierra la sesión y redirige al login.
async function opsSignOut() {
  const sb = getSB();
  await sb.auth.signOut();
  window.location.href = '/ops/login';
}

// Devuelve el usuario actual (o null).
async function opsGetUser() {
  const sb = getSB();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// Muestra un toast temporal.
function opsToast(msg, type = 'success', ms = 2800) {
  const t = document.createElement('div');
  t.className = 'ops-toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
