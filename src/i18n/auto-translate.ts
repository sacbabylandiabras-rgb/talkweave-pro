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

import i18n from "./index";
import { dictionary } from "./dictionary";

const ORIG = new WeakMap<Text, string>();
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "IFRAME",
]);

function lookup(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hit = dictionary[trimmed];
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