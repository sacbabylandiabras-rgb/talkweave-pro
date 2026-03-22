import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
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
    <div className="min-h-screen bg-landing-dark text-white relative overflow-hidden">
      {/* Decorative curved border line */}
      <div className="landing-deco-line" />

      {/* Header */}
      <header className="relative z-10 w-[90%] max-w-[1200px] mx-auto flex justify-between items-center py-6">
        <img src={logoImage} alt="ZapLynx Logo" className="h-14" />
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/auth")}
            className="text-white/80 hover:text-white transition-colors font-medium text-sm"
          >
            Entrar
          </button>
          <button
            onClick={() => navigate("/auth?signup=true")}
            className="landing-btn-new"
          >
            Começar Agora
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 w-[90%] max-w-[900px] mx-auto text-center pt-20 pb-10 md:pt-28 md:pb-16">
        <h1 className="text-4xl md:text-[56px] font-extrabold leading-[1.1] text-white mb-6">
          Gerencie suas mensagens do{" "}
          <span className="text-landing-accent">WhatsApp</span> em escala
        </h1>
        <p className="text-lg md:text-xl text-white/70 max-w-[640px] mx-auto mb-10 leading-relaxed">
          Automação profissional, agente inteligente com IA e gestão completa
          para transformar mensagens em vendas todos os dias.
        </p>
        <button
          onClick={() => navigate("/auth?signup=true")}
          className="landing-btn-new text-lg px-10 py-4"
        >
          Criar Conta Grátis
        </button>
      </section>

      {/* Dashboard Mockup */}
      <section className="relative z-10 w-[90%] max-w-[900px] mx-auto pb-20">
        <div className="landing-mockup-card">
          <img
            src={dashboardMockup}
            alt="ZapLynx Dashboard"
            className="w-full rounded-lg"
          />
        </div>
      </section>

      {/* Social proof bar */}
      <div className="relative z-10 border-y border-white/10 py-6 mb-10">
        <p className="text-center text-white/50 text-sm tracking-wide">
          Junte-se a centenas de empresas que já automatizam suas vendas pelo WhatsApp
        </p>
      </div>

      {/* Benefícios grid */}
      <section className="relative z-10 w-[90%] max-w-[1200px] mx-auto py-20">
        <h2 className="text-center text-3xl md:text-[40px] font-extrabold text-white mb-4">
          Plataforma Completa de <span className="text-landing-accent">Automação</span>
        </h2>
        <p className="text-center text-white/60 mb-14 max-w-[600px] mx-auto">
          Tudo que você precisa para escalar seu WhatsApp em um único painel.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { emoji: "🤖", title: "Agente de IA Treinável", desc: "Responde automaticamente seus clientes 24h por dia." },
            { emoji: "🚀", title: "Envios Estratégicos", desc: "Dispare campanhas segmentadas com alta performance." },
            { emoji: "📊", title: "Relatórios Avançados", desc: "Acompanhe métricas e resultados em tempo real." },
            { emoji: "⚙", title: "Gestão Multi-Instância", desc: "Gerencie vários números em um único painel." },
          ].map((card, i) => (
            <div
              key={i}
              className="landing-feature-card"
            >
              <span className="text-3xl mb-3 block">{card.emoji}</span>
              <h3 className="text-white font-semibold mb-2">{card.title}</h3>
              <p className="text-white/60 text-[15px]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Showcase - Envios em Massa */}
      <FeatureSection
        title={<>Envios em Massa com <span className="text-landing-accent">Controle Total</span></>}
        description="Dispare mensagens para milhares de contatos com intervalos inteligentes, revezamento automático entre instâncias e acompanhamento em tempo real do progresso de cada envio."
        items={[
          "Envio segmentado por grupos e listas",
          "Delay configurável entre mensagens",
          "Relatório detalhado de entregas",
          "Suporte a texto, imagem, áudio e vídeo",
        ]}
        ctaText="Começar a Enviar"
        navigate={navigate}
        visual={<PhoneMockup />}
        reversed
      />

      {/* Fluxo Visual */}
      <FeatureSection
        title={<>Fluxos Visuais de <span className="text-landing-accent">Automação</span></>}
        description="Crie automações poderosas arrastando e conectando blocos visuais. Sem código, sem complicação — monte jornadas completas para seus clientes com lógica condicional, ações automáticas e gatilhos inteligentes."
        items={[
          "Editor visual drag-and-drop intuitivo",
          "Gatilhos por palavra-chave ou evento",
          "Condições e ramificações inteligentes",
          "Envio de mensagens, mídias e links automáticos",
          "Integração com webhooks e APIs externas",
          "Ativação e desativação com um clique",
        ]}
        ctaText="Criar Meus Fluxos"
        navigate={navigate}
        visual={
          <div className="landing-mockup-card">
            <img src={fluxoScreenshot3} alt="Fluxo visual de automação" className="w-full rounded-lg" />
          </div>
        }
      />

      {/* Extração de Leads */}
      <FeatureSection
        title={<>Extraia <span className="text-landing-accent">Leads</span> de Grupos e Comunidades</>}
        description="Transforme grupos e comunidades do WhatsApp em listas de contatos qualificados. Nosso sistema identifica automaticamente todos os grupos e comunidades das suas instâncias e extrai os números dos participantes com um clique."
        items={[
          "Detecção automática de grupos e comunidades",
          "Extração de participantes com um clique",
          "Sincronização entre múltiplas instâncias",
          "Envie campanhas direto para os leads extraídos",
        ]}
        ctaText="Extrair Leads Agora"
        navigate={navigate}
        reversed
        visual={
          <div className="landing-glass-card p-6 space-y-4 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">👥</span>
              <h4 className="text-white font-bold text-lg">Grupos & Comunidades</h4>
            </div>
            {[
              { name: "Marketing Digital 2026", members: 847, type: "Grupo" },
              { name: "Comunidade Vendas BR", members: 3420, type: "Comunidade" },
              { name: "Empreendedores SP", members: 562, type: "Grupo" },
            ].map((group, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{group.name}</p>
                  <p className="text-white/50 text-xs">{group.members} membros · {group.type}</p>
                </div>
                <span className="text-landing-accent text-xs font-bold">Extrair</span>
              </div>
            ))}
            <div className="text-center pt-2">
              <span className="text-white/40 text-xs">+ 12 grupos e comunidades disponíveis</span>
            </div>
          </div>
        }
      />

      {/* Agente de IA */}
      <FeatureSection
        title={<>Agente de IA que <span className="text-landing-accent">Vende por Você</span> 24h</>}
        description="Treine um agente inteligente com o conhecimento do seu negócio. Ele responde seus clientes no WhatsApp automaticamente, tira dúvidas, envia links de produtos e conduz a venda — mesmo enquanto você dorme."
        items={[
          "Treinável com FAQ, documentos e sites",
          "Respostas naturais e personalizadas",
          "Funciona 24 horas por dia, 7 dias por semana",
          "Integrado diretamente ao seu WhatsApp",
          "Chat de teste no painel para validar respostas",
        ]}
        ctaText="Testar Agente de IA"
        navigate={navigate}
        visual={
          <div className="landing-glass-card p-6 space-y-4 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🧠</span>
              <h4 className="text-white font-bold text-lg">Agente Inteligente</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-landing-accent/20 text-white text-sm rounded-xl rounded-br-sm px-4 py-2 max-w-[80%]">
                  Oi, vocês têm esse produto disponível?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white/10 text-white text-sm rounded-xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                  Olá! Sim, temos disponível 😊 Posso te enviar o link com mais detalhes e condições especiais?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-landing-accent/20 text-white text-sm rounded-xl rounded-br-sm px-4 py-2 max-w-[80%]">
                  Sim, por favor!
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white/10 text-white text-sm rounded-xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                  Aqui está! 🔗 Qualquer dúvida, estou aqui pra te ajudar.
                </div>
              </div>
            </div>
            <div className="text-center pt-2">
              <span className="text-white/40 text-xs">Resposta automática via IA · 2s</span>
            </div>
          </div>
        }
      />

      {/* Integração com Checkouts */}
      <FeatureSection
        title={<>Integração com Qualquer <span className="text-landing-accent">Checkout ou Gateway</span></>}
        description="Conecte sua plataforma de vendas ao ZapLynx via webhook e automatize o envio de mensagens com base em eventos de pagamento."
        items={[
          "Compatível com PerfectPay, Hotmart, Kiwify, Stripe e mais",
          "Disparo automático por evento (aprovado, cancelado, reembolso)",
          "Mensagens personalizadas por tipo de evento",
          "Configuração simples via URL de webhook única",
          "Histórico completo de eventos recebidos",
        ]}
        ctaText="Conectar Meu Checkout"
        navigate={navigate}
        reversed
        visual={
          <div className="landing-glass-card p-6 space-y-4 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔗</span>
              <h4 className="text-white font-bold text-lg">Integrações Conectadas</h4>
            </div>
            {[
              { name: "PerfectPay", status: "Ativo", icon: "💳" },
              { name: "Hotmart", status: "Ativo", icon: "🔥" },
              { name: "Kiwify", status: "Ativo", icon: "🥝" },
              { name: "Stripe", status: "Ativo", icon: "💎" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <p className="text-white text-sm font-medium">{item.name}</p>
                </div>
                <span className="text-landing-accent text-xs font-bold">{item.status}</span>
              </div>
            ))}
            <div className="text-center pt-2">
              <span className="text-white/40 text-xs">+ qualquer plataforma com webhook</span>
            </div>
          </div>
        }
      />

      {/* Modelos de Mensagens */}
      <FeatureSection
        title={<>Modelos Prontos para <span className="text-landing-accent">Envio Rápido</span></>}
        description="Crie e salve modelos de mensagens reutilizáveis com texto, imagens, vídeos, áudios, botões interativos e até carrosséis completos."
        items={[
          "Modelos com texto, mídia, botões e carrossel",
          "Variáveis dinâmicas como {{nome}} e {{telefone}}",
          "Categorias organizadas (vendas, suporte, remarketing)",
          "Integração direta com campanhas e fluxos",
          "Reutilize em envios em massa com um clique",
        ]}
        ctaText="Criar Meus Modelos"
        navigate={navigate}
        visual={
          <div className="landing-glass-card p-6 space-y-4 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📋</span>
              <h4 className="text-white font-bold text-lg">Modelos Salvos</h4>
            </div>
            {[
              { name: "Boas-vindas VIP", type: "Texto + Botão", category: "Vendas" },
              { name: "Promoção Relâmpago", type: "Imagem + Texto", category: "Marketing" },
              { name: "Lembrete de Pagamento", type: "Texto", category: "Cobrança" },
              { name: "Catálogo de Produtos", type: "Carrossel", category: "Vendas" },
            ].map((tpl, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{tpl.name}</p>
                  <p className="text-white/50 text-xs">{tpl.type} · {tpl.category}</p>
                </div>
                <span className="text-landing-accent text-xs font-bold">Usar</span>
              </div>
            ))}
            <div className="text-center pt-2">
              <span className="text-white/40 text-xs">+ crie modelos ilimitados</span>
            </div>
          </div>
        }
      />

      {/* Boas-Vindas */}
      <FeatureSection
        title={<>Boas-Vindas <span className="text-landing-accent">Automáticas</span> nos Grupos</>}
        description="Receba novos membros nos seus grupos do WhatsApp de forma automática e profissional. Configure mensagens personalizadas com o nome do participante."
        items={[
          "Mensagem automática ao entrar no grupo",
          "Personalização com {{nome}}, {{telefone}} e {{grupo}}",
          "Suporte a texto, modelos com mídia e botões",
          "Acione fluxos visuais como resposta de boas-vindas",
          "Configuração individual por grupo",
        ]}
        ctaText="Configurar Boas-Vindas"
        navigate={navigate}
        reversed
        visual={
          <div className="landing-glass-card w-full max-w-sm overflow-hidden">
            <div className="bg-landing-accent/20 px-4 py-3 flex items-center gap-3 border-b border-white/10">
              <div className="w-9 h-9 rounded-full bg-landing-accent/30 flex items-center justify-center text-sm font-bold text-landing-accent">VIP</div>
              <div>
                <p className="text-white text-sm font-semibold">Grupo VIP Clientes</p>
                <p className="text-white/50 text-[10px]">48 participantes</p>
              </div>
            </div>
            <div className="px-4 py-4 space-y-3 min-h-[260px]">
              <div className="flex justify-center">
                <span className="text-[10px] text-white/50 bg-white/10 px-3 py-1 rounded-full">
                  Maria Silva entrou no grupo
                </span>
              </div>
              <div className="flex justify-center">
                <span className="text-landing-accent text-lg animate-bounce">⬇</span>
              </div>
              <div className="flex justify-end">
                <div className="bg-landing-accent text-white rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
                  <p className="text-xs leading-relaxed">Olá <strong>Maria Silva</strong>! 👋</p>
                  <p className="text-xs leading-relaxed mt-1">Bem-vindo ao nosso grupo VIP! Aqui você terá acesso a ofertas exclusivas e conteúdos especiais.</p>
                  <div className="mt-2 space-y-1">
                    <div className="text-center text-[11px] font-medium py-1.5 rounded-md border border-white/30 bg-white/10">
                      🛒 Ver Ofertas
                    </div>
                    <div className="text-center text-[11px] font-medium py-1.5 rounded-md border border-white/30 bg-white/10">
                      📞 Falar com Suporte
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <span className="text-[9px] opacity-70">🤖 Automático</span>
                    <span className="text-[9px] opacity-60">14:32</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-lg rounded-tl-none px-3 py-2 max-w-[70%] shadow-sm">
                  <p className="text-xs text-white">Obrigada! 😍</p>
                  <p className="text-[9px] text-white/50 text-right mt-0.5">14:33</p>
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* Gerenciamento de Grupos */}
      <FeatureSection
        title={<>Gestão Completa de <span className="text-landing-accent">Grupos WhatsApp</span></>}
        description="Gerencie todos os seus grupos diretamente pelo painel. Crie grupos, altere nome, descrição e foto, adicione ou remova participantes — tudo sem precisar abrir o WhatsApp."
        items={[
          "Criar grupos e adicionar participantes em massa",
          "Alterar nome, descrição e foto do grupo",
          "Promover e remover administradores",
          "Restringir mensagens apenas para admins",
          "Links de convite e redirecionamento rotativo",
          "Gerenciamento centralizado de múltiplas instâncias",
        ]}
        ctaText="Gerenciar Meus Grupos"
        navigate={navigate}
        visual={
          <div className="landing-glass-card w-full max-w-sm overflow-hidden">
            <div className="bg-landing-accent/20 px-4 py-3 flex items-center gap-3 border-b border-white/10">
              <span className="text-2xl">🔗</span>
              <div>
                <p className="text-white text-sm font-semibold">Link Rotativo: Turma VIP</p>
                <p className="text-white/50 text-[10px]">zaplynx.app/turma-vip · 1.247 acessos</p>
              </div>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="bg-landing-accent/20 text-landing-accent text-[10px] font-bold px-2 py-1 rounded-full">Link Único</div>
                <span className="text-white/40 text-xs">→</span>
                <div className="bg-landing-accent/20 text-landing-accent text-[10px] font-bold px-2 py-1 rounded-full">Rotação Automática</div>
              </div>
              {[
                { name: "Turma VIP #1", members: "248/250", full: true, pct: 99 },
                { name: "Turma VIP #2", members: "245/250", full: false, pct: 98 },
                { name: "Turma VIP #3", members: "102/250", full: false, pct: 41 },
              ].map((g, i) => (
                <div key={i} className="bg-white/5 rounded-lg px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-landing-accent/20 flex items-center justify-center text-xs font-bold text-landing-accent">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">{g.name}</p>
                        <p className="text-white/50 text-[10px]">{g.members} membros</p>
                      </div>
                    </div>
                    {g.full ? (
                      <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Lotado</span>
                    ) : i === 1 ? (
                      <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">Quase</span>
                    ) : (
                      <span className="text-[10px] font-bold text-landing-accent bg-landing-accent/10 px-2 py-0.5 rounded-full">Ativo ←</span>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${g.full ? 'bg-red-400' : 'bg-landing-accent'}`}
                      style={{ width: `${g.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 bg-landing-accent/10 rounded-lg px-3 py-2.5 border border-dashed border-landing-accent/30">
                <span className="text-sm">✨</span>
                <div>
                  <p className="text-white text-[11px] font-medium">Próximo grupo criado automaticamente</p>
                  <p className="text-white/50 text-[10px]">Turma VIP #4 será criado ao lotar o #3</p>
                </div>
              </div>
              <div className="text-center pt-1">
                <span className="text-white/40 text-[10px]">Um link → vários grupos → sem lotação</span>
              </div>
            </div>
          </div>
        }
      />

      {/* Quem usa, recomenda */}
      <SocialProofSection />

      {/* Planos */}
      <section className="relative z-10 w-[90%] max-w-[1200px] mx-auto py-20">
        <h2 className="text-center text-3xl md:text-[40px] font-extrabold text-white mb-4">
          Planos e <span className="text-landing-accent">Preços</span>
        </h2>
        <p className="text-center text-white/60 mb-14 max-w-[500px] mx-auto">
          Sem amarras, sem precisar dar explicações. Cancele quando quiser.
        </p>
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
              className={`landing-plan-card ${plan.popular ? "landing-plan-card--popular" : ""}`}
            >
              {plan.popular && (
                <span className="inline-block bg-landing-accent text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                  MAIS POPULAR
                </span>
              )}
              <h3 className="text-white font-semibold text-xl mb-4">{plan.name}</h3>
              <div className="mb-5">
                <span className="text-[40px] font-extrabold text-landing-accent">R${plan.price}</span>
                <span className="text-sm text-white/50">/mês</span>
              </div>
              <ul className="text-left space-y-2 mb-6">
                {plan.features.map((feat, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="text-landing-accent mt-0.5">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
              <a
                href={plan.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`landing-btn-new w-full inline-block text-center ${!plan.popular ? 'bg-white/10 border-white/20 hover:bg-white/20' : ''}`}
              >
                Assinar
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative z-10 text-center py-24 px-5">
        <div className="max-w-[700px] mx-auto">
          <h2 className="text-3xl md:text-[40px] font-extrabold text-white mb-5 leading-tight">
            Escalone seu WhatsApp com <span className="text-landing-accent">Inteligência Artificial</span>
          </h2>
          <p className="text-white/60 mb-8 text-lg">
            Transforme mensagens em vendas automaticamente.
          </p>
          <button
            onClick={() => navigate("/auth?signup=true")}
            className="landing-btn-new text-lg px-10 py-4"
          >
            Começar Agora
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 border-t border-white/10 text-sm text-white/40">
        © 2026 ZapLynx - Todos os direitos reservados
      </footer>
    </div>
  );
};

/* ===== Reusable Feature Section ===== */
function FeatureSection({
  title,
  description,
  items,
  ctaText,
  navigate,
  visual,
  reversed = false,
}: {
  title: React.ReactNode;
  description: string;
  items: string[];
  ctaText: string;
  navigate: ReturnType<typeof useNavigate>;
  visual: React.ReactNode;
  reversed?: boolean;
}) {
  return (
    <section className="relative z-10 w-[90%] max-w-[1200px] mx-auto py-20">
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center`}>
        <div className={`space-y-6 ${reversed ? 'md:order-2' : ''}`}>
          <h2 className="text-3xl md:text-[36px] font-extrabold text-white leading-tight">
            {title}
          </h2>
          <p className="text-white/60 text-base leading-relaxed">{description}</p>
          <ul className="space-y-3">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <span className="text-landing-accent mt-0.5 font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <button onClick={() => navigate("/auth?signup=true")} className="landing-btn-new">
            {ctaText}
          </button>
        </div>
        <div className={`flex justify-center ${reversed ? 'md:order-1' : ''}`}>
          {visual}
        </div>
      </div>
    </section>
  );
}

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
    <section className="relative z-10 w-[90%] max-w-[1200px] mx-auto py-20">
      <h2 className="text-center text-3xl md:text-[40px] font-extrabold text-white mb-10">
        Quem usa, <span className="text-landing-accent">recomenda</span> 🔥
      </h2>
      <div className="relative overflow-hidden">
        <button
          onClick={prev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-landing-accent text-white border-none text-lg px-3 py-2 rounded-md cursor-pointer hover:bg-landing-accent/80"
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
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-landing-accent text-white border-none text-lg px-3 py-2 rounded-md cursor-pointer hover:bg-landing-accent/80"
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
          "radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.10) 40%, transparent 70%)",
      }}
    />
  );
}

export default Landing;
