 import { useState, useMemo } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Textarea } from "@/components/ui/textarea";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Instagram, Send, Loader2 } from "lucide-react";
 import { useZapi } from "@/hooks/useZapi";
 import { useToast } from "@/hooks/use-toast";
 import InstanceSelector from "@/components/envio/InstanceSelector";
 import { useZapiInstances } from "@/hooks/useZapiInstances";
 import { supabase } from "@/integrations/supabase/client";
 
 const EnviarInstagram = () => {
   const [username, setUsername] = useState("");
   const [mensagem, setMensagem] = useState("");
   const { toast } = useToast();
   const { instances: allInstances } = useZapiInstances({ includeMeta: true });
   const [loading, setLoading] = useState(false);
   
   // No Instagram, podemos usar tanto instâncias Z-API específicas de Instagram 
   // quanto a Meta API se ela suportar Instagram (o que requer configuração diferente).
   // Por enquanto, vamos permitir selecionar qualquer instância e o backend resolve.
   const instances = useMemo(() => allInstances, [allInstances]);
 
   const handleSend = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!username || !mensagem) {
       toast({ title: "Campos obrigatórios", description: "Informe o usuário e a mensagem", variant: "destructive" });
       return;
     }
 
     setLoading(true);
     try {
       // Chamada para a edge function send-message com flag de Instagram
       const { data, error } = await supabase.functions.invoke("send-message", {
         body: {
           phone: username, // no Instagram o "phone" é o username ou IGSID
           message: mensagem,
           isInstagram: true
         }
       });
 
       if (error) throw error;
       if (data?.error) throw new Error(data.message || data.error);
 
       toast({ title: "Mensagem enviada!", description: "Sua mensagem foi enviada com sucesso." });
       setUsername("");
       setMensagem("");
     } catch (err: any) {
       console.error("Erro ao enviar DM:", err);
       toast({ title: "Erro ao enviar", description: err.message || "Erro desconhecido", variant: "destructive" });
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <div className="space-y-6 w-full max-w-4xl mx-auto">
       <div>
         <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
           <Instagram className="w-6 h-6 text-pink-500" />
           Enviar Direct Message
         </h1>
         <p className="text-sm text-muted-foreground mt-0.5">Envie mensagens manuais para seus contatos do Instagram</p>
       </div>
 
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 space-y-6">
           <Card>
             <CardHeader>
               <CardTitle className="text-base">Nova Mensagem</CardTitle>
               <CardDescription>Informe o @usuario ou o ID numérico do contato</CardDescription>
             </CardHeader>
             <CardContent>
               <form onSubmit={handleSend} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="username">Usuário do Instagram</Label>
                   <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                     <Input 
                       id="username"
                       placeholder="usuario_exemplo"
                       className="pl-7"
                       value={username}
                       onChange={(e) => setUsername(e.target.value.replace("@", ""))}
                     />
                   </div>
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="message">Mensagem</Label>
                   <Textarea 
                     id="message"
                     placeholder="Digite sua mensagem aqui..."
                     className="min-h-[150px]"
                     value={mensagem}
                     onChange={(e) => setMensagem(e.target.value)}
                   />
                 </div>
 
                 <Button type="submit" className="w-full gap-2" disabled={loading}>
                   {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   {loading ? "Enviando..." : "Enviar DM"}
                 </Button>
               </form>
             </CardContent>
           </Card>
         </div>
 
         <div className="space-y-6">
           <Card>
             <CardHeader>
               <CardTitle className="text-base flex items-center gap-2">
                 <Instagram className="w-4 h-4" />
                 Instância de Envio
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <InstanceSelector providerFilter="all" />
               <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
                 Certifique-se de selecionar uma instância que possua a conta do Instagram conectada.
               </p>
             </CardContent>
           </Card>
         </div>
       </div>
     </div>
   );
 };
 
 export default EnviarInstagram;