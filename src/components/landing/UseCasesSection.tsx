import { useState } from "react";

interface UseCase {
  title: string;
  description: string;
  chatContent: React.ReactNode;
}

const useCases: UseCase[] = [
  {
    title: "Envios em Massa Inteligentes",
    description:
      "Dispare mensagens para milhares de contatos com intervalos configuráveis, revezamento entre instâncias e acompanhamento em tempo real.",
    chatContent: (
      <div className="px-4 py-4 space-y-3 bg-secondary/20 min-h-[340px]">
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
            <p className="text-xs leading-relaxed">🔥 Oferta exclusiva para você!</p>
            <p className="text-xs leading-relaxed mt-1">Garanta 40% OFF em todos os cursos até sexta-feira. Clique abaixo 👇</p>
            <div className="mt-2">
              <div className="text-center text-[11px] font-medium py-1.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10">
                🛒 Ver Ofertas
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className="text-[9px] opacity-60">10:30 ✓✓</span>
            </div>
          </div>
        </div>
        <div className="flex justify-center">
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
            Enviando para 1.247 contatos...
          </span>
        </div>
        <div className="flex justify-start">
          <div className="bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[75%] shadow-sm">
            <p className="text-xs text-foreground">Opa! Me interessei, como faço?</p>
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">10:32</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[75%] shadow-sm">
            <p className="text-xs text-foreground">Quero aproveitar! 🙋‍♂️</p>
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">10:33</p>
          </div>
        </div>
        <div className="bg-primary/10 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] text-primary font-semibold">📊 847 entregues · 23 respostas · 12 cliques</p>
        </div>
      </div>
    ),
  },
  {
    title: "Agente de IA 24h",
    description:
      "Treine um agente inteligente com o conhecimento do seu negócio. Ele responde clientes, tira dúvidas e conduz vendas automaticamente.",
    chatContent: (
      <div className="px-4 py-4 space-y-3 bg-secondary/20 min-h-[340px]">
        <div className="flex justify-start">
          <div className="bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[80%] shadow-sm">
            <p className="text-xs text-foreground">Oi, vocês têm esse produto disponível?</p>
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">14:02</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
            <p className="text-xs leading-relaxed">Olá! Sim, temos disponível 😊</p>
            <p className="text-xs leading-relaxed mt-1">Posso te enviar o link com mais detalhes e condições especiais?</p>
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className="text-[9px] opacity-70">🤖 IA</span>
              <span className="text-[9px] opacity-60">14:02</span>
            </div>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[70%] shadow-sm">
            <p className="text-xs text-foreground">Sim, por favor!</p>
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">14:03</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
            <p className="text-xs leading-relaxed">Aqui está! 🔗 https://loja.com/produto</p>
            <p className="text-xs leading-relaxed mt-1">Qualquer dúvida, estou aqui pra ajudar.</p>
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className="text-[9px] opacity-70">🤖 IA · 2s</span>
              <span className="text-[9px] opacity-60">14:03</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Boas-Vindas Automáticas",
    description:
      "Receba novos membros nos seus grupos automaticamente com mensagens personalizadas, botões interativos e fluxos visuais.",
    chatContent: (
      <div className="px-4 py-4 space-y-3 bg-secondary/20 min-h-[340px]">
        <div className="flex justify-center">
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
            Maria Silva entrou no grupo
          </span>
        </div>
        <div className="flex justify-center">
          <span className="text-primary text-lg animate-bounce">⬇</span>
        </div>
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
            <p className="text-xs leading-relaxed">Olá <strong>Maria Silva</strong>! 👋</p>
            <p className="text-xs leading-relaxed mt-1">Bem-vindo ao nosso grupo VIP! Aqui você terá acesso a ofertas exclusivas.</p>
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
        <div className="flex justify-start">
          <div className="bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[70%] shadow-sm">
            <p className="text-xs text-foreground">Obrigada! 😍</p>
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">14:33</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Links Rotativos & Gestão de Grupos",
    description:
      "Crie um link único que distribui membros automaticamente entre vários grupos. Gerencie nome, foto e descrição em massa.",
    chatContent: (
      <div className="px-4 py-3 space-y-3 min-h-[340px]">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-full">Link Único</div>
          <span className="text-muted-foreground text-xs">→</span>
          <div className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-full">Rotação Auto</div>
        </div>
        {[
          { name: "Turma VIP #1", members: "248/250", pct: 99, status: "Lotado", color: "destructive" },
          { name: "Turma VIP #2", members: "245/250", pct: 98, status: "Quase", color: "yellow" },
          { name: "Turma VIP #3", members: "102/250", pct: 41, status: "Ativo ←", color: "primary" },
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
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                g.color === "destructive" ? "text-destructive bg-destructive/10" :
                g.color === "yellow" ? "text-yellow-500 bg-yellow-500/10" :
                "text-primary bg-primary/10"
              }`}>{g.status}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${g.color === "destructive" ? "bg-destructive" : "bg-primary"}`} style={{ width: `${g.pct}%` }} />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2 border border-dashed border-primary/30">
          <span className="text-sm">✨</span>
          <p className="text-foreground text-[11px] font-medium">Turma VIP #4 será criado automaticamente</p>
        </div>
      </div>
    ),
  },
  {
    title: "Integração com Checkouts",
    description:
      "Conecte PerfectPay, Hotmart, Kiwify, Stripe e qualquer plataforma via webhook. Dispare mensagens automáticas por evento de pagamento.",
    chatContent: (
      <div className="px-4 py-4 space-y-3 bg-secondary/20 min-h-[340px]">
        <div className="flex justify-center">
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
            💳 Pagamento aprovado via PerfectPay
          </span>
        </div>
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
            <p className="text-xs leading-relaxed">Parabéns <strong>João</strong>! 🎉</p>
            <p className="text-xs leading-relaxed mt-1">Seu acesso ao curso "Marketing Digital Pro" foi liberado!</p>
            <div className="mt-2 space-y-1">
              <div className="text-center text-[11px] font-medium py-1.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10">
                📚 Acessar Curso
              </div>
              <div className="text-center text-[11px] font-medium py-1.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10">
                🔗 Entrar no Grupo VIP
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className="text-[9px] opacity-70">🤖 Automático</span>
              <span className="text-[9px] opacity-60">15:47</span>
            </div>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[70%] shadow-sm">
            <p className="text-xs text-foreground">Muito obrigado! Já vou acessar 🚀</p>
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">15:48</p>
          </div>
        </div>
      </div>
    ),
  },
];

const UseCasesSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="w-[90%] max-w-[1200px] mx-auto py-20">
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-3">
        Casos de Uso
      </p>
      <h2 className="text-[32px] md:text-[38px] font-extrabold text-foreground leading-tight mb-3">
        Se adapta ao seu negócio<br />e aos seus objetivos
      </h2>
      <p className="text-muted-foreground text-base max-w-xl mb-12">
        Seja por eficiência operacional ou aumento de receita, o ZapLynx é capaz de tudo isso e muito mais.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Accordion */}
        <div className="space-y-0">
          {useCases.map((uc, i) => {
            const isActive = activeIndex === i;
            return (
              <div
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`cursor-pointer border-b border-border transition-all duration-300 ${
                  isActive ? "" : ""
                }`}
              >
                <div className="flex items-center justify-between py-4">
                  <h3
                    className={`font-semibold text-base transition-colors ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {uc.title}
                  </h3>
                  <span
                    className={`text-xl transition-transform duration-300 ${
                      isActive ? "rotate-45 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    +
                  </span>
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isActive ? "max-h-40 pb-4" : "max-h-0"
                  }`}
                >
                  <p className="text-muted-foreground text-sm leading-relaxed pr-8">
                    {uc.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Phone Mockup */}
        <div className="flex justify-center">
          <div className="landing-phone-showcase" style={{ animation: "none" }}>
            <div className="landing-phone-frame">
              <span className="landing-phone-button landing-phone-button--volume-up" />
              <span className="landing-phone-button landing-phone-button--volume-down" />
              <span className="landing-phone-button landing-phone-button--power" />

              <div className="landing-phone-screen-wrap">
                <div className="landing-phone-notch" />
                <div className="landing-phone-screen">
                  {/* WhatsApp header */}
                  <div className="bg-primary/15 px-3 py-2.5 flex items-center gap-2 border-b border-border pt-8">
                    <span className="text-foreground text-sm">←</span>
                    <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
                      ZL
                    </div>
                    <div>
                      <p className="text-foreground text-xs font-semibold">ZapLynx Bot</p>
                      <p className="text-muted-foreground text-[9px]">online</p>
                    </div>
                  </div>
                  {/* Dynamic content */}
                  <div className="transition-opacity duration-300">
                    {useCases[activeIndex].chatContent}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;
