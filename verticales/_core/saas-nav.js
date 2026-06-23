async function renderNav(activeSection) {
  const user = await requireAuth(['owner', 'staff', 'super_admin']);
  if (!user) return;

  const isOwner = user.role === 'owner' || user.role === 'super_admin';
  const ownerLinks = [
    { href: '/verticales/peluquerias/dashboard.html',    icon: '▦', label: 'Inicio' },
    { href: '/verticales/peluquerias/agenda.html',       icon: '◷', label: 'Agenda' },
    { href: '/verticales/peluquerias/staff.html',        icon: '✦', label: 'Staff' },
    { href: '/verticales/peluquerias/servicios.html',    icon: '✧', label: 'Servicios' },
    { href: '/verticales/peluquerias/ventas.html',       icon: '⊕', label: 'Ventas' },
    { href: '/verticales/peluquerias/comisiones.html',   icon: '◈', label: 'Comisiones' },
    { href: '/verticales/peluquerias/mi-billetera.html', icon: '◎', label: 'Billeteras' },
    { href: '/verticales/peluquerias/whatsapp.html',     icon: '✉', label: 'WhatsApp' },
    { href: '/verticales/peluquerias/clientes.html',     icon: '◉', label: 'Clientes' },
    { href: '/verticales/peluquerias/reportes.html',     icon: '▲', label: 'Reportes' },
    { href: '/verticales/peluquerias/configuracion.html',icon: '⚙', label: 'Config' },
  ];

  const staffLinks = [
    { href: '/verticales/peluquerias/agenda.html',       icon: '◷', label: 'Mi agenda' },
    { href: '/verticales/peluquerias/mi-billetera.html', icon: '◎', label: 'Mi billetera' },
  ];

  const links = isOwner ? ownerLinks : staffLinks;
  const nav   = document.getElementById('saas-nav');
  if (!nav) return;

  const savedTheme = localStorage.getItem('admin-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeLabel = savedTheme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';

  nav.innerHTML = `
    <div class="nav-brand">
      <span class="nav-tenant">${user.tenant?.name || 'HORIZON SaaS'}</span>
      <span class="nav-plan">${user.tenant?.plan || ''}</span>
    </div>
    <ul class="nav-links">
      ${links.map(l => `
        <li class="${l.label === activeSection ? 'active' : ''}">
          <a href="${l.href}"><span>${l.icon}</span>${l.label}</a>
        </li>`).join('')}
    </ul>
    <div class="nav-footer">
      <button id="navThemeBtn" onclick="toggleAdminTheme()"
        style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:7px;color:var(--text2);padding:7px 12px;font-size:11px;cursor:pointer;text-align:left;margin-bottom:8px;">
        ${themeLabel}
      </button>
      <button onclick="logout()" class="nav-logout">Cerrar sesión</button>
    </div>
  `;
}

window.toggleAdminTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('admin-theme', next);
  const btn = document.getElementById('navThemeBtn');
  if (btn) btn.textContent = next === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
};
