import { useState } from "react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users, UserPlus, UserMinus, Shield, Loader2, Search, Download, RefreshCw
} from "lucide-react";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { useGroupMemberCount } from "@/hooks/useGroupMemberCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formatCommunityLid = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/@lid$/i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 13 ? `${digits}@lid` : raw.replace(/@c\.us$/i, "").replace(/@s\.whatsapp\.net$/i, "");
};

const ExtractMembers = () => {
  const { groups, loading, refetch } = useWhatsAppGroups({ provider: 'zapi' });
  const { instances } = useZapiInstances({ provider: 'zapi' });
  const { fetchMemberCount, isLoading: isMemberLoading } = useGroupMemberCount();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [busca, setBusca] = useState("");
  const [phoneToAdd, setPhoneToAdd] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const fetchParticipants = async (group: any) => {
    setLoadingParticipants(true);
    setParticipants([]);
    try {
      const { data, error } = await supabase.functions.invoke("get-group-participants", {
        body: {
          groupId: group.id,
          sourceInstanceId: group.sourceInstanceId || null,
          fallbackParticipants: group.participantes || [],
          isCommunity: Boolean(group.isCommunity),
        },
      });
      if (error) throw error;
      setParticipants((data?.participants || []).map((p: any) => ({
        ...p,
        phone: formatCommunityLid(p.phone || p.id || ""),
      })));
    } catch (err: any) {
      console.error("Erro ao buscar participantes:", err);
      toast.error("Erro ao buscar participantes do grupo");
    } finally {
      setLoadingParticipants(false);
    }
  };

  const getInstanceCredentials = (group: any) => {
    const inst = instances.find((i) => i.zapi_instance_id === group?.sourceInstanceId);
    if (inst) {
      return {
        instanceId: inst.zapi_instance_id,
        instanceToken: inst.zapi_token,
        instanceClientToken: inst.zapi_client_token,
      };
    }
    return { instanceId: group?.sourceInstanceId };
  };

  const handleAction = async (action: string, phone: string) => {
    if (!selectedGroup) return;
    setActionLoading(`${action}-${phone}`);
    try {
      const credentials = getInstanceCredentials(selectedGroup);
      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: {
          action,
          groupId: selectedGroup.id,
          phone,
          ...credentials,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        action === "add-participant" ? "Participante adicionado!" :
        action === "remove-participant" ? "Participante removido!" :
        action === "promote-participant" ? "Promovido a admin!" :
        "Rebaixado!"
      );
      fetchParticipants(selectedGroup);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha na operação"));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredParticipants = participants.filter((p: any) => {
    const phone = p.phone || p.id || "";
    const name = p.name || "";
    return phone.includes(busca) || name.toLowerCase().includes(busca.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 shrink-0">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Extrair Membros
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie e extraia participantes dos seus grupos e comunidades</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-20 scrollbar-thin scrollbar-thumb-white/10">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Selecione grupo, comunidade ou canal</label>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => selectedGroup && fetchParticipants(selectedGroup)} disabled={loadingParticipants || !selectedGroup}>
                <RefreshCw className={`w-4 h-4 ${loadingParticipants ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : groups.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center border border-dashed rounded-md">
                Nenhum grupo encontrado na instância de dispositivo
              </div>
            ) : (
              <Select
                value={selectedGroupId}
                onValueChange={(value) => {
                  const group = groups.find((g) => g.id === value);
                  setSelectedGroupId(value);
                  if (group) {
                    fetchMemberCount(group.id, group.sourceInstanceId, group.participantes);
                    fetchParticipants(group);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um item para gerenciar" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.typeLabel || (g.isChannel ? "Canal" : g.isCommunity ? "Comunidade" : "Grupo")} · {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Gerenciar Participantes
                  </CardTitle>
                  <CardDescription>Adicione, remova ou extraia membros dos seus grupos</CardDescription>
                </div>
                {selectedGroup && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const text = filteredParticipants.map(p => p.phone).join('\n');
                      const blob = new Blob([text], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `membros-${selectedGroup.nome.replace(/\s+/g, '-')}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast.success("Membros extraídos com sucesso!");
                    }}
                    disabled={filteredParticipants.length === 0}
                  >
                    <Download className="w-4 h-4" />
                    Extrair Membros
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedGroup ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Número com DDI (ex: 5511999999999)"
                      value={phoneToAdd}
                      onChange={(e) => setPhoneToAdd(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (phoneToAdd.trim()) {
                          handleAction("add-participant", phoneToAdd.trim());
                          setPhoneToAdd("");
                        }
                      }}
                      disabled={!!actionLoading}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar participante..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {loadingParticipants ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Buscando participantes...</span>
                      </div>
                    ) : filteredParticipants.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {participants.length === 0
                          ? "Nenhum participante encontrado. Selecione um grupo para carregar."
                          : "Nenhum resultado para a busca"}
                      </p>
                    ) : (
                      filteredParticipants.map((p: any, i: number) => {
                        const phone = p.phone || p.id || `participante-${i}`;
                        const isAdmin = p.admin === "admin" || p.isAdmin;
                        return (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {phone.slice(-2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="text-sm font-medium">{phone}</span>
                                {isAdmin && <Badge variant="secondary" className="ml-2 text-[10px]">Admin</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleAction("promote-participant", phone)}
                                  disabled={actionLoading === `promote-participant-${phone}`}
                                  title="Promover a admin"
                                >
                                  {actionLoading === `promote-participant-${phone}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Shield className="w-3.5 h-3.5 text-primary" />
                                  )}
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleAction("demote-participant", phone)}
                                  disabled={actionLoading === `demote-participant-${phone}`}
                                  title="Remover admin"
                                >
                                  {actionLoading === `demote-participant-${phone}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleAction("remove-participant", phone)}
                                disabled={actionLoading === `remove-participant-${phone}`}
                                title="Remover participante"
                              >
                                {actionLoading === `remove-participant-${phone}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserMinus className="w-3.5 h-3.5 text-destructive" />
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mb-4 opacity-20" />
                  <p>Selecione um grupo acima para gerenciar os participantes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExtractMembers;
