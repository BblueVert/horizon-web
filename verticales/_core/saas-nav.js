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

  // Accesos rápidos para la barra inferior móvil (máx. 4 + botón "Más")
  const bottomKeys = isOwner
    ? ['Inicio', 'Agenda', 'Ventas', 'Config']
    : links.map(l => l.label);
  const bottomLinks = bottomKeys.map(k => links.find(l => l.label === k)).filter(Boolean);

  const nav = document.getElementById('saas-nav');
  if (!nav) return;

  const savedTheme = localStorage.getItem('admin-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeLabel = savedTheme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
  const themeIcon  = savedTheme === 'dark' ? '☀️' : '🌙';

  const bookingUrl = getBookingPreviewUrl(user);
  const previewBtn = `<a class="nav-preview-btn" href="${bookingUrl}" target="_blank" rel="noopener">👁 Ver vista de reserva (cliente) →</a>`;

  // ── Sidebar de escritorio ──────────────────────────────────────────────
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
      ${previewBtn}
      <button id="navThemeBtn" onclick="toggleAdminTheme()"
        style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:7px;color:var(--text2);padding:7px 12px;font-size:11px;cursor:pointer;text-align:left;margin-bottom:8px;">
        ${themeLabel}
      </button>
      <button onclick="logout()" class="nav-logout">Cerrar sesión</button>
    </div>
  `;

  // ── Mobile: top bar + drawer + bottom tab bar ──────────────────────────
  renderMobileNav({ user, links, bottomLinks, activeSection, bookingUrl, themeIcon, themeLabel });
}

function getBookingPreviewUrl(user) {
  const slug = user.tenant?.slug || (window._DEMO_TENANT && window._DEMO_TENANT.slug) || 'pillars';
  const base = (typeof SAAS_CONFIG !== 'undefined' && SAAS_CONFIG.bookingDomain) || window.location.origin;
  const path = (typeof SAAS_CONFIG !== 'undefined' && SAAS_CONFIG.routes?.bookingBase) || '/verticales/peluquerias/public/booking.html';
  return `${base}${path}?t=${slug}`;
}

function renderMobileNav({ user, links, bottomLinks, activeSection, bookingUrl, themeIcon, themeLabel }) {
  // Evita duplicar elementos si renderNav se llama más de una vez
  document.getElementById('mobile-topbar')?.remove();
  document.getElementById('mobile-drawer-overlay')?.remove();
  document.getElementById('mobile-bottom-nav')?.remove();

  const topbar = document.createElement('div');
  topbar.id = 'mobile-topbar';
  topbar.innerHTML = `
    <button class="mobile-hamburger" onclick="openMobileDrawer()" aria-label="Abrir menú">
      <span></span><span></span><span></span>
    </button>
    <span class="mobile-topbar-title">${user.tenant?.name || 'HORIZON SaaS'}</span>
    <button class="mobile-theme-btn" onclick="toggleAdminTheme()">${themeIcon}</button>
  `;

  const overlay = document.createElement('div');
  overlay.id = 'mobile-drawer-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeMobileDrawer(); };
  overlay.innerHTML = `
    <nav id="mobile-drawer">
      <div class="drawer-header">
        <div class="drawer-brand">
          <span class="nav-tenant">${user.tenant?.name || 'HORIZON SaaS'}</span>
          <span class="nav-plan">${user.tenant?.plan || ''}</span>
        </div>
        <button class="drawer-close" onclick="closeMobileDrawer()" aria-label="Cerrar menú">✕</button>
      </div>
      <ul class="drawer-links">
        ${links.map(l => `
          <li class="${l.label === activeSection ? 'active' : ''}">
            <a href="${l.href}" onclick="closeMobileDrawer()"><span>${l.icon}</span>${l.label}</a>
          </li>`).join('')}
      </ul>
      <div class="drawer-footer">
        <a class="nav-preview-btn" href="${bookingUrl}" target="_blank" rel="noopener">👁 Ver vista de reserva (cliente) →</a>
        <button class="drawer-theme-btn" onclick="toggleAdminTheme()">${themeLabel}</button>
        <button class="drawer-logout-btn" onclick="logout()">Cerrar sesión</button>
      </div>
    </nav>
  `;

  const bottomNav = document.createElement('div');
  bottomNav.id = 'mobile-bottom-nav';
  bottomNav.innerHTML = `
    <ul>
      ${bottomLinks.map(l => `
        <li class="${l.label === activeSection ? 'active' : ''}">
          <a href="${l.href}"><span class="icon">${l.icon}</span>${l.label}</a>
        </li>`).join('')}
      <li class="${activeSection === '__more__' ? 'active' : ''}">
        <button onclick="openMobileDrawer()"><span class="icon">☰</span>Más</button>
      </li>
    </ul>
  `;

  document.body.appendChild(topbar);
  document.body.appendChild(overlay);
  document.body.appendChild(bottomNav);
}

window.openMobileDrawer  = function() { document.getElementById('mobile-drawer-overlay')?.classList.add('open'); };
window.closeMobileDrawer = function() { document.getElementById('mobile-drawer-overlay')?.classList.remove('open'); };

window.toggleAdminTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('admin-theme', next);

  const label = next === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
  const icon  = next === 'dark' ? '☀️' : '🌙';

  const btn = document.getElementById('navThemeBtn');
  if (btn) btn.textContent = label;
  const mobileBtn = document.querySelector('.mobile-theme-btn');
  if (mobileBtn) mobileBtn.textContent = icon;
  const drawerBtn = document.querySelector('.drawer-theme-btn');
  if (drawerBtn) drawerBtn.textContent = label;
};
