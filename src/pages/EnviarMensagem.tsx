import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, User, FileText, Image, Plus, Trash2, MessageSquare, List, MousePointer } from "lucide-react";
import { useZapi } from "@/hooks/useZapi";
import { z } from "zod";

const messageSchema = z.object({
  phone: z.string()
    .min(10, "Número deve ter pelo menos 10 dígitos")
    .max(15, "Número deve ter no máximo 15 dígitos")
    .regex(/^\d+$/, "Número deve conter apenas dígitos"),
  message: z.string()
    .min(1, "Mensagem não pode estar vazia")
    .max(4096, "Mensagem deve ter no máximo 4096 caracteres")
});

const EnviarMensagem = () => {
  const [mensagem, setMensagem] = useState("");
  const [contatos, setContatos] = useState("");
  const [numero, setNumero] = useState("");
  const [titulo, setTitulo] = useState("");
  const [rodape, setRodape] = useState("");
  const [errors, setErrors] = useState<{phone?: string, message?: string}>({});
  
  // Estados para botões simples
  const [botoes, setBotoes] = useState([{id: "1", label: ""}]);
  
  // Estados para botões de ação
  const [botoesAcao, setBotoesAcao] = useState([{id: "1", type: "REPLY" as "CALL" | "URL" | "REPLY", label: "", phone: "", url: ""}]);
  
  // Estados para lista de opções
  const [tituloLista, setTituloLista] = useState("");
  const [labelBotaoLista, setLabelBotaoLista] = useState("Ver opções");
  const [opcoes, setOpcoes] = useState([{id: "1", title: "", description: ""}]);
  
  const { sendMessage, sendButtonList, sendButtonActions, sendOptionList, loading } = useZapi();

  const handleSendIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});
      
      await sendMessage(validatedData.phone, validatedData.message);
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleSendButtonList = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});
      
      const validButtons = botoes.filter(btn => btn.label.trim() !== "");
      if (validButtons.length === 0) {
        throw new Error("Adicione pelo menos um botão com texto");
      }
      
      await sendButtonList(validatedData.phone, validatedData.message, validButtons);
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
      setBotoes([{id: "1", label: ""}]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleSendButtonActions = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});
      
      const validButtons = botoesAcao.filter(btn => {
        if (btn.label.trim() === "") return false;
        if (btn.type === "CALL" && btn.phone.trim() === "") return false;
        if (btn.type === "URL" && btn.url.trim() === "") return false;
        return true;
      });
      
      if (validButtons.length === 0) {
        throw new Error("Adicione pelo menos um botão válido");
      }
      
      await sendButtonActions(
        validatedData.phone, 
        validatedData.message, 
        validButtons.map(btn => ({
          id: btn.id,
          type: btn.type,
          label: btn.label,
          ...(btn.type === "CALL" && { phone: btn.phone }),
          ...(btn.type === "URL" && { url: btn.url })
        })),
        titulo || undefined,
        rodape || undefined
      );
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
      setTitulo("");
      setRodape("");
      setBotoesAcao([{id: "1", type: "REPLY", label: "", phone: "", url: ""}]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleSendOptionList = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});
      
      const validOptions = opcoes.filter(opt => opt.title.trim() !== "" && opt.description.trim() !== "");
      if (validOptions.length === 0) {
        throw new Error("Adicione pelo menos uma opção válida");
      }
      
      if (!tituloLista.trim()) {
        throw new Error("Título da lista é obrigatório");
      }
      
      await sendOptionList(validatedData.phone, validatedData.message, {
        title: tituloLista,
        buttonLabel: labelBotaoLista,
        options: validOptions
      });
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
      setTituloLista("");
      setLabelBotaoLista("Ver opções");
      setOpcoes([{id: "1", title: "", description: ""}]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const addButton = () => {
    setBotoes([...botoes, {id: (botoes.length + 1).toString(), label: ""}]);
  };

  const removeButton = (index: number) => {
    if (botoes.length > 1) {
      setBotoes(botoes.filter((_, i) => i !== index));
    }
  };

  const updateButton = (index: number, field: string, value: string) => {
    const newBotoes = [...botoes];
    newBotoes[index] = {...newBotoes[index], [field]: value};
    setBotoes(newBotoes);
  };

  const addActionButton = () => {
    setBotoesAcao([...botoesAcao, {id: (botoesAcao.length + 1).toString(), type: "REPLY", label: "", phone: "", url: ""}]);
  };

  const removeActionButton = (index: number) => {
    if (botoesAcao.length > 1) {
      setBotoesAcao(botoesAcao.filter((_, i) => i !== index));
    }
  };

  const updateActionButton = (index: number, field: string, value: string) => {
    const newBotoes = [...botoesAcao];
    newBotoes[index] = {...newBotoes[index], [field]: value};
    setBotoesAcao(newBotoes);
  };

  const addOption = () => {
    setOpcoes([...opcoes, {id: (opcoes.length + 1).toString(), title: "", description: ""}]);
  };

  const removeOption = (index: number) => {
    if (opcoes.length > 1) {
      setOpcoes(opcoes.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: string, value: string) => {
    const newOpcoes = [...opcoes];
    newOpcoes[index] = {...newOpcoes[index], [field]: value};
    setOpcoes(newOpcoes);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enviar Mensagem</h1>
        <p className="text-muted-foreground">Envie mensagens texto, com botões, listas de opções e mais</p>
      </div>

      <Tabs defaultValue="individual" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Texto
          </TabsTrigger>
          <TabsTrigger value="botoes" className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            Botões
          </TabsTrigger>
          <TabsTrigger value="acoes" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Ações
          </TabsTrigger>
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="massa" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Em Massa
          </TabsTrigger>
        </TabsList>

        {/* Mensagem de Texto Simples */}
        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagem de Texto</CardTitle>
              <CardDescription>Envie uma mensagem de texto simples</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendIndividual}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="numero">Número do WhatsApp</Label>
                    <Input 
                      id="numero" 
                      type="tel"
                      placeholder="5511999999999"
                      className={`mt-1 ${errors.phone ? "border-destructive" : ""}`}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Digite apenas números (ex: 5511999999999)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="mensagem-individual">Mensagem</Label>
                    <Textarea 
                      id="mensagem-individual"
                      placeholder="Digite sua mensagem aqui..."
                      className={`mt-1 min-h-[120px] ${errors.message ? "border-destructive" : ""}`}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {mensagem.length}/4096 caracteres
                    </p>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar Mensagem
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mensagem com Botões Simples */}
        <TabsContent value="botoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagem com Botões</CardTitle>
              <CardDescription>Envie mensagem com botões de resposta rápida</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendButtonList}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="numero-botoes">Número do WhatsApp</Label>
                    <Input 
                      id="numero-botoes" 
                      type="tel"
                      placeholder="5511999999999"
                      className={`mt-1 ${errors.phone ? "border-destructive" : ""}`}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="mensagem-botoes">Mensagem</Label>
                    <Textarea 
                      id="mensagem-botoes"
                      placeholder="Digite sua pergunta aqui..."
                      className={`mt-1 min-h-[120px] ${errors.message ? "border-destructive" : ""}`}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label>Botões de Resposta</Label>
                    <div className="space-y-2 mt-2">
                      {botoes.map((botao, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder={`Botão ${index + 1}`}
                            value={botao.label}
                            onChange={(e) => updateButton(index, 'label', e.target.value)}
                          />
                          {botoes.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeButton(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addButton}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Botão
                      </Button>
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <MousePointer className="w-4 h-4" />
                        Enviar com Botões
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mensagem com Botões de Ação */}
        <TabsContent value="acoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagem com Botões de Ação</CardTitle>
              <CardDescription>Envie mensagem com botões para ligar, abrir links ou responder</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendButtonActions}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="numero-acoes">Número do WhatsApp</Label>
                    <Input 
                      id="numero-acoes" 
                      type="tel"
                      placeholder="5511999999999"
                      className={`mt-1 ${errors.phone ? "border-destructive" : ""}`}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="titulo">Título (opcional)</Label>
                    <Input 
                      id="titulo" 
                      placeholder="Título da mensagem"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="mensagem-acoes">Mensagem</Label>
                    <Textarea 
                      id="mensagem-acoes"
                      placeholder="Digite sua mensagem aqui..."
                      className={`mt-1 min-h-[120px] ${errors.message ? "border-destructive" : ""}`}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="rodape">Rodapé (opcional)</Label>
                    <Input 
                      id="rodape" 
                      placeholder="Texto do rodapé"
                      value={rodape}
                      onChange={(e) => setRodape(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Botões de Ação</Label>
                    <div className="space-y-4 mt-2">
                      {botoesAcao.map((botao, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex gap-2 items-center">
                            <Select
                              value={botao.type}
                              onValueChange={(value: "CALL" | "URL" | "REPLY") => updateActionButton(index, 'type', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="REPLY">Resposta</SelectItem>
                                <SelectItem value="CALL">Ligar</SelectItem>
                                <SelectItem value="URL">Link</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Texto do botão"
                              value={botao.label}
                              onChange={(e) => updateActionButton(index, 'label', e.target.value)}
                            />
                            {botoesAcao.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeActionButton(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          {botao.type === "CALL" && (
                            <Input
                              placeholder="Número para ligar (ex: 5511999999999)"
                              value={botao.phone}
                              onChange={(e) => updateActionButton(index, 'phone', e.target.value.replace(/\D/g, ''))}
                            />
                          )}
                          
                          {botao.type === "URL" && (
                            <Input
                              placeholder="URL (ex: https://example.com)"
                              value={botao.url}
                              onChange={(e) => updateActionButton(index, 'url', e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addActionButton}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Botão
                      </Button>
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar com Botões de Ação
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lista de Opções */}
        <TabsContent value="lista" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Opções</CardTitle>
              <CardDescription>Envie uma lista de opções para o usuário escolher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendOptionList}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="numero-lista">Número do WhatsApp</Label>
                    <Input 
                      id="numero-lista" 
                      type="tel"
                      placeholder="5511999999999"
                      className={`mt-1 ${errors.phone ? "border-destructive" : ""}`}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="mensagem-lista">Mensagem</Label>
                    <Textarea 
                      id="mensagem-lista"
                      placeholder="Digite sua mensagem aqui..."
                      className={`mt-1 min-h-[120px] ${errors.message ? "border-destructive" : ""}`}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="titulo-lista">Título da Lista</Label>
                    <Input 
                      id="titulo-lista" 
                      placeholder="Opções disponíveis"
                      value={tituloLista}
                      onChange={(e) => setTituloLista(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="label-botao">Texto do Botão</Label>
                    <Input 
                      id="label-botao" 
                      placeholder="Ver opções"
                      value={labelBotaoLista}
                      onChange={(e) => setLabelBotaoLista(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Opções da Lista</Label>
                    <div className="space-y-3 mt-2">
                      {opcoes.map((opcao, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex gap-2 items-center">
                            <Input
                              placeholder="Título da opção"
                              value={opcao.title}
                              onChange={(e) => updateOption(index, 'title', e.target.value)}
                            />
                            {opcoes.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeOption(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <Input
                            placeholder="Descrição da opção"
                            value={opcao.description}
                            onChange={(e) => updateOption(index, 'description', e.target.value)}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addOption}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Opção
                      </Button>
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <List className="w-4 h-4" />
                        Enviar Lista de Opções
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Envio em Massa - mantido como estava */}
        <TabsContent value="massa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Envio em Massa</CardTitle>
              <CardDescription>Envie mensagens para múltiplos contatos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contatos-massa">Lista de Contatos</Label>
                <Textarea 
                  id="contatos-massa"
                  placeholder="Digite os números separados por vírgula ou quebra de linha
+55 11 99999-9999
+55 11 88888-8888
+55 11 77777-7777"
                  className="mt-1 min-h-[120px]"
                  value={contatos}
                  onChange={(e) => setContatos(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mensagem-massa">Mensagem</Label>
                <Textarea 
                  id="mensagem-massa"
                  placeholder="Digite sua mensagem aqui..."
                  className="mt-1 min-h-[120px]"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Importar Lista
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Usar Modelo
                </Button>
              </div>
              <Button className="w-full flex items-center gap-2">
                <Send className="w-4 h-4" />
                Enviar para Todos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnviarMensagem;