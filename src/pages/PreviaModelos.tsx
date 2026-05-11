import { useState, useMemo } from "react";
import { useMessageTemplates, MessageTemplate } from "@/hooks/useMessageTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowLeft, LayoutGrid, LayoutList, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

 import { WhatsAppPreview } from "@/components/WhatsAppPreview";
const PreviaModelos = () => {
  const { templates, loading, createTemplate } = useMessageTemplates();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [creatingExamples, setCreatingExamples] = useState(false);
  const navigate = useNavigate();

  const exampleTemplates: Partial<MessageTemplate>[] = [
    {
      name: "Boas-vindas (Exemplo)",
      category: "Boas-vindas",
      content: "Olá {nome}, seja muito bem-vindo(a) à nossa empresa! 🚀\n\nEstamos muito felizes em ter você conosco. Como posso te ajudar hoje?",
      footer: "Equipe de Atendimento",
      type: "texto"
    },
    {
      name: "Promoção Relâmpago (Exemplo)",
      category: "Marketing",
      content: "🔥 OFERTA EXCLUSIVA 🔥\n\nSomente hoje, toda a nossa loja com 50% de DESCONTO! Não perca essa oportunidade única.",
      footer: "Válido até 23:59",
      type: "texto",
      buttons: [
        { id: "1", text: "Ver Ofertas", type: "url", value: "https://exemplo.com" },
        { id: "2", text: "Falar com Vendedor", type: "reply" }
      ]
    },
    {
      name: "Lembrete de Agendamento (Exemplo)",
      category: "Aviso",
      content: "Olá! Passando para lembrar do seu agendamento amanhã às 14:00. Podemos confirmar sua presença?",
      type: "texto",
      buttons: [
        { id: "1", text: "Confirmar ✅", type: "reply" },
        { id: "2", text: "Reagendar 🗓️", type: "reply" }
      ]
    },
    {
      name: "Cobrança Amigável (Exemplo)",
      category: "Cobrança",
      content: "Olá! Notamos que o seu pagamento ainda não foi identificado em nosso sistema. Caso já tenha pago, por favor desconsidere esta mensagem.",
      footer: "Dúvidas? Entre em contato.",
      type: "texto"
    }
  ];

  const handleCreateExamples = async () => {
    setCreatingExamples(true);
    try {
      for (const example of exampleTemplates) {
        await createTemplate(example as any);
      }
    } finally {
      setCreatingExamples(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [templates, searchTerm]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/modelos")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Prévia de Modelos</h1>
            <p className="text-muted-foreground text-sm">Visualize como suas mensagens serão enviadas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex border rounded-lg p-1 bg-muted/20">
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card className="p-12 text-center border-dashed bg-muted/5">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <LayoutGrid className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium">Nenhum modelo encontrado</h3>
            <p className="text-muted-foreground">
              Parece que você ainda não tem modelos criados. Deseja que eu crie alguns exemplos profissionais para você começar?
            </p>
            <Button 
              onClick={handleCreateExamples} 
              disabled={creatingExamples}
              className="gap-2"
            >
              {creatingExamples ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {creatingExamples ? "Criando exemplos..." : "Criar modelos de exemplo"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className={viewMode === "grid" 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
          : "space-y-4"
        }>
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="overflow-hidden bg-muted/10 border-white/5 hover:border-primary/20 transition-all flex flex-col">
              <CardHeader className="p-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate" title={template.name}>
                    {template.name}
                  </CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                    {template.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-end">
                <WhatsAppPreview template={template} />
                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>ID: {template.id.split('-')[0]}</span>
                  <span>Usado {template.usage_count}x</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PreviaModelos;
