/* HORIZON OPS — Sidebar Navigation */
(function () {
  const NAV_ITEMS = [
    { href: '/ops',           label: 'Dashboard',  icon: 'dashboard' },
    { href: '/ops/pipeline',  label: 'Pipeline',   icon: 'pipeline'  },
    { href: '/ops/proyectos', label: 'Proyectos',  icon: 'projects'  },
    { href: '/ops/agente',    label: 'Agente IA',  icon: 'agent'     },
  ];

  const ICONS = {
    dashboard: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    pipeline:  `<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
    projects:  `<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    agent:     `<svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/></svg>`,
    site:      `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    signout:   `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  };

  function buildSidebar(user) {
    const current = window.location.pathname;

    const navItems = NAV_ITEMS.map(item => {
      const isActive = current === item.href || (item.href !== '/ops' && current.startsWith(item.href));
      return `<a href="${item.href}" class="ops-nav-item${isActive ? ' active' : ''}">
        <span class="ops-nav-icon">${ICONS[item.icon]}</span>
        <span class="ops-nav-label">${item.label}</span>
      </a>`;
    }).join('');

    const initials = user?.email ? user.email[0].toUpperCase() : 'B';
    const emailDisplay = user?.email || '';

    return `
<aside class="ops-sidebar">
  <div class="ops-sidebar-top">
    <div class="ops-logo">
      <img src="/Identidad/Logo-Vertical-png.png" alt="HORIZON">
      <span class="ops-logo-badge">OPS</span>
    </div>
  </div>
  <nav class="ops-nav">
    <div class="ops-nav-section">Módulos</div>
    ${navItems}
  </nav>
  <div class="ops-sidebar-footer">
    <div class="ops-user-info">
      <div class="ops-user-avatar">${initials}</div>
      <div>
        <div class="ops-user-name">Benja</div>
        <div class="ops-user-email">${emailDisplay}</div>
      </div>
    </div>
    <a href="/" class="ops-nav-item ops-nav-item--subtle">
      <span class="ops-nav-icon">${ICONS.site}</span>
      <span class="ops-nav-label">Ir al sitio</span>
    </a>
    <button class="ops-nav-item ops-nav-item--danger" onclick="opsSignOut()">
      <span class="ops-nav-icon">${ICONS.signout}</span>
      <span class="ops-nav-label">Cerrar sesión</span>
    </button>
  </div>
</aside>`;
  }

  // Inyecta el sidebar en el primer elemento .ops-layout
  window.opsInitNav = async function () {
    const layout = document.querySelector('.ops-layout');
    if (!layout) return;
    const user = await opsGetUser();
    const sidebar = document.createElement('div');
    sidebar.innerHTML = buildSidebar(user);
    layout.prepend(sidebar.firstElementChild);
  };
})();
