/**
 * Runtime DOM auto-translator.
 *
 * Walks the rendered DOM and replaces Portuguese text/attributes with their
 * English equivalents from the dictionary whenever the active language is "en".
 * Watches for mutations so dynamically-rendered content is also translated.
 *
 * Strategy:
 *  - Each translated text node stores its original Portuguese in a WeakMap so
 *    we can restore it when the user switches back to "pt-br".
 *  - For attributes (placeholder, title, aria-label, alt), we store the
 *    original value in a `data-i18n-orig-<attr>` attribute on the element.
 *  - We skip <script>, <style>, <code>, <pre>, contenteditable and any
 *    element marked with `data-i18n-skip`.
 */

import type { i18n as I18nInstance } from "i18next";
import { dictionary } from "./dictionary";
import { supabase } from "@/integrations/supabase/client";

const ORIG = new WeakMap<Text, string>();
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "alt"];
const dictionaryLower: Record<string, string> = Object.fromEntries(
  Object.entries(dictionary).map(([key, value]) => [key.toLocaleLowerCase("pt-BR"), value]),
);
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "IFRAME",
]);

// ---------- Runtime cache populated by AI translation ----------
const CACHE_KEY = "i18n_runtime_cache_v1";
const aiCache: Record<string, string> = (() => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
})();
function persistCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(aiCache));
  } catch {
    /* quota errors ignored */
  }
}

// Track strings we've already queued/asked for so we don't re-request them.
const requested = new Set<string>();
// Pending strings to translate (debounced batch).
const pendingTranslations = new Set<string>();
// Nodes that referenced pending strings, so we can re-walk after translations arrive.
const pendingNodes = new Set<Node>();
let batchTimer: number | null = null;

// Heuristic: should we ask the AI to translate this string?
// Skip URLs, emails, numbers, very long blobs, code-like content, bare punctuation.
function looksTranslatable(s: string): boolean {
  const t = s.trim();
  if (!t || t.length < 2 || t.length > 240) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(t)) return false;
  if (/^[\d\s.,:/%$€£R$\-+()]+$/.test(t)) return false; // pure numbers/currency
  if (!/[a-zA-ZÀ-ÿ]/.test(t)) return false; // must contain letters
  // Skip pure single-token brand/product names we never want to translate.
  const BRAND_SINGLE = /^(ZapLynx|WhatsApp|Instagram|Telegram|Pix|PIX|Facebook|Meta|Google|Shopify|Stripe|Pagar\.?me|HubPague|Woovi|CartWave|OK|Cloud)$/i;
  if (BRAND_SINGLE.test(t)) return false;
  // Otherwise send to AI — it will return the same string if already English
  // and translate Portuguese strings without accents (e.g. "Painel", "Detalhes").
  return true;
}

async function flushTranslationBatch() {
  batchTimer = null;
  const items = Array.from(pendingTranslations);
  pendingTranslations.clear();
  if (items.length === 0) return;

  // Chunk to keep payload small.
  const chunkSize = 40;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    try {
      const { data, error } = await supabase.functions.invoke("translate-batch", {
        body: { target: "en", texts: chunk },
      });
      if (error) {
        console.warn("[i18n] translate-batch error", error.message);
        continue;
      }
      const translations: Record<string, string> = data?.translations || {};
      let changed = false;
      for (const [src, dst] of Object.entries(translations)) {
        if (dst && dst !== src && !aiCache[src]) {
          aiCache[src] = dst;
          changed = true;
        }
      }
      if (changed) persistCache();
    } catch (e) {
      console.warn("[i18n] translate-batch failed", e);
    }
  }

  // Re-walk any nodes that triggered these requests so new translations apply.
  if (currentlyEnglish) {
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();
    for (const n of nodes) {
      if (n.isConnected) walk(n, true);
    }
    // Also walk the body once to catch any other matching nodes.
    if (document.body) walk(document.body, true);
  }
}

function queueForAi(text: string, hostNode: Node) {
  if (requested.has(text)) return;
  if (!looksTranslatable(text)) return;
  requested.add(text);
  pendingTranslations.add(text);
  pendingNodes.add(hostNode);
  if (batchTimer == null) {
    batchTimer = window.setTimeout(flushTranslationBatch, 600);
  }
}

function lookup(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hit =
    dictionary[trimmed] ??
    aiCache[trimmed] ??
    dictionaryLower[trimmed.toLocaleLowerCase("pt-BR")];
  if (!hit) return null;
  // Preserve surrounding whitespace
  const leading = raw.match(/^\s*/)?.[0] ?? "";
  const trailing = raw.match(/\s*$/)?.[0] ?? "";
  return leading + hit + trailing;
}

function shouldSkip(node: Node): boolean {
  let el: Node | null = node;
  while (el) {
    if (el.nodeType === Node.ELEMENT_NODE) {
      const e = el as HTMLElement;
      if (SKIP_TAGS.has(e.tagName)) return true;
      if (e.hasAttribute("data-i18n-skip")) return true;
      if (e.isContentEditable) return true;
    }
    el = el.parentNode;
  }
  return false;
}

function translateTextNode(node: Text, toEnglish: boolean) {
  if (shouldSkip(node)) return;
  if (toEnglish) {
    const original = ORIG.get(node) ?? node.nodeValue ?? "";
    const translated = lookup(original);
    if (translated && translated !== node.nodeValue) {
      if (!ORIG.has(node)) ORIG.set(node, original);
      node.nodeValue = translated;
    } else if (!translated) {
      // Not in any dictionary — queue for AI translation.
      queueForAi(original.trim(), node);
    }
  } else {
    const original = ORIG.get(node);
    if (original !== undefined && original !== node.nodeValue) {
      node.nodeValue = original;
    }
  }
}

function translateAttributes(el: HTMLElement, toEnglish: boolean) {
  if (SKIP_TAGS.has(el.tagName) || el.hasAttribute("data-i18n-skip")) return;
  for (const attr of TRANSLATABLE_ATTRS) {
    const current = el.getAttribute(attr);
    if (current == null) continue;
    const origKey = `data-i18n-orig-${attr}`;
    if (toEnglish) {
      const original = el.getAttribute(origKey) ?? current;
      const translated = lookup(original);
      if (translated && translated !== current) {
        if (!el.hasAttribute(origKey)) el.setAttribute(origKey, original);
        el.setAttribute(attr, translated);
      } else if (!translated) {
        queueForAi(original.trim(), el);
      }
    } else {
      const original = el.getAttribute(origKey);
      if (original != null && original !== current) {
        el.setAttribute(attr, original);
        el.removeAttribute(origKey);
      }
    }
  }
}

function walk(root: Node, toEnglish: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, toEnglish);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as HTMLElement;
  if (SKIP_TAGS.has(el.tagName)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let cur: Node | null = walker.currentNode;
  while (cur) {
    if (cur.nodeType === Node.TEXT_NODE) {
      translateTextNode(cur as Text, toEnglish);
    } else if (cur.nodeType === Node.ELEMENT_NODE) {
      translateAttributes(cur as HTMLElement, toEnglish);
    }
    cur = walker.nextNode();
  }
  // Also handle root attributes if root is an element
  translateAttributes(el, toEnglish);
}

let observer: MutationObserver | null = null;
let currentlyEnglish = false;
let rafId: number | null = null;
const pending = new Set<Node>();

function flush() {
  rafId = null;
  const nodes = Array.from(pending);
  pending.clear();
  for (const n of nodes) {
    if (n.isConnected) walk(n, currentlyEnglish);
  }
}

function scheduleWalk(node: Node) {
  pending.add(node);
  if (rafId == null) {
    rafId = requestAnimationFrame(flush);
  }
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach((n) => scheduleWalk(n));
      } else if (m.type === "characterData") {
        scheduleWalk(m.target);
      } else if (m.type === "attributes" && m.target.nodeType === Node.ELEMENT_NODE) {
        scheduleWalk(m.target);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRS,
  });
}

function apply(lng: string) {
  const toEnglish = lng?.startsWith("en") ?? false;
  currentlyEnglish = toEnglish;
  if (!document.body) return;
  walk(document.body, toEnglish);
  if (toEnglish) startObserver();
}

export function installAutoTranslator() {
  const run = () => {
    apply(i18n.language);
    i18n.on("languageChanged", apply);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}