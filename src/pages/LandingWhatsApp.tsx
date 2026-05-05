import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import logoKiwify from "@/assets/logo-kiwify.jpg";
import logoHotmart from "@/assets/logo-hotmart.jpg";
import logoDevzapp from "@/assets/logo-devzapp.jpg";
import logoSendflow from "@/assets/logo-sendflow.png";
import logoManychat from "@/assets/logo-manychat.webp";
import AgentChatMockup from "@/components/landing/AgentChatMockup";
import "./Landing.css";

const LandingWhatsApp = () => {
  const navigate = useNavigate();
  const goSignup = () => navigate("/auth?signup=true");
  const goLogin = () => navigate("/auth");

  return (
    <div className="lp-root">
      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-logo">Zap<span>Lynx</span></div>
        <div className="lp-nav-right">
          <button className="lp-btn-ghost" onClick={goLogin}>Entrar</button>
          <button className="lp-btn-accent" onClick={goSignup}>Começar Agora</button>
        </div>
      </nav>

      {/* HERO PAC-MAN */}
      <HeroSection />

      {/* HERO COPY */}
      <div className="lp-hero">
        <div className="lp-hero-glow" />
        <h1>
          Automação de <em>WhatsApp</em> <br />
          em escala — sem complicação
        </h1>
        <p className="lp-hero-sub">
          Envios em massa, fluxos visuais, agente de IA, chat unificado, grupos
          e aquecimento de número — tudo numa única plataforma.
        </p>
        <button className="lp-btn-cta" onClick={goSignup}>Começar Grátis →</button>
      </div>

      {/* FEATURE CARDS - CARROSSEL EM MOVIMENTO */}
      <FeatureCarousel />

      <div className="lp-divider" />

      {/* SEÇÃO: Disparos em Massa */}
      <div className="lp-section">
        <div>
          <div className="lp-section-tag">Campanhas</div>
          <div className="lp-section-title">Disparos em Massa Inteligentes</div>
          <div className="lp-section-desc">
            Dispare campanhas para milhares de contatos usando várias conexões
            simultâneas. Sistema com rotação automática, retomada resiliente e
            controle de velocidade para evitar bloqueios.
          </div>
          <CheckList items={[
            "Múltiplas conexões com round-robin automático",
            "Mensagens com texto, mídia, áudio, vídeo e botões",
            "Pausa, retomada e reagendamento de campanhas",
            "Filtro de números válidos antes do envio",
            "Relatório de entregas, leituras e respostas",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Criar Minha Campanha →</button>
        </div>
        <BlastMock />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Fluxos Visuais */}
      <div className="lp-section lp-section-reverse">
        <div>
          <div className="lp-section-tag">Automação Visual</div>
          <div className="lp-section-title">Fluxos Visuais Drag & Drop</div>
          <div className="lp-section-desc">
            Construa jornadas completas conectando blocos visuais. Gatilhos por
            palavra-chave, condições inteligentes, delays, mídia e webhooks —
            tudo sem escrever uma linha de código.
          </div>
          <CheckList items={[
            "Editor visual com gatilhos, condições e ações",
            "Botões interativos, listas e mídia nativa",
            "Captura de respostas e variáveis dinâmicas",
            "Rastreamento de cliques em links",
            "Disparo manual de fluxo em massa",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Criar Meus Fluxos →</button>
        </div>
        <FlowVisualMock />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Agente IA */}
      <div className="lp-section">
        <div>
          <div className="lp-section-tag">Inteligência Artificial</div>
          <div className="lp-section-title">Agente de IA que Atende e Vende 24h</div>
          <div className="lp-section-desc">
            Treine um agente com o conhecimento do seu negócio. Ele responde
            dúvidas, qualifica leads, envia links e fecha vendas
            automaticamente — direto no WhatsApp.
          </div>
          <CheckList items={[
            "Treinável com FAQ, documentos e sites",
            "Envia links e mídia automaticamente",
            "Funciona 24 horas por dia, 7 dias por semana",
            "Histórico de conversas com contexto",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Ativar Agente de IA →</button>
        </div>
        <AgentChatMockup />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Chat Unificado */}
      <div className="lp-section lp-section-reverse">
        <div>
          <div className="lp-section-tag">Atendimento</div>
          <div className="lp-section-title">Chat Unificado em Tempo Real</div>
          <div className="lp-section-desc">
            Centralize todas as conversas do WhatsApp em uma única caixa de
            entrada. Múltiplos atendentes, respostas rápidas, mensagens
            agendadas e mensagem de boas-vindas automática.
          </div>
          <CheckList items={[
            "Caixa unificada de várias conexões",
            "Mensagens em tempo real (realtime)",
            "Modelos de mensagens reutilizáveis",
            "Boas-vindas automáticas para novos contatos",
            "Resposta automática por palavra-chave",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Conhecer o Chat →</button>
        </div>
        <ChatUnifiedMock />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Grupos */}
      <div className="lp-section">
        <div>
          <div className="lp-section-tag">Grupos & Comunidades</div>
          <div className="lp-section-title">Gestão Completa de Grupos</div>
          <div className="lp-section-desc">
            Crie grupos em massa, extraia membros de comunidades, configure
            links rotativos e dispare campanhas direcionadas a grupos com
            roteamento por instância.
          </div>
          <CheckList items={[
            "Criação automática de grupos em lote",
            "Extração de membros de comunidades",
            "Links rotativos com variáveis personalizadas",
            "Campanhas para grupos com fluxo dedicado",
            "Clonagem de grupos com metadados",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Gerenciar Grupos →</button>
        </div>
        <GroupsMock />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Aquecimento */}
      <div className="lp-section lp-section-reverse">
        <div>
          <div className="lp-section-tag">Anti-Ban</div>
          <div className="lp-section-title">Aquecimento de Número</div>
          <div className="lp-section-desc">
            Proteja seus números contra banimento. Sistema simula conversas
            naturais entre suas conexões para construir reputação antes de
            disparos em massa.
          </div>
          <CheckList items={[
            "Conversas automáticas entre suas conexões",
            "Velocidade controlada e progressiva",
            "Mensagens humanizadas e variadas",
            "Reduz risco de banimento drasticamente",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Aquecer Números →</button>
        </div>
        <WarmupMock />
      </div>

      <div className="lp-divider" />

      {/* CTA FINAL */}
      <div className="lp-cta-final">
        <h2>Tudo que você precisa para WhatsApp em um só lugar</h2>
        <p>Disparos, fluxos, IA, grupos, chat e aquecimento — comece grátis hoje.</p>
        <button className="lp-btn-cta" onClick={goSignup}>Começar Agora →</button>
      </div>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-f-logo">Zap<span>Lynx</span></div>
        <div className="lp-f-copy">© 2026 ZapLynx · Todos os direitos reservados</div>
      </footer>
    </div>
  );
};

/* ===== Subcomponents ===== */

function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const logoSources: Record<string, string> = {
      Kiwify: logoKiwify,
      Hotmart: logoHotmart,
      DevZapp: logoDevzapp,
      SendFlow: logoSendflow,
      ManyChat: logoManychat,
    };
    const logoImages: Record<string, HTMLImageElement> = {};
    Object.entries(logoSources).forEach(([name, src]) => {
      const img = new Image();
      img.src = src;
      logoImages[name] = img;
    });

    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d")!;
    let H = stage.offsetHeight || 460;
    const W = () => canvas.width;

    function resize() {
      H = stage.offsetHeight || 460;
      canvas.width = stage.offsetWidth;
      canvas.height = H;
    }
    resize();

    type LogoObj = { name: string; x: number; y: number; radius: number; eaten: boolean; opacity: number; scale: number };
    let objs: LogoObj[] = [];
    let pacX = 0, pacY = 0, pacAngle = 0, mouthOpen = 0.25, mouthDir = 1;
    let currentTarget = 0;
    let phase: "eating" | "exiting" = "eating";
    let animId: number;

    function initPositions() {
      const w = W();
      pacX = -40;
      pacY = H / 2 - 10;
      const names = ["Kiwify", "Hotmart", "DevZapp", "SendFlow", "ManyChat"];
      const spacing = (w * 0.76) / names.length;
      objs = names.map((name, i) => ({
        name,
        x: w * 0.20 + i * spacing,
        y: H / 2 - 10 + Math.sin(i * 1.4) * 28,
        radius: 26,
        eaten: false,
        opacity: 1,
        scale: 1,
      }));
      currentTarget = 0;
      phase = "eating";
    }
    initPositions();

    function drawLogo(name: string, cx: number, cy: number, r: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const clip = new Path2D();
      clip.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.save();
      ctx.clip(clip);
      const img = logoImages[name];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${r * 0.36}px Plus Jakarta Sans, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(name, cx, cy + r + 4);
      ctx.restore();
    }

    function drawPacman(x: number, y: number, r: number, angle: number, mouth: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, mouth * Math.PI, (2 - mouth) * Math.PI);
      ctx.closePath();
      ctx.fillStyle = "#f5c518";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.38, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "#0d0f1a";
      ctx.fill();
      ctx.restore();
    }

    function drawDots() {
      ctx.fillStyle = "rgba(245,197,24,0.18)";
      for (let i = 0; i < 12; i++) {
        const px = W() * 0.08 + i * (W() * 0.077);
        if (px < pacX - 24) continue;
        let skip = false;
        objs.forEach(o => { if (Math.abs(px - o.x) < 24 && o.eaten) skip = true; });
        if (skip) continue;
        ctx.beginPath();
        ctx.arc(px, H / 2 - 10, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawGrid() {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let gx = 0; gx < W(); gx += 36)
        for (let gy = 0; gy < H; gy += 36) {
          ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    function update() {
      if (phase === "eating") {
        const t = objs[currentTarget];
        if (!t) { phase = "exiting"; return; }
        const dx = t.x - pacX, dy = t.y - pacY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        pacAngle = Math.atan2(dy, dx);
        if (dist > t.radius + 16) {
          pacX += (dx / dist) * 2.5;
          pacY += (dy / dist) * 2.5;
        } else {
          t.scale = Math.max(0, t.scale - 0.08);
          t.opacity = Math.max(0, t.opacity - 0.08);
          if (t.opacity <= 0) { t.eaten = true; currentTarget++; }
        }
        mouthOpen += 0.05 * mouthDir;
        if (mouthOpen > 0.28 || mouthOpen < 0.03) mouthDir *= -1;
      } else {
        pacX += 2.5;
        pacAngle = 0;
        mouthOpen += 0.05 * mouthDir;
        if (mouthOpen > 0.28 || mouthOpen < 0.03) mouthDir *= -1;
        if (pacX > W() + 40) initPositions();
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W(), H);
      drawGrid();
      drawDots();
      objs.forEach(o => {
        if (o.eaten && o.opacity <= 0) return;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.scale(o.scale, o.scale);
        ctx.translate(-o.x, -o.y);
        drawLogo(o.name, o.x, o.y, o.radius, o.opacity);
        ctx.restore();
      });
      drawPacman(pacX, pacY, 30, pacAngle, mouthOpen);
    }

    function loop() {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    }
    loop();

    const onResize = () => { resize(); initPositions(); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div id="lp-hero-section">
      <div className="lp-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="lp-canvas" />
      </div>
      <div className="lp-hero-tagline-block">
        <div id="lp-tagline">ZapLynx <em>engole</em> a concorrência</div>
        <div id="lp-sub">WhatsApp · Disparos · Fluxos · IA — tudo em um só lugar</div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const svgMap: Record<string, JSX.Element> = {
    chat: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    flow: <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v0a6 6 0 0 0 6 6 6 6 0 0 0 6-6"/></svg>,
    ai: <svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 0-4 4v1H7a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h1v1a4 4 0 0 0 8 0v-1h1a3 3 0 0 0 3-3v-3a3 3 0 0 0-3-3h-1V6a4 4 0 0 0-4-4z"/></svg>,
    group: <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M14 20c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/></svg>,
    warm: <svg viewBox="0 0 24 24"><path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-3 2-5 2-7s3-3 3-3z"/></svg>,
    chart: <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  };
  return (
    <div className="lp-fcard">
      <div className="lp-fcard-icon">{svgMap[icon]}</div>
      <div className="lp-fcard-title">{title}</div>
      <div className="lp-fcard-desc">{desc}</div>
    </div>
  );
}

function FeatureCarousel() {
  const features = [
    {
      icon: "chat",
      title: "Disparos em Massa",
      desc: "Envie milhares de mensagens com múltiplas conexões e rotação automática.",
      stat: "+50.000 msgs/dia",
      color: "#22c55e",
      visual: "blast",
    },
    {
      icon: "flow",
      title: "Fluxos Visuais",
      desc: "Monte automações arrastando blocos. Sem código.",
      stat: "100% no-code",
      color: "#a78bfa",
      visual: "flow",
    },
    {
      icon: "ai",
      title: "Agente de IA",
      desc: "Atendimento 24/7 com IA treinada no seu negócio.",
      stat: "Resposta em 2s",
      color: "#f472b6",
      visual: "ai",
    },
    {
      icon: "group",
      title: "Grupos & Comunidades",
      desc: "Crie, clone e gerencie grupos automaticamente.",
      stat: "Até 500 grupos/h",
      color: "#38bdf8",
      visual: "group",
    },
    {
      icon: "warm",
      title: "Aquecimento",
      desc: "Aqueça seus números e proteja contra banimento.",
      stat: "−87% banimentos",
      color: "#fbbf24",
      visual: "warm",
    },
    {
      icon: "chart",
      title: "Relatórios",
      desc: "Métricas em tempo real de entregas, leituras e respostas.",
      stat: "Tempo real",
      color: "#34d399",
      visual: "chart",
    },
  ];

  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const DURATION = 5000;

  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / DURATION, 1);
      setProgress(p);
      if (p >= 1) setActive((a) => (a + 1) % features.length);
    }, 30);
    return () => clearInterval(id);
  }, [active, paused, features.length]);

  const current = features[active];

  return (
    <div
      style={{ width: "100%", padding: "30px 24px", margin: "20px auto", maxWidth: 1280 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes lp-fc-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lp-fc-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        .lp-fc-shell {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 28px;
          background: linear-gradient(160deg, rgba(30,32,46,0.85), rgba(15,17,27,0.95));
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 36px;
          min-height: 320px;
          box-shadow: 0 40px 80px -30px rgba(0,0,0,0.6);
          position: relative;
          overflow: hidden;
        }
        .lp-fc-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 80% 20%, var(--accent-color) 0%, transparent 50%);
          opacity: 0.12;
          transition: opacity 0.6s ease;
        }
        .lp-fc-content { position: relative; z-index: 2; animation: lp-fc-in 0.6s ease; }
        .lp-fc-tag {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px; border-radius: 20px;
          background: color-mix(in srgb, var(--accent-color) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-color) 40%, transparent);
          color: var(--accent-color);
          font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .lp-fc-tag-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent-color);
          animation: lp-fc-pulse 1.5s ease-in-out infinite;
        }
        .lp-fc-title {
          font-size: 38px; font-weight: 800; color: #fff;
          margin: 16px 0 12px; line-height: 1.1;
          background: linear-gradient(135deg, #fff, color-mix(in srgb, var(--accent-color) 80%, #fff));
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .lp-fc-desc { font-size: 16px; color: rgba(255,255,255,0.65); line-height: 1.6; max-width: 420px; }
        .lp-fc-stat {
          margin-top: 20px;
          display: inline-flex; align-items: baseline; gap: 8px;
          font-size: 22px; font-weight: 700; color: var(--accent-color);
        }
        .lp-fc-stat-label { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        .lp-fc-visual { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; animation: lp-fc-in 0.6s ease; }
        .lp-fc-thumbs {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-top: 18px;
        }
        .lp-fc-thumb {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 14px 12px; cursor: pointer; text-align: left;
          transition: all 0.3s ease; position: relative; overflow: hidden;
        }
        .lp-fc-thumb:hover { border-color: rgba(255,255,255,0.18); transform: translateY(-2px); }
        .lp-fc-thumb.active {
          background: rgba(255,255,255,0.05);
          border-color: color-mix(in srgb, var(--accent-color) 50%, transparent);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-color) 30%, transparent), 0 12px 30px -10px color-mix(in srgb, var(--accent-color) 40%, transparent);
        }
        .lp-fc-thumb-icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--thumb-color) 20%, transparent);
          color: var(--thumb-color);
          margin-bottom: 8px;
        }
        .lp-fc-thumb-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .lp-fc-thumb-title { font-size: 12px; font-weight: 600; color: #fff; line-height: 1.3; }
        .lp-fc-thumb-progress {
          position: absolute; left: 0; bottom: 0; height: 2px;
          background: var(--thumb-color);
          transition: width 0.05s linear;
        }
        @media (max-width: 900px) {
          .lp-fc-shell { grid-template-columns: 1fr; padding: 24px; }
          .lp-fc-title { font-size: 28px; }
          .lp-fc-thumbs { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      <div className="lp-fc-shell" style={{ ["--accent-color" as any]: current.color }}>
        <div className="lp-fc-content" key={`c-${active}`}>
          <div className="lp-fc-tag"><span className="lp-fc-tag-dot" />Funcionalidade {active + 1} de {features.length}</div>
          <div className="lp-fc-title">{current.title}</div>
          <div className="lp-fc-desc">{current.desc}</div>
          <div className="lp-fc-stat">
            {current.stat}
            <span className="lp-fc-stat-label">no plano ZapLynx</span>
          </div>
        </div>
        <div className="lp-fc-visual" key={`v-${active}`}>
          <FeatureVisual kind={current.visual} color={current.color} />
        </div>
      </div>

      <div className="lp-fc-thumbs">
        {features.map((f, i) => {
          const isActive = i === active;
          return (
            <button
              key={i}
              className={`lp-fc-thumb ${isActive ? "active" : ""}`}
              style={{ ["--thumb-color" as any]: f.color }}
              onClick={() => { setActive(i); setProgress(0); }}
            >
              <div className="lp-fc-thumb-icon"><FeatureIconSvg icon={f.icon} /></div>
              <div className="lp-fc-thumb-title">{f.title}</div>
              {isActive && (
                <div className="lp-fc-thumb-progress" style={{ width: `${progress * 100}%` }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeatureIconSvg({ icon }: { icon: string }) {
  const map: Record<string, JSX.Element> = {
    chat: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    flow: <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v0a6 6 0 0 0 6 6 6 6 0 0 0 6-6"/></svg>,
    ai: <svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 0-4 4v1H7a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h1v1a4 4 0 0 0 8 0v-1h1a3 3 0 0 0 3-3v-3a3 3 0 0 0-3-3h-1V6a4 4 0 0 0-4-4z"/></svg>,
    group: <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M14 20c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/></svg>,
    warm: <svg viewBox="0 0 24 24"><path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-3 2-5 2-7s3-3 3-3z"/></svg>,
    chart: <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  };
  return map[icon] || null;
}

function FeatureVisual({ kind, color }: { kind: string; color: string }) {
  if (kind === "blast") {
    return (
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
        {[85, 72, 91, 64].map((p, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              <span>Conexão 0{i + 1}</span><span>{p}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${p}%`, height: "100%", background: color, borderRadius: 4, transition: "width 1s" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "flow") {
    const Node = ({ x, y, label, sub }: any) => (
      <div style={{
        position: "absolute", left: x, top: y, padding: "8px 12px", borderRadius: 10,
        background: "rgba(20,22,32,0.95)", border: `1px solid ${color}`,
        boxShadow: `0 0 14px ${color}33`, minWidth: 110,
      }}>
        <div style={{ fontSize: 9, color, fontWeight: 700, textTransform: "uppercase" }}>{sub}</div>
        <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{label}</div>
      </div>
    );
    return (
      <div style={{ position: "relative", width: 360, height: 260 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line x1="80" y1="40" x2="80" y2="100" stroke={color} strokeWidth="2" strokeDasharray="4 4" />
          <line x1="80" y1="160" x2="80" y2="200" stroke={color} strokeWidth="2" strokeDasharray="4 4" />
          <line x1="140" y1="220" x2="240" y2="220" stroke={color} strokeWidth="2" strokeDasharray="4 4" />
        </svg>
        <Node x={20} y={10} label="Recebeu 'oi'" sub="Gatilho" />
        <Node x={20} y={100} label="Cliente novo?" sub="Condição" />
        <Node x={20} y={200} label="Boas-vindas" sub="Ação" />
        <Node x={240} y={200} label="Catálogo" sub="Ação" />
      </div>
    );
  }
  if (kind === "ai") {
    return (
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ alignSelf: "flex-start", maxWidth: "75%", padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13 }}>
          Olá! Quero saber sobre o produto X
        </div>
        <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", background: color, color: "#0d0f1a", fontSize: 13, fontWeight: 500 }}>
          Oi! Claro 😊 Posso te enviar um link com 10% off agora?
        </div>
        <div style={{ alignSelf: "flex-start", maxWidth: "70%", padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13 }}>
          Sim, manda!
        </div>
        <div style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: "lp-fc-pulse 1s infinite" }} />
          IA digitando...
        </div>
      </div>
    );
  }
  if (kind === "group") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 360 }}>
        {["Vendas SP", "Vendas RJ", "VIP", "Suporte"].map((g, i) => (
          <div key={g} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${color}, ${color}99)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0d0f1a", fontWeight: 700 }}>{g[0]}</div>
              <div>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{g}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{120 + i * 47} membros</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "warm") {
    return (
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {[{ n: "+55 11 9****-1234", l: 92 }, { n: "+55 21 9****-5678", l: 78 }, { n: "+55 31 9****-9012", l: 58 }].map((it) => (
          <div key={it.n}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
              <span>{it.n}</span><span style={{ color, fontWeight: 600 }}>{it.l}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${it.l}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 4, padding: 10, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}40`, fontSize: 11, color }}>
          ✓ 2.847 mensagens trocadas hoje · Risco baixo
        </div>
      </div>
    );
  }
  if (kind === "chart") {
    const data = [30, 45, 38, 62, 55, 78, 71, 88, 95];
    const max = Math.max(...data);
    return (
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, padding: "10px 0" }}>
          {data.map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, background: `linear-gradient(180deg, ${color}, ${color}55)`, borderRadius: "4px 4px 0 0" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
          {[{ l: "Entregues", v: "94.2%" }, { l: "Lidas", v: "78.5%" }, { l: "Respostas", v: "23.1%" }].map((s) => (
            <div key={s.l} style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{s.l}</div>
              <div style={{ fontSize: 16, color, fontWeight: 700 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function CheckList({ items }: { items: string[] }) {
  return (
    <div className="lp-check-list">
      {items.map((item, i) => (
        <div key={i} className="lp-check-item">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          {item}
        </div>
      ))}
    </div>
  );
}

function MockShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "linear-gradient(160deg, rgba(30,32,46,0.9), rgba(20,22,32,0.9))",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18,
      padding: 20,
      boxShadow: "0 30px 60px -20px rgba(0,0,0,0.5)",
      minHeight: 360,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <span style={{ marginLeft: 12, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function BlastMock() {
  const items = [
    { name: "Conexão 01", sent: 1240, total: 1500, color: "#22c55e" },
    { name: "Conexão 02", sent: 1180, total: 1500, color: "#a78bfa" },
    { name: "Conexão 03", sent: 980, total: 1500, color: "#f472b6" },
    { name: "Conexão 04", sent: 1320, total: 1500, color: "#38bdf8" },
  ];
  return (
    <MockShell title="Campanha · Black Friday">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((it) => {
          const pct = (it.sent / it.total) * 100;
          return (
            <div key={it.name}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                <span>{it.name}</span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{it.sent}/{it.total}</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: it.color, borderRadius: 6 }} />
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Stat label="Enviadas" value="4.720" />
          <Stat label="Entregues" value="4.612" />
          <Stat label="Lidas" value="3.280" />
          <Stat label="Respostas" value="612" />
        </div>
      </div>
    </MockShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{value}</div>
    </div>
  );
}

function FlowVisualMock() {
  const node = (label: string, sub: string, x: number, y: number, color: string) => (
    <div style={{
      position: "absolute", left: x, top: y, padding: "10px 14px", borderRadius: 12,
      background: "rgba(20,22,32,0.95)", border: `1px solid ${color}`,
      boxShadow: `0 0 18px ${color}33`, minWidth: 130,
    }}>
      <div style={{ fontSize: 10, color: color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{sub}</div>
      <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
  return (
    <MockShell title="Editor de Fluxo">
      <div style={{ position: "relative", height: 320 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line x1="100" y1="50" x2="100" y2="120" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="100" y1="170" x2="100" y2="220" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="160" y1="245" x2="260" y2="245" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="160" y1="265" x2="260" y2="295" stroke="#f472b6" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
        {node("Recebeu 'oi'", "Gatilho", 30, 10, "#a78bfa")}
        {node("Cliente novo?", "Condição", 30, 120, "#fbbf24")}
        {node("Boas-vindas", "Mensagem", 30, 220, "#22c55e")}
        {node("Enviar catálogo", "Ação", 260, 220, "#22c55e")}
        {node("Notificar atendente", "Ação", 260, 280, "#f472b6")}
      </div>
    </MockShell>
  );
}

function ChatUnifiedMock() {
  const chats = [
    { name: "Maria Silva", msg: "Quero comprar 2 unidades", time: "2m", unread: 3 },
    { name: "João Pedro", msg: "Tem em estoque?", time: "5m", unread: 1 },
    { name: "Grupo VIP", msg: "Carlos: alguém disponível?", time: "12m", unread: 0 },
    { name: "Ana Costa", msg: "Obrigada! 🙏", time: "1h", unread: 0 },
  ];
  return (
    <MockShell title="Chat Unificado">
      <div style={{ display: "flex", gap: 12, height: 320 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {chats.map((c, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 10, background: i === 0 ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#f472b6)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#fff", fontWeight: 600 }}>
                  <span>{c.name}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{c.time}</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.msg}</div>
              </div>
              {c.unread > 0 && (
                <div style={{ background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 7px" }}>{c.unread}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </MockShell>
  );
}

function GroupsMock() {
  return (
    <MockShell title="Grupos · Gerenciamento">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {["Vendas SP", "Vendas RJ", "Promoções", "Clientes VIP", "Suporte 01", "Suporte 02"].map((g, i) => (
          <div key={g} style={{
            padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, hsl(${i * 60}, 70%, 60%), hsl(${i * 60 + 30}, 70%, 50%))`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 14,
              }}>{g[0]}</div>
              <div>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{g}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{120 + i * 47} membros</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} /> Ativo
            </div>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

function WarmupMock() {
  const numbers = [
    { n: "+55 11 9****-1234", level: 92 },
    { n: "+55 21 9****-5678", level: 78 },
    { n: "+55 31 9****-9012", level: 65 },
    { n: "+55 41 9****-3456", level: 45 },
  ];
  return (
    <MockShell title="Aquecimento · Reputação">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {numbers.map((it) => (
          <div key={it.n}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              <span>{it.n}</span>
              <span style={{ color: it.level > 70 ? "#22c55e" : it.level > 50 ? "#fbbf24" : "#f472b6", fontWeight: 600 }}>{it.level}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                width: `${it.level}%`, height: "100%", borderRadius: 6,
                background: `linear-gradient(90deg, ${it.level > 70 ? "#22c55e" : it.level > 50 ? "#fbbf24" : "#f472b6"}, ${it.level > 70 ? "#16a34a" : it.level > 50 ? "#f59e0b" : "#ec4899"})`,
              }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, padding: 12, borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", fontSize: 12, color: "#22c55e" }}>
          ✓ 2.847 mensagens trocadas hoje · Risco de banimento: baixo
        </div>
      </div>
    </MockShell>
  );
}

export default LandingWhatsApp;