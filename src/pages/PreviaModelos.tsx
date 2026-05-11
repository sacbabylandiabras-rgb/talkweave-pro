import { useState } from "react";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowLeft, LayoutGrid, LayoutList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const WhatsAppPreview = ({ template }: { template: any }) => {
  const isSpecial = template.content?.startsWith("__SPECIAL_TEMPLATE__:");
  let content = template.content;
  let type = template.type;

  if (isSpecial) {
    try {
      const parsed = JSON.parse(template.content.slice(21));
      content = parsed.description || parsed.title || "Template Especial";
      type = parsed.type;
    } catch (e) {
      content = "Erro ao processar template especial";
    }
  }

  return (
    <div className="bg-[#0b141a] rounded-lg p-3 max-w-full overflow-hidden shadow-lg border border-white/5">
      {template.header && (
        <div className="text-white/50 text-[11px] font-bold mb-1 uppercase tracking-wider">
          {template.header}
        </div>
      )}
      
      {template.mediaUrl && (
        <div className="mb-2 rounded overflow-hidden bg-white/5">
          {template.fileType?.startsWith('image') ? (
            <img src={template.mediaUrl} alt="Preview" className="w-full h-32 object-cover" />
          ) : (
            <div className="w-full h-32 flex items-center justify-center text-white/30">
              Arquivo: {template.fileName || 'Mídia'}
            </div>
          )}
        </div>
      )}

      <div className="text-white text-[14.5px] whitespace-pre-wrap break-words leading-relaxed">
        {content}
      </div>

      {template.footer && (
        <div className="text-white/45 text-[12px] mt-1.5 italic">
          {template.footer}
        </div>
      )}

      {template.buttons && template.buttons.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {template.buttons.map((btn: any, idx: number) => (
            <div 
              key={idx} 
              className="bg-[#202c33] hover:bg-[#2a3942] transition-colors py-2 px-4 rounded text-[#00a884] text-sm font-medium text-center border-t border-white/5"
            >
              {btn.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PreviaModelos = () => {
  const { templates, loading } = useMessageTemplates();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const navigate = useNavigate();

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">Nenhum modelo encontrado.</p>
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
