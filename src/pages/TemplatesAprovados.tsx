import { useState, useEffect } from "react";
import { FileCheck, Search, Eye, Copy, MoreHorizontal, CheckCircle2, Clock, XCircle, Send, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
  quality_score?: any;
}

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  APPROVED: { label: "Aprovado", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  PENDING: { label: "Em análise", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  REJECTED: { label: "Rejeitado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  PAUSED: { label: "Pausado", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  DISABLED: { label: "Desativado", icon: XCircle, color: "text-muted-foreground", bg: "bg-muted border-border" },
};

const categoryLabels: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

async function getInvokeErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try { const p = await context.clone().json(); if (p?.error) return p.error; } catch {
        try { const t = await context.clone().text(); if (t) return t; } catch {}
      }
    }
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function getTemplateBody(tpl: MetaTemplate): string {
  const bodyComp = tpl.components?.find((c: any) => c.type === "BODY");
  return bodyComp?.text || "";
}

function getTemplateHeader(tpl: MetaTemplate): string {
  const headerComp = tpl.components?.find((c: any) => c.type === "HEADER");
  return headerComp?.text || headerComp?.format || "";
}

function getTemplateFooter(tpl: MetaTemplate): string {
  const footerComp = tpl.components?.find((c: any) => c.type === "FOOTER");
  return footerComp?.text || "";
}

export default function TemplatesAprovados() {
  const { data: creds, isLoading: loadingCreds } = useMetaCredentials();
  const isConnected = creds?.connected === true;

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewTpl, setPreviewTpl] = useState<MetaTemplate | null>(null);

  useEffect(() => {
    if (isConnected) fetchTemplates();
  }, [isConnected]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "list_templates" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTemplates(data.templates || []);
    } catch (err) {
      const msg = await getInvokeErrorMessage(err, "Erro ao buscar templates");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filtered = templates.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      getTemplateBody(t).toLowerCase().includes(search.toLowerCase());
    if (activeTab === "all") return matchSearch;
    return matchSearch && t.status === activeTab.toUpperCase();
  });

  const counts = {
    approved: templates.filter((t) => t.status === "APPROVED").length,
    pending: templates.filter((t) => t.status === "PENDING").length,
    rejected: templates.filter((t) => t.status === "REJECTED").length,
  };

  if (loadingCreds) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Templates Aprovados</h1>
        <Card className="p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-medium">Conta não conectada</p>
          <p className="text-xs text-muted-foreground">Conecte via Configuração Meta.</p>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/meta/configuracao"}>Ir para Configuração</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates Aprovados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Templates reais da sua conta WABA — sincronizados com a Meta
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetchTemplates} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Aprovados", count: counts.approved, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Em análise", count: counts.pending, icon: Clock, color: "text-amber-500" },
          { label: "Rejeitados", count: counts.rejected, icon: XCircle, color: "text-destructive" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "..." : stat.count}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">Todos ({templates.length})</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">Aprovados</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Em análise</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">Rejeitados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Buscando templates da Meta...</span>
        </div>
      )}

      {/* Template List */}
      {!loading && (
        <div className="space-y-3">
          {filtered.map((template) => {
            const status = statusConfig[template.status] || statusConfig.PENDING;
            const StatusIcon = status.icon;
            const body = getTemplateBody(template);
            const header = getTemplateHeader(template);

            return (
              <Card key={template.id} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                        {template.name}
                      </code>
                      <Badge variant="outline" className={`text-[10px] ${status.bg} ${status.color} border`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {categoryLabels[template.category] || template.category}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {template.language}
                      </Badge>
                    </div>
                    {header && (
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Header: {header}
                      </p>
                    )}
                    {body && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {body}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {template.status === "APPROVED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => window.location.href = `/meta/enviar?template=${template.name}`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-xs gap-2" onClick={() => setPreviewTpl(template)}>
                          <Eye className="w-3.5 h-3.5" /> Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs gap-2" onClick={() => {
                          navigator.clipboard.writeText(template.name);
                          toast.success("Nome do template copiado!");
                        }}>
                          <Copy className="w-3.5 h-3.5" /> Copiar Nome
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum template encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTpl} onOpenChange={(open) => !open && setPreviewTpl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{previewTpl?.name}</DialogTitle>
          </DialogHeader>
          {previewTpl && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{categoryLabels[previewTpl.category] || previewTpl.category}</Badge>
                <Badge variant="outline" className="font-mono">{previewTpl.language}</Badge>
                {(() => {
                  const s = statusConfig[previewTpl.status] || statusConfig.PENDING;
                  const SI = s.icon;
                  return (
                    <Badge variant="outline" className={`${s.bg} ${s.color}`}>
                      <SI className="w-3 h-3 mr-1" />
                      {s.label}
                    </Badge>
                  );
                })()}
              </div>

              {/* Simulate WhatsApp bubble */}
              <div className="bg-[#DCF8C6] dark:bg-emerald-900/30 rounded-lg p-4 space-y-2 border border-emerald-200 dark:border-emerald-800">
                {getTemplateHeader(previewTpl) && (
                  <p className="text-xs font-bold text-foreground">{getTemplateHeader(previewTpl)}</p>
                )}
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {getTemplateBody(previewTpl) || "Sem conteúdo de body"}
                </p>
                {getTemplateFooter(previewTpl) && (
                  <p className="text-[10px] text-muted-foreground">{getTemplateFooter(previewTpl)}</p>
                )}
                {/* Buttons */}
                {previewTpl.components?.filter((c: any) => c.type === "BUTTONS").map((btnComp: any, i: number) => (
                  <div key={i} className="space-y-1 pt-2 border-t border-emerald-300 dark:border-emerald-700">
                    {btnComp.buttons?.map((btn: any, j: number) => (
                      <div key={j} className="text-center text-xs text-primary font-medium py-1">
                        {btn.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>ID: {previewTpl.id}</p>
                <p>Componentes: {previewTpl.components?.map((c: any) => c.type).join(", ")}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
