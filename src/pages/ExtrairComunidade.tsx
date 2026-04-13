import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Download, Loader2, Copy, Check, Search, AlertTriangle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedParticipant {
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name: string;
}

const STORAGE_KEY = "uazapi_credentials";

function loadCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { apiUrl: string; apiToken: string };
  } catch {}
  return { apiUrl: "", apiToken: "" };
}

function saveCredentials(apiUrl: string, apiToken: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiUrl, apiToken }));
}

const ExtrairComunidade = () => {
  const [communityId, setCommunityId] = useState("");
  const stored = loadCredentials();
  const [apiUrl, setApiUrl] = useState(stored.apiUrl);
  const [apiToken, setApiToken] = useState(stored.apiToken);
  const [extracting, setExtracting] = useState(false);
  const [participants, setParticipants] = useState<ExtractedParticipant[]>([]);
  const [metadata, setMetadata] = useState<{
    groupName: string;
    totalMembers: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");

  const handleSaveCredentials = () => {
    if (!apiUrl.trim() || !apiToken.trim()) {
      toast.error("Preencha a URL e o Token da uazapi");
      return;
    }
    saveCredentials(apiUrl.trim(), apiToken.trim());
    toast.success("Credenciais salvas localmente!");
  };

  const handleExtract = async () => {
    if (!communityId.trim()) {
      toast.error("Informe o ID da comunidade");
      return;
    }
    if (!apiUrl.trim() || !apiToken.trim()) {
      toast.error("Configure a URL e Token da uazapi primeiro");
      return;
    }

    setExtracting(true);
    setParticipants([]);
    setMetadata(null);

    try {
      const { data, error } = await supabase.functions.invoke("uazapi-group-info", {
        body: {
          groupId: communityId.trim(),
          apiUrl: apiUrl.trim(),
          apiToken: apiToken.trim(),
        },
      });

      if (error) throw error;

      // Parse uazapi response — participants array with JID format
      const rawParticipants = data?.participants || [];
      const extracted: ExtractedParticipant[] = rawParticipants.map((p: any) => {
        const jid = p.id || p.jid || p.JID || "";
        const phone = jid.replace(/@.*/, "");
        return {
          phone,
          isAdmin: p.isAdmin === true || p.admin === "admin",
          isSuperAdmin: p.isSuperAdmin === true || p.admin === "superadmin",
          name: p.name || p.pushName || p.notify || "",
        };
      });

      setParticipants(extracted);
      setMetadata({
        groupName: data?.subject || data?.name || data?.groupName || "Comunidade",
        totalMembers: extracted.length,
      });

      if (extracted.length === 0) {
        toast.warning("Nenhum membro encontrado. Verifique o ID e tente novamente.");
      } else {
        toast.success(`${extracted.length} membros extraídos com sucesso!`);
      }
    } catch (err: any) {
      console.error("Erro ao extrair membros:", err);
      toast.error(err?.message || "Erro ao extrair membros da comunidade");
    } finally {
      setExtracting(false);
    }
  };

  const phones = participants
    .map((p) => p.phone)
    .filter((p) => p.length > 5 && !p.includes("lid"));

  const filteredParticipants = filter
    ? participants.filter(
        (p) =>
          p.phone.includes(filter) ||
          p.name.toLowerCase().includes(filter.toLowerCase())
      )
    : participants;

  const copyAll = () => {
    if (phones.length === 0) return;
    navigator.clipboard.writeText(phones.join("\n"));
    setCopied(true);
    toast.success(`${phones.length} números copiados!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (phones.length === 0) return;
    const blob = new Blob([phones.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comunidade_${communityId.replace(/[^a-zA-Z0-9]/g, "_")}_membros.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (participants.length === 0) return;
    const header = "Telefone,Nome,Admin\n";
    const rows = participants
      .filter((p) => p.phone.length > 5 && !p.phone.includes("lid"))
      .map((p) => `${p.phone},${p.name.replace(/,/g, " ")},${p.isAdmin || p.isSuperAdmin ? "Sim" : "Não"}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comunidade_${communityId.replace(/[^a-zA-Z0-9]/g, "_")}_membros.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Extrair Membros de Comunidade</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Insira o ID da comunidade WhatsApp para extrair a lista de membros via uazapi
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Credenciais uazapi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                URL da API (ex: https://seudominio.uazapi.com)
              </label>
              <Input
                placeholder="https://seudominio.uazapi.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                type="url"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Token da Instância
              </label>
              <Input
                placeholder="Seu token de instância uazapi"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                type="password"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSaveCredentials}>
            <Save className="w-3 h-3 mr-1" /> Salvar Credenciais
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Extração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              ID da Comunidade / Grupo
            </label>
            <Input
              placeholder="Ex: 120363xxxxxxxxxxxx@g.us"
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              disabled={extracting}
            />
          </div>

          <Button
            onClick={handleExtract}
            disabled={extracting || !communityId.trim() || !apiUrl.trim() || !apiToken.trim()}
            className="w-full sm:w-auto"
          >
            {extracting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extraindo...</>
            ) : (
              <><Search className="w-4 h-4 mr-2" /> Extrair Membros</>
            )}
          </Button>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
            <div>
              <p className="font-medium text-foreground">Como encontrar o ID da comunidade?</p>
              <p className="mt-1">
                No WhatsApp, abra a comunidade → toque no nome → role até "Convidar via link" → copie o link.
                O ID é a sequência numérica longa no link (ex: <code className="bg-muted px-1 rounded">120363xxxxxxxxxx@g.us</code>).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {metadata && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Total Membros</span>
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xl font-bold">{metadata.totalMembers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Números Válidos</span>
                  <Users className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xl font-bold">{phones.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="text-sm">
                  Membros — {metadata.groupName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copyAll} disabled={phones.length === 0}>
                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "Copiado!" : "Copiar Todos"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadTxt} disabled={phones.length === 0}>
                    <Download className="w-3 h-3 mr-1" /> TXT
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadCsv} disabled={phones.length === 0}>
                    <Download className="w-3 h-3 mr-1" /> CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Filtrar por número ou nome..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-sm"
              />

              <div className="max-h-[400px] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">#</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Telefone</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Nome</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p, i) => (
                      <tr key={`${p.phone}-${i}`} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{p.phone}</td>
                        <td className="px-3 py-1.5 text-xs">{p.name || "—"}</td>
                        <td className="px-3 py-1.5">
                          {p.isSuperAdmin ? (
                            <Badge variant="default" className="text-[10px]">Super Admin</Badge>
                          ) : p.isAdmin ? (
                            <Badge variant="secondary" className="text-[10px]">Admin</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Membro</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredParticipants.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                          {filter ? "Nenhum resultado para o filtro" : "Nenhum membro extraído"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ExtrairComunidade;
