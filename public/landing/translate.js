/* ZapLynx landing — translate-to-English button */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://yodgjxdekuraxquxkxhx.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8';
  var CACHE_KEY = 'landing_i18n_en_v1';
  var STATE_KEY = 'landing_lang';

  var btn = document.getElementById('langToggle');
  if (!btn) return;

  var cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { cache = {}; }

  // Snapshot of original PT text nodes / attributes so we can restore.
  var originalTextNodes = []; // {node, text}
  var originalAttrs = [];     // {el, attr, value}
  var snapshotTaken = false;

  var ATTR_LIST = ['placeholder', 'title', 'aria-label', 'alt', 'value'];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, SVG: 1, IFRAME: 1 };

  function isTranslatable(s) {
    if (!s) return false;
    var t = s.trim();
    if (t.length < 2 || t.length > 400) return false;
    if (!/[A-Za-zÀ-ÿ]/.test(t)) return false;
    if (/^https?:\/\//i.test(t)) return false;
    if (/^[\d\s.,:/+\-R$%€£]+$/.test(t)) return false;
    return true;
  }

  function walk(root, onText, onAttr) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var node = walker.currentNode;
    while (node) {
      if (node.nodeType === 1) {
        var el = node;
        if (SKIP_TAGS[el.tagName]) {
          node = walker.nextSibling() || walker.parentNode();
          if (!node) break;
          continue;
        }
        if (el.id === 'langToggle') {
          // skip
        } else {
          for (var i = 0; i < ATTR_LIST.length; i++) {
            var a = ATTR_LIST[i];
            if (el.hasAttribute(a)) {
              var v = el.getAttribute(a);
              if (isTranslatable(v)) onAttr(el, a, v);
            }
          }
        }
      } else if (node.nodeType === 3) {
        if (isTranslatable(node.nodeValue)) onText(node);
      }
      node = walker.nextNode();
    }
  }

  function takeSnapshot() {
    if (snapshotTaken) return;
    walk(document.body,
      function (textNode) { originalTextNodes.push({ node: textNode, text: textNode.nodeValue }); },
      function (el, attr, value) { originalAttrs.push({ el: el, attr: attr, value: value }); }
    );
    snapshotTaken = true;
  }

  function applyEnglish(translations) {
    for (var i = 0; i < originalTextNodes.length; i++) {
      var it = originalTextNodes[i];
      var key = it.text.trim();
      var tr = translations[key] || cache[key];
      if (tr) {
        // Preserve leading/trailing whitespace
        var lead = it.text.match(/^\s*/)[0];
        var trail = it.text.match(/\s*$/)[0];
        it.node.nodeValue = lead + tr + trail;
      }
    }
    for (var j = 0; j < originalAttrs.length; j++) {
      var a = originalAttrs[j];
      var k = a.value.trim();
      var t = translations[k] || cache[k];
      if (t) a.el.setAttribute(a.attr, t);
    }
  }

  function restorePortuguese() {
    for (var i = 0; i < originalTextNodes.length; i++) {
      originalTextNodes[i].node.nodeValue = originalTextNodes[i].text;
    }
    for (var j = 0; j < originalAttrs.length; j++) {
      originalAttrs[j].el.setAttribute(originalAttrs[j].attr, originalAttrs[j].value);
    }
  }

  function uniqueStrings() {
    var seen = {};
    var out = [];
    for (var i = 0; i < originalTextNodes.length; i++) {
      var k = originalTextNodes[i].text.trim();
      if (k && !seen[k]) { seen[k] = 1; out.push(k); }
    }
    for (var j = 0; j < originalAttrs.length; j++) {
      var k2 = originalAttrs[j].value.trim();
      if (k2 && !seen[k2]) { seen[k2] = 1; out.push(k2); }
    }
    return out;
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  async function fetchTranslations(missing) {
    var batches = chunk(missing, 40);
    var all = {};
    for (var i = 0; i < batches.length; i++) {
      try {
        var res = await fetch(SUPABASE_URL + '/functions/v1/translate-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + SUPABASE_ANON,
          },
          body: JSON.stringify({ target: 'en', texts: batches[i] }),
        });
        if (!res.ok) continue;
        var data = await res.json();
        var t = (data && data.translations) || {};
        for (var k in t) { all[k] = t[k]; cache[k] = t[k]; }
      } catch (e) { /* ignore */ }
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
    return all;
  }

  async function translateToEnglish() {
    takeSnapshot();
    btn.disabled = true;
    var prevLabel = btn.textContent;
    btn.textContent = '...';
    try {
      var all = uniqueStrings();
      var missing = all.filter(function (s) { return !cache[s]; });
      if (missing.length) await fetchTranslations(missing);
      applyEnglish(cache);
      document.documentElement.lang = 'en';
      btn.textContent = 'PT';
      localStorage.setItem(STATE_KEY, 'en');
    } catch (e) {
      btn.textContent = prevLabel;
    } finally {
      btn.disabled = false;
    }
  }

  function switchToPortuguese() {
    if (snapshotTaken) restorePortuguese();
    document.documentElement.lang = 'pt-BR';
    btn.textContent = 'EN';
    localStorage.setItem(STATE_KEY, 'pt');
  }

  btn.addEventListener('click', function () {
    var cur = localStorage.getItem(STATE_KEY) || 'pt';
    if (cur === 'en') switchToPortuguese();
    else translateToEnglish();
  });

  // Auto-apply if user previously chose EN
  if (localStorage.getItem(STATE_KEY) === 'en') {
    // Defer until after other scripts inject content (hero panel etc.)
    setTimeout(translateToEnglish, 600);
  }
})();