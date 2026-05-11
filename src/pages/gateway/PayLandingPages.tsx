import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, Upload, Trash2, ExternalLink, Loader2, FileCode, Link2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LandingFile {
  path: string;
  name: string;
  size: number;
  url: string;
}

interface LandingPage {
  id: string;
  name: string;
  slug?: string | null;
  description: string | null;
  files: LandingFile[];
  entry_file: string | null;
  status: boolean;
  created_at: string;
  checkout_id?: string | null;
}

interface CheckoutOption {
  id: string;
  name: string;
  slug: string | null;
}

const ACCEPTED = ".html,.htm,.css,.js,.png,.jpg,.jpeg,.webp,.svg,.gif,.ico,.woff,.woff2,.ttf,.json,.txt";
const PLATFORM_CHECKOUT_DOMAIN = "zaplynx.com";

const buildLandingUrl = (domain: string, pageId: string, fileName?: string | null) => {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "") || PLATFORM_CHECKOUT_DOMAIN;
  const base = `https://${cleanDomain}/lp/${pageId}`;
  if (!fileName) return base;
  const encodedPath = fileName.split("/").map(encodeURIComponent).join("/");
  return `${base}/${encodedPath}`;
};

export default function PayLandingPages() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkoutDomain, setCheckoutDomain] = useState(PLATFORM_CHECKOUT_DOMAIN);
  const [checkoutOptions, setCheckoutOptions] = useState<CheckoutOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUserId = session?.user?.id || null;
      setUserId(currentUserId);
      loadCheckoutDomain(currentUserId);
    });
    load();
    loadCheckouts();
  }, []);

  const loadCheckouts = async () => {
    const { data } = await (supabase as any)
      .from("gateway_checkouts")
      .select("id, name, slug")
      .eq("status", true)
      .order("created_at", { ascending: false });
    setCheckoutOptions((data as CheckoutOption[]) || []);
  };

  const loadCheckoutDomain = async (currentUserId: string | null) => {
    const storedDomain = localStorage.getItem("checkout_custom_domain") || "";
    if (!currentUserId) {
      setCheckoutDomain(storedDomain || PLATFORM_CHECKOUT_DOMAIN);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("custom_domain")
        .eq("id", currentUserId)
        .maybeSingle();
      const resolvedDomain = (profile as { custom_domain?: string | null } | null)?.custom_domain || storedDomain;
      if (resolvedDomain) localStorage.setItem("checkout_custom_domain", resolvedDomain);
      setCheckoutDomain(resolvedDomain || PLATFORM_CHECKOUT_DOMAIN);
    } catch {
      setCheckoutDomain(storedDomain || PLATFORM_CHECKOUT_DOMAIN);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("gateway_landing_pages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar suas landing pages");
    } else {
      setPages((data as LandingPage[]) || []);
    }
    setLoading(false);
  };

  const handleFilesPicked = (list: FileList | null) => {
    if (!list) return;
    setSelectedFiles(Array.from(list));
  };

  const upload = async () => {
    if (!userId) return toast.error("Sessão não encontrada");
    if (!name.trim()) return toast.error("Dê um nome para a landing page");
    if (selectedFiles.length === 0) return toast.error("Selecione ao menos 1 arquivo");

    const mimeByExt = (filename: string): string => {
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const map: Record<string, string> = {
        html: "text/html; charset=utf-8",
        htm: "text/html; charset=utf-8",
        css: "text/css; charset=utf-8",
        js: "application/javascript; charset=utf-8",
        mjs: "application/javascript; charset=utf-8",
        json: "application/json; charset=utf-8",
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        ico: "image/x-icon",
        avif: "image/avif",
        mp4: "video/mp4",
        webm: "video/webm",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        otf: "font/otf",
        eot: "application/vnd.ms-fontobject",
        txt: "text/plain; charset=utf-8",
        xml: "application/xml; charset=utf-8",
        pdf: "application/pdf",
        map: "application/json; charset=utf-8",
      };
      return map[ext] || "application/octet-stream";
    };

    setUploading(true);
    try {
      const folderId = crypto.randomUUID();
      const uploaded: LandingFile[] = [];

      for (const file of selectedFiles) {
        const relPath = (file as any).webkitRelativePath || file.name;
        const cleanRel = relPath.replace(/^\/+/, "");
        const storagePath = `${userId}/${folderId}/${cleanRel}`;
        const contentType = mimeByExt(cleanRel) || file.type || "application/octet-stream";
        const blob = new Blob([file], { type: contentType });
        const { error: upErr } = await supabase.storage
          .from("landing-pages")
          .upload(storagePath, blob, { cacheControl: "3600", upsert: true, contentType });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from("landing-pages").getPublicUrl(storagePath);
        uploaded.push({ path: storagePath, name: cleanRel, size: file.size, url: pub.publicUrl });
      }

      const entry =
        uploaded.find((f) => /(^|\/)index\.html?$/i.test(f.name))?.name ||
        uploaded.find((f) => /\.html?$/i.test(f.name))?.name ||
        null;

      const { error: insErr } = await (supabase as any)
        .from("gateway_landing_pages")
        .insert({
          user_id: userId,
          name: name.trim(),
          description: description.trim() || null,
          files: uploaded,
          entry_file: entry,
        });
      if (insErr) throw new Error(insErr.message);

      toast.success("Landing page enviada com sucesso");
      setName("");
      setDescription("");
      setSelectedFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const removePage = async (page: LandingPage) => {
    if (!confirm(`Remover "${page.name}"?`)) return;
    try {
      const paths = (page.files || []).map((f) => f.path);
      if (paths.length) await supabase.storage.from("landing-pages").remove(paths);
      const { error } = await (supabase as any).from("gateway_landing_pages").delete().eq("id", page.id);
      if (error) throw error;
      toast.success("Landing page removida");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    }
  };

  const updateCheckoutLink = async (pageId: string, checkoutId: string | null) => {
    const payload = { checkout_id: checkoutId, slug: checkoutId };
    const { error } = await (supabase as any)
      .from("gateway_landing_pages")
      .update(payload)
      .eq("id", pageId);
    if (error) {
      const isMissingCheckoutColumn = String(error.message || "").includes("checkout_id");
      if (!isMissingCheckoutColumn) {
        toast.error("Não foi possível vincular o checkout");
        return;
      }
      const { error: fallbackError } = await (supabase as any)
        .from("gateway_landing_pages")
        .update({ slug: checkoutId })
        .eq("id", pageId);
      if (fallbackError) {
        toast.error("Não foi possível vincular o checkout");
        return;
      }
    }
    toast.success(checkoutId ? "Checkout vinculado" : "Vínculo removido");
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, checkout_id: checkoutId, slug: checkoutId } : p)));
  };

  const entryUrl = (page: LandingPage) => {
    const entry = page.entry_file || page.files[0]?.name;
    return entry ? buildLandingUrl(checkoutDomain, page.id, entry) : null;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutTemplate className="w-6 h-6 text-primary" />
          Landing Pages
        </h1>
        <p className="text-sm text-muted-foreground">
          Faça upload dos arquivos da sua landing page (HTML, CSS, JS, imagens).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova landing page</CardTitle>
          <CardDescription>
            Selecione um <strong>index.html</strong> e seus arquivos vinculados. Você pode enviar uma pasta inteira.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lp-name">Nome</Label>
              <Input id="lp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promo Black Friday" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-desc">Descrição (opcional)</Label>
              <Input id="lp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Curta descrição" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Arquivos</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" /> Selecionar arquivos
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const el = document.getElementById("lp-folder") as HTMLInputElement | null;
                  el?.click();
                }}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" /> Enviar pasta
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => handleFilesPicked(e.target.files)}
              />
              <input
                id="lp-folder"
                type="file"
                multiple
                // @ts-ignore
                webkitdirectory=""
                // @ts-ignore
                directory=""
                className="hidden"
                onChange={(e) => handleFilesPicked(e.target.files)}
              />
            </div>
            {selectedFiles.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 max-h-44 overflow-auto text-xs space-y-1">
                {selectedFiles.map((f) => (
                  <div key={f.name + f.size} className="flex items-center justify-between">
                    <span className="truncate">{(f as any).webkitRelativePath || f.name}</span>
                    <span className="text-muted-foreground ml-2">{Math.ceil(f.size / 1024)} KB</span>
                  </div>
                ))}
                <p className="text-muted-foreground pt-1">{selectedFiles.length} arquivo(s) prontos para envio</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={upload} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar landing page
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suas landing pages</CardTitle>
          <CardDescription>
            Gerencie e acesse os links públicos. Ao vincular um checkout, os botões da landing page que apontam para
            plataformas externas de pagamento (Hotmart, Kiwify, Eduzz, Monetizze, Braip, Cakto, Yampi,
            Ticto, Hubla, Lastlink, Kirvano, Stripe, entre outras) são <strong>substituídos automaticamente</strong> pelo
            seu checkout. Também funciona com <code className="text-xs">href="#checkout"</code>,{" "}
            <code className="text-xs">data-checkout-link</code> e o placeholder{" "}
            <code className="text-xs">{"{{checkout_url}}"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <LayoutTemplate className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-foreground font-medium">Nenhuma landing page criada</p>
              <p className="text-muted-foreground text-sm">Envie seus arquivos acima para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pages.map((p) => {
                const url = entryUrl(p);
                return (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">{p.name}</p>
                        <Badge variant="secondary" className="text-xs">{p.files.length} arquivos</Badge>
                        {p.entry_file && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileCode className="w-3 h-3" /> {p.entry_file}
                          </Badge>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      )}
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline break-all"
                        >
                          {url}
                        </a>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Checkout vinculado:</span>
                        <Select
                          value={p.checkout_id || p.slug || "none"}
                          onValueChange={(v) => updateCheckoutLink(p.id, v === "none" ? null : v)}
                        >
                          <SelectTrigger className="h-8 w-[260px] text-xs">
                            <SelectValue placeholder="Selecione um checkout" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem vínculo</SelectItem>
                            {checkoutOptions.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-1" /> Abrir
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removePage(p)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
