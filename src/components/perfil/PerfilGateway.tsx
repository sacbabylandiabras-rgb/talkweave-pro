import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Phone, Globe, Shield, Key, Copy, CheckCircle, FileText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const PerfilGateway = () => {
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Business fields (local state, could be extended to save in profiles or a new table)
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [documentType, setDocumentType] = useState("cpf");
  const [document, setDocument] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, whatsapp")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name || user.user_metadata?.full_name || "");
        setBusinessPhone(profile?.whatsapp || "");
        // Fetch document fields separately (new columns)
        const { data: docData } = await supabase
          .from("profiles" as any)
          .select("document, document_type")
          .eq("id", user.id)
          .single();
        const doc = docData as any;
        setDocument(doc?.document || "");
        setDocumentType(doc?.document_type || "cpf");
      }
    };
    fetchUser();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: userName,
        whatsapp: businessPhone,
        document: document,
        document_type: documentType,
      } as any).eq("id", userId);
      if (error) throw error;
      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookUrl = `https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/webhook-gateway`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas informações de conta e empresa</p>
      </div>

      {/* Dados da Conta */}
      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-[#a78bfa]" />
            Dados da Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-[#a78bfa] text-white text-lg">
               {userName ? userName.charAt(0).toUpperCase() : (userEmail && userEmail.includes("@") ? userEmail.charAt(0).toUpperCase() : "U")}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 flex-1">
             <p className="font-semibold text-foreground">{userName || (userEmail && userEmail.includes("@") ? userEmail : "Usuário")}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />{userEmail}
            </p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-0">Ativo</Badge>
        </CardContent>
      </Card>

      {/* Informações do Negócio */}
      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-[#a78bfa]" />
            Informações do Negócio
          </CardTitle>
          <CardDescription>Dados que aparecerão nos seus checkouts e comunicações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome / Empresa</Label>
              <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome da empresa ou responsável" />
            </div>
            <div className="space-y-2">
              <Label>Telefone / WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="(11) 99999-9999" className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} placeholder="https://seusite.com.br" className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={userEmail} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                  <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{documentType === "cnpj" ? "CNPJ" : "CPF"}</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  placeholder={documentType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição do Negócio</Label>
            <Textarea value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} placeholder="Breve descrição da sua empresa ou serviço..." className="min-h-[80px] border-[#2A2A2A]" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white">
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Chaves de API */}
      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4 text-[#a78bfa]" />
            Chaves de Integração
          </CardTitle>
          <CardDescription>Use essas informações para integrar com sua plataforma</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Webhook URL</Label>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs bg-muted/30 border-[#2A2A2A]" />
              <Button size="sm" variant="outline" onClick={() => handleCopy(webhookUrl, "Webhook URL")} className="shrink-0">
                {copied === "Webhook URL" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">User ID</Label>
            <div className="flex items-center gap-2">
              <Input value={userId} readOnly className="font-mono text-xs bg-muted/30 border-[#2A2A2A]" />
              <Button size="sm" variant="outline" onClick={() => handleCopy(userId, "User ID")} className="shrink-0">
                {copied === "User ID" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-[#a78bfa]" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-[#2A2A2A]">
            <div>
              <p className="text-sm font-medium">Autenticação em 2 fatores</p>
              <p className="text-xs text-muted-foreground">Adicione uma camada extra de segurança</p>
            </div>
            <Badge variant="secondary" className="text-xs">Em breve</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-[#2A2A2A]">
            <div>
              <p className="text-sm font-medium">Alterar Senha</p>
              <p className="text-xs text-muted-foreground">Troque sua senha de acesso</p>
            </div>
            <Button size="sm" variant="outline" className="text-xs">Alterar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilGateway;
