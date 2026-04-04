import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Users, Phone, Smartphone } from "lucide-react";
import type { RedirectLink } from "@/hooks/useRedirectLinks";

interface Props {
  link: RedirectLink | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (linkId: string, updates: Partial<RedirectLink>) => Promise<void>;
  templates: { id: string; name: string }[];
  flows: { id: string; name: string }[];
  instances: { id: string; instance_name: string }[];
  saving: boolean;
}

export function LinkAutomationDialog({ link, open, onOpenChange, onSave, templates, flows, instances, saving }: Props) {
  if (!link) return null;

  const save = (updates: Partial<RedirectLink>) => onSave(link.id, updates);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Automação do Link
            <Badge variant="outline" className="text-xs font-normal">{link.name}</Badge>
          </DialogTitle>
          <DialogDescription>Configure mensagens automáticas quando alguém entrar pelo link</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="private" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="private" className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Privado
              {link.welcome_type !== 'none' && link.welcome_type && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">ON</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              No Grupo
              {link.group_message_type !== 'none' && link.group_message_type && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">ON</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notify" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Notificação
              {link.notify_admin && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">ON</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* PRIVATE MESSAGE TAB */}
          <TabsContent value="private" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Mensagem enviada no privado do membro que entrou no grupo.</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de envio</label>
              <Select value={link.welcome_type || 'none'} onValueChange={(v) => save({ welcome_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Desativada</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="template">Modelo</SelectItem>
                  <SelectItem value="flow">Fluxo Visual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {link.welcome_type === 'text' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Mensagem</label>
                <Textarea
                  defaultValue={link.welcome_message || ''}
                  onBlur={(e) => save({ welcome_message: e.target.value })}
                  placeholder="Olá {{nome}}! Bem-vindo ao grupo!"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">Variáveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{grupo}}'}</p>
              </div>
            )}

            {link.welcome_type === 'template' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Modelo</label>
                <Select value={link.welcome_template_id || ''} onValueChange={(v) => save({ welcome_template_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {link.welcome_type === 'flow' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Fluxo Visual</label>
                <Select value={link.welcome_flow_id || ''} onValueChange={(v) => save({ welcome_flow_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
                  <SelectContent>
                    {flows.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {link.welcome_type && link.welcome_type !== 'none' && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Instância de envio
                </label>
                <Select value={link.welcome_instance_id || 'auto'} onValueChange={(v) => save({ welcome_instance_id: v === 'auto' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automática (instância do grupo)</SelectItem>
                    {instances.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          {/* GROUP MESSAGE TAB */}
          <TabsContent value="group" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Mensagem enviada dentro do grupo quando alguém entra.</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de envio</label>
              <Select value={link.group_message_type || 'none'} onValueChange={(v) => save({ group_message_type: v, group_message_enabled: v !== 'none' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Desativada</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="template">Modelo</SelectItem>
                  <SelectItem value="flow">Fluxo Visual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {link.group_message_type === 'text' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Mensagem</label>
                <Textarea
                  defaultValue={link.group_message_text || ''}
                  onBlur={(e) => save({ group_message_text: e.target.value })}
                  placeholder="Bem-vindo ao grupo, {{nome}}! 🎉"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">Variáveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{grupo}}'}</p>
              </div>
            )}

            {link.group_message_type === 'template' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Modelo</label>
                <Select value={link.group_message_template_id || ''} onValueChange={(v) => save({ group_message_template_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {link.group_message_type === 'flow' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Fluxo Visual</label>
                <Select value={link.group_message_flow_id || ''} onValueChange={(v) => save({ group_message_flow_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
                  <SelectContent>
                    {flows.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {link.group_message_type && link.group_message_type !== 'none' && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Instância de envio (grupo)
                </label>
                <Select value={link.group_message_instance_id || 'auto'} onValueChange={(v) => save({ group_message_instance_id: v === 'auto' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automática (instância do grupo)</SelectItem>
                    {instances.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          {/* NOTIFICATION TAB */}
          <TabsContent value="notify" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Receba um alerta no WhatsApp quando alguém entrar pelo link.</p>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Ativar notificação</label>
              <Switch checked={link.notify_admin || false} onCheckedChange={(v) => save({ notify_admin: v })} />
            </div>
            {link.notify_admin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone do admin</label>
                <Input
                  placeholder="5511999999999"
                  defaultValue={link.notify_phone || ''}
                  onBlur={(e) => save({ notify_phone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Receba uma mensagem toda vez que alguém entrar via este link</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {saving && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Salvando...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
