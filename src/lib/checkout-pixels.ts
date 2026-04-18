// Front-end pixel injection for public checkout pages.
// Server-side Conversions API (CAPI) is fired separately from payment webhooks.

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    ttq?: any;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export interface PublicPixelConfig {
  platform: string;
  pixel_id: string;
  events?: string[];
  active?: boolean;
  extra_config?: Record<string, any>;
}

const injected = new Set<string>();

function injectMetaPixel(pixelId: string) {
  const key = `meta:${pixelId}`;
  if (injected.has(key)) return;
  injected.add(key);

  // Standard Meta Pixel base code
  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e);
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
}

function injectTikTokPixel(pixelId: string) {
  const key = `tiktok:${pixelId}`;
  if (injected.has(key)) return;
  injected.add(key);

  /* eslint-disable */
  (function (w: any, d: any, t: any) {
    w.TiktokAnalyticsObject = t;
    const ttq: any = (w[t] = w[t] || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function (e: any, n: any) {
      e[n] = function () {
        e.push([n].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (e: any) {
      const n = ttq._i[e] || [];
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(n, ttq.methods[i]);
      return n;
    };
    ttq.load = function (e: any) {
      const n = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = n;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = {};
      const o = d.createElement("script");
      o.type = "text/javascript";
      o.async = true;
      o.src = n + "?sdkid=" + e + "&lib=" + t;
      const a = d.getElementsByTagName("script")[0];
      a.parentNode.insertBefore(o, a);
    };
    ttq.load(pixelId);
    ttq.page();
  })(window, document, "ttq");
  /* eslint-enable */
}

function injectGoogleTag(tagId: string) {
  const key = `google:${tagId}`;
  if (injected.has(key)) return;
  injected.add(key);

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", tagId);
}

export function initCheckoutPixels(pixels: PublicPixelConfig[] | undefined | null) {
  if (typeof window === "undefined" || !pixels?.length) return;

  for (const px of pixels) {
    if (!px.active || !px.pixel_id) continue;
    try {
      if (px.platform === "meta") injectMetaPixel(px.pixel_id);
      else if (px.platform === "tiktok") injectTikTokPixel(px.pixel_id);
      else if (px.platform === "google") injectGoogleTag(px.pixel_id);
    } catch (e) {
      console.error(`[pixels] failed to inject ${px.platform}`, e);
    }
  }
}

export function trackPixelEvent(
  pixels: PublicPixelConfig[] | undefined | null,
  event: "PageView" | "InitiateCheckout" | "AddPaymentInfo" | "Lead" | "Purchase",
  data?: { value?: number; currency?: string },
) {
  if (typeof window === "undefined" || !pixels?.length) return;

  for (const px of pixels) {
    if (!px.active || !px.pixel_id) continue;
    if (px.events && px.events.length && !px.events.includes(event)) continue;

    try {
      if (px.platform === "meta" && window.fbq) {
        window.fbq("track", event, data || {});
      } else if (px.platform === "tiktok" && window.ttq) {
        const ttEventMap: Record<string, string> = {
          PageView: "Pageview",
          InitiateCheckout: "InitiateCheckout",
          AddPaymentInfo: "AddPaymentInfo",
          Lead: "SubmitForm",
          Purchase: "CompletePayment",
        };
        const ttEvent = ttEventMap[event] || event;
        window.ttq.track(ttEvent, {
          value: data?.value,
          currency: data?.currency || "BRL",
        });
      } else if (px.platform === "google" && window.gtag) {
        window.gtag("event", event === "Purchase" ? "purchase" : event.toLowerCase(), {
          value: data?.value,
          currency: data?.currency || "BRL",
        });
      }
    } catch (e) {
      console.error(`[pixels] failed to track ${event} on ${px.platform}`, e);
    }
  }
}
