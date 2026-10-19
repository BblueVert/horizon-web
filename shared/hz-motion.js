// HORIZON — movimiento compartido de las páginas claras: menú móvil, header, Lenis y apariciones con GSAP.
// Requiere en <head> el snippet que agrega html.anim, y GSAP/ScrollTrigger/Lenis cargados con defer antes de este archivo.
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    var menuBtn = document.getElementById('menuBtn'), drawer = document.getElementById('drawer');
    if (menuBtn && drawer) {
      menuBtn.addEventListener('click', function () {
        var open = drawer.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open);
      });
      drawer.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { drawer.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); });
      });
    }

    var header = document.querySelector('.header'), lastY = 0;
    if (header) {
      addEventListener('scroll', function () {
        var y = scrollY;
        header.classList.toggle('scrolled', y > 12);
        header.classList.toggle('hide', y > 400 && y > lastY && !(drawer && drawer.classList.contains('open')));
        lastY = y;
      }, { passive: true });
    }

    if (reduced || !window.gsap) return;
    gsap.registerPlugin(ScrollTrigger);

    if (window.Lenis) {
      var lenis = new Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      window.hzLenis = lenis;
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href');
          var target = id.length > 1 && document.querySelector(id);
          if (!target) return;
          e.preventDefault();
          lenis.scrollTo(target, { offset: -84 });
        });
      });
    }

    var ease = 'power3.out';
    gsap.to('[data-intro]', { opacity: 1, y: 0, duration: .8, ease: ease, stagger: .08, startAt: { y: 18 } });
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      gsap.to(el, { opacity: 1, y: 0, duration: .9, ease: ease, startAt: { y: 24 },
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    gsap.utils.toArray('[data-stagger]').forEach(function (group) {
      gsap.to(group.children, { opacity: 1, y: 0, duration: .8, ease: ease, stagger: .08, startAt: { y: 26 },
        scrollTrigger: { trigger: group, start: 'top 86%', once: true } });
    });
  });
})();
