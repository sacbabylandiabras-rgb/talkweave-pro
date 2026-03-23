import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Bot, Rocket, BarChart3, Settings, Users, Brain, Link, CreditCard, Flame, Cherry, Gem, ClipboardList, ArrowDown, ShoppingCart, Phone, Sparkles, Check, ChevronLeft, ChevronRight } from "lucide-react";
import logoImage from "@/assets/logo.png";
import dashboardMockup from "@/assets/dashboard-new.png";
import fluxoScreenshot1 from "@/assets/fluxo-screenshot-1.png";
import fluxoScreenshot2 from "@/assets/fluxo-screenshot-2.png";
import fluxoScreenshot3 from "@/assets/fluxo-screenshot-3.png";
import prova1 from "@/assets/prova1.jpg";
import prova2 from "@/assets/prova2.jpg";
import prova3 from "@/assets/prova3.jpg";
import prova4 from "@/assets/prova4.jpg";
import prova5 from "@/assets/prova5.jpg";
import PhoneMockup from "@/components/landing/PhoneMockup";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen landing-bg text-foreground relative">
      {/* Mouse follow effect */}
      <MouseFollowEffect />

      {/* Header */}
      <header className="w-[90%] max-w-[1200px] mx-auto flex justify-between items-center py-6">
        <img src={logoImage} alt="ZapLynx Logo" className="h-14" />
        <button
          onClick={() => navigate("/auth?signup=true")}
          className="landing-btn"
        >
          Começar Agora
        </button>
      </header>

      {/* Hero */}
      <section className="w-[90%] max-w-[1200px] mx-auto text-center py-20 md:py-24">
        <h1 className="text-3xl md:text-[42px] font-extrabold leading-tight text-foreground mb-5">
          Gerencie suas mensagens do{" "}
          <span className="text-primary">WhatsApp</span> em escala
        </h1>
        <p className="text-lg text-muted-foreground max-w-[600px] mx-auto mb-8">
          Automação profissional, agente inteligente com IA e gestão completa
          para transformar mensagens em vendas todos os dias.
        </p>


        <button
          onClick={() => navigate("/auth?signup=true")}
          className="landing-btn mt-8"
        >
          Criar Conta
        </button>
      </section>


      {/* Benefícios */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <h2 className="text-center text-[32px] font-extrabold text-foreground mb-10">
          Plataforma Completa de Automação
        </h2>

        {/* Mockup do Dashboard */}
        <div className="max-w-2xl mx-auto isolate landing-mockup-wrap mb-14">
          <div className="landing-laptop-frame">
            <div className="landing-laptop-screen">
              <img
                src={dashboardMockup}
                alt="ZapLynx Dashboard"
                className="w-full h-full object-cover object-right-top"
              />
            </div>
            <div className="landing-laptop-base" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <Bot className="w-6 h-6 text-primary" />, title: "Agente de IA Treinável", desc: "Responde automaticamente seus clientes 24h por dia." },
            { icon: <Rocket className="w-6 h-6 text-primary" />, title: "Envios Estratégicos", desc: "Dispare campanhas segmentadas com alta performance." },
            { icon: <BarChart3 className="w-6 h-6 text-primary" />, title: "Relatórios Avançados", desc: "Acompanhe métricas e resultados em tempo real." },
            { icon: <Settings className="w-6 h-6 text-primary" />, title: "Gestão Multi-Instância", desc: "Gerencie vários números em um único painel." },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-2 mb-2">
                {card.icon}
                <h3 className="text-foreground font-semibold">{card.title}</h3>
              </div>
              <p className="text-muted-foreground text-[15px]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="flex justify-center">
            <PhoneMockup />
          </div>
          <div className="space-y-5">
            <h3 className="text-2xl font-extrabold text-foreground">
              Envios em Massa com Controle Total
            </h3>
            <p className="text-muted-foreground text-base leading-relaxed">
              Dispare mensagens para milhares de contatos com intervalos inteligentes, 
              revezamento automático entre instâncias e acompanhamento em tempo real 
              do progresso de cada envio.
            </p>
            <ul className="space-y-3">
              {[
                "Envio segmentado por grupos e listas",
                "Delay configurável entre mensagens",
                "Relatório detalhado de entregas",
                "Suporte a texto, imagem, áudio e vídeo",
              ].map((item, i) => (
                 <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                   <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Fluxo Visual Section */}
      <section className="w-full">

        {/* White section with flow description */}
        <div className="py-20 px-5">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
                Fluxos Visuais de Automação
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Crie automações poderosas arrastando e conectando blocos visuais. 
                Sem código, sem complicação — monte jornadas completas para seus 
                clientes com lógica condicional, ações automáticas e gatilhos inteligentes.
              </p>
              <ul className="space-y-3">
                {[
                  "Editor visual drag-and-drop intuitivo",
                  "Gatilhos por palavra-chave ou evento",
                  "Condições e ramificações inteligentes",
                  "Envio de mensagens, mídias e links automáticos",
                  "Integração com webhooks e APIs externas",
                  "Ativação e desativação com um clique",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/auth?signup=true")}
                className="landing-btn"
              >
                Criar Meus Fluxos
              </button>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-md isolate landing-mockup-wrap">
                <div className="landing-laptop-frame">
                  <div className="landing-laptop-screen">
                    <img
                      src={fluxoScreenshot3}
                      alt="Exemplo de fluxo visual de automação"
                      className="w-full h-full object-cover object-left-top"
                    />
                  </div>
                  <div className="landing-laptop-base" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Extração de Leads de Grupos */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-7 h-7 text-primary" />
                <h4 className="text-foreground font-bold text-lg">Grupos & Comunidades</h4>
              </div>
              {[
                { name: "Marketing Digital 2026", members: 847, type: "Grupo" },
                { name: "Comunidade Vendas BR", members: 3420, type: "Comunidade" },
                { name: "Empreendedores SP", members: 562, type: "Grupo" },
              ].map((group, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">{group.name}</p>
                    <p className="text-muted-foreground text-xs">{group.members} membros · {group.type}</p>
                  </div>
                  <span className="text-primary text-xs font-bold">Extrair</span>
                </div>
              ))}
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">+ 12 grupos e comunidades disponíveis</span>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Extraia Leads de Grupos e Comunidades
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Transforme grupos e comunidades do WhatsApp em listas de contatos qualificados. 
              Nosso sistema identifica automaticamente todos os grupos e comunidades 
              das suas instâncias e extrai os números dos participantes com um clique.
            </p>
            <ul className="space-y-3">
              {[
                "Detecção automática de grupos e comunidades",
                "Extração de participantes com um clique",
                "Sincronização entre múltiplas instâncias",
                "Envie campanhas direto para os leads extraídos",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/auth?signup=true")}
              className="landing-btn"
            >
              Extrair Leads Agora
            </button>
          </div>
        </div>
      </section>

      {/* Agente de IA */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Agente de IA que Vende por Você 24h
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Treine um agente inteligente com o conhecimento do seu negócio. 
              Ele responde seus clientes no WhatsApp automaticamente, tira dúvidas, 
              envia links de produtos e conduz a venda — mesmo enquanto você dorme.
            </p>
            <ul className="space-y-3">
              {[
                "Treinável com FAQ, documentos e sites",
                "Respostas naturais e personalizadas",
                "Funciona 24 horas por dia, 7 dias por semana",
                "Integrado diretamente ao seu WhatsApp",
                "Chat de teste no painel para validar respostas",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/auth?signup=true")}
              className="landing-btn"
            >
              Testar Agente de IA
            </button>
          </div>
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🧠</span>
                <h4 className="text-foreground font-bold text-lg">Agente Inteligente</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="bg-primary/10 text-foreground text-sm rounded-xl rounded-br-sm px-4 py-2 max-w-[80%]">
                    Oi, vocês têm esse produto disponível?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-secondary text-foreground text-sm rounded-xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                    Olá! Sim, temos disponível 😊 Posso te enviar o link com mais detalhes e condições especiais?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary/10 text-foreground text-sm rounded-xl rounded-br-sm px-4 py-2 max-w-[80%]">
                    Sim, por favor!
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-secondary text-foreground text-sm rounded-xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                    Aqui está! 🔗 Qualquer dúvida, estou aqui pra te ajudar.
                  </div>
                </div>
              </div>
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">Resposta automática via IA · 2s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integração com Checkouts e Gateways */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🔗</span>
                <h4 className="text-foreground font-bold text-lg">Integrações Conectadas</h4>
              </div>
              {[
                { name: "PerfectPay", status: "Ativo", icon: "💳" },
                { name: "Hotmart", status: "Ativo", icon: "🔥" },
                { name: "Kiwify", status: "Ativo", icon: "🥝" },
                { name: "Stripe", status: "Ativo", icon: "💎" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <p className="text-foreground text-sm font-medium">{item.name}</p>
                  </div>
                  <span className="text-primary text-xs font-bold">{item.status}</span>
                </div>
              ))}
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">+ qualquer plataforma com webhook</span>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Integração com Qualquer Checkout ou Gateway
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Conecte sua plataforma de vendas ao ZapLynx via webhook e automatize 
              o envio de mensagens com base em eventos de pagamento. Funciona com 
              qualquer checkout, gateway ou plataforma que envie webhooks.
            </p>
            <ul className="space-y-3">
              {[
                "Compatível com PerfectPay, Hotmart, Kiwify, Stripe e mais",
                "Disparo automático por evento (aprovado, cancelado, reembolso)",
                "Mensagens personalizadas por tipo de evento",
                "Configuração simples via URL de webhook única",
                "Histórico completo de eventos recebidos",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/auth?signup=true")}
              className="landing-btn"
            >
              Conectar Meu Checkout
            </button>
          </div>
        </div>
      </section>


      {/* Modelos de Mensagens */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Modelos Prontos para Envio Rápido
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Crie e salve modelos de mensagens reutilizáveis com texto, imagens, vídeos, 
              áudios, botões interativos e até carrosséis completos. Padronize sua comunicação 
              e dispare campanhas em segundos.
            </p>
            <ul className="space-y-3">
              {[
                "Modelos com texto, mídia, botões e carrossel",
                "Variáveis dinâmicas como {{nome}} e {{telefone}}",
                "Categorias organizadas (vendas, suporte, remarketing)",
                "Integração direta com campanhas e fluxos",
                "Reutilize em envios em massa com um clique",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/auth?signup=true")}
              className="landing-btn"
            >
              Criar Meus Modelos
            </button>
          </div>
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">📋</span>
                <h4 className="text-foreground font-bold text-lg">Modelos Salvos</h4>
              </div>
              {[
                { name: "Boas-vindas VIP", type: "Texto + Botão", category: "Vendas" },
                { name: "Promoção Relâmpago", type: "Imagem + Texto", category: "Marketing" },
                { name: "Lembrete de Pagamento", type: "Texto", category: "Cobrança" },
                { name: "Catálogo de Produtos", type: "Carrossel", category: "Vendas" },
              ].map((tpl, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">{tpl.name}</p>
                    <p className="text-muted-foreground text-xs">{tpl.type} · {tpl.category}</p>
                  </div>
                  <span className="text-primary text-xs font-bold">Usar</span>
                </div>
              ))}
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">+ crie modelos ilimitados</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mensagem de Boas-Vindas */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden">
              {/* WhatsApp-style header */}
              <div className="bg-primary/15 px-4 py-3 flex items-center gap-3 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-primary/30 flex items-center justify-center text-sm font-bold text-primary">VIP</div>
                <div>
                  <p className="text-foreground text-sm font-semibold">Grupo VIP Clientes</p>
                  <p className="text-muted-foreground text-[10px]">48 participantes</p>
                </div>
              </div>
              {/* Chat area */}
              <div className="px-4 py-4 space-y-3 bg-secondary/20 min-h-[260px]">
                {/* System message */}
                <div className="flex justify-center">
                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                    Maria Silva entrou no grupo
                  </span>
                </div>
                {/* Arrow indicator */}
                <div className="flex justify-center">
                  <span className="text-primary text-lg animate-bounce">⬇</span>
                </div>
                {/* Bot welcome message */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
                    <p className="text-xs leading-relaxed">Olá <strong>Maria Silva</strong>! 👋</p>
                    <p className="text-xs leading-relaxed mt-1">Bem-vindo ao nosso grupo VIP! Aqui você terá acesso a ofertas exclusivas e conteúdos especiais.</p>
                    <div className="mt-2 space-y-1">
                      <div className="text-center text-[11px] font-medium py-1.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10">
                        🛒 Ver Ofertas
                      </div>
                      <div className="text-center text-[11px] font-medium py-1.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10">
                        📞 Falar com Suporte
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1.5">
                      <span className="text-[9px] opacity-70">🤖 Automático</span>
                      <span className="text-[9px] opacity-60">14:32</span>
                    </div>
                  </div>
                </div>
                {/* Response from member */}
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[70%] shadow-sm">
                    <p className="text-xs text-foreground">Obrigada! 😍</p>
                    <p className="text-[9px] text-muted-foreground text-right mt-0.5">14:33</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Boas-Vindas Automáticas nos Grupos
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Receba novos membros nos seus grupos do WhatsApp de forma automática e profissional.
              Configure mensagens personalizadas com o nome do participante, envie modelos com
              imagens e botões, ou acione fluxos visuais completos.
            </p>
            <ul className="space-y-3">
              {[
                "Mensagem automática ao entrar no grupo",
                "Personalização com {{nome}}, {{telefone}} e {{grupo}}",
                "Suporte a texto, modelos com mídia e botões",
                "Acione fluxos visuais como resposta de boas-vindas",
                "Configuração individual por grupo",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/auth?signup=true")}
              className="landing-btn"
            >
              Configurar Boas-Vindas
            </button>
          </div>
        </div>
      </section>

      {/* Gerenciamento de Grupos */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Gestão Completa de Grupos WhatsApp
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Gerencie todos os seus grupos diretamente pelo painel. Crie grupos, altere nome, 
              descrição e foto, adicione ou remova participantes, promova admins e configure 
              restrições — tudo sem precisar abrir o WhatsApp.
            </p>
            <ul className="space-y-3">
              {[
                "Criar grupos e adicionar participantes em massa",
                "Alterar nome, descrição e foto do grupo",
                "Promover e remover administradores",
                "Restringir mensagens apenas para admins",
                "Links de convite e redirecionamento rotativo",
                "Gerenciamento centralizado de múltiplas instâncias",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/auth?signup=true")}
              className="landing-btn"
            >
              Gerenciar Meus Grupos
            </button>
          </div>
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden">
              {/* Header - Link Rotativo */}
              <div className="bg-primary/15 px-4 py-3 flex items-center gap-3 border-b border-border">
                <span className="text-2xl">🔗</span>
                <div>
                  <p className="text-foreground text-sm font-semibold">Link Rotativo: Turma VIP</p>
                  <p className="text-muted-foreground text-[10px]">zaplynx.app/turma-vip · 1.247 acessos</p>
                </div>
              </div>
              <div className="px-4 py-4 space-y-3">
                {/* Flow visualization */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-full">Link Único</div>
                  <span className="text-muted-foreground text-xs">→</span>
                  <div className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-full">Rotação Automática</div>
                </div>
                {/* Groups in rotation */}
                {[
                  { name: "Turma VIP #1", members: "248/250", full: true, pct: 99 },
                  { name: "Turma VIP #2", members: "245/250", full: false, pct: 98 },
                  { name: "Turma VIP #3", members: "102/250", full: false, pct: 41 },
                ].map((g, i) => (
                  <div key={i} className="bg-secondary/50 rounded-lg px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          #{i + 1}
                        </div>
                        <div>
                          <p className="text-foreground text-xs font-medium">{g.name}</p>
                          <p className="text-muted-foreground text-[10px]">{g.members} membros</p>
                        </div>
                      </div>
                      {g.full ? (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Lotado</span>
                      ) : i === 1 ? (
                        <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">Quase</span>
                      ) : (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Ativo ←</span>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${g.full ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${g.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                {/* Auto-create indicator */}
                <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2.5 border border-dashed border-primary/30">
                  <span className="text-sm">✨</span>
                  <div>
                    <p className="text-foreground text-[11px] font-medium">Próximo grupo criado automaticamente</p>
                    <p className="text-muted-foreground text-[10px]">Turma VIP #4 será criado ao lotar o #3</p>
                  </div>
                </div>
                <div className="text-center pt-1">
                  <span className="text-muted-foreground text-[10px]">Um link → vários grupos → sem lotação</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quem usa, recomenda */}
      <SocialProofSection />

      {/* Planos */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <h2 className="text-center text-[32px] font-extrabold text-foreground mb-10">
          Planos e Preços
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              name: "Plano Start",
              price: "397",
              popular: false,
              link: "https://checkout.perfectpay.com.br/pay/PPU38CQ97NN",
              features: [
                "1 Instância WhatsApp",
                "Envios em massa ilimitados",
                "Gestão de contatos",
                "Modelos de mensagens",
                "Fluxos visuais básicos",
                "Relatórios básicos",
                "Suporte via chat",
              ],
            },
            {
              name: "Plano Pro",
              price: "497",
              popular: true,
              link: "https://checkout.perfectpay.com.br/pay/PPU38CQ97NP",
              features: [
                "3 Instâncias WhatsApp",
                "Envios em massa ilimitados",
                "Agente de IA treinável",
                "Fluxos visuais",
                "Automação de boas-vindas",
                "Respostas automáticas",
                "Campanhas agendadas",
                "Relatórios avançados",
                "Suporte prioritário",
              ],
            },
            {
              name: "Plano Scale",
              price: "897",
              popular: false,
              link: "https://checkout.perfectpay.com.br/pay/PPU38CQ97NO",
              features: [
                "10 Instâncias WhatsApp",
                "Tudo do Plano Pro",
                "Fluxos visuais avançados",
                "Gateway de integrações",
                "API completa",
                "Gestão multi-usuário",
                "Relatórios personalizados",
                "Suporte dedicado",
              ],
            },
          ].map((plan, i) => (
            <div
              key={i}
              className={`bg-card border rounded-2xl p-8 text-center transition-transform hover:-translate-y-1 ${
                plan.popular ? "border-primary shadow-lg scale-105" : "border-border"
              }`}
            >
              {plan.popular && (
                <span className="inline-block bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full mb-3">
                  MAIS POPULAR
                </span>
              )}
              <h3 className="text-foreground font-semibold text-xl mb-4">{plan.name}</h3>
              <div className="mb-5">
                <span className="text-[32px] font-extrabold text-primary">R${plan.price}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
              <ul className="text-left space-y-2 mb-6">
                {plan.features.map((feat, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
              <a
                href={plan.link}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn w-full inline-block text-center"
              >
                Assinar
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-secondary/50 text-center py-20 px-5">
        <h2 className="text-[30px] font-extrabold text-foreground mb-4">
          Escalone seu WhatsApp com Inteligência Artificial
        </h2>
        <p className="text-muted-foreground mb-6">
          Transforme mensagens em vendas automaticamente.
        </p>
        <button
          onClick={() => navigate("/auth?signup=true")}
          className="landing-btn"
        >
          Começar Agora
        </button>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-border text-sm text-muted-foreground">
        © 2026 ZapLynx - Todos os direitos reservados
      </footer>
    </div>
  );
};

/* ===== Social Proof Carousel ===== */
function SocialProofSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const provas = [prova1, prova2, prova3, prova4, prova5];
  const slidesToShow = 3;
  const maxIndex = provas.length - slidesToShow;

  const prev = () => setIndex((i) => (i <= 0 ? maxIndex : i - 1));
  const next = () => setIndex((i) => (i >= maxIndex ? 0 : i + 1));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, 3000);
    return () => clearInterval(timer);
  }, [maxIndex]);

  return (
    <section className="w-[90%] max-w-[1200px] mx-auto py-20">
      <h2 className="text-center text-[32px] font-extrabold text-foreground mb-10">
        Quem usa, recomenda 🔥
      </h2>
      <div className="relative overflow-hidden">
        <button
          onClick={prev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-primary text-primary-foreground border-none text-lg px-3 py-2 rounded-md cursor-pointer hover:bg-primary/80"
        >
          &#10094;
        </button>
        <div
          ref={trackRef}
          className="flex transition-transform duration-400 ease-in-out"
          style={{ transform: `translateX(-${index * (100 / slidesToShow)}%)` }}
        >
          {provas.map((src, i) => (
            <div key={i} className="min-w-[33.3333%] px-3 max-md:min-w-full">
              <img
                src={src}
                alt={`Prova social ${i + 1}`}
                className="w-full h-auto rounded-2xl object-contain"
              />
            </div>
          ))}
        </div>
        <button
          onClick={next}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-primary text-primary-foreground border-none text-lg px-3 py-2 rounded-md cursor-pointer hover:bg-primary/80"
        >
          &#10095;
        </button>
      </div>
    </section>
  );
}

/* ===== Mouse Follow Effect ===== */
function MouseFollowEffect() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const move = (x: number, y: number) => {
      el.style.left = x + "px";
      el.style.top = y + "px";
    };

    const onMouse = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    };

    document.addEventListener("mousemove", onMouse);
    document.addEventListener("touchmove", onTouch);
    return () => {
      document.removeEventListener("mousemove", onMouse);
      document.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed w-[140px] h-[140px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[99999]"
      style={{
        background:
          "radial-gradient(circle, rgba(239,68,68,0.35) 0%, rgba(239,68,68,0.15) 40%, transparent 70%)",
      }}
    />
  );
}

export default Landing;
