import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Download, Loader2, Copy, Check, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { toast } from "sonner";

interface ExtractedParticipant {
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name: string;
}

const ExtrairComunidade = () => {
  const [communityId, setCommunityId] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [participants, setParticipants] = useState<ExtractedParticipant[]>([]);
  const [metadata, setMetadata] = useState<{
    groupName: string;
    totalLids: number;
    resolvedLids: number;
    unresolvedLids: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");
  const { instances } = useZapiInstances();

  const handleExtract = async () => {
    if (!communityId.trim()) {
      toast.error("Informe o ID da comunidade");
      return;
    }

    setExtracting(true);
    setParticipants([]);
    setMetadata(null);

    try {
      const sourceInstanceId = selectedInstance || null;
      const { data, error } = await supabase.functions.invoke("get-group-participants", {
        body: { groupId: communityId.trim(), fallbackParticipants: [], sourceInstanceId },
      });

      if (error) throw error;

      const extracted: ExtractedParticipant[] = (data.participants || []).filter(
        (p: any) => p.phone && p.phone.length > 5
      );

      setParticipants(extracted);
      setMetadata({
        groupName: data.groupName || "Comunidade",
        totalLids: data.totalLids || 0,
        resolvedLids: data.resolvedLids || 0,
        unresolvedLids: data.unresolvedLids || 0,
      });

      if (extracted.length === 0) {
        toast.warning("Nenhum membro encontrado. Verifique o ID e tente novamente.");
      } else if (data.unresolvedLids > 0) {
        toast.success(`${extracted.length} membros extraídos (${data.unresolvedLids} com @lid não resolvido)`);
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
    .filter((p) => !p.includes("@lid"));

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
      .filter((p) => !p.phone.includes("@lid"))
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
          Insira o ID da comunidade WhatsApp para extrair a lista de membros
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 block">
                ID da Comunidade / Grupo
              </label>
              <Input
                placeholder="Ex: 120363xxxxxxxxxxxx@g.us ou 120363xxxxxxxxxxxx-group"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                disabled={extracting}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Instância
              </label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Instância Padrão</SelectItem>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.zapi_instance_id}>
                      {inst.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleExtract}
            disabled={extracting || !communityId.trim()}
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
                O ID é a sequência numérica longa no link (ex: <code className="bg-muted px-1 rounded">120363xxxxxxxxxx</code>).
                Ou use o ID que aparece nos seus grupos listados na página de Apanhador de Grupos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {metadata && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Total Membros</span>
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xl font-bold">{participants.length}</p>
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
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">LIDs Resolvidos</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-xl font-bold">{metadata.resolvedLids}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">LIDs Pendentes</span>
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                </div>
                <p className="text-xl font-bold">{metadata.unresolvedLids}</p>
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
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {p.phone.includes("@lid") ? (
                            <span className="text-yellow-500">{p.phone}</span>
                          ) : (
                            p.phone
                          )}
                        </td>
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