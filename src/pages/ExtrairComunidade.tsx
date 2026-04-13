import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Download, Loader2, Copy, Check, Search, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedParticipant {
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name: string;
}

interface GroupInfo {
  id: string;
  name: string;
  size: number;
  raw?: any;
}

const normalizeParticipantIdentifier = (value: any) => {
  const raw = String(value ?? "").trim();

  if (!raw) return "";
  if (/@lid$/i.test(raw)) return raw;

  return raw.replace(/@.*/, "");
};

const extractParticipantsFromPayload = (payload: any): any[] => {
  const candidates = [
    payload?.participants,
    payload?.Participants,
    payload?.members,
    payload?.Members,
    payload?.data?.participants,
    payload?.data?.Participants,
    payload?.data?.members,
    payload?.data?.Members,
    payload?.group?.participants,
    payload?.group?.Participants,
    payload?.group?.members,
    payload?.group?.Members,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }

  return [];
};

const normalizeParticipant = (p: any): ExtractedParticipant | null => {
  const realPhone = normalizeParticipantIdentifier(
    p?.PN || p?.PhoneNumber || p?.phone || p?.number || p?.waId || "",
  );

  const encryptedId = normalizeParticipantIdentifier(
    p?.LID || p?.lid || p?.JID || p?.jid || p?.id || p?.userJid || p?.participant || "",
  );

  const phone = realPhone || encryptedId;

  if (phone.length <= 3) return null;

  return {
    phone,
    isAdmin:
      p?.isAdmin === true ||
      p?.IsAdmin === true ||
      p?.admin === "admin" ||
      p?.role === "admin" ||
      p?.IsAdmin === "admin",
    isSuperAdmin:
      p?.isSuperAdmin === true ||
      p?.IsSuperAdmin === true ||
      p?.admin === "superadmin" ||
      p?.role === "superadmin" ||
      p?.IsAdmin === "superadmin",
    name: p?.DisplayName || p?.displayName || p?.name || p?.Name || p?.pushName || p?.notify || "",
  };
};

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
  const stored = loadCredentials();
  const [apiUrl, setApiUrl] = useState(stored.apiUrl);
  const [apiToken, setApiToken] = useState(stored.apiToken);
  const [extracting, setExtracting] = useState(false);
  const [participants, setParticipants] = useState<ExtractedParticipant[]>([]);
  const [metadata, setMetadata] = useState<{ groupName: string; totalMembers: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");

  // Groups list
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  const hasCredentials = apiUrl.trim() && apiToken.trim();

  const handleSaveCredentials = () => {
    if (!hasCredentials) {
      toast.error("Preencha a URL e o Token da uazapi");
      return;
    }
    saveCredentials(apiUrl.trim(), apiToken.trim());
    toast.success("Credenciais salvas!");
    fetchGroups();
  };

  const fetchGroups = async () => {
    if (!apiUrl.trim() || !apiToken.trim()) return;
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-group-list", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(`Erro da uazapi: ${data.error}. Verifique suas credenciais.`);
        setLoadingGroups(false);
        return;
      }

      const rawGroups = Array.isArray(data)
        ? data
        : Array.isArray(data?.groups)
          ? data.groups
          : [];

      const list: GroupInfo[] = rawGroups
        .map((g: any) => {
          const id = typeof g === "string"
            ? g
            : g?.JID || g?.id || g?.jid || g?.groupId || g?.remoteJid || "";

          const name = typeof g === "string"
            ? ""
            : g?.Name || g?.subject || g?.name || g?.groupName || g?.pushName || "";

          const rawParticipants = typeof g === "string" ? [] : extractParticipantsFromPayload(g);
          const size = typeof g === "string"
            ? 0
            : g?.ParticipantCount || g?.participantCount || g?.size || rawParticipants.length || g?.memberCount || g?.MemberCount || 0;

          return { id, name, size, raw: typeof g === "string" ? undefined : g };
        })
        .filter((g) => g.id.includes("@g.us"))
        .filter((g, index, self) => self.findIndex((item) => item.id === g.id) === index)
        .map((g) => ({
          ...g,
          name: g.name || g.id.replace("@g.us", ""),
        }));

      setGroups(list);
      if (list.length === 0) {
        toast.warning("Nenhum grupo encontrado nesta instância.");
      } else {
        toast.success(`${list.length} grupos carregados!`);
      }
    } catch (err: any) {
      console.error("Erro ao listar grupos:", err);
      toast.error(err?.message || "Erro ao listar grupos");
    } finally {
      setLoadingGroups(false);
    }
  };

  // Auto-fetch groups on mount if credentials exist
  useEffect(() => {
    if (stored.apiUrl && stored.apiToken) {
      fetchGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExtract = async (groupId: string) => {
    if (!groupId.trim() || !hasCredentials) return;

    setExtracting(true);
    setParticipants([]);
    setMetadata(null);
    setSelectedGroupId(groupId);

    try {
      const { data, error } = await supabase.functions.invoke("uazapi-group-info", {
        body: { groupId: groupId.trim(), apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const responseParticipants = extractParticipantsFromPayload(data);
      const selectedGroup = groups.find((group) => group.id === groupId.trim());
      const listParticipants = extractParticipantsFromPayload(selectedGroup?.raw);
      const localParticipants = [...responseParticipants, ...listParticipants]
        .map((participant) => normalizeParticipant(participant))
        .filter((participant): participant is ExtractedParticipant => Boolean(participant));

      let zapiParticipants: ExtractedParticipant[] = [];

      try {
        const { data: zapiData, error: zapiError } = await supabase.functions.invoke("get-group-participants", {
          body: {
            groupId: groupId.trim(),
            fallbackParticipants: localParticipants,
          },
        });

        if (zapiError) throw zapiError;

        zapiParticipants = Array.isArray(zapiData?.participants)
          ? zapiData.participants
              .map((participant: any) => normalizeParticipant(participant))
              .filter((participant): participant is ExtractedParticipant => Boolean(participant))
          : [];
      } catch (fallbackError) {
        console.warn("Fallback get-group-participants falhou:", fallbackError);
      }

      const normalizedMap = new Map<string, ExtractedParticipant>();

      [...localParticipants, ...zapiParticipants].forEach((normalized) => {
        if (!normalized) return;

        const existing = normalizedMap.get(normalized.phone);
        if (!existing) {
          normalizedMap.set(normalized.phone, normalized);
          return;
        }

        normalizedMap.set(normalized.phone, {
          phone: normalized.phone,
          name: existing.name || normalized.name,
          isAdmin: existing.isAdmin || normalized.isAdmin,
          isSuperAdmin: existing.isSuperAdmin || normalized.isSuperAdmin,
        });
      });

      const extracted = Array.from(normalizedMap.values());
      const reportedTotal = Math.max(
        Number(data?.ParticipantCount) || 0,
        Number(data?.participantCount) || 0,
        Number(data?.data?.ParticipantCount) || 0,
        Number(data?.data?.participantCount) || 0,
        Number(selectedGroup?.size) || 0,
        extracted.length,
        zapiParticipants.length,
      );

      setParticipants(extracted);
      setMetadata({
        groupName: data?.subject || data?.Subject || data?.name || data?.Name || data?.groupName || data?.data?.subject || data?.data?.name || selectedGroup?.name || "Comunidade",
        totalMembers: Number(reportedTotal) || extracted.length,
      });

      if (extracted.length === 0) {
        toast.warning("Nenhum membro encontrado ou a API retornou em formato diferente.");
      } else {
        toast.success(`${extracted.length} membros extraídos!`);
      }
    } catch (err: any) {
      console.error("Erro ao extrair membros:", err);
      toast.error(err?.message || "Erro ao extrair membros");
    } finally {
      setExtracting(false);
    }
  };

  const phones = participants
    .map((p) => p.phone)
    .filter((p) => p.length > 3);

  const filteredParticipants = filter
    ? participants.filter(
        (p) => p.phone.includes(filter) || p.name.toLowerCase().includes(filter.toLowerCase())
      )
    : participants;

  const filteredGroups = groupFilter
    ? groups.filter(
        (g) => g.name.toLowerCase().includes(groupFilter.toLowerCase()) || g.id.includes(groupFilter)
      )
    : groups;

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
    a.download = `membros_${selectedGroupId.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (participants.length === 0) return;
    const header = "Telefone,Nome,Admin\n";
    const rows = participants
      .filter((p) => p.phone.length > 3)
      .map((p) => `${p.phone},${p.name.replace(/,/g, " ")},${p.isAdmin || p.isSuperAdmin ? "Sim" : "Não"}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `membros_${selectedGroupId.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Extrair Membros de Comunidade</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Conecte sua instância uazapi para listar grupos e extrair membros automaticamente
        </p>
      </div>

      {/* Credentials */}
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
          <Button variant="outline" size="sm" onClick={handleSaveCredentials} disabled={!hasCredentials}>
            <Save className="w-3 h-3 mr-1" /> Salvar e Carregar Grupos
          </Button>
        </CardContent>
      </Card>

      {/* Groups List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Grupos da Instância {groups.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{groups.length}</Badge>}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchGroups}
              disabled={loadingGroups || !hasCredentials}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingGroups ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingGroups && groups.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando grupos...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {hasCredentials
                ? "Nenhum grupo encontrado. Clique em Atualizar."
                : "Configure suas credenciais uazapi acima para listar os grupos."}
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar grupo por nome ou ID..."
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="max-w-sm"
              />
              <div className="max-h-[350px] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Nome do Grupo</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Membros</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((g) => (
                      <tr key={g.id} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div>
                            <p className="text-xs font-medium truncate max-w-[250px]">{g.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[250px]">{g.id}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{g.size || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant={selectedGroupId === g.id && metadata ? "secondary" : "default"}
                            onClick={() => handleExtract(g.id)}
                            disabled={extracting}
                            className="text-xs h-7 px-3"
                          >
                            {extracting && selectedGroupId === g.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <><Search className="w-3 h-3 mr-1" /> Extrair</>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredGroups.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-muted-foreground text-xs">
                          Nenhum grupo encontrado para o filtro
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Results */}
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
                <CardTitle className="text-sm">Membros — {metadata.groupName}</CardTitle>
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
