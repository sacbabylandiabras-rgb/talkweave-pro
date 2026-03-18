import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import zaplynxLogo from "@/assets/zaplynx-logo.png";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen landing-bg text-foreground relative">
      {/* Mouse follow effect */}
      <MouseFollowEffect />

      {/* Header */}
      <header className="w-[90%] max-w-[1200px] mx-auto flex justify-between items-center py-6">
        <img src={zaplynxLogo} alt="ZapLynx Logo" className="h-14" />
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

        {/* VSL Placeholder */}
        <div className="max-w-3xl mx-auto aspect-video bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-border mb-8">
          <span className="text-muted-foreground text-sm">Vídeo de apresentação</span>
        </div>

        <button
          onClick={() => navigate("/auth?signup=true")}
          className="landing-btn mt-8"
        >
          Criar Conta
        </button>
      </section>

      {/* Prova Social */}
      <SocialProofSection />

      {/* Benefícios */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <h2 className="text-center text-[32px] font-extrabold text-foreground mb-10">
          Plataforma Completa de Automação
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { emoji: "🤖", title: "Agente de IA Treinável", desc: "Responde automaticamente seus clientes 24h por dia." },
            { emoji: "🚀", title: "Envios Estratégicos", desc: "Dispare campanhas segmentadas com alta performance." },
            { emoji: "📊", title: "Relatórios Avançados", desc: "Acompanhe métricas e resultados em tempo real." },
            { emoji: "⚙", title: "Gestão Multi-Instância", desc: "Gerencie vários números em um único painel." },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-6 transition-transform hover:-translate-y-1"
            >
              <h3 className="text-foreground font-semibold mb-2">
                {card.emoji} {card.title}
              </h3>
              <p className="text-muted-foreground text-[15px]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section className="w-[90%] max-w-[1200px] mx-auto py-20">
        <h2 className="text-center text-[32px] font-extrabold text-foreground mb-10">
          Planos e Preços
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: "Plano Start", price: "397", popular: false },
            { name: "Plano Pro", price: "497", popular: true },
            { name: "Plano Scale", price: "897", popular: false },
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
              <button
                onClick={() => navigate("/auth?signup=true")}
                className="landing-btn w-full"
              >
                Assinar
              </button>
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
  const totalSlides = 8;
  const slidesToShow = 3;

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(totalSlides - slidesToShow, i + 1));

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
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div key={i} className="min-w-[33.3333%] px-3 max-md:min-w-full">
              <div className="w-full aspect-[4/3] bg-secondary rounded-2xl flex items-center justify-center border border-border">
                <span className="text-muted-foreground text-sm">Prova {i + 1}</span>
              </div>
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
