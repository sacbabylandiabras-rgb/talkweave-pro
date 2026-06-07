export const getHttpAvatarUrl = (value?: string | null) => {
  const url = String(value || "").trim();
  if (!url || url === "null" || url === "undefined") return null;
  if (!/^https?:\/\//i.test(url)) return null;
  
  // Se for pps.whatsapp.net, usamos o proxy images.weserv.nl para evitar o erro 403 (Forbidden)
  if (url.includes("pps.whatsapp.net")) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=mm`;
  }
  
  return url;
};

export const sameAvatarUrl = (a?: string | null, b?: string | null) => {
  const left = getHttpAvatarUrl(a);
  const right = getHttpAvatarUrl(b);
  return !!left && !!right && left === right;
};
