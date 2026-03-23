import { useState } from "react";
import { FileCheck, Plus, Search, Filter, Eye, Copy, MoreHorizontal, CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mockTemplates = [
  {
    id: "1",
    name: "boas_vindas_cliente",
    category: "MARKETING",
    language: "pt_BR",
    status: "APPROVED" as const,
    content: "Olá {{1}}! 👋 Seja bem-vindo à nossa plataforma. Estamos felizes em ter você conosco!",
    updatedAt: "2026-03-20",
  },
  {
    id: "2",
    name: "confirmacao_pedido",
    category: "UTILITY",
    language: "pt_BR",
    status: "APPROVED" as const,
    content: "Seu pedido #{{1}} foi confirmado! O valor total é R$ {{2}}. Acompanhe pelo link: {{3}}",
    updatedAt: "2026-03-19",
  },
  {
    id: "3",
    name: "recuperacao_carrinho",
    category: "MARKETING",
    language: "pt_BR",
    status: "PENDING" as const,
    content: "Oi {{1}}, você deixou itens no carrinho! Complete sua compra com 10% de desconto usando o cupom: {{2}}",
    updatedAt: "2026-03-21",
  },
  {
    id: "4",
    name: "notificacao_envio",
    category: "UTILITY",
    language: "pt_BR",
    status: "REJECTED" as const,
    content: "Seu pedido foi enviado! Código de rastreio: {{1}}. Prazo estimado: {{2}} dias úteis.",
    updatedAt: "2026-03-18",
  },
  {
    id: "5",
    name: "lembrete_pagamento",
    category: "UTILITY",
    language: "pt_BR",
    status: "APPROVED" as const,
    content: "Olá {{1}}, lembrete: sua fatura de R$ {{2}} vence em {{3}}. Evite juros e pague no prazo!",
    updatedAt: "2026-03-22",
  },
];

const statusConfig = {
  APPROVED: { label: "Aprovado", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  PENDING: { label: "Em análise", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  REJECTED: { label: "Rejeitado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
};

const categoryLabels: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

export default function TemplatesAprovados() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filtered = mockTemplates.filter((t) => {
    const matchSearch = t.name.includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "all") return matchSearch;
    return matchSearch && t.status === activeTab.toUpperCase();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates Aprovados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus templates aprovados pela Meta para envio via Cloud API
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Submeter Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Aprovados", count: mockTemplates.filter((t) => t.status === "APPROVED").length, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Em análise", count: mockTemplates.filter((t) => t.status === "PENDING").length, icon: Clock, color: "text-amber-500" },
          { label: "Rejeitados", count: mockTemplates.filter((t) => t.status === "REJECTED").length, icon: XCircle, color: "text-destructive" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.count}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">Aprovados</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Em análise</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">Rejeitados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Template List */}
      <div className="space-y-3">
        {filtered.map((template) => {
          const status = statusConfig[template.status];
          const StatusIcon = status.icon;
          return (
            <Card key={template.id} className="p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                      {template.name}
                    </code>
                    <Badge variant="outline" className={`text-[10px] ${status.bg} ${status.color} border`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {categoryLabels[template.category] || template.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {template.language}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {template.content}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    Atualizado em {template.updatedAt}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {template.status === "APPROVED" && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <Send className="w-3.5 h-3.5" />
                      Enviar
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-xs gap-2">
                        <Eye className="w-3.5 h-3.5" /> Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs gap-2">
                        <Copy className="w-3.5 h-3.5" /> Duplicar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FileCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum template encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
