import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link as LinkIcon,
  Plus,
  Shuffle,
  Pencil,
  Globe,
  Bot,
  Hash,
  X,
  Copy,
  Trash2,
  Check,
  ExternalLink,
  AlertTriangle,
  FileText,
  ArrowRight,
  Shield,
  Share2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TabId = "links" | "vendas" | "utm" | "dominio" | "redirect";

interface TgRedirectLink {
  id: string;
  name: string;
  slug: string;
  slug_type: string;
  mode: string;
  active: boolean;
  cloaker: boolean;
  cloaker_v2: boolean;
  cloaker_block_method?: string;
  cloaker_redirect_url?: string;
  cloaker_block_ads?: boolean;
  cloaker_anti_share?: boolean;
  domain: string;
  destination_type: string;
  destination_bot_id: string | null;
  destination_channel: string | null;
  flow_ids: string[];
  click_count: number;
  created_at: string;
}

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "links", label: "Links", icon: LinkIcon },
  { id: "vendas", label: "Códigos de Vendas", icon: Hash },
  { id: "utm", label: "Gerador UTM", icon: Shuffle },
  { id: "dominio", label: "Domínio Próprio", icon: Globe },
  { id: "redirect", label: "Página de Redirect", icon: ExternalLink },
];

function randomSlug(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function TelegramRedirecionadores() {
  const [tab, setTab] = useState<TabId>("links");
  const [links, setLinks] = useState<TgRedirectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TgRedirectLink | null>(null);
  const [vendasDialogOpen, setVendasDialogOpen] = useState(false);

  const fetchLinks = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("telegram_redirect_links")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar redirecionadores");
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Redirecionadores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure seus links de redirecionamento
          </p>
        </div>
        <Button
          onClick={() => (tab === "vendas" ? setVendasDialogOpen(true) : setDialogOpen(true))}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {tab === "vendas" ? "Criar Codigo" : "Criar Link"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "links" && (
        <LinksTab
          loading={loading}
          links={links}
          onCreate={() => setDialogOpen(true)}
          onChanged={fetchLinks}
          onEdit={(l) => {
            setEditing(l);
            setDialogOpen(true);
          }}
        />
      )}
      {tab === "vendas" && (
        <VendasTab
          links={links}
          onCreate={() => setVendasDialogOpen(true)}
          dialogOpen={vendasDialogOpen}
          setDialogOpen={setVendasDialogOpen}
        />
      )}
      {tab === "utm" && <UtmTab links={links} />}
      {tab === "dominio" && <DominioTab />}
      {tab !== "links" && tab !== "vendas" && tab !== "utm" && tab !== "dominio" && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
            <LinkIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </div>
      )}

      <CreateRedirectDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        onCreated={fetchLinks}
        editing={editing}
      />
    </div>
  );
}

function LinksTab({
  loading,
  links,
  onCreate,
  onChanged,
  onEdit,
}: {
  loading: boolean;
  links: TgRedirectLink[];
  onCreate: () => void;
  onChanged: () => void;
  onEdit: (l: TgRedirectLink) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-24 text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!links.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
          <LinkIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground">
          Nenhum redirecionador criado
        </p>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          Crie seu primeiro link para começar a rastrear cliques
        </p>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar Primeiro Link
        </Button>
      </div>
    );
  }

  const baseDomain = "zaplynx.com";

  return (
    <div className="space-y-3">
      {links.map((l) => {
        const url = `https://${baseDomain}/r/${l.slug}`;
        return (
          <div
            key={l.id}
            className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">
                  /{l.slug}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    l.active
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {l.active ? "Ativo" : "Inativo"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  {l.mode === "sequential" ? "Sequencial" : "Aleatório"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {url}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {l.click_count} {l.click_count === 1 ? "clique" : "cliques"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(l)}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Switch
                checked={l.active}
                onCheckedChange={async (v) => {
                  await (supabase as any)
                    .from("telegram_redirect_links")
                    .update({ active: v })
                    .eq("id", l.id);
                  onChanged();
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!confirm("Excluir este redirecionador?")) return;
                  await (supabase as any)
                    .from("telegram_redirect_links")
                    .delete()
                    .eq("id", l.id);
                  toast.success("Removido");
                  onChanged();
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateRedirectDialog({
  open,
  onOpenChange,
  onCreated,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  editing?: TgRedirectLink | null;
}) {
  const [slugType, setSlugType] = useState<"random" | "custom">("random");
  const [slug, setSlug] = useState(randomSlug());
  const [mode, setMode] = useState<"random" | "sequential">("random");
  const [active, setActive] = useState(true);
  const [cloaker, setCloaker] = useState(false);
  const [cloakerV2, setCloakerV2] = useState(false);
  const [confirmCloaker, setConfirmCloaker] = useState<null | "cloaker" | "cloakerV2">(null);
  const [blockMethod, setBlockMethod] = useState<"page" | "redirect">("page");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [blockAds, setBlockAds] = useState(true);
  const [antiShare, setAntiShare] = useState(false);
  const [destinationType, setDestinationType] = useState<"bot" | "channel">("bot");
  const [bots, setBots] = useState<{ id: string; first_name: string | null; username: string | null }[]>([]);
  const [destinationBotId, setDestinationBotId] = useState<string>("");
  const [destinationChannel, setDestinationChannel] = useState("");
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [selectedFlows, setSelectedFlows] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const domain = "zaplynx.com";

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: botsData } = await (supabase as any)
        .from("telegram_bots")
        .select("id, first_name, username")
        .eq("active", true);
      setBots(botsData || []);
      if (!editing && botsData?.[0]?.id) setDestinationBotId(botsData[0].id);

      const { data: flowsData } = await (supabase as any)
        .from("flow_automations")
        .select("id, name")
        .eq("category", "telegram")
        .order("created_at", { ascending: false });
      setFlows(flowsData || []);
    })();
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setSlugType((editing.slug_type as any) || "random");
      setSlug(editing.slug);
      setMode((editing.mode as any) || "random");
      setActive(editing.active);
      setCloaker(editing.cloaker);
      setCloakerV2(editing.cloaker_v2);
      setBlockMethod(((editing as any).cloaker_block_method as any) || "page");
      setRedirectUrl((editing as any).cloaker_redirect_url || "");
      setBlockAds((editing as any).cloaker_block_ads ?? true);
      setAntiShare((editing as any).cloaker_anti_share ?? false);
      setDestinationType((editing.destination_type as any) || "bot");
      setDestinationBotId(editing.destination_bot_id || "");
      setDestinationChannel(editing.destination_channel || "");
      setSelectedFlows(editing.flow_ids || []);
    } else {
      setSlugType("random");
      setSlug(randomSlug());
      setMode("random");
      setActive(true);
      setCloaker(false);
      setCloakerV2(false);
      setBlockMethod("page");
      setRedirectUrl("");
      setBlockAds(true);
      setAntiShare(false);
      setDestinationType("bot");
      setDestinationChannel("");
      setSelectedFlows([]);
    }
  }, [open, editing]);

  const resetAndClose = () => {
    setSlugType("random");
    setSlug(randomSlug());
    setMode("random");
    setActive(true);
    setCloaker(false);
    setCloakerV2(false);
    setBlockMethod("page");
    setRedirectUrl("");
    setBlockAds(true);
    setAntiShare(false);
    setDestinationType("bot");
    setDestinationChannel("");
    setSelectedFlows([]);
    onOpenChange(false);
  };

  const availableFlows = useMemo(
    () => flows.filter((f) => !selectedFlows.includes(f.id)),
    [flows, selectedFlows],
  );

  const save = async () => {
    if (!slug.trim()) {
      toast.error("Informe o slug");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Não autenticado");
      setSaving(false);
      return;
    }
    const payload: any = {
      slug: slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, ""),
      slug_type: slugType,
      mode,
      active,
      cloaker,
      cloaker_v2: cloakerV2,
      cloaker_block_method: blockMethod,
      cloaker_redirect_url: blockMethod === "redirect" ? redirectUrl.trim() : "",
      cloaker_block_ads: blockAds,
      cloaker_anti_share: antiShare,
      destination_type: destinationType,
      destination_bot_id: destinationType === "bot" ? destinationBotId || null : null,
      destination_channel:
        destinationType === "channel" ? destinationChannel || null : null,
      flow_ids: selectedFlows,
    };
    const { error } = editing
      ? await (supabase as any)
          .from("telegram_redirect_links")
          .update(payload)
          .eq("id", editing.id)
      : await (supabase as any)
          .from("telegram_redirect_links")
          .insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error(error.message?.includes("unique") ? "Slug já em uso" : "Erro ao salvar");
      return;
    }
    toast.success(editing ? "Redirecionador atualizado" : "Redirecionador criado");
    resetAndClose();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              {editing ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <Plus className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <DialogTitle>
                {editing ? "Editar Redirecionador" : "Criar Redirecionador"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure seu link de redirecionamento
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
          {/* Tipo de slug */}
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">
              Tipo de Slug
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setSlugType("random");
                  setSlug(randomSlug());
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition ${
                  slugType === "random"
                    ? "border-foreground bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                Aleatório
              </button>
              <button
                type="button"
                onClick={() => setSlugType("custom")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition ${
                  slugType === "custom"
                    ? "border-foreground bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pencil className="h-3.5 w-3.5" />
                Personalizado
              </button>
            </div>
          </div>

          {/* Slug + Modo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">
                Slug
              </Label>
              <div className="relative mt-1.5">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  readOnly={slugType === "random"}
                  className="pr-9"
                />
                {slugType === "random" && (
                  <button
                    type="button"
                    onClick={() => setSlug(randomSlug())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Gerar"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">
                Modo
              </Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Aleatório</SelectItem>
                  <SelectItem value="sequential">Sequencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={active} onCheckedChange={setActive} />
              <span className="text-sm">Ativo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={cloaker}
                onCheckedChange={(v) => {
                  if (v) setConfirmCloaker("cloaker");
                  else setCloaker(false);
                }}
              />
              <span className="text-sm">Cloaker</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={cloakerV2}
                onCheckedChange={(v) => {
                  if (v) setConfirmCloaker("cloakerV2");
                  else setCloakerV2(false);
                }}
              />
              <span className="text-sm">Cloaker V2</span>
            </label>
          </div>

          {confirmCloaker && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">
                  Ativar {confirmCloaker === "cloakerV2" ? "Cloaker V2 + AntiClone" : "Cloaker"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                O cloaker requer configuração adicional. Leia antes de ativar:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>
                  O parâmetro <span className="font-mono font-semibold text-amber-500">shk</span>{" "}
                  deve estar em todos os links de tráfego pago.
                </li>
                <li>
                  Sem o parâmetro, o cloaker vai{" "}
                  <span className="font-semibold text-foreground">bloquear o acesso</span> dos visitantes.
                </li>
              </ul>
              <p className="text-xs text-primary">
                Use a aba "Gerador UTM" para criar links com o parâmetro correto.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (confirmCloaker === "cloakerV2") setCloakerV2(true);
                    else setCloaker(true);
                    setConfirmCloaker(null);
                  }}
                  className="gap-2 bg-amber-600 hover:bg-amber-600/90 text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  Sim, ativar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmCloaker(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {(cloaker || cloakerV2) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs text-primary">
                  <span className="font-semibold">Cloaker ativo:</span>{" "}
                  {cloakerV2
                    ? "Sistema avançado de detecção com scoring de bots e crawlers."
                    : "Bloqueia acessos sem o parâmetro shk."}
                </span>
              </div>

              <div>
                <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">
                  Método de Bloqueio
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setBlockMethod("page")}
                    className={`text-left rounded-lg border p-3 transition ${
                      blockMethod === "page"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`h-3.5 w-3.5 rounded-full border-2 ${
                          blockMethod === "page"
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      />
                      <FileText className="h-3.5 w-3.5 text-foreground" />
                      <span className="text-sm font-semibold">Página Segura</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Exibe página inline</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockMethod("redirect")}
                    className={`text-left rounded-lg border p-3 transition ${
                      blockMethod === "redirect"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`h-3.5 w-3.5 rounded-full border-2 ${
                          blockMethod === "redirect"
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      />
                      <ArrowRight className="h-3.5 w-3.5 text-foreground" />
                      <span className="text-sm font-semibold">Redirect</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Redireciona para URL</p>
                  </button>
                </div>

                {blockMethod === "page" ? (
                  <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                    <p className="text-[11px] text-emerald-500">
                      Visitantes bloqueados verão uma página de segurança. Nenhuma URL externa necessária.
                    </p>
                  </div>
                ) : (
                  <Input
                    className="mt-2"
                    placeholder="https://exemplo.com/pagina-segura"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                  />
                )}
              </div>

              <div className="rounded-lg border border-border p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-rose-500/15 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Bloquear Bots de Ads</div>
                  <p className="text-[11px] text-muted-foreground">
                    Crawlers do Facebook, Google e TikTok serão bloqueados
                  </p>
                </div>
                <Switch checked={blockAds} onCheckedChange={setBlockAds} />
              </div>

              <div className="rounded-lg border border-border p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Anti-Compartilhamento</div>
                  <p className="text-[11px] text-muted-foreground">
                    {antiShare
                      ? "Cada link só pode ser acessado uma vez"
                      : "Qualquer pessoa com o link pode acessar"}
                  </p>
                </div>
                <Switch checked={antiShare} onCheckedChange={setAntiShare} />
              </div>
            </div>
          )}

          {/* Domain display */}
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium flex-1 truncate">
              {domain}
            </span>
            <span className="text-[11px] text-muted-foreground">Alterar</span>
          </div>

          {/* Destino */}
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">
              Destino
            </Label>
            <Select
              value={destinationType}
              onValueChange={(v: any) => setDestinationType(v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bot">
                  <span className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5" />
                    Telegram (Bot)
                  </span>
                </SelectItem>
                <SelectItem value="channel">
                  <span className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5" />
                    Canal / Grupo
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {destinationType === "bot"
                ? "Redireciona para o bot do Telegram"
                : "Redireciona para um canal ou grupo"}
            </p>
          </div>

          {destinationType === "bot" && bots.length > 0 && (
            <Select value={destinationBotId} onValueChange={setDestinationBotId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar bot" />
              </SelectTrigger>
              <SelectContent>
                {bots.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.first_name || b.username || b.id.slice(0, 6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {destinationType === "channel" && (
            <Input
              placeholder="@meucanal ou link de convite"
              value={destinationChannel}
              onChange={(e) => setDestinationChannel(e.target.value)}
            />
          )}

          {/* Fluxos */}
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">
              Fluxos
            </Label>
            <div className="mt-1.5 rounded-lg border border-border bg-muted/30 min-h-[56px] p-2 flex flex-wrap gap-1.5">
              {selectedFlows.length === 0 && (
                <span className="text-xs text-muted-foreground p-2">
                  Nenhum fluxo selecionado
                </span>
              )}
              {selectedFlows.map((fid) => {
                const f = flows.find((x) => x.id === fid);
                return (
                  <span
                    key={fid}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 text-primary text-xs px-2 py-1"
                  >
                    {f?.name || fid.slice(0, 6)}
                    <button
                      onClick={() =>
                        setSelectedFlows((arr) => arr.filter((x) => x !== fid))
                      }
                      className="hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <Select
              value=""
              onValueChange={(v) => {
                if (v) setSelectedFlows((arr) => [...arr, v]);
              }}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Adicionar fluxo..." />
              </SelectTrigger>
              <SelectContent>
                {availableFlows.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum fluxo disponível
                  </div>
                )}
                {availableFlows.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 border-t border-border bg-background">
          <Button onClick={save} disabled={saving} className="gap-2">
            <Check className="h-4 w-4" />
            {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </Button>
          <Button variant="outline" onClick={resetAndClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ UTM Generator Tab ============

interface UtmFields {
  source: string;
  campaign: string;
  medium: string;
  content: string;
  term: string;
  id: string;
}

const UTM_MODELS: Record<string, { label: string; values: UtmFields }> = {
  personalizado: {
    label: "Personalizado",
    values: { source: "", campaign: "", medium: "", content: "", term: "", id: "" },
  },
  meta: {
    label: "UTMs Meta Ads",
    values: {
      source: "FB",
      campaign: "{{campaign.name}}|{{campaign.id}}",
      medium: "{{adset.name}}|{{adset.id}}",
      content: "{{ad.name}}|{{ad.id}}",
      term: "{{placement}}",
      id: "{{campaign.id}}",
    },
  },
  google: {
    label: "UTMs Google Ads",
    values: {
      source: "google",
      campaign: "{campaignid}",
      medium: "cpc",
      content: "{creative}",
      term: "{keyword}",
      id: "{campaignid}",
    },
  },
  tiktok: {
    label: "UTMs TikTok Ads",
    values: {
      source: "tiktok",
      campaign: "__CAMPAIGN_NAME__|__CAMPAIGN_ID__",
      medium: "__AID_NAME__|__AID__",
      content: "__CID_NAME__|__CID__",
      term: "__PLACEMENT__",
      id: "__CAMPAIGN_ID__",
    },
  },
};

function CopyField({ value, variant = "default" }: { value: string; variant?: "default" | "info" | "success" | "warn" }) {
  const styles =
    variant === "info"
      ? "border-primary/30 bg-primary/5"
      : variant === "success"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : variant === "warn"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-border bg-muted/30";
  return (
    <div className={`rounded-lg border ${styles} p-3 flex items-center gap-2`}>
      <code className="flex-1 text-[11px] text-foreground break-all font-mono leading-relaxed">
        {value}
      </code>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copiado");
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function UtmTab({ links }: { links: TgRedirectLink[] }) {
  const baseDomain = "zaplynx.com";
  const [linkId, setLinkId] = useState<string>("");
  const [model, setModel] = useState<string>("meta");
  const [fields, setFields] = useState<UtmFields>(UTM_MODELS.meta.values);
  const [cv, setCv] = useState("");
  const [shk, setShk] = useState("");
  const [salesCodes, setSalesCodes] = useState<Array<{ code: string; name: string; link_id: string }>>([]);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    setGenerated(false);
  }, [linkId, model, fields, cv, shk]);

  useEffect(() => {
    if (!linkId && links.length) setLinkId(links[0].id);
  }, [links, linkId]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("telegram_sales_codes")
        .select("code,name,link_id");
      setSalesCodes(data || []);
    })();
  }, []);

  const handleModel = (v: string) => {
    setModel(v);
    const preset = UTM_MODELS[v];
    if (preset) setFields(preset.values);
  };

  const selectedLink = links.find((l) => l.id === linkId);
  const linkSalesCodes = salesCodes.filter((c) => c.link_id === linkId);

  const baseUrl = selectedLink
    ? `https://${baseDomain}/r/${selectedLink.slug}`
    : `https://${baseDomain}/r/...`;

  const paramsString = useMemo(() => {
    const parts: string[] = [];
    if (fields.source) parts.push(`utm_source=${fields.source}`);
    if (fields.campaign) parts.push(`utm_campaign=${fields.campaign}`);
    if (fields.medium) parts.push(`utm_medium=${fields.medium}`);
    if (fields.content) parts.push(`utm_content=${fields.content}`);
    if (fields.term) parts.push(`utm_term=${fields.term}`);
    if (fields.id) parts.push(`utm_id=${fields.id}`);
    return parts.join("&");
  }, [fields]);

  const extraParams = useMemo(() => {
    const parts: string[] = [];
    if (cv.trim()) parts.push(`cv=${encodeURIComponent(cv.trim())}`);
    if (shk.trim()) parts.push(`shk=${encodeURIComponent(shk.trim())}`);
    return parts.join("&");
  }, [cv, shk]);

  const managerUrl = useMemo(() => {
    return extraParams ? `${baseUrl}?${extraParams}` : baseUrl;
  }, [baseUrl, extraParams]);

  const fullUrl = useMemo(() => {
    const all = [paramsString, extraParams].filter(Boolean).join("&");
    return all ? `${baseUrl}?${all}` : baseUrl;
  }, [baseUrl, paramsString, extraParams]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-start gap-3 border-l-4 border-primary pl-3">
        <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
          <Shuffle className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gerador de Links UTM</h2>
          <p className="text-sm text-muted-foreground">
            Monte links com parâmetros UTM para rastrear campanhas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Link Base</Label>
          <Select value={linkId} onValueChange={setLinkId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um link" />
            </SelectTrigger>
            <SelectContent>
              {links.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum link criado
                </div>
              )}
              {links.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  /{l.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Globe className="h-3 w-3" /> Domínio
          </Label>
          <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/30 text-sm">
            {baseDomain}
            <Check className="h-3.5 w-3.5 ml-auto text-emerald-500" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Modelo UTM</Label>
          <Select value={model} onValueChange={handleModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(UTM_MODELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
        <Hash className="h-3.5 w-3.5" />
        {linkSalesCodes.length === 0
          ? "Nenhum código de vendas vinculado a este link"
          : `${linkSalesCodes.length} código(s) de vendas vinculado(s) a este link`}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "source", label: "UTM SOURCE" },
          { key: "campaign", label: "UTM CAMPAIGN" },
          { key: "medium", label: "UTM MEDIUM" },
          { key: "content", label: "UTM CONTENT" },
          { key: "term", label: "UTM TERM" },
          { key: "id", label: "UTM ID" },
        ].map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {f.label}
            </Label>
            <Input
              value={(fields as any)[f.key]}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              maxLength={200}
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Código de Vendas (opcional)
          </Label>
          <Input
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            placeholder="Ex: 123"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Shark ID (Cloaker)
          </Label>
          <Input
            value={shk}
            onChange={(e) => setShk(e.target.value)}
            placeholder="Ex: bb8ste2u"
          />
        </div>
      </div>

      <Button
        className="w-full"
        variant="secondary"
        onClick={() => {
          if (!selectedLink) {
            toast.error("Selecione um link base");
            return;
          }
          setGenerated(true);
          toast.success("Link gerado!");
        }}
      >
        Gerar Link
      </Button>

      {generated && (
      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Globe className="h-3.5 w-3.5" />
            USE ESTA URL NO SITE NO GERENCIADOR DE ANÚNCIOS
          </div>
          <CopyField value={managerUrl} variant="info" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
            <Check className="h-3.5 w-3.5" />
            USE ESTES NOS PARÂMETROS DA URL, NO FACEBOOK
          </div>
          <CopyField value={paramsString} variant="success" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            LINK COMPLETO – APENAS PARA DEBUG
          </div>
          <p className="text-[11px] text-muted-foreground">
            Não cole no gerenciador de anúncios. Use a URL acima.
          </p>
          <CopyField value={fullUrl} variant="warn" />
        </div>
      </div>
      )}
    </div>
  );
}

interface SalesCode {
  id: string;
  name: string;
  code: string;
  link_id: string;
  click_count: number;
  sales_count: number;
  created_at: string;
}

function VendasTab({
  links,
  onCreate,
  dialogOpen,
  setDialogOpen,
}: {
  links: TgRedirectLink[];
  onCreate: () => void;
  dialogOpen: boolean;
  setDialogOpen: (v: boolean) => void;
}) {
  const [codes, setCodes] = useState<SalesCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SalesCode | null>(null);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("telegram_sales_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar códigos");
    } else {
      setCodes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const baseDomain = "zaplynx.com";
  const linkById = useMemo(() => {
    const m = new Map<string, TgRedirectLink>();
    links.forEach((l) => m.set(l.id, l));
    return m;
  }, [links]);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <>
      {codes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
            <Hash className="h-6 w-6 text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">
            Nenhum código de vendas criado
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Códigos de venda (cv=) rastreiam tráfego orgânico e afiliados
          </p>
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Primeiro Codigo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((c) => {
            const link = linkById.get(c.link_id);
            const url = link
              ? `https://${baseDomain}/r/${link.slug}?cv=${encodeURIComponent(c.code)}`
              : "";
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {c.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      cv={c.code}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {url || "Link removido"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {c.click_count} cliques · {c.sales_count} vendas
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(c);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Excluir este código?")) return;
                      await (supabase as any)
                        .from("telegram_sales_codes")
                        .delete()
                        .eq("id", c.id);
                      toast.success("Removido");
                      fetchCodes();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SalesCodeDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        links={links}
        editing={editing}
        onSaved={fetchCodes}
      />
    </>
  );
}

function SalesCodeDialog({
  open,
  onOpenChange,
  links,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  links: TgRedirectLink[];
  editing: SalesCode | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [linkId, setLinkId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name || "");
      setLinkId(editing?.link_id || "");
    }
  }, [open, editing]);

  const baseDomain = "zaplynx.com";
  const selectedLink = links.find((l) => l.id === linkId);
  const previewUrl = selectedLink
    ? `https://${baseDomain}/r/${selectedLink.slug}?cv=${encodeURIComponent(name || "codigo")}`
    : "";

  const save = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome para o código");
      return;
    }
    if (!linkId) {
      toast.error("Selecione um link vinculado");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Sessão expirada");
      setSaving(false);
      return;
    }
    const code = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    if (editing) {
      const { error } = await (supabase as any)
        .from("telegram_sales_codes")
        .update({ name: name.trim(), code, link_id: linkId })
        .eq("id", editing.id);
      if (error) {
        toast.error("Erro ao salvar");
      } else {
        toast.success("Código atualizado");
        onSaved();
        onOpenChange(false);
      }
    } else {
      const { error } = await (supabase as any)
        .from("telegram_sales_codes")
        .insert({ user_id: userId, name: name.trim(), code, link_id: linkId });
      if (error) {
        toast.error(error.message?.includes("unique") ? "Código já existe" : "Erro ao criar");
      } else {
        toast.success("Código criado");
        onSaved();
        onOpenChange(false);
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{editing ? "Editar Codigo de Vendas" : "Criar Codigo de Vendas"}</DialogTitle>
              <DialogDescription>Codigos para rastrear vendas por afiliado</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs p-3 flex items-start gap-2">
            <Hash className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Códigos de venda (cv=) permitem rastrear vendas de afiliados ou campanhas específicas.</span>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome do Codigo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: afiliado1" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Link Vinculado</Label>
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um link..." />
              </SelectTrigger>
              <SelectContent>
                {links.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Crie um link primeiro</div>
                )}
                {links.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    /{l.slug} {l.name ? `· ${l.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {previewUrl && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground truncate">{previewUrl}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 border-t border-border bg-background">
          <Button onClick={save} disabled={saving} className="gap-2">
            <Check className="h-4 w-4" />
            {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}