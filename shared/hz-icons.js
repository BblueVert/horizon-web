/* HORIZON — Sistema de iconos
 * Set lineal propio (grilla 24, trazo 1.6, puntas redondeadas) compartido por OPS y el portal.
 *
 * Uso en HTML o en templates:  <i class="hz-i" data-i="calendar"></i>
 * Uso en JS:                   hzIcon('calendar')  → string <svg>
 *
 * Los <i class="hz-i"> se hidratan solos, incluso los que se insertan después con innerHTML.
 */
(function () {
  const P = {
    // navegación / acciones
    check:       '<path d="M5 12.5l4.2 4.2L19 7"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.3l2.6 2.6 5-5.2"/>',
    x:           '<path d="M6 6l12 12M18 6L6 18"/>',
    plus:        '<path d="M12 5v14M5 12h14"/>',
    pencil:      '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash:       '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    search:      '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    list:        '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6"/><circle cx="4.5" cy="12" r=".6"/><circle cx="4.5" cy="18" r=".6"/>',
    grip:        '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    'arrow-up':  '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down':'<path d="M12 5v14M18 13l-6 6-6-6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    send:        '<path d="M20.5 3.5L10 14"/><path d="M20.5 3.5l-6.5 17-4-6.5-6.5-4 17-6.5z"/>',
    link:        '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
    external:    '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    refresh:     '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>',
    gear:        '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 6.5l2.1 1.2M17.7 16.3l2.1 1.2M4.2 17.5l2.1-1.2M17.7 7.7l2.1-1.2M2.8 12h2.4M18.8 12h2.4"/><circle cx="12" cy="12" r="7"/>',
    // tiempo / estado
    calendar:    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock:       '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    timer:       '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2 1.5M9.5 3h5M12 3v3"/>',
    circle:      '<circle cx="12" cy="12" r="8.5"/>',
    progress:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    flag:        '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    target:      '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    alert:       '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    lock:        '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    bolt:        '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    flame:       '<path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5-1.5 2-2.5 3-4 3 0-2-1-4-2.5-5.5C8 7 6 9.5 6 15a6 6 0 0 0 6 6z"/>',
    // comunicación / personas
    message:     '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17H5.5A1.5 1.5 0 0 1 4 15.5z"/>',
    user:        '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    users:       '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    agent:       '<rect x="4.5" y="7.5" width="15" height="12" rx="4"/><path d="M12 7.5V4M9.5 13v1.5M14.5 13v1.5M2.5 13v2.5M21.5 13v2.5"/><circle cx="12" cy="3.5" r=".8"/>',
    // trabajo / proyecto
    doc:         '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    note:        '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V15l-6 6H6.5A1.5 1.5 0 0 1 5 19.5z"/><path d="M13 21v-4.5a1.5 1.5 0 0 1 1.5-1.5H19M9 8h6M9 11.5h4"/>',
    pin:         '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 14v7"/>',
    clipboard:   '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3.5h6v1M9 11h6M9 15h4"/>',
    briefcase:   '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
    chart:       '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    star:        '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z"/>',
    trophy:      '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5A2.5 2.5 0 0 0 8 10M16 5.5h3a2.5 2.5 0 0 1-3 4.5M12 13v3.5M8.5 20.5h7M9.5 20.5l.5-4h4l.5 4"/>',
    launch:      '<path d="M14.5 4.5c2.5-1 4.5-1 5-.5s.5 2.5-.5 5l-6 6-4-4z"/><path d="M9 11l-3.5.5L3 14l4 1M13 15l-.5 3.5L10 21l-1-4M6.5 17.5L4 20"/><circle cx="15.5" cy="8.5" r="1.3"/>',
    flow:        '<path d="M4 7h4.5a3 3 0 0 1 2.5 1.3l2 2.9a3 3 0 0 0 2.5 1.3H20"/><path d="M4 17h4.5a3 3 0 0 0 2.5-1.3l.6-.9M17 9.5l3 3-3 3M15 4.5h5V9"/>',
    store:       '<path d="M4 9.5L5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5V20h13v-8.5M10 20v-4.5h4V20"/>',
    coin:        '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    palette:     '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.3.3-2.3 1.6-2.3H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="7.8" cy="11" r=".9"/><circle cx="10.5" cy="7.5" r=".9"/><circle cx="15" cy="8" r=".9"/>',
    code:        '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
    focus:       '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><circle cx="12" cy="12" r="3"/>',
    wave:        '<path d="M3 9c2 0 2-2 4.5-2S10 9 12 9s2-2 4.5-2S19 9 21 9M3 15c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2"/>',
    coffee:      '<path d="M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M16.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.8M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"/>',
    rest:        '<path d="M3.5 17.5V11a2 2 0 0 1 4 0v2h9v-2a2 2 0 0 1 4 0v6.5z"/><path d="M5.5 9V7.5A2.5 2.5 0 0 1 8 5h8a2.5 2.5 0 0 1 2.5 2.5V9M5.5 17.5V20M18.5 17.5V20"/>',
    // producto / portal
    bag:         '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 10.5V6.5a3 3 0 0 1 6 0v4"/>',
    ruler:       '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4"/>',
    image:       '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="M20.5 16l-5-5L6 19.5"/>',
    deploy:      '<circle cx="6" cy="5.5" r="2"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="8.5" r="2"/><path d="M6 7.5v9M18 10.5c0 4-5 3.5-10.4 6.6"/>',
    spark:       '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    layers:      '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
    eye:         '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    home:        '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
    dot:         '<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>',
  };

  function hzIcon(name, cls) {
    const body = P[name] || P.circle;
    return `<svg class="hz-svg${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function hydrate(root) {
    const nodes = root.querySelectorAll ? root.querySelectorAll('i.hz-i[data-i]:not([data-h])') : [];
    nodes.forEach(n => { n.innerHTML = hzIcon(n.dataset.i); n.setAttribute('data-h', ''); });
    if (root.matches && root.matches('i.hz-i[data-i]:not([data-h])')) {
      root.innerHTML = hzIcon(root.dataset.i); root.setAttribute('data-h', '');
    }
  }

  const css = document.createElement('style');
  css.textContent =
    '.hz-i{display:inline-flex;width:1em;height:1em;vertical-align:-.14em;flex-shrink:0;font-style:normal;}' +
    '.hz-i svg,.hz-svg{width:100%;height:100%;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}';
  document.head.appendChild(css);

  window.hzIcon = hzIcon;
  window.HZ_ICON_NAMES = Object.keys(P);

  const start = () => {
    hydrate(document);
    new MutationObserver(muts => {
      for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1) hydrate(n); });
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
