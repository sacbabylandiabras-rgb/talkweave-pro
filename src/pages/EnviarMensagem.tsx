import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Users, User, FileText, Image } from "lucide-react";
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
  const [errors, setErrors] = useState<{phone?: string, message?: string}>({});
  const { sendMessage, loading } = useZapi();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enviar Mensagem</h1>
        <p className="text-muted-foreground">Envie mensagens individuais ou em massa</p>
      </div>

      <Tabs defaultValue="individual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="massa" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Em Massa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagem Individual</CardTitle>
              <CardDescription>Envie uma mensagem para um contato específico</CardDescription>
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
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Anexar Mídia
                    </Button>
                    <Button type="button" variant="outline" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Usar Modelo
                    </Button>
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