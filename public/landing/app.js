/* ============================================================
   ZapLynx — app.js
   Nav, reveal-on-scroll, stat count-up, FAQ, pricing toggle
   ============================================================ */
(function () {
  'use strict';

  /* ---- Nav shrink on scroll ---- */
  const navWrap = document.getElementById('navWrap');
  const onScroll = () => { if (navWrap) navWrap.classList.toggle('scrolled', window.scrollY > 20); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Reveal on scroll ---- */
  const reveals = [].slice.call(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => ro.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ---- Stat count-up ---- */
  const fmtNum = (n, dec) => {
    if (dec) return n.toFixed(dec).replace('.', ',');
    return Math.round(n).toLocaleString('pt-BR');
  };
  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const pre = el.dataset.prefix || '';
    const suf = el.dataset.suffix || '';
    const dec = (String(el.dataset.count).indexOf('.') > -1) ? (el.dataset.count.split('.')[1].length) : 0;
    let start = null; const dur = 1700;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + fmtNum(target * eased, dec) + suf;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = pre + fmtNum(target, dec) + suf;
    }
    requestAnimationFrame(step);
  }
  const stats = [].slice.call(document.querySelectorAll('[data-count]'));
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); so.unobserve(e.target); } });
    }, { threshold: 0.5 });
    stats.forEach((el) => so.observe(el));
  } else { stats.forEach(countUp); }

  /* ---- FAQ accordion ---- */
  const faqList = document.getElementById('faqList');
  if (faqList) {
    faqList.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.faq-q');
      if (!btn) return;
      const item = btn.closest('.faq-item');
      const ans = item.querySelector('.faq-a');
      const isOpen = item.classList.contains('open');
      // close all
      faqList.querySelectorAll('.faq-item.open').forEach((it) => {
        it.classList.remove('open');
        it.querySelector('.faq-a').style.maxHeight = '0px';
      });
      if (!isOpen) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
    // open first by default
    const first = faqList.querySelector('.faq-item');
    if (first) { first.classList.add('open'); const a = first.querySelector('.faq-a'); a.style.maxHeight = a.scrollHeight + 'px'; }
  }

  /* ---- Pricing toggle ---- */
  const toggle = document.querySelector('.billing-toggle');
  if (toggle) {
    toggle.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-billing]');
      if (!btn) return;
      toggle.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.billing;
      document.querySelectorAll('.plan .amt').forEach((amt) => {
        const v = mode === 'year' ? amt.dataset.year : amt.dataset.month;
        amt.textContent = v;
      });
      document.querySelectorAll('.plan .pnote').forEach((note) => {
        note.textContent = mode === 'year' ? (note.dataset.noteYear || 'cobrado anualmente') : 'cobrado mensalmente';
      });
    });
  }
})();
