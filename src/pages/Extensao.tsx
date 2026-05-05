import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Download, Copy, Check, Chrome, Shield, Zap, Users } from "lucide-react";
import { toast } from "sonner";

const Extensao = () => {
  const [userId, setUserId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    toast.success("Chave copiada com sucesso!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Extensão ZapLynx</h1>
        <p className="text-muted-foreground mt-2">Potencialize seu WhatsApp Web com ferramentas exclusivas</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Instalar Extensão
            </CardTitle>
            <CardDescription>
              Baixe e instale a extensão manualmente no seu Google Chrome.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-background/50 p-4 rounded-lg border border-border text-sm space-y-2">
              <p className="font-medium text-foreground">Passos para instalação:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Baixe o arquivo ZIP da extensão.</li>
                <li>Extraia o conteúdo em uma pasta.</li>
                <li>Abra <code className="bg-muted px-1 rounded">chrome://extensions</code> no Chrome.</li>
                <li>Ative o "Modo do desenvolvedor" (canto superior direito).</li>
                <li>Clique em "Carregar sem compactação" e selecione a pasta extraída.</li>
              </ol>
            </div>
            <Button className="w-full gap-2" size="lg" asChild>
              <a href="/extension.zip" download="zaplynx-extension.zip">
                <Download className="w-4 h-4" />
                Baixar Extensão (.zip)
              </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Conectar Conta
            </CardTitle>
            <CardDescription>
              Use esta chave para vincular a extensão à sua conta ZapLynx.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sua Chave de Extensão</label>
              <div className="flex gap-2">
                <Input 
                  value={userId} 
                  readOnly 
                  className="font-mono text-xs bg-muted/50"
                />
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              * Nunca compartilhe esta chave com terceiros. Ela dá acesso aos seus dados no WhatsApp Web.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <FeatureCard 
          icon={<Users className="w-6 h-6 text-blue-400" />}
          title="Extração de Contatos"
          description="Extraia números de grupos e conversas com um único clique."
        />
        <FeatureCard 
          icon={<Zap className="w-6 h-6 text-yellow-400" />}
          title="Respostas Rápidas"
          description="Acesse seus modelos de mensagens diretamente no chat do WhatsApp."
        />
        <FeatureCard 
          icon={<Chrome className="w-6 h-6 text-green-400" />}
          title="Sincronização"
          description="Envie conversas do WhatsApp Web direto para o seu CRM ZapLynx."
        />
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <Card className="bg-background/40">
    <CardContent className="pt-6 text-center space-y-3">
      <div className="mx-auto bg-muted w-12 h-12 rounded-full flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export default Extensao;