import { useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Plus, Shield, Bell, Building2, Key, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function PaySettings() {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie as configurações da sua conta</p>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="empresa"><Building2 className="w-3.5 h-3.5 mr-1.5" />Empresa</TabsTrigger>
          <TabsTrigger value="api"><Key className="w-3.5 h-3.5 mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="w-3.5 h-3.5 mr-1.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="notificacoes"><Bell className="w-3.5 h-3.5 mr-1.5" />Notificações</TabsTrigger>
          <TabsTrigger value="seguranca"><Shield className="w-3.5 h-3.5 mr-1.5" />Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Dados da Empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Razão Social</Label><Input defaultValue="TechStore Ltda" /></div>
                <div><Label>CNPJ</Label><Input defaultValue="12.345.678/0001-99" disabled /></div>
                <div><Label>Nome Fantasia</Label><Input defaultValue="TechStore" /></div>
                <div><Label>Segmento</Label><Input defaultValue="E-commerce" /></div>
              </div>
              <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full">Salvar</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Chaves de API</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Chave Pública (Publishable Key)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value="pk_live_zaplynxpay_a1b2c3d4e5f6" readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText("pk_live_zaplynxpay_a1b2c3d4e5f6"); toast.success("Copiado!"); }}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
              <div>
                <Label>Chave Secreta (Secret Key)</Label>
                <div className="flex gap-2 mt-1">
                  <Input type={showSecret ? "text" : "password"} value="sk_live_zaplynxpay_x9y8z7w6v5u4" readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText("sk_live_zaplynxpay_x9y8z7w6v5u4"); toast.success("Copiado!"); }}><Copy className="w-4 h-4" /></Button>
                </div>
                <p className="text-[10px] text-red-400 mt-1">⚠️ Nunca exponha esta chave em código frontend</p>
              </div>
              <Button variant="outline" className="rounded-full text-xs"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerar Chaves</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Endpoints de Webhook</CardTitle>
              <Button size="sm" className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar</Button>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Nenhum webhook configurado.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Notificações por E-mail</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {["Transação aprovada", "Transação recusada", "Estorno realizado", "Chargeback recebido", "Relatório semanal"].map(n => (
                <div key={n} className="flex items-center justify-between">
                  <span className="text-sm">{n}</span>
                  <Switch defaultChecked={n.includes("Chargeback") || n.includes("Estorno")} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Autenticação 2FA</p>
                  <p className="text-xs text-muted-foreground">Proteja sua conta com verificação em duas etapas</p>
                </div>
                <Switch />
              </div>
              <div>
                <Label>IPs Permitidos</Label>
                <Input placeholder="Ex: 192.168.1.1, 10.0.0.1" className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para permitir qualquer IP</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
