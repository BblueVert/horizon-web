/* HORIZON OPS — Entrada al panel
 * Continúa la pantalla de inicio del celular (fondo #1A1626 + logo, ver /OPS/manifest.webmanifest)
 * y la funde con el panel cuando la página ya cargó, sin el pantallazo blanco.
 * Va en el <head> y sin defer: tiene que pintar antes que el body.
 * Sale una vez por sesión (o en cada apertura de la app instalada) y respeta prefers-reduced-motion.
 */
(function () {
  var d = document, de = d.documentElement;
  var app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var first = true;
  try { first = !sessionStorage.getItem('hz-ops-intro'); sessionStorage.setItem('hz-ops-intro', '1'); } catch (e) {}
  if (!app && !first) return;

  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = d.createElement('style');
  css.textContent =
    '#hz-splash{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'background:#1A1626;transition:opacity .45s cubic-bezier(.4,0,.2,1),visibility 0s linear .45s;}' +
    '#hz-splash::before{content:"";position:absolute;width:340px;height:340px;border-radius:50%;' +
      'background:radial-gradient(circle,rgba(242,105,12,.22),rgba(204,50,83,.12) 45%,transparent 70%);' +
      'filter:blur(10px);opacity:0;transition:opacity .6s ease;}' +
    '#hz-splash img{position:relative;width:112px;height:112px;' +
      'transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .4s ease;}' +
    '#hz-splash.in::before{opacity:1;}' +
    '#hz-splash.wait img{animation:hzBreath 1.6s ease-in-out infinite;}' +
    '#hz-splash.out{opacity:0;visibility:hidden;}' +
    '#hz-splash.out img{transform:scale(1.14);opacity:0;}' +
    '@keyframes hzBreath{50%{transform:scale(1.04);}}' +
    (calm ? '#hz-splash,#hz-splash img,#hz-splash::before{transition-duration:.2s!important;animation:none!important;}' : '');
  de.appendChild(css);

  var el = d.createElement('div');
  el.id = 'hz-splash';
  el.setAttribute('aria-hidden', 'true');
  // En la app el logo ya viene en pantalla (splash del sistema): parte quieto. En el navegador, aparece.
  el.innerHTML = '<img src="/OPS/app/splash-logo.png" alt="" style="' + (app ? '' : 'opacity:0;transform:scale(.9)') + '">';
  de.appendChild(el);
  var img = el.firstChild;
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    el.className = 'in';
    img.style.opacity = ''; img.style.transform = '';
  }); });

  var t0 = Date.now(), min = calm ? 0 : (app ? 450 : 1000), done = false;
  var waitT = setTimeout(function () { if (!done) el.className = 'in wait'; }, 900);
  function hide() {
    if (done) return; done = true; clearTimeout(waitT);
    setTimeout(function () {
      el.className = 'in out';
      setTimeout(function () { el.remove(); css.remove(); }, 600);
    }, Math.max(0, min - (Date.now() - t0)));
  }
  if (d.readyState === 'complete') hide(); else window.addEventListener('load', hide);
  setTimeout(hide, 3500);   // nunca deja el panel tapado si algo no termina de cargar
})();
