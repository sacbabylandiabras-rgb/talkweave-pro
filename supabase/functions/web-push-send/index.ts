import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert raw P-256 private key (32 bytes) into PKCS8 for importKey
function rawPrivKeyToPkcs8(rawPriv: Uint8Array, rawPubUncompressed: Uint8Array): Uint8Array {
  // Build EC PrivateKey ASN.1 (SEC1) wrapped in PKCS8 — pre-built template, splice in keys.
  // Template (PKCS8 for EC P-256 with 32-byte priv + 65-byte pub):
  // 30 81 87 02 01 00 30 13 06 07 2A 86 48 CE 3D 02 01 06 08 2A 86 48 CE 3D 03 01 07 04 6D 30 6B 02 01 01 04 20 <priv32> A1 44 03 42 00 <pub65>
  const head = Uint8Array.from([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01,
    0x04, 0x20,
  ]);
  const mid = Uint8Array.from([0xa1, 0x44, 0x03, 0x42, 0x00]);
  const out = new Uint8Array(head.length + 32 + mid.length + 65);
  out.set(head, 0);
  out.set(rawPriv, head.length);
  out.set(mid, head.length + 32);
  out.set(rawPubUncompressed, head.length + 32 + mid.length);
  return out;
}

async function importVapidKey(privB64u: string, pubB64u: string) {
  const priv = b64urlDecode(privB64u);
  const pub = b64urlDecode(pubB64u);
  const pkcs8 = rawPrivKeyToPkcs8(priv, pub);
  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function buildVapidJwt(audience: string, subject: string, privB64u: string, pubB64u: string) {
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));
  const signingInput = `${header}.${payload}`;
  const key = await importVapidKey(privB64u, pubB64u);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// HKDF
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

// Encrypt payload using aes128gcm content encoding (RFC 8188 + RFC 8291)
async function encryptPayload(payload: string, p256dhB64u: string, authB64u: string) {
  const clientPub = b64urlDecode(p256dhB64u); // 65 bytes uncompressed
  const authSecret = b64urlDecode(authB64u);

  // Generate ephemeral ECDH keypair
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ephemeralPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey)); // 65 bytes

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw", clientPub, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, ephemeral.privateKey, 256);
  const shared = new Uint8Array(sharedBits);

  // PRK_key = HKDF(authSecret, shared, "WebPush: info\0" || clientPub || ephemeralPub, 32)
  const keyInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    clientPub,
    ephemeralPubRaw,
  );
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  // Random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  // NONCE = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  // Plaintext + 0x02 padding delimiter
  const plaintext = concat(new TextEncoder().encode(payload), Uint8Array.from([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

  // aes128gcm header: salt(16) | rs(4 BE = 4096) | idlen(1 = 65) | keyid(65 = ephemeralPub)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // rs = 4096
  header[16] = 0; header[17] = 0; header[18] = 0x10; header[19] = 0;
  header[20] = 65;
  header.set(ephemeralPubRaw, 21);

  return concat(header, ciphertext);
}

async function sendOne(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, vapidPub: string, vapidPriv: string, vapidSub: string) {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience, vapidSub, vapidPriv, vapidPub);
  const body = await encryptPayload(payload, sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "60",
      "Authorization": `vapid t=${jwt}, k=${vapidPub}`,
    },
    body,
  });
  return { status: res.status, text: res.status >= 400 ? await res.text() : "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!VAPID_PUBLIC_KEY) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id || null;
    }

    const payload = await req.json().catch(() => ({}));
    if (payload?.action === "public-key") {
      return new Response(JSON.stringify({ publicKey: VAPID_PUBLIC_KEY }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, title, body, url, tag } = payload;
    const targetUser = user_id || userId;
    if (!targetUser || !title || !body) {
      return new Response(JSON.stringify({ error: "user_id, title, body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await supabase
      .from("web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", targetUser);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messagePayload = JSON.stringify({ title, body, url: url || "/", tag: tag || "zaplynx" });
    const results: any[] = [];
    for (const s of subs) {
      try {
        const r = await sendOne(s, messagePayload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT);
        results.push({ id: s.id, status: r.status, error: r.text || undefined });
        if (r.status === 404 || r.status === 410) {
          await supabase.from("web_push_subscriptions").delete().eq("id", s.id);
        }
      } catch (e) {
        results.push({ id: s.id, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: results.filter(r => r.status && r.status < 300).length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
