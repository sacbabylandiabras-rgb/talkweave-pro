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
  
  // Estados para botões de ação (agora com todas as opções)
  const [botoesAcao, setBotoesAcao] = useState([{id: "1", type: "REPLY" as "CALL" | "URL" | "REPLY" | "OPTION" | "COPY", label: "", phone: "", url: "", copyText: "", replyText: ""}]);
  
  // Estados para lista de opções
  const [tituloLista, setTituloLista] = useState("");
  const [labelBotaoLista, setLabelBotaoLista] = useState("Ver opções");
  const [opcoes, setOpcoes] = useState([{id: "1", title: "", description: ""}]);
  
  const { sendMessage, sendButtonActions, sendOptionList, loading } = useZapi();

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
        if (btn.type === "REPLY" && btn.replyText.trim() === "") return false;
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
          ...(btn.type === "COPY" && { copyText: btn.copyText }),
          ...(btn.type === "REPLY" && { replyText: btn.replyText })
        })),
        titulo || undefined,
        rodape || undefined
      );
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
      setTitulo("");
      setRodape("");
      setBotoesAcao([{id: "1", type: "REPLY", label: "", phone: "", url: "", copyText: "", replyText: ""}]);
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
    setBotoesAcao([...botoesAcao, {id: (botoesAcao.length + 1).toString(), type: "REPLY", label: "", phone: "", url: "", copyText: "", replyText: ""}]);
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
                            <div>
                              <Label className="text-sm text-muted-foreground">Texto da resposta</Label>
                              <Input
                                placeholder="Texto que será enviado como resposta"
                                value={botao.replyText}
                                onChange={(e) => updateActionButton(index, 'replyText', e.target.value)}
                                className="mt-1"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                💡 Este texto será enviado automaticamente quando o usuário clicar no botão
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
                    Baixe o modelo para organizar seus contatos
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      // Criar CSV de exemplo
                      const csvContent = `nome,telefone
João Silva,5511999999999
Maria Santos,5511888888888
Pedro Costa,5511777777777`;
                      
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = 'modelo_contatos_whatsapp.csv';
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
                    Faça upload do arquivo CSV preenchido
                  </p>
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
                          // Processar CSV e extrair números
                          const lines = csvData.split('\n');
                          const contacts = lines
                            .slice(1) // Pular cabeçalho
                            .map(line => {
                              const [nome, telefone] = line.split(',');
                              return telefone?.trim();
                            })
                            .filter(phone => phone && phone.length >= 10)
                            .join('\n');
                          setContatos(contacts);
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