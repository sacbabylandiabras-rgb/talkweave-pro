import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, User, FileText, Image, Plus, Trash2, MessageSquare, List, MousePointer, Upload, Video, FileAudio, Paperclip } from "lucide-react";
import { useZapi } from "@/hooks/useZapi";
import { useToast } from "@/hooks/use-toast";
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
  
  // Estados para botões de ação 
  const [botoesAcao, setBotoesAcao] = useState([{id: "1", type: "REPLY" as "CALL" | "URL" | "REPLY" | "OPTION" | "COPY", label: "", phone: "", url: "", copyText: ""}]);
  
  // Estados para lista de opções
  const [tituloLista, setTituloLista] = useState("");
  const [labelBotaoLista, setLabelBotaoLista] = useState("Ver opções");
  const [opcoes, setOpcoes] = useState([{id: "1", title: "", description: ""}]);
  
  // Estados para mídia e modelos
  const [arquivoMidia, setArquivoMidia] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [modeloSelecionado, setModeloSelecionado] = useState("");
  
  const { sendMessage, sendButtonActions, sendOptionList, sendImage, sendDocument, loading } = useZapi();
  const { toast } = useToast();
  
  // Modelos pré-definidos (vem da página Modelos)
  const modelosDisponiveis = [
    {
      id: 1,
      nome: "Saudação Comercial",
      categoria: "Saudação",
      conteudo: "Olá! Obrigado por entrar em contato conosco. Como podemos ajudá-lo hoje?"
    },
    {
      id: 2,
      nome: "Informações de Produto",
      categoria: "Vendas", 
      conteudo: "Nosso produto oferece as seguintes funcionalidades: {lista_funcionalidades}. Gostaria de saber mais detalhes?"
    },
    {
      id: 3,
      nome: "Agendamento",
      categoria: "Atendimento",
      conteudo: "Para agendar uma reunião, por favor nos informe sua disponibilidade. Nossos horários são de segunda a sexta, das 9h às 17h."
    },
    {
      id: 4,
      nome: "Suporte Técnico", 
      categoria: "Suporte",
      conteudo: "Recebemos sua solicitação de suporte. Nossa equipe técnica entrará em contato em até 24 horas."
    }
  ];

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

  const handleSendButtonActions = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});
      
      const validButtons = botoesAcao.filter(btn => {
        if (btn.label.trim() === "") return false;
        if (btn.type === "CALL" && btn.phone.trim() === "") return false;
        if (btn.type === "URL" && btn.url.trim() === "") return false;
        if (btn.type === "COPY" && btn.copyText.trim() === "") return false;
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
          ...(btn.type === "URL" && { url: btn.url }),
          ...(btn.type === "COPY" && { copyText: btn.copyText })
        })),
        titulo || undefined,
        rodape || undefined
      );
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
      setTitulo("");
      setRodape("");
      setBotoesAcao([{id: "1", type: "REPLY", label: "", phone: "", url: "", copyText: ""}]);
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

  const addActionButton = () => {
    setBotoesAcao([...botoesAcao, {id: (botoesAcao.length + 1).toString(), type: "REPLY", label: "", phone: "", url: "", copyText: ""}]);
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

  // Função para converter arquivo para base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Função para enviar mensagem com mídia
  const handleSendWithMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!arquivoMidia) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Selecione um arquivo para enviar",
        variant: "destructive"
      });
      return;
    }

    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});

      const base64File = await convertToBase64(arquivoMidia);
      const fileExtension = arquivoMidia.name.split('.').pop()?.toLowerCase();
      
      // Verificar se é imagem ou documento
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const isImage = imageExtensions.includes(fileExtension || '');

      if (isImage) {
        await sendImage(validatedData.phone, base64File, legenda || mensagem);
      } else {
        await sendDocument(
          validatedData.phone,
          base64File,
          arquivoMidia.name,
          fileExtension || 'txt',
          legenda || mensagem
        );
      }

      // Limpar formulário
      setNumero("");
      setMensagem("");
      setLegenda("");
      setArquivoMidia(null);
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

  // Função para aplicar modelo
  const aplicarModelo = (modeloId: string) => {
    const modelo = modelosDisponiveis.find(m => m.id.toString() === modeloId);
    if (modelo) {
      setMensagem(modelo.conteudo);
      toast({
        title: "Modelo aplicado!",
        description: `Modelo "${modelo.nome}" foi aplicado à mensagem`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enviar Mensagem</h1>
        <p className="text-muted-foreground">Envie mensagens texto, com botões, listas de opções e mais</p>
      </div>

      <Tabs defaultValue="individual" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Texto
          </TabsTrigger>
          <TabsTrigger value="botoes" className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            Botões Interativos
          </TabsTrigger>
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Lista de Opções
          </TabsTrigger>
          <TabsTrigger value="massa" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Envio em Massa
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
                  
                  {/* Seção de Mídia e Modelos */}
                  <div className="border-t pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Anexar Mídia */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Paperclip className="w-4 h-4" />
                          Anexar Mídia
                        </h4>
                        <div className="space-y-3">
                          <Input
                            type="file"
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 64 * 1024 * 1024) { // 64MB limit
                                  toast({
                                    title: "Arquivo muito grande",
                                    description: "O arquivo deve ter no máximo 64MB",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                setArquivoMidia(file);
                              }
                            }}
                            className="text-sm"
                          />
                          {arquivoMidia && (
                            <div className="bg-muted p-2 rounded text-sm">
                              <p className="font-medium">{arquivoMidia.name}</p>
                              <p className="text-muted-foreground">
                                {(arquivoMidia.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          )}
                          <Input
                            placeholder="Legenda da mídia (opcional)"
                            value={legenda}
                            onChange={(e) => setLegenda(e.target.value)}
                          />
                          {arquivoMidia && (
                            <Button
                              type="button"
                              onClick={handleSendWithMedia}
                              disabled={loading}
                              className="w-full flex items-center gap-2"
                              variant="outline"
                            >
                              {loading ? (
                                <>Enviando...</>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  Enviar com Mídia
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </Card>

                      {/* Usar Modelo */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Usar Modelo
                        </h4>
                        <div className="space-y-3">
                          <Select value={modeloSelecionado} onValueChange={setModeloSelecionado}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um modelo" />
                            </SelectTrigger>
                            <SelectContent>
                              {modelosDisponiveis.map((modelo) => (
                                <SelectItem key={modelo.id} value={modelo.id.toString()}>
                                  <div>
                                    <p className="font-medium">{modelo.nome}</p>
                                    <p className="text-xs text-muted-foreground">{modelo.categoria}</p>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {modeloSelecionado && (
                            <div className="bg-muted p-3 rounded text-sm">
                              <p className="font-medium mb-1">Preview:</p>
                              <p className="text-muted-foreground">
                                {modelosDisponiveis.find(m => m.id.toString() === modeloSelecionado)?.conteudo}
                              </p>
                            </div>
                          )}
                          <Button
                            type="button"
                            onClick={() => modeloSelecionado && aplicarModelo(modeloSelecionado)}
                            disabled={!modeloSelecionado}
                            variant="outline"
                            className="w-full"
                          >
                            Aplicar Modelo
                          </Button>
                        </div>
                      </Card>
                    </div>
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

        {/* Botões Interativos Completos */}
        <TabsContent value="botoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagem com Botões Interativos</CardTitle>
              <CardDescription>Envie mensagem com botões para responder, ligar, abrir links + título e rodapé</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendButtonActions}>
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
                    <Label htmlFor="titulo-botoes">Título (opcional)</Label>
                    <Input 
                      id="titulo-botoes" 
                      placeholder="Título da mensagem"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="mensagem-botoes">Mensagem</Label>
                    <Textarea 
                      id="mensagem-botoes"
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
                    <Label htmlFor="rodape-botoes">Rodapé (opcional)</Label>
                    <Input 
                      id="rodape-botoes" 
                      placeholder="Texto do rodapé"
                      value={rodape}
                      onChange={(e) => setRodape(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Botões Interativos</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Configure botões para resposta rápida, fazer ligações ou abrir links
                    </p>
                    <div className="space-y-4 mt-2">
                      {botoesAcao.map((botao, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                          <div className="flex gap-2 items-center">
                            <Select
                              value={botao.type}
                              onValueChange={(value: "CALL" | "URL" | "REPLY" | "OPTION" | "COPY") => updateActionButton(index, 'type', value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="REPLY">📋 Resposta Rápida</SelectItem>
                                <SelectItem value="URL">🌐 Abrir Link</SelectItem>
                                <SelectItem value="CALL">📞 Ligar</SelectItem>
                                <SelectItem value="OPTION">📝 Opção</SelectItem>
                                <SelectItem value="COPY">📄 Copiar Texto</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Texto do botão"
                              value={botao.label}
                              onChange={(e) => updateActionButton(index, 'label', e.target.value)}
                              className="flex-1"
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
                            <div>
                              <Label className="text-sm text-muted-foreground">Número para ligação</Label>
                              <Input
                                placeholder="5511999999999"
                                value={botao.phone}
                                onChange={(e) => updateActionButton(index, 'phone', e.target.value.replace(/\D/g, ''))}
                                className="mt-1"
                              />
                            </div>
                          )}
                          
                          {botao.type === "URL" && (
                            <div>
                              <Label className="text-sm text-muted-foreground">Link de destino</Label>
                              <Input
                                placeholder="https://example.com"
                                value={botao.url}
                                onChange={(e) => updateActionButton(index, 'url', e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          )}

                          {botao.type === "COPY" && (
                            <div>
                              <Label className="text-sm text-muted-foreground">Texto para copiar</Label>
                              <Input
                                placeholder="Código ou texto a ser copiado"
                                value={botao.copyText}
                                onChange={(e) => updateActionButton(index, 'copyText', e.target.value)}
                                className="mt-1"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                💡 Este texto será copiado automaticamente quando o usuário clicar no botão
                              </p>
                            </div>
                          )}

                          {botao.type === "REPLY" && (
                            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                💡 <strong>Botão de Resposta Rápida:</strong> O texto do botão acima será enviado automaticamente como resposta quando o usuário clicar nele.
                              </p>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Exemplo: Se o botão diz "Falar com Suporte", essa será a mensagem enviada.
                              </p>
                            </div>
                          )}

                          {botao.type === "OPTION" && (
                            <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                              💡 Este botão funcionará como uma opção de escolha rápida
                            </p>
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
                  
                  {/* Seção de Mídia e Modelos para Botões */}
                  <div className="border-t pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Anexar Mídia */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Paperclip className="w-4 h-4" />
                          Anexar Mídia
                        </h4>
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          <Upload className="w-4 h-4 mr-2" />
                          Em breve: Botões + Mídia
                        </Button>
                      </Card>

                      {/* Usar Modelo */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Usar Modelo
                        </h4>
                        <div className="space-y-3">
                          <Select value={modeloSelecionado} onValueChange={setModeloSelecionado}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um modelo" />
                            </SelectTrigger>
                            <SelectContent>
                              {modelosDisponiveis.map((modelo) => (
                                <SelectItem key={modelo.id} value={modelo.id.toString()}>
                                  <div>
                                    <p className="font-medium">{modelo.nome}</p>
                                    <p className="text-xs text-muted-foreground">{modelo.categoria}</p>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            onClick={() => modeloSelecionado && aplicarModelo(modeloSelecionado)}
                            disabled={!modeloSelecionado}
                            variant="outline"
                            className="w-full"
                          >
                            Aplicar ao Texto Principal
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <MousePointer className="w-4 h-4" />
                        Enviar com Botões Interativos
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
                  
                  {/* Seção de Mídia e Modelos para Lista */}
                  <div className="border-t pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Anexar Mídia */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Paperclip className="w-4 h-4" />
                          Anexar Mídia
                        </h4>
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          <Upload className="w-4 h-4 mr-2" />
                          Em breve: Lista + Mídia
                        </Button>
                      </Card>

                      {/* Usar Modelo */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Usar Modelo
                        </h4>
                        <div className="space-y-3">
                          <Select value={modeloSelecionado} onValueChange={setModeloSelecionado}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um modelo" />
                            </SelectTrigger>
                            <SelectContent>
                              {modelosDisponiveis.map((modelo) => (
                                <SelectItem key={modelo.id} value={modelo.id.toString()}>
                                  <div>
                                    <p className="font-medium">{modelo.nome}</p>
                                    <p className="text-xs text-muted-foreground">{modelo.categoria}</p>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            onClick={() => modeloSelecionado && aplicarModelo(modeloSelecionado)}
                            disabled={!modeloSelecionado}
                            variant="outline"
                            className="w-full"
                          >
                            Aplicar ao Texto Principal
                          </Button>
                        </div>
                      </Card>
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

        {/* Envio em Massa com Template */}
        <TabsContent value="massa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Envio em Massa</CardTitle>
              <CardDescription>Envie mensagens para múltiplos contatos usando lista ou planilha</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Como usar o envio em massa:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <li>Baixe o modelo de planilha abaixo</li>
                  <li>Preencha com os números e nomes dos contatos</li>
                  <li>Salve como arquivo CSV</li>
                  <li>Faça o upload do arquivo ou cole a lista manualmente</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Modelo de Planilha
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Exemplo simples sem cabeçalho
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      // Criar CSV de exemplo mais simples
                      const csvContent = `João Silva,5511999999999
Maria Santos,5511888888888
Pedro Costa,5511777777777`;
                      
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = 'modelo_contatos_simples.csv';
                      link.click();
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Baixar Modelo CSV
                  </Button>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Upload de Planilha
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Aceita qualquer planilha CSV com números de telefone
                  </p>
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800 mb-3">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                      ✅ Formatos aceitos:
                    </p>
                    <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                      <li>• Coluna A: Nomes, Coluna B: Telefones</li>
                      <li>• Separadores: vírgula, ponto-vírgula ou tab</li>  
                      <li>• Com ou sem cabeçalho</li>
                      <li>• Detecta automaticamente números válidos</li>
                    </ul>
                  </div>
                  <Input
                    type="file"
                    accept=".csv,.txt"
                    className="w-full"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const csvData = event.target?.result as string;
                          
                          // Processar CSV de forma mais inteligente
                          const lines = csvData.split('\n').filter(line => line.trim() !== '');
                          
                          let processedContacts: string[] = [];
                          let hasHeader = false;
                          
                          // Detectar se primeira linha é cabeçalho
                          if (lines.length > 0) {
                            const firstLine = lines[0].toLowerCase();
                            hasHeader = firstLine.includes('nome') || firstLine.includes('name') || 
                                       firstLine.includes('telefone') || firstLine.includes('phone') ||
                                       firstLine.includes('contato') || firstLine.includes('contact');
                          }
                          
                          const dataLines = hasHeader ? lines.slice(1) : lines;
                          
                          dataLines.forEach((line, index) => {
                            // Tentar diferentes separadores
                            let parts: string[] = [];
                            if (line.includes(',')) {
                              parts = line.split(',');
                            } else if (line.includes(';')) {
                              parts = line.split(';');
                            } else if (line.includes('\t')) {
                              parts = line.split('\t');
                            } else {
                              // Se só tem um valor, assumir que é telefone
                              parts = [line];
                            }
                            
                            // Procurar por números de telefone nas colunas
                            let phoneFound = false;
                            for (const part of parts) {
                              const cleaned = part.trim().replace(/\D/g, '');
                              if (cleaned.length >= 10 && cleaned.length <= 15) {
                                processedContacts.push(cleaned);
                                phoneFound = true;
                                break; // Pegar apenas o primeiro número válido da linha
                              }
                            }
                            
                            // Se não encontrou número válido, tentar extrair da linha inteira
                            if (!phoneFound) {
                              const lineNumbers = line.match(/\d{10,15}/g);
                              if (lineNumbers && lineNumbers.length > 0) {
                                processedContacts.push(lineNumbers[0]);
                              }
                            }
                          });
                          
                          if (processedContacts.length > 0) {
                            setContatos(processedContacts.join('\n'));
                            toast({
                              title: "✅ Planilha processada!",
                              description: `${processedContacts.length} números válidos encontrados${hasHeader ? ' (cabeçalho detectado)' : ''}`,
                            });
                          } else {
                            toast({
                              title: "⚠️ Nenhum número encontrado",
                              description: "Verifique se a planilha contém números de telefone válidos (10-15 dígitos)",
                              variant: "destructive"
                            });
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </Card>
              </div>

              <div>
                <Label htmlFor="contatos-massa">
                  Lista de Contatos
                  <span className="text-sm text-muted-foreground ml-2">
                    (Um número por linha ou separados por vírgula)
                  </span>
                </Label>
                <Textarea 
                  id="contatos-massa"
                  placeholder="Digite ou cole os números aqui:
5511999999999
5511888888888
5511777777777

Ou separados por vírgula:
5511999999999, 5511888888888, 5511777777777"
                  className="mt-2 min-h-[140px] font-mono text-sm"
                  value={contatos}
                  onChange={(e) => setContatos(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {contatos ? `${contatos.split(/[\n,]/).filter(n => n.trim().length >= 10).length} números válidos encontrados` : 'Nenhum número adicionado'}
                </p>
              </div>
              
              <div>
                <Label htmlFor="mensagem-massa">Mensagem para Envio</Label>
                <Textarea 
                  id="mensagem-massa"
                  placeholder="Digite sua mensagem aqui...

Você pode usar variáveis:
- {nome} para o nome do contato
- {numero} para o número do contato"
                  className="mt-2 min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Use {`{nome}`} e {`{numero}`} para personalizar a mensagem
                </p>
              </div>
              
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Anexar Mídia para Massa */}
                  <Card className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Anexar Mídia
                    </h4>
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      <Upload className="w-4 h-4 mr-2" />
                      Em breve: Massa + Mídia
                    </Button>
                  </Card>

                  {/* Usar Modelo para Massa */}
                  <Card className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Usar Modelo
                    </h4>
                    <div className="space-y-3">
                      <Select value={modeloSelecionado} onValueChange={setModeloSelecionado}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelosDisponiveis.map((modelo) => (
                            <SelectItem key={modelo.id} value={modelo.id.toString()}>
                              <div>
                                <p className="font-medium">{modelo.nome}</p>
                                <p className="text-xs text-muted-foreground">{modelo.categoria}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={() => modeloSelecionado && aplicarModelo(modeloSelecionado)}
                        disabled={!modeloSelecionado}
                        variant="outline"
                        className="w-full"
                      >
                        Aplicar à Mensagem
                      </Button>
                    </div>
                  </Card>
                </div>
                
                <div className="flex gap-2 mb-4">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Anexar Mídia
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Usar Modelo
                  </Button>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ <strong>Importante:</strong> O envio em massa deve respeitar as políticas do WhatsApp. 
                    Recomendamos intervalos entre envios e verificar se os números aceitam mensagens comerciais.
                  </p>
                </div>
                
                <Button className="w-full flex items-center gap-2" size="lg">
                  <Send className="w-4 h-4" />
                  Iniciar Envio em Massa
                  <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">
                    {contatos ? contatos.split(/[\n,]/).filter(n => n.trim().length >= 10).length : 0} contatos
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnviarMensagem;