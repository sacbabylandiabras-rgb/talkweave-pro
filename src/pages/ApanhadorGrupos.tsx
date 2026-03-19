import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Search, Download, RefreshCw, Users, Eye, Loader2, Copy, Check } from "lucide-react";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ApanhadorGrupos = () => {
  const [busca, setBusca] = useState("");
  const { groups, loading, refetch } = useWhatsAppGroups();
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractedNumbers, setExtractedNumbers] = useState<Map<string, string[]>>(new Map());
  const [copied, setCopied] = useState<string | null>(null);

  const filteredGroups = groups.filter((grupo) => {
    const query = busca.toLowerCase();
    return (
      grupo.nome.toLowerCase().includes(query) ||
      grupo.descricao.toLowerCase().includes(query)
    );
  });

  const extractParticipants = async (
    groupId: string,
    fallbackParticipants: any[] = [],
    sourceInstanceId?: string | null,
  ) => {
    setExtracting(groupId);
    try {
      const { data, error } = await supabase.functions.invoke('get-group-participants', {
        body: { groupId, fallbackParticipants, sourceInstanceId },
      });
      if (error) throw error;
      const phones = (data.participants || [])
        .map((p: any) => p.phone)
        .filter((p: string) => p && p.length > 5);
      setExtractedNumbers(prev => new Map(prev).set(groupId, phones));
      toast.success(`${phones.length} números extraídos!`);
    } catch (err: any) {
      console.error('Erro ao extrair participantes:', err);
      toast.error('Erro ao extrair participantes do grupo');
    } finally {
      setExtracting(null);
    }
  };

  const copyNumbers = (groupId: string) => {
    const numbers = extractedNumbers.get(groupId);
    if (!numbers) return;
    navigator.clipboard.writeText(numbers.join('\n'));
    setCopied(groupId);
    toast.success('Números copiados!');
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadNumbers = (groupId: string, groupName: string) => {
    const numbers = extractedNumbers.get(groupId);
    if (!numbers) return;
    const blob = new Blob([numbers.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_numeros.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Apanhador de Grupos</h1>
        <p className="text-muted-foreground">Visualize seus grupos do WhatsApp e extraia números dos participantes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Grupos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
            <p className="text-xs text-muted-foreground">Grupos encontrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups.reduce((sum, g) => sum + g.membros, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Contatos nos grupos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grupos Admin</CardTitle>
            <Eye className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups.filter(g => g.isAdmin).length}
            </div>
            <p className="text-xs text-muted-foreground">Você é administrador</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Grupos do WhatsApp</CardTitle>
              <CardDescription>Clique em "Extrair Números" para obter os telefones dos participantes</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar grupos por nome ou descrição..."
                className="pl-10"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Buscando grupos...</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">
              {busca ? "Nenhum grupo encontrado" : "Nenhum grupo disponível"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {busca
                ? "Tente buscar com outro termo"
                : "Verifique se sua instância Z-API está conectada"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((grupo) => {
            const numbers = extractedNumbers.get(grupo.id);
            return (
              <Card key={grupo.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={grupo.foto || undefined} alt={grupo.nome} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {grupo.nome.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-base truncate">
                          {grupo.nome}
                        </h3>
                        {grupo.isAdmin && (
                          <Badge variant="default" className="text-xs">Admin</Badge>
                        )}
                      </div>

                      {grupo.descricao && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {grupo.descricao}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {grupo.membros > 0 ? `${grupo.membros} membros` : "Clique em 'Extrair Números' para ver"}
                        </span>
                        {numbers && (
                          <Badge variant="secondary" className="text-xs">
                            {numbers.length} números extraídos
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {numbers ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyNumbers(grupo.id)}
                          >
                            {copied === grupo.id ? (
                              <Check className="w-4 h-4 mr-1 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 mr-1" />
                            )}
                            Copiar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadNumbers(grupo.id, grupo.nome)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Baixar
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => extractParticipants(grupo.id, grupo.participantes || [], grupo.sourceInstanceId)}
                          disabled={extracting === grupo.id}
                        >
                          {extracting === grupo.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4 mr-1" />
                          )}
                          Extrair Números
                        </Button>
                      )}
                    </div>
                  </div>

                  {numbers && numbers.length > 0 && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">
                        Números extraídos ({numbers.length}):
                      </p>
                      <div className="max-h-32 overflow-y-auto text-xs font-mono text-foreground space-y-0.5">
                        {numbers.map((num, i) => (
                          <div key={i}>{num}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApanhadorGrupos;
