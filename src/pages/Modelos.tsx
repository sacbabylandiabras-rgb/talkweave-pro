import { useState, useCallback, memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Copy, Edit, Trash2, Save, Send, Users, Search, Phone, Link, MessageCircle, Image, Music, Video, List, FileArchive, FileType, Menu, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Helper para obter o ícone do tipo de template
const getTemplateIcon = (type?: string) => {
  switch (type) {
    case "imagem":
    case "imagem_botoes":
      return <Image className="w-5 h-5 text-primary" />;
    case "audio":
      return <Music className="w-5 h-5 text-primary" />;
    case "video":
    case "video_botoes":
      return <Video className="w-5 h-5 text-primary" />;
    case "lista_opcao":
      return <List className="w-5 h-5 text-primary" />;
    case "arquivo":
      return <FileArchive className="w-5 h-5 text-primary" />;
    case "documento":
      return <FileType className="w-5 h-5 text-primary" />;
    case "carrossel":
      return <Menu className="w-5 h-5 text-primary" />;
    default:
      return <FileText className="w-5 h-5 text-primary" />;
  }
};

// Helper para obter o nome amigável do tipo
const getTypeFriendlyName = (type?: string) => {
  const names: Record<string, string> = {
    texto: "Texto",
    imagem: "Imagem",
    audio: "Áudio",
    video: "Vídeo",
    video_botoes: "Vídeo c/ Botões",
    lista_opcao: "Lista",
    copia_cola: "Copiar/Colar",
    arquivo: "Arquivo",
    imagem_botoes: "Imagem c/ Botões",
    documento: "Documento",
    carrossel: "Carrossel",
  };
  return names[type || "texto"] || "Texto";
};

// Componente ButtonEditor separado e memoizado para evitar re-renders
const ButtonEditor = memo(({ 
  buttons, 
  isEdit = false, 
  onAddButton, 
  onUpdateButton, 
  onRemoveButton 
}: { 
  buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>, 
  isEdit?: boolean,
  onAddButton: (isEdit: boolean) => void,
  onUpdateButton: (index: number, field: string, value: string, isEdit: boolean) => void,
  onRemoveButton: (index: number, isEdit: boolean) => void
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Botões de Ação</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddButton(isEdit);
          }}
          disabled={buttons.length >= 3}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Botão
        </Button>
      </div>
    
      {buttons.map((button, index) => (
        <div key={button.id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Botão {index + 1}</span>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveButton(index, isEdit);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Texto do Botão</Label>
              <Input
                placeholder="Ex: Confirmar Pedido"
                value={button.text}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateButton(index, 'text', e.target.value, isEdit);
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                maxLength={20}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select 
                value={button.type} 
                onValueChange={(value) => {
                  onUpdateButton(index, 'type', value, isEdit);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reply">
                    <div className="flex items-center">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Resposta Rápida
                    </div>
                  </SelectItem>
                  <SelectItem value="url">
                    <div className="flex items-center">
                      <Link className="w-4 h-4 mr-2" />
                      Link/URL
                    </div>
                  </SelectItem>
                  <SelectItem value="call">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      Ligar
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(button.type === 'url' || button.type === 'call') && (
            <div>
              <Label>{button.type === 'url' ? 'URL' : 'Número de Telefone'}</Label>
              <Input
                placeholder={button.type === 'url' ? "https://exemplo.com" : "+5511999999999"}
                value={button.value || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateButton(index, 'value', e.target.value, isEdit);
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          )}
        </div>
      ))}
      
      {buttons.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Nenhum botão adicionado. Clique em "Adicionar Botão" para criar um.
        </div>
      )}
      
      <div className="bg-muted/50 p-2 rounded text-xs text-muted-foreground">
        💡 Máximo 3 botões por modelo. Botões de resposta rápida enviam texto automático, links abrem URLs e botões de ligar iniciam chamadas.
      </div>
    </div>
  );
});
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useToast } from "@/hooks/use-toast";

const Modelos = () => {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useMessageTemplates();
  const { toast } = useToast();
  
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "",
    type: "texto",
    content: "",
    header: "",
    footer: "",
    mediaUrl: "",
    fileName: "",
    fileType: "",
    variables: [] as string[],
    buttons: [] as Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>,
    listItems: [] as Array<{id: string, title: string, description?: string}>,
    carouselCards: [] as Array<{
      id: string;
      image: string;
      title: string;
      description: string;
      buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>;
    }>,
  });
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    category: "",
    type: "texto",
    content: "",
    header: "",
    footer: "",
    mediaUrl: "",
    fileName: "",
    fileType: "",
    buttons: [] as Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>,
    listItems: [] as Array<{id: string, title: string, description?: string}>,
    carouselCards: [] as Array<{
      id: string;
      image: string;
      title: string;
      description: string;
      buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>;
    }>,
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Função para fazer upload do arquivo
  const handleFileUpload = async (file: File, isEdit: boolean = false) => {
    try {
      setUploadingFile(true);
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('template-media')
        .upload(filePath, file);

      if (error) throw error;

      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('template-media')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Atualizar estado com a URL
      if (isEdit) {
        setEditFormData(prev => ({
          ...prev,
          mediaUrl: publicUrl,
          fileName: file.name,
          fileType: file.type,
        }));
      } else {
        setNewTemplate(prev => ({
          ...prev,
          mediaUrl: publicUrl,
          fileName: file.name,
          fileType: file.type,
        }));
      }

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso!",
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const categories = ["Todos", ...new Set(templates.map(t => t.category))];
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === "Todos" || template.category === selectedCategory;
    const matchesSearch = searchTerm === "" || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.category || !newTemplate.content) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      // Extract variables from content
      const variableMatches = newTemplate.content.match(/{([^}]+)}/g);
      const variables = variableMatches 
        ? variableMatches.map(match => match.slice(1, -1))
        : [];

      // Validação específica para carrossel
      if (newTemplate.type === "carrossel") {
        if (newTemplate.carouselCards.length < 2) {
          toast({
            title: "Erro",
            description: "Carrossel precisa de pelo menos 2 cards",
            variant: "destructive",
          });
          return;
        }
        
        // Validar cada card
        for (let i = 0; i < newTemplate.carouselCards.length; i++) {
          const card = newTemplate.carouselCards[i];
          if (!card.image || !card.title || !card.description) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: Imagem, título e descrição são obrigatórios`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      await createTemplate({
        name: newTemplate.name,
        category: newTemplate.category,
        type: newTemplate.type,
        content: newTemplate.content,
        header: newTemplate.header,
        footer: newTemplate.footer,
        variables,
        buttons: newTemplate.buttons,
        mediaUrl: newTemplate.mediaUrl,
        fileName: newTemplate.fileName,
        fileType: newTemplate.fileType,
        listItems: newTemplate.listItems,
        carouselCards: newTemplate.carouselCards,
      });

      setNewTemplate({ name: "", category: "", type: "texto", content: "", header: "", footer: "", mediaUrl: "", fileName: "", fileType: "", variables: [], buttons: [], listItems: [], carouselCards: [] });
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleDuplicateTemplate = async (template: any) => {
    try {
      await duplicateTemplate(template);
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Tem certeza que deseja remover este modelo?')) {
      try {
        await deleteTemplate(templateId);
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };


  const handleEditTemplate = (template: any) => {
    setEditFormData({
      name: template.name,
      category: template.category,
      type: template.type || "texto",
      content: template.content,
      header: template.header || "",
      footer: template.footer || "",
      mediaUrl: template.mediaUrl || "",
      fileName: template.fileName || "",
      fileType: template.fileType || "",
      buttons: template.buttons || [],
      listItems: template.listItems || [],
      carouselCards: template.carouselCards || [],
    });
    setEditingTemplate(template.id);
  };

  const handleUpdateTemplate = async () => {
    if (!editFormData.name || !editFormData.category || !editFormData.content) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      // Extract variables from content
      const variableMatches = editFormData.content.match(/{([^}]+)}/g);
      const variables = variableMatches 
        ? variableMatches.map(match => match.slice(1, -1))
        : [];

      // Validação específica para carrossel
      if (editFormData.type === "carrossel") {
        if (editFormData.carouselCards.length < 2) {
          toast({
            title: "Erro",
            description: "Carrossel precisa de pelo menos 2 cards",
            variant: "destructive",
          });
          return;
        }
        
        // Validar cada card
        for (let i = 0; i < editFormData.carouselCards.length; i++) {
          const card = editFormData.carouselCards[i];
          if (!card.image || !card.title || !card.description) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: Imagem, título e descrição são obrigatórios`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      await updateTemplate(editingTemplate!, {
        name: editFormData.name,
        category: editFormData.category,
        type: editFormData.type,
        content: editFormData.content,
        header: editFormData.header,
        footer: editFormData.footer,
        variables,
        buttons: editFormData.buttons,
        mediaUrl: editFormData.mediaUrl,
        fileName: editFormData.fileName,
        fileType: editFormData.fileType,
        listItems: editFormData.listItems,
        carouselCards: editFormData.carouselCards,
      });

      setEditingTemplate(null);
      setEditFormData({ name: "", category: "", type: "texto", content: "", header: "", footer: "", mediaUrl: "", fileName: "", fileType: "", buttons: [], listItems: [], carouselCards: [] });
    } catch (error) {
      console.error('Error updating template:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setEditFormData({ name: "", category: "", type: "texto", content: "", header: "", footer: "", mediaUrl: "", fileName: "", fileType: "", buttons: [], listItems: [], carouselCards: [] });
  };

  const addButton = useCallback((isEdit = false) => {
    const newButton = {
      id: Date.now().toString(),
      text: "",
      type: 'reply' as 'reply' | 'url' | 'call',
      value: "",
    };
    
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        buttons: [...prev.buttons, newButton]
      }));
    } else {
      setNewTemplate(prev => ({
        ...prev,
        buttons: [...prev.buttons, newButton]
      }));
    }
  }, []);

  const updateButton = useCallback((index: number, field: string, value: string, isEdit = false) => {
    if (isEdit) {
      setEditFormData(prev => {
        const newButtons = [...prev.buttons];
        newButtons[index] = { ...newButtons[index], [field]: value };
        return { ...prev, buttons: newButtons };
      });
    } else {
      setNewTemplate(prev => {
        const newButtons = [...prev.buttons];
        newButtons[index] = { ...newButtons[index], [field]: value };
        return { ...prev, buttons: newButtons };
      });
    }
  }, []);

  const removeButton = useCallback((index: number, isEdit = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        buttons: prev.buttons.filter((_, i) => i !== index)
      }));
    } else {
      setNewTemplate(prev => ({
        ...prev,
        buttons: prev.buttons.filter((_, i) => i !== index)
      }));
    }
  }, []);


  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Modelos de Mensagem</h1>
            <p className="text-muted-foreground">Gerencie e organize seus modelos de mensagem personalizados</p>
          </div>
        </div>
      </div>

      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar modelos por nome, categoria ou conteúdo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {categories.map((categoria) => (
            <Button 
              key={categoria} 
              variant={selectedCategory === categoria ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedCategory(categoria)}
            >
              {categoria}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo Modelo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Criar Novo Modelo
                </DialogTitle>
                <DialogDescription>
                  Configure um novo modelo de mensagem com texto personalizado e botões interativos
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto space-y-4 py-4">
                <div>
                  <Label htmlFor="template-name">Nome do Modelo</Label>
                  <Input
                    id="template-name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Saudação Personalizada"
                  />
                </div>
                <div>
                  <Label htmlFor="template-category">Categoria</Label>
                  <Input
                    id="template-category"
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ex: Vendas, Suporte"
                  />
                </div>

                <div>
                  <Label htmlFor="template-type">Tipo de Template</Label>
                  <Select
                    value={newTemplate.type}
                    onValueChange={(value) => setNewTemplate(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger id="template-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="texto">texto</SelectItem>
                      <SelectItem value="imagem">imagem</SelectItem>
                      <SelectItem value="audio">audio</SelectItem>
                      <SelectItem value="video">video</SelectItem>
                      <SelectItem value="video_botoes">vídeo com botões</SelectItem>
                      <SelectItem value="lista_opcao">lista de opção</SelectItem>
                      <SelectItem value="copia_cola">copia e cola</SelectItem>
                      <SelectItem value="arquivo">arquivo</SelectItem>
                      <SelectItem value="imagem_botoes">imagem com botões</SelectItem>
                      <SelectItem value="documento">documento</SelectItem>
                      <SelectItem value="carrossel">carrossel</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠️ Botões funcionam com "imagem com botões" e "vídeo com botões"
                  </p>
                </div>

                {/* Campos específicos por tipo */}
                {(newTemplate.type === "imagem" || newTemplate.type === "audio" || newTemplate.type === "video" || newTemplate.type === "imagem_botoes" || newTemplate.type === "video_botoes") && (
                  <div className="space-y-3">
                    <div>
                      <Label>Upload de Arquivo</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept={
                              newTemplate.type === "imagem" || newTemplate.type === "imagem_botoes"
                                ? "image/*"
                                : newTemplate.type === "audio"
                                ? "audio/*"
                                : "video/*"
                            }
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, false);
                            }}
                            disabled={uploadingFile}
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Enviando arquivo...
                            </p>
                          )}
                        </div>
                        {newTemplate.mediaUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {newTemplate.mediaUrl && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Arquivo: {newTemplate.fileName}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="template-media-url">Ou cole a URL da Mídia</Label>
                      <Input
                        id="template-media-url"
                        value={newTemplate.mediaUrl}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, mediaUrl: e.target.value }))}
                        placeholder="https://exemplo.com/arquivo.jpg"
                      />
                    </div>
                  </div>
                )}

                {(newTemplate.type === "arquivo" || newTemplate.type === "documento") && (
                  <div className="space-y-3">
                    <div>
                      <Label>Upload de Arquivo</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, false);
                            }}
                            disabled={uploadingFile}
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Enviando arquivo...
                            </p>
                          )}
                        </div>
                        {newTemplate.mediaUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {newTemplate.mediaUrl && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Arquivo: {newTemplate.fileName}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="template-file-url">Ou cole a URL do Arquivo</Label>
                      <Input
                        id="template-file-url"
                        value={newTemplate.mediaUrl}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, mediaUrl: e.target.value }))}
                        placeholder="https://exemplo.com/documento.pdf"
                      />
                    </div>
                    {!newTemplate.fileName && newTemplate.mediaUrl && (
                      <div>
                        <Label htmlFor="template-file-name">Nome do Arquivo</Label>
                        <Input
                          id="template-file-name"
                          value={newTemplate.fileName}
                          onChange={(e) => setNewTemplate(prev => ({ ...prev, fileName: e.target.value }))}
                          placeholder="documento.pdf"
                        />
                      </div>
                    )}
                  </div>
                )}

                {newTemplate.type === "lista_opcao" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Itens da Lista</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewTemplate(prev => ({
                          ...prev,
                          listItems: [...prev.listItems, { id: Date.now().toString(), title: "", description: "" }]
                        }))}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Item
                      </Button>
                    </div>
                    {newTemplate.listItems.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Item {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({
                              ...prev,
                              listItems: prev.listItems.filter((_, i) => i !== index)
                            }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Título do item"
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...newTemplate.listItems];
                            newItems[index] = { ...item, title: e.target.value };
                            setNewTemplate(prev => ({ ...prev, listItems: newItems }));
                          }}
                        />
                        <Input
                          placeholder="Descrição (opcional)"
                          value={item.description || ""}
                          onChange={(e) => {
                            const newItems = [...newTemplate.listItems];
                            newItems[index] = { ...item, description: e.target.value };
                            setNewTemplate(prev => ({ ...prev, listItems: newItems }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Editor de Carrossel */}
                {newTemplate.type === "carrossel" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Cards do Carrossel</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewTemplate(prev => ({
                          ...prev,
                          carouselCards: [...prev.carouselCards, {
                            id: Date.now().toString(),
                            image: "",
                            title: "",
                            description: "",
                            buttons: []
                          }]
                        }))}
                        disabled={newTemplate.carouselCards.length >= 10}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Card
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mínimo 2 cards, máximo 10 cards. Cada card pode ter até 2 botões.
                    </p>
                    {newTemplate.carouselCards.map((card, cardIndex) => (
                      <div key={card.id} className="border-2 rounded-lg p-4 space-y-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Card {cardIndex + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({
                              ...prev,
                              carouselCards: prev.carouselCards.filter((_, i) => i !== cardIndex)
                            }))}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                        
                    <div>
                      <Label>URL da Imagem *</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, false).then(() => {
                                  // A URL já foi atualizada no newTemplate.mediaUrl
                                  // Agora precisamos copiar para o card específico
                                  setTimeout(() => {
                                    const newCards = [...newTemplate.carouselCards];
                                    newCards[cardIndex] = { ...card, image: newTemplate.mediaUrl };
                                    setNewTemplate(prev => ({ 
                                      ...prev, 
                                      carouselCards: newCards,
                                      mediaUrl: "" // Limpar para não interferir
                                    }));
                                  }, 500);
                                });
                              }
                            }}
                            disabled={uploadingFile}
                            className="mb-2"
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mb-1">
                              Enviando imagem...
                            </p>
                          )}
                          <Input
                            placeholder="Ou cole a URL: https://exemplo.com/imagem.jpg"
                            value={card.image}
                            onChange={(e) => {
                              const newCards = [...newTemplate.carouselCards];
                              newCards[cardIndex] = { ...card, image: e.target.value };
                              setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                        </div>
                        {card.image && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newCards = [...newTemplate.carouselCards];
                              newCards[cardIndex] = { ...card, image: "" };
                              setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {card.image && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Imagem configurada
                        </p>
                      )}
                    </div>
                        
                        <div>
                          <Label>Título *</Label>
                          <Input
                            placeholder="Título do card"
                            value={card.title}
                            maxLength={60}
                            onChange={(e) => {
                              const newCards = [...newTemplate.carouselCards];
                              newCards[cardIndex] = { ...card, title: e.target.value };
                              setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                        </div>
                        
                        <div>
                          <Label>Descrição *</Label>
                          <Textarea
                            placeholder="Descrição do card"
                            value={card.description}
                            rows={2}
                            maxLength={160}
                            onChange={(e) => {
                              const newCards = [...newTemplate.carouselCards];
                              newCards[cardIndex] = { ...card, description: e.target.value };
                              setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Botões do Card</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newCards = [...newTemplate.carouselCards];
                                newCards[cardIndex].buttons.push({
                                  id: Date.now().toString(),
                                  text: "",
                                  type: 'url',
                                  value: ""
                                });
                                setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                              }}
                              disabled={card.buttons.length >= 2}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Botão
                            </Button>
                          </div>
                          
                          {card.buttons.map((button, btnIndex) => (
                            <div key={button.id} className="border rounded p-2 space-y-2 bg-background">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Botão {btnIndex + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newCards = [...newTemplate.carouselCards];
                                    newCards[cardIndex].buttons = newCards[cardIndex].buttons.filter((_, i) => i !== btnIndex);
                                    setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              
                              <Input
                                placeholder="Texto do botão"
                                value={button.text}
                                maxLength={20}
                                onChange={(e) => {
                                  const newCards = [...newTemplate.carouselCards];
                                  newCards[cardIndex].buttons[btnIndex].text = e.target.value;
                                  setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                }}
                              />
                              
                              <Select
                                value={button.type}
                                onValueChange={(value: 'reply' | 'url' | 'call') => {
                                  const newCards = [...newTemplate.carouselCards];
                                  newCards[cardIndex].buttons[btnIndex].type = value;
                                  setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="url">Link/URL</SelectItem>
                                  <SelectItem value="call">Ligar</SelectItem>
                                  <SelectItem value="reply">Resposta</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              {(button.type === 'url' || button.type === 'call') && (
                                <Input
                                  placeholder={button.type === 'url' ? "https://..." : "+5511999999999"}
                                  value={button.value || ''}
                                  onChange={(e) => {
                                    const newCards = [...newTemplate.carouselCards];
                                    newCards[cardIndex].buttons[btnIndex].value = e.target.value;
                                    setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {newTemplate.carouselCards.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                        Clique em "Adicionar Card" para criar os cards do carrossel
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="template-header">Título/Cabeçalho da Mensagem (opcional)</Label>
                  <Input
                    id="template-header"
                    value={newTemplate.header}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, header: e.target.value }))}
                    placeholder="Ex: Oferta Especial"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Aparece no topo da mensagem no WhatsApp</p>
                </div>
                
                <div>
                  <Label htmlFor="template-content">Conteúdo do Modelo</Label>
                  <Textarea
                    id="template-content"
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Digite o conteúdo do modelo..."
                    rows={4}
                  />
                </div>
                
                <div>
                  <Label htmlFor="template-footer">Rodapé da Mensagem (opcional)</Label>
                  <Input
                    id="template-footer"
                    value={newTemplate.footer}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, footer: e.target.value }))}
                    placeholder="Ex: Empresa XYZ - www.exemplo.com"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Aparece no final da mensagem no WhatsApp</p>
                </div>

                <ButtonEditor 
                  buttons={newTemplate.buttons} 
                  isEdit={false} 
                  onAddButton={addButton}
                  onUpdateButton={updateButton}
                  onRemoveButton={removeButton}
                />

                <div className="bg-muted/50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium mb-1">Variáveis Disponíveis:</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><code>{"{nome}"}</code> - Nome do contato</div>
                    <div><code>{"{empresa}"}</code> - Nome da empresa</div>
                    <div><code>{"{data}"}</code> - Data atual</div>
                    <div><code>{"{hora}"}</code> - Hora atual</div>
                  </div>
                </div>
              </form>

              <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="button" onClick={handleCreateTemplate} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Modelo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredTemplates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getTemplateIcon(template.type)}
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{template.category}</Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getTypeFriendlyName(template.type)}
                      </Badge>
                      <span>•</span>
                      <span>Usado {template.usage_count} vezes</span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1"
                    onClick={() => handleDuplicateTemplate(template)}
                  >
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Duplicar</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <Edit className="w-4 h-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Excluir</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-3 rounded-lg mb-3 space-y-2">
                {template.header && (
                  <div className="text-xs font-semibold text-primary border-b pb-1">
                    📋 {template.header}
                  </div>
                )}
                {template.mediaUrl && (
                  <div className="text-xs text-muted-foreground mb-2">
                    🔗 Mídia: {template.mediaUrl}
                  </div>
                )}
                {template.fileName && (
                  <div className="text-xs text-muted-foreground mb-2">
                    📄 Arquivo: {template.fileName}
                  </div>
                )}
                {template.listItems && template.listItems.length > 0 && (
                  <div className="text-xs mb-2">
                    <div className="font-medium mb-1">📋 Itens da Lista:</div>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {template.listItems.map((item, idx) => (
                        <li key={idx}>
                          {item.title}
                          {item.description && <span className="text-xs"> - {item.description}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {template.carouselCards && template.carouselCards.length > 0 && (
                  <div className="text-xs mb-2 space-y-2">
                    <div className="font-medium mb-1">🎠 Cards do Carrossel ({template.carouselCards.length}):</div>
                    {template.carouselCards.map((card, idx) => (
                      <div key={idx} className="border rounded p-2 bg-background/50">
                        <div className="font-semibold">Card {idx + 1}: {card.title}</div>
                        <div className="text-muted-foreground mt-1">{card.description}</div>
                        {card.buttons && card.buttons.length > 0 && (
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {card.buttons.map((btn, btnIdx) => (
                              <Badge key={btnIdx} variant="outline" className="text-xs">
                                {btn.text}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm">{template.content}</p>
                {template.footer && (
                  <div className="text-xs text-muted-foreground border-t pt-1">
                    {template.footer}
                  </div>
                )}
              </div>
              
              {/* Ações rápidas */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(template.content)}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copiar Texto
                </Button>
              </div>

              {template.variables && template.variables.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Variáveis utilizadas:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.variables.map((variable, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {`{${variable}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {template.buttons && template.buttons.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Botões configurados:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.buttons.map((button, index) => (
                      <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                        {button.type === 'reply' && <MessageCircle className="w-3 h-3" />}
                        {button.type === 'url' && <Link className="w-3 h-3" />}
                        {button.type === 'call' && <Phone className="w-3 h-3" />}
                        {button.text || 'Botão sem texto'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {filteredTemplates.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {selectedCategory === "Todos" 
                  ? "Nenhum modelo encontrado. Crie seu primeiro modelo!" 
                  : `Nenhum modelo encontrado na categoria "${selectedCategory}".`
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Edição */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => {
        if (!open) handleCancelEdit();
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Editar Modelo
            </DialogTitle>
            <DialogDescription>
              Modifique as configurações do modelo de mensagem
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto space-y-4 py-4">
            <div>
              <Label htmlFor="edit-template-name">Nome do Modelo</Label>
              <Input
                id="edit-template-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Saudação Personalizada"
              />
            </div>
            <div>
              <Label htmlFor="edit-template-category">Categoria</Label>
              <Input
                id="edit-template-category"
                value={editFormData.category}
                onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: Vendas, Suporte"
              />
            </div>

            <div>
              <Label htmlFor="edit-template-type">Tipo de Template</Label>
              <Select
                value={editFormData.type}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="edit-template-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="texto">texto</SelectItem>
                  <SelectItem value="imagem">imagem</SelectItem>
                  <SelectItem value="audio">audio</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="video_botoes">vídeo com botões</SelectItem>
                  <SelectItem value="lista_opcao">lista de opção</SelectItem>
                  <SelectItem value="copia_cola">copia e cola</SelectItem>
                  <SelectItem value="arquivo">arquivo</SelectItem>
                  <SelectItem value="imagem_botoes">imagem com botões</SelectItem>
                  <SelectItem value="documento">documento</SelectItem>
                  <SelectItem value="carrossel">carrossel</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                ⚠️ Botões funcionam com "imagem com botões" e "vídeo com botões"
              </p>
            </div>

            {/* Campos específicos por tipo - Edição */}
            {(editFormData.type === "imagem" || editFormData.type === "audio" || editFormData.type === "video" || editFormData.type === "imagem_botoes" || editFormData.type === "video_botoes") && (
              <div className="space-y-3">
                <div>
                  <Label>Upload de Arquivo</Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept={
                          editFormData.type === "imagem" || editFormData.type === "imagem_botoes"
                            ? "image/*"
                            : editFormData.type === "audio"
                            ? "audio/*"
                            : "video/*"
                        }
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, true);
                        }}
                        disabled={uploadingFile}
                      />
                      {uploadingFile && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviando arquivo...
                        </p>
                      )}
                    </div>
                    {editFormData.mediaUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {editFormData.mediaUrl && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Arquivo: {editFormData.fileName}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="edit-template-media-url">Ou cole a URL da Mídia</Label>
                  <Input
                    id="edit-template-media-url"
                    value={editFormData.mediaUrl}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, mediaUrl: e.target.value }))}
                    placeholder="https://exemplo.com/arquivo.jpg"
                  />
                </div>
              </div>
            )}

            {(editFormData.type === "arquivo" || editFormData.type === "documento") && (
              <div className="space-y-3">
                <div>
                  <Label>Upload de Arquivo</Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, true);
                        }}
                        disabled={uploadingFile}
                      />
                      {uploadingFile && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviando arquivo...
                        </p>
                      )}
                    </div>
                    {editFormData.mediaUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {editFormData.mediaUrl && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Arquivo: {editFormData.fileName}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="edit-template-file-url">Ou cole a URL do Arquivo</Label>
                  <Input
                    id="edit-template-file-url"
                    value={editFormData.mediaUrl}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, mediaUrl: e.target.value }))}
                    placeholder="https://exemplo.com/documento.pdf"
                  />
                </div>
                {!editFormData.fileName && editFormData.mediaUrl && (
                  <div>
                    <Label htmlFor="edit-template-file-name">Nome do Arquivo</Label>
                    <Input
                      id="edit-template-file-name"
                      value={editFormData.fileName}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, fileName: e.target.value }))}
                      placeholder="documento.pdf"
                    />
                  </div>
                )}
              </div>
            )}

            {editFormData.type === "lista_opcao" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Itens da Lista</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditFormData(prev => ({
                      ...prev,
                      listItems: [...prev.listItems, { id: Date.now().toString(), title: "", description: "" }]
                    }))}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>
                {editFormData.listItems.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({
                          ...prev,
                          listItems: prev.listItems.filter((_, i) => i !== index)
                        }))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Título do item"
                      value={item.title}
                      onChange={(e) => {
                        const newItems = [...editFormData.listItems];
                        newItems[index] = { ...item, title: e.target.value };
                        setEditFormData(prev => ({ ...prev, listItems: newItems }));
                      }}
                    />
                    <Input
                      placeholder="Descrição (opcional)"
                      value={item.description || ""}
                      onChange={(e) => {
                        const newItems = [...editFormData.listItems];
                        newItems[index] = { ...item, description: e.target.value };
                        setEditFormData(prev => ({ ...prev, listItems: newItems }));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Editor de Carrossel - Edição */}
            {editFormData.type === "carrossel" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Cards do Carrossel</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditFormData(prev => ({
                      ...prev,
                      carouselCards: [...prev.carouselCards, {
                        id: Date.now().toString(),
                        image: "",
                        title: "",
                        description: "",
                        buttons: []
                      }]
                    }))}
                    disabled={editFormData.carouselCards.length >= 10}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Card
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 2 cards, máximo 10 cards. Cada card pode ter até 2 botões.
                </p>
                {editFormData.carouselCards.map((card, cardIndex) => (
                  <div key={card.id} className="border-2 rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Card {cardIndex + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({
                          ...prev,
                          carouselCards: prev.carouselCards.filter((_, i) => i !== cardIndex)
                        }))}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                    
                    <div>
                      <Label>URL da Imagem *</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, true).then(() => {
                                  // A URL já foi atualizada no editFormData.mediaUrl
                                  // Agora precisamos copiar para o card específico
                                  setTimeout(() => {
                                    const newCards = [...editFormData.carouselCards];
                                    newCards[cardIndex] = { ...card, image: editFormData.mediaUrl };
                                    setEditFormData(prev => ({ 
                                      ...prev, 
                                      carouselCards: newCards,
                                      mediaUrl: "" // Limpar para não interferir
                                    }));
                                  }, 500);
                                });
                              }
                            }}
                            disabled={uploadingFile}
                            className="mb-2"
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mb-1">
                              Enviando imagem...
                            </p>
                          )}
                          <Input
                            placeholder="Ou cole a URL: https://exemplo.com/imagem.jpg"
                            value={card.image}
                            onChange={(e) => {
                              const newCards = [...editFormData.carouselCards];
                              newCards[cardIndex] = { ...card, image: e.target.value };
                              setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                        </div>
                        {card.image && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newCards = [...editFormData.carouselCards];
                              newCards[cardIndex] = { ...card, image: "" };
                              setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {card.image && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Imagem configurada
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label>Título *</Label>
                      <Input
                        placeholder="Título do card"
                        value={card.title}
                        maxLength={60}
                        onChange={(e) => {
                          const newCards = [...editFormData.carouselCards];
                          newCards[cardIndex] = { ...card, title: e.target.value };
                          setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                        }}
                      />
                    </div>
                    
                    <div>
                      <Label>Descrição *</Label>
                      <Textarea
                        placeholder="Descrição do card"
                        value={card.description}
                        rows={2}
                        maxLength={160}
                        onChange={(e) => {
                          const newCards = [...editFormData.carouselCards];
                          newCards[cardIndex] = { ...card, description: e.target.value };
                          setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Botões do Card</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newCards = [...editFormData.carouselCards];
                            newCards[cardIndex].buttons.push({
                              id: Date.now().toString(),
                              text: "",
                              type: 'url',
                              value: ""
                            });
                            setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                          }}
                          disabled={card.buttons.length >= 2}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Botão
                        </Button>
                      </div>
                      
                      {card.buttons.map((button, btnIndex) => (
                        <div key={button.id} className="border rounded p-2 space-y-2 bg-background">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Botão {btnIndex + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newCards = [...editFormData.carouselCards];
                                newCards[cardIndex].buttons = newCards[cardIndex].buttons.filter((_, i) => i !== btnIndex);
                                setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          <Input
                            placeholder="Texto do botão"
                            value={button.text}
                            maxLength={20}
                            onChange={(e) => {
                              const newCards = [...editFormData.carouselCards];
                              newCards[cardIndex].buttons[btnIndex].text = e.target.value;
                              setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                          
                          <Select
                            value={button.type}
                            onValueChange={(value: 'reply' | 'url' | 'call') => {
                              const newCards = [...editFormData.carouselCards];
                              newCards[cardIndex].buttons[btnIndex].type = value;
                              setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="url">Link/URL</SelectItem>
                              <SelectItem value="call">Ligar</SelectItem>
                              <SelectItem value="reply">Resposta</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {(button.type === 'url' || button.type === 'call') && (
                            <Input
                              placeholder={button.type === 'url' ? "https://..." : "+5511999999999"}
                              value={button.value || ''}
                              onChange={(e) => {
                                const newCards = [...editFormData.carouselCards];
                                newCards[cardIndex].buttons[btnIndex].value = e.target.value;
                                setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {editFormData.carouselCards.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Clique em "Adicionar Card" para criar os cards do carrossel
                  </div>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="edit-template-header">Título/Cabeçalho da Mensagem (opcional)</Label>
              <Input
                id="edit-template-header"
                value={editFormData.header}
                onChange={(e) => setEditFormData(prev => ({ ...prev, header: e.target.value }))}
                placeholder="Ex: Oferta Especial"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">Aparece no topo da mensagem no WhatsApp</p>
            </div>
            
            <div>
              <Label htmlFor="edit-template-content">Conteúdo do Modelo</Label>
              <Textarea
                id="edit-template-content"
                value={editFormData.content}
                onChange={(e) => setEditFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o conteúdo do modelo..."
                rows={4}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-template-footer">Rodapé da Mensagem (opcional)</Label>
              <Input
                id="edit-template-footer"
                value={editFormData.footer}
                onChange={(e) => setEditFormData(prev => ({ ...prev, footer: e.target.value }))}
                placeholder="Ex: Empresa XYZ - www.exemplo.com"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">Aparece no final da mensagem no WhatsApp</p>
            </div>

                          <ButtonEditor 
                            buttons={editFormData.buttons} 
                            isEdit={true} 
                            onAddButton={addButton}
                            onUpdateButton={updateButton}
                            onRemoveButton={removeButton}
                          />

            <div className="bg-muted/50 p-3 rounded-lg">
              <h4 className="text-sm font-medium mb-1">Variáveis Disponíveis:</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div><code>{"{nome}"}</code> - Nome do contato</div>
                <div><code>{"{empresa}"}</code> - Nome da empresa</div>
                <div><code>{"{data}"}</code> - Data atual</div>
                <div><code>{"{hora}"}</code> - Hora atual</div>
              </div>
            </div>
          </form>
          
          <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancelEdit} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="button" onClick={handleUpdateTemplate} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Modelos;