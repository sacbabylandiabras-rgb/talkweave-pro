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
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar Link
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
      {tab !== "links" && (
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