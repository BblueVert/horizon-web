/* HORIZON OPS — Sidebar Navigation */
(function () {
  const NAV = [
    { section: 'MÓDULOS' },
    { href:'/ops',              label:'Dashboard',     icon:'dashboard'  },
    { href:'/ops/pipeline',     label:'Pipeline',      icon:'pipeline'   },
    { href:'/ops/proyectos',    label:'Proyectos',     icon:'projects'   },
    { href:'/ops/agente',       label:'Agente IA',     icon:'agent'      },
    { section: 'SAAS' },
    { href:'/ops/saas-clientes',  label:'Clientes SaaS',  icon:'saas'     },
    { section: 'TRABAJO' },
    { href:'/ops/deep-work',    label:'Deep Work',     icon:'deepwork'   },
    { href:'/ops/leads-activos',label:'Leads Activos', icon:'leads'      },
    { href:'/ops/objetivos',    label:'Objetivos',     icon:'objetivos'  },
    { href:'/ops/agenda',       label:'Agenda',        icon:'agenda'     },
    { href:'/ops/tareas',       label:'Tareas',        icon:'tareas'     },
    { href:'/ops/notas',        label:'Notas',         icon:'notas'      },
  ];

  const ICONS = {
    dashboard: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    pipeline:  `<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
    projects:  `<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    agent:     `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/></svg>`,
    deepwork:  `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    leads:     `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    objetivos: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    agenda:    `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    tareas:    `<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    notas:     `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    saas:      `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/></svg>`,
    site:      `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    signout:   `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  };

  function buildSidebar(user) {
    const current = window.location.pathname;

    const navHTML = NAV.map(item => {
      if (item.section) {
        return `<div class="ops-nav-section">${item.section}</div>`;
      }
      const isActive = current === item.href || (item.href !== '/ops' && current.startsWith(item.href));
      return `<a href="${item.href}" class="ops-nav-item${isActive?' active':''}">
        <span class="ops-nav-icon">${ICONS[item.icon]}</span>
        <span class="ops-nav-label">${item.label}</span>
      </a>`;
    }).join('');

    const initials = user?.email ? user.email[0].toUpperCase() : 'B';
    const emailDisplay = user?.email || '';

    return `
<aside class="ops-sidebar">
  <div class="ops-sidebar-top">
    <a href="/ops" class="ops-logo" style="text-decoration:none;display:flex;align-items:center;gap:10px;">
      <img src="/Identidad/Logo-Vertical-png.png" alt="HORIZON">
      <span class="ops-logo-badge">OPS</span>
    </a>
  </div>
  <nav class="ops-nav">${navHTML}</nav>
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

  window.opsInitNav = async function () {
    const layout = document.querySelector('.ops-layout');
    if (!layout) return;
    const user = await opsGetUser();
    const sidebar = document.createElement('div');
    sidebar.innerHTML = buildSidebar(user);
    layout.prepend(sidebar.firstElementChild);
  };
})();
