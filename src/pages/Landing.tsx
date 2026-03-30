import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Bot, Rocket, BarChart3, Settings, Users, Brain, Link, CreditCard, Flame, Cherry, Gem, ClipboardList, ArrowDown, ShoppingCart, Phone, Sparkles, Check, Shield, Zap, DollarSign, Store, MessageSquare, Globe, Lock, TrendingUp, Wallet } from "lucide-react";
import logoImage from "@/assets/logo.png";
import dashboardMockup from "@/assets/dashboard-new.png";
import PhoneMockup from "@/components/landing/PhoneMockup";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen landing-bg text-foreground relative">
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
          <span className="text-primary">Gateway de Pagamentos</span> +{" "}
          Sistema de Gestão <span className="text-primary">WhatsApp</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-[650px] mx-auto mb-8">
          Receba pagamentos via Pix, gerencie checkouts personalizados e automatize
          toda sua comunicação no WhatsApp — tudo em uma única plataforma.
        </p>
        <button
          onClick={() => navigate("/auth?signup=true")}
          className="landing-btn mt-8"
        >
          Criar Conta Grátis
        </button>
      </section>

      {/* Números / Destaques */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <DollarSign className="w-6 h-6 text-primary" />, title: "Gateway Pix Integrado", desc: "Receba pagamentos instantâneos com checkout próprio." },
            { icon: <MessageSquare className="w-6 h-6 text-primary" />, title: "Automação WhatsApp", desc: "Envios em massa, IA, fluxos visuais e boas-vindas." },
            { icon: <Shield className="w-6 h-6 text-primary" />, title: "KYC e Segurança", desc: "Verificação de identidade e antifraude integrados." },
            { icon: <TrendingUp className="w-6 h-6 text-primary" />, title: "Relatórios em Tempo Real", desc: "Acompanhe vendas, conversões e métricas ao vivo." },
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

      {/* Gateway de Pagamentos */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Gateway de Pagamentos Completo
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Crie checkouts personalizados, receba via Pix instantâneo, acompanhe transações 
              em tempo real e gerencie saques — tudo com sua marca e sem intermediários.
            </p>
            <ul className="space-y-3">
              {[
                "Checkout customizável com 6+ templates profissionais",
                "Pagamento via Pix com confirmação instantânea",
                "Gestão de produtos físicos e digitais",
                "Painel de transações com filtros avançados",
                "Saques automáticos para sua conta",
                "Pixels de rastreamento (Facebook, Google, TikTok)",
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
              Criar Meu Checkout
            </button>
          </div>
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Store className="w-7 h-7 text-primary" />
                <h4 className="text-foreground font-bold text-lg">ZapLynxPay</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <p className="text-foreground text-sm font-medium">Vendas Hoje</p>
                  <span className="text-primary text-xs font-bold">R$ 12.847,00</span>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <p className="text-foreground text-sm font-medium">Transações</p>
                  <span className="text-primary text-xs font-bold">148</span>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <p className="text-foreground text-sm font-medium">Taxa de Conversão</p>
                  <span className="text-primary text-xs font-bold">73.4%</span>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-foreground text-sm font-medium">Checkout Ativo</p>
                  </div>
                  <span className="text-primary text-xs font-bold">Online</span>
                </div>
              </div>
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">Pix instantâneo · Sem mensalidade</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Checkout Personalizado */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <ShoppingCart className="w-7 h-7 text-primary" />
                <h4 className="text-foreground font-bold text-lg">Templates de Checkout</h4>
              </div>
              {[
                { name: "Alto Impacto", desc: "Urgência + escassez", tag: "Popular" },
                { name: "Minimalista", desc: "Clean e direto", tag: "Novo" },
                { name: "Confiança", desc: "Selos + garantia", tag: "Pro" },
                { name: "TikTok Style", desc: "Visual moderno", tag: "Trend" },
              ].map((tpl, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">{tpl.name}</p>
                    <p className="text-muted-foreground text-xs">{tpl.desc}</p>
                  </div>
                  <span className="text-primary text-xs font-bold">{tpl.tag}</span>
                </div>
              ))}
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">6+ layouts profissionais disponíveis</span>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Checkouts que Convertem
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Escolha entre templates otimizados para conversão ou personalize cada detalhe 
              do seu checkout. Cores, textos, selos de segurança, timer de urgência e muito mais.
            </p>
            <ul className="space-y-3">
              {[
                "6+ templates prontos e otimizados",
                "Personalização completa de cores e textos",
                "Timer de urgência e contador de vendas",
                "Selos de segurança e garantia",
                "CPF obrigatório para validação",
                "Responsivo para mobile e desktop",
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
              Montar Meu Checkout
            </button>
          </div>
        </div>
      </section>

      {/* Envios em Massa WhatsApp */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
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
              revezamento automático entre instâncias e acompanhamento em tempo real.
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

      {/* Integração Webhooks + Automação pós-venda */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Automação Pós-Venda via WhatsApp
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Quando um pagamento é confirmado, o ZapLynx envia automaticamente mensagens 
              no WhatsApp do cliente. Funciona com qualquer plataforma de checkout via webhook.
            </p>
            <ul className="space-y-3">
              {[
                "Disparo automático por evento (aprovado, cancelado, reembolso)",
                "Compatível com PerfectPay, Hotmart, Kiwify, Stripe e mais",
                "Mensagens personalizadas por tipo de evento",
                "Funis de recuperação de vendas abandonadas",
                "Histórico completo de eventos e entregas",
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
              Automatizar Pós-Venda
            </button>
          </div>
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-7 h-7 text-primary" />
                <h4 className="text-foreground font-bold text-lg">Automação Ativa</h4>
              </div>
              {[
                { event: "Pagamento Aprovado", action: "Enviar acesso + boas-vindas", status: "Ativo" },
                { event: "Boleto Gerado", action: "Lembrete de pagamento", status: "Ativo" },
                { event: "Carrinho Abandonado", action: "Recuperação em 30min", status: "Ativo" },
                { event: "Reembolso", action: "Pesquisa de satisfação", status: "Ativo" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">{item.event}</p>
                    <p className="text-muted-foreground text-xs">{item.action}</p>
                  </div>
                  <span className="text-primary text-xs font-bold">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Agente de IA */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-7 h-7 text-primary" />
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
                    Olá! Sim, temos disponível 😊 Posso te enviar o link de pagamento?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary/10 text-foreground text-sm rounded-xl rounded-br-sm px-4 py-2 max-w-[80%]">
                    Sim, por favor!
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-secondary text-foreground text-sm rounded-xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                    Aqui está seu checkout: zaplynx.pay/produto ✅
                  </div>
                </div>
              </div>
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">Resposta automática via IA · 2s</span>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Agente de IA que Vende por Você 24h
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Treine um agente inteligente com o conhecimento do seu negócio. 
              Ele responde clientes, envia links de checkout e conduz a venda automaticamente.
            </p>
            <ul className="space-y-3">
              {[
                "Treinável com FAQ, documentos e sites",
                "Envia links de checkout automaticamente",
                "Funciona 24 horas por dia, 7 dias por semana",
                "Integrado ao gateway de pagamentos",
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
              Ativar Agente de IA
            </button>
          </div>
        </div>
      </section>

      {/* Meta API Oficial */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              API Oficial do WhatsApp (Meta)
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Integre via API Oficial da Meta para disparos com alta taxa de entrega, 
              templates aprovados e perfil Business profissional.
            </p>
            <ul className="space-y-3">
              {[
                "Conexão via OAuth automática",
                "Templates aprovados pela Meta",
                "Alta taxa de entrega (99%+)",
                "WhatsApp Business API v21.0",
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
              Conectar Meta API
            </button>
          </div>
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-7 h-7 text-primary" />
                <h4 className="text-foreground font-bold text-lg">Meta WhatsApp API</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-foreground text-sm font-medium">Conta Conectada</p>
                  </div>
                  <span className="text-primary text-xs font-bold">Ativa</span>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <p className="text-foreground text-sm font-medium">Templates Aprovados</p>
                  <span className="text-primary text-xs font-bold">12</span>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <p className="text-foreground text-sm font-medium">Mensagens Hoje</p>
                  <span className="text-primary text-xs font-bold">1.847</span>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                  <p className="text-foreground text-sm font-medium">Taxa de Entrega</p>
                  <span className="text-primary text-xs font-bold">99.2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gestão de Grupos */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-primary/15 px-4 py-3 flex items-center gap-3 border-b border-border">
                <Link className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-foreground text-sm font-semibold">Link Rotativo: Clientes VIP</p>
                  <p className="text-muted-foreground text-[10px]">zaplynx.app/vip · 2.340 acessos</p>
                </div>
              </div>
              <div className="px-4 py-4 space-y-3">
                {[
                  { name: "Clientes VIP #1", members: "248/250", pct: 99, full: true },
                  { name: "Clientes VIP #2", members: "189/250", pct: 76, full: false },
                  { name: "Clientes VIP #3", members: "45/250", pct: 18, full: false },
                ].map((g, i) => (
                  <div key={i} className="bg-secondary/50 rounded-lg px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          #{i + 1}
                        </div>
                        <div>
                          <p className="text-foreground text-xs font-medium">{g.name}</p>
                          <p className="text-muted-foreground text-[10px]">{g.members}</p>
                        </div>
                      </div>
                      {g.full ? (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Lotado</span>
                      ) : (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Ativo</span>
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
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Gestão Completa de Grupos WhatsApp
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Crie grupos, extraia leads, configure boas-vindas automáticas e use links 
              rotativos para distribuir membros entre vários grupos automaticamente.
            </p>
            <ul className="space-y-3">
              {[
                "Criar grupos e adicionar participantes em massa",
                "Extração de leads de grupos e comunidades",
                "Boas-vindas automáticas personalizadas",
                "Links rotativos com distribuição inteligente",
                "Gerenciamento centralizado multi-instância",
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
              Gerenciar Grupos
            </button>
          </div>
        </div>
      </section>

      {/* Fluxos Visuais */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-[32px] font-extrabold text-foreground leading-tight">
              Fluxos Visuais de Automação
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Monte jornadas completas arrastando blocos visuais. Gatilhos por palavra-chave, 
              condições inteligentes e ações automáticas — sem código.
            </p>
            <ul className="space-y-3">
              {[
                "Editor visual drag-and-drop",
                "Gatilhos por palavra-chave ou evento de pagamento",
                "Condições e ramificações inteligentes",
                "Integração com webhooks e APIs externas",
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
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-7 h-7 text-primary" />
                <h4 className="text-foreground font-bold text-lg">Fluxo Ativo</h4>
              </div>
              <div className="space-y-2">
                {[
                  { step: "1", label: "Gatilho: 'quero comprar'", color: "bg-primary/20 text-primary" },
                  { step: "2", label: "Enviar catálogo de produtos", color: "bg-blue-500/20 text-blue-400" },
                  { step: "3", label: "Aguardar resposta (30s)", color: "bg-amber-500/20 text-amber-400" },
                  { step: "4", label: "Enviar link de checkout", color: "bg-green-500/20 text-green-400" },
                  { step: "5", label: "Confirmar pagamento via webhook", color: "bg-purple-500/20 text-purple-400" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${s.color}`}>
                      {s.step}
                    </div>
                    <p className="text-foreground text-sm">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-xs">Fluxo de venda completo · Automático</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-secondary/50 text-center py-20 px-5">
        <h2 className="text-[30px] font-extrabold text-foreground mb-4">
          Venda mais com Gateway + WhatsApp integrados
        </h2>
        <p className="text-muted-foreground mb-6">
          Receba pagamentos e automatize sua comunicação em uma única plataforma.
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
