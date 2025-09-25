import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Copy, Edit, Trash2, Save, Send, Users } from "lucide-react";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";

const Modelos = () => {
  const { templates, loading, createTemplate, deleteTemplate, duplicateTemplate } = useMessageTemplates();
  const { createCampaign } = useCampaigns();
  const { toast } = useToast();
  
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "",
    content: "",
    variables: [] as string[],
  });
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState({
    name: "",
    description: "",
    template_id: "",
    contacts: "",
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);

  const categories = ["Todos", ...new Set(templates.map(t => t.category))];
  const filteredTemplates = selectedCategory === "Todos" 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

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

      await createTemplate({
        name: newTemplate.name,
        category: newTemplate.category,
        content: newTemplate.content,
        variables,
      });

      setNewTemplate({ name: "", category: "", content: "", variables: [] });
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

  const handleCreateCampaign = async () => {
    if (!campaignData.name || !campaignData.template_id) {
      toast({
        title: "Erro",
        description: "Nome da campanha e modelo são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      // Parse contacts (simple format: phone numbers separated by commas)
      const contacts = campaignData.contacts
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(phone => ({ phone, name: `Cliente` }));

      const campaign = await createCampaign({
        name: campaignData.name,
        description: campaignData.description,
        template_id: campaignData.template_id,
        target_audience: { contacts },
      });

      setCampaignData({ name: "", description: "", template_id: "", contacts: "" });
      setShowCampaignDialog(false);

      toast({
        title: "Sucesso",
        description: "Campanha criada! Você pode gerenciá-la na seção de Campanhas",
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Modelos de Mensagem</h1>
        <p className="text-muted-foreground">Gerencie e organize seus modelos de mensagem</p>
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
          <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Nova Campanha</DialogTitle>
                <DialogDescription>
                  Crie uma campanha usando um modelo de mensagem
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="campaign-name">Nome da Campanha</Label>
                  <Input
                    id="campaign-name"
                    value={campaignData.name}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Promoção Black Friday"
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-template">Modelo</Label>
                  <Select
                    value={campaignData.template_id}
                    onValueChange={(value) => setCampaignData(prev => ({ ...prev, template_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="campaign-description">Descrição (opcional)</Label>
                  <Textarea
                    id="campaign-description"
                    value={campaignData.description}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva o objetivo da campanha"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-contacts">Lista de Contatos</Label>
                  <Textarea
                    id="campaign-contacts"
                    value={campaignData.contacts}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, contacts: e.target.value }))}
                    placeholder="Digite os números (um por linha)&#10;5511999999999&#10;5511888888888"
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCampaign}>
                  Criar Campanha
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo Modelo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Modelo</DialogTitle>
                <DialogDescription>
                  Adicione um novo modelo de mensagem
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
                  <Label htmlFor="template-content">Conteúdo do Modelo</Label>
                  <Textarea
                    id="template-content"
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Digite o conteúdo do modelo..."
                    rows={4}
                  />
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium mb-1">Variáveis Disponíveis:</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><code>{"{nome}"}</code> - Nome do contato</div>
                    <div><code>{"{empresa}"}</code> - Nome da empresa</div>
                    <div><code>{"{data}"}</code> - Data atual</div>
                    <div><code>{"{hora}"}</code> - Hora atual</div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTemplate}>
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
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{template.category}</Badge>
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
                    Duplicar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingTemplate(template.id)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm">{template.content}</p>
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

    </div>
  );
};

export default Modelos;