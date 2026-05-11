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
    // Básicos
    { name: "Mensagem de Texto", category: "Básico", type: "texto", content: "Olá! Esta é uma mensagem de texto simples." },
    { name: "Exemplo de Imagem", category: "Básico", type: "imagem", content: "Legenda da imagem", mediaUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475" },
    { name: "Exemplo de Áudio", category: "Básico", type: "áudio", content: "Mensagem de voz", mediaUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { name: "Exemplo de Vídeo", category: "Básico", type: "vídeo", content: "Confira este vídeo!", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" },
    { name: "Exemplo de Arquivo/Documento", category: "Básico", type: "documento", content: "Contrato de Prestação de Serviços", fileName: "contrato.pdf" },
    
    // Interativos
    { 
      name: "Imagem com Botões", category: "Interativo", type: "imagem com botões", 
      content: "Gostou desta oferta?", 
      mediaUrl: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b",
      buttons: [{ id: "1", text: "Sim! 😍", type: "reply" }, { id: "2", text: "Não 😢", type: "reply" }]
    },
    { 
      name: "Vídeo com Botões", category: "Interativo", type: "vídeo com botões", 
      content: "Assista e escolha uma opção:", 
      mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      buttons: [{ id: "1", text: "Saiba Mais", type: "url", value: "https://exemplo.com" }]
    },
    { 
      name: "Lista de Opções", category: "Interativo", type: "lista de opção", 
      content: "Escolha um departamento:", 
      footer: "Menu Principal",
      listItems: [{ id: "1", title: "Vendas" }, { id: "2", title: "Suporte" }, { id: "3", title: "Financeiro" }]
    },

    // Especiais
    { 
      name: "Botão Copiar", category: "Especial", type: "copia e cola", 
      content: "__SPECIAL_TEMPLATE__:{\"type\":\"copia_cola\",\"description\":\"Clique para copiar o código do cupom:\",\"copyText\":\"PROMO2024\"}"
    },
    { 
      name: "Cobrança PIX", category: "Especial", type: "pix", 
      content: "__SPECIAL_TEMPLATE__:{\"type\":\"pix\",\"pixKey\":\"12345678900\",\"pixKeyType\":\"cpf\",\"amount\":\"150.00\",\"merchantName\":\"Minha Loja\",\"city\":\"São Paulo\",\"description\":\"Pagamento do Pedido #123\"}"
    },
    { 
      name: "Localização", category: "Especial", type: "localizacao", 
      content: "__SPECIAL_TEMPLATE__:{\"type\":\"localizacao\",\"latitude\":\"-23.5505\",\"longitude\":\"-46.6333\",\"address\":\"Av. Paulista, 1000\",\"title\":\"Nosso Escritório\"}"
    },
    { 
      name: "Cartão de Contato", category: "Especial", type: "contato", 
      content: "__SPECIAL_TEMPLATE__:{\"type\":\"contato\",\"contactName\":\"Suporte ZapLynx\",\"contactPhone\":\"+5511999999999\",\"contactBusinessDescription\":\"Atendimento 24h\"}"
    },
    { 
      name: "Produto do Catálogo", category: "Especial", type: "produto", 
      content: "__SPECIAL_TEMPLATE__:{\"type\":\"produto\",\"productId\":\"PROD-001\",\"description\":\"Confira este produto em nossa loja!\"}"
    },
    { 
      name: "Enquete (Poll)", category: "Especial", type: "poll", 
      content: "Qual seu dia preferido para reunião?",
      buttons: [{ id: "1", text: "Segunda" }, { id: "2", text: "Quarta" }, { id: "3", text: "Sexta" }]
    },
    { name: "Sticker (Figurinha)", category: "Especial", type: "sticker", mediaUrl: "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmZ3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z/3o7TKMGf7U1aFjD9pS/giphy.gif" },
    { name: "GIF Animado", category: "Especial", type: "gif", mediaUrl: "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmZ3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z/3o7TKMGf7U1aFjD9pS/giphy.gif" },
    { name: "Link com Preview", category: "Especial", type: "link", content: "Acesse nosso site: https://lovable.dev" }
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

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={handleCreateExamples} 
            disabled={creatingExamples}
            variant="outline"
            className="gap-2 border-primary/20 hover:bg-primary/5"
          >
            {creatingExamples ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {creatingExamples ? "Criando..." : "Gerar Exemplos"}
          </Button>

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
