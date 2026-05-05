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
      <FeatureMarquee />

      <div className="lp-divider" />

      {/* SEÇÃO: Disparos em Massa */}
      <div className="lp-section">
        <div>
          <FeatureHighlight color="#22c55e" stat="+50.000 msgs/dia" tag="Campanhas" />
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
          <FeatureHighlight color="#a78bfa" stat="100% no-code" tag="Automação Visual" />
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
          <FeatureHighlight color="#f472b6" stat="Resposta em 2s" tag="Inteligência Artificial" />
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
          <FeatureHighlight color="#34d399" stat="Tempo real" tag="Atendimento" />
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
          <FeatureHighlight color="#38bdf8" stat="Até 500 grupos/h" tag="Grupos & Comunidades" />
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
          <FeatureHighlight color="#fbbf24" stat="−87% banimentos" tag="Anti-Ban" />
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

function FeatureMarquee() {
  const features = [
    { icon: "chat", title: "Disparos em Massa", desc: "Múltiplas conexões com rotação automática." },
    { icon: "flow", title: "Fluxos Visuais", desc: "Automações drag & drop sem código." },
    { icon: "ai", title: "Agente de IA", desc: "Atendimento 24/7 treinado no seu negócio." },
    { icon: "group", title: "Grupos & Comunidades", desc: "Crie, clone e gerencie em massa." },
    { icon: "warm", title: "Aquecimento", desc: "Proteja seus números contra banimento." },
    { icon: "chart", title: "Relatórios", desc: "Métricas em tempo real de entregas." },
  ];
  const loop = [...features, ...features];
  return (
    <div style={{ width: "100%", padding: "20px 0", margin: "20px auto", overflow: "hidden",
      maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
      <style>{`
        @keyframes lp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .lp-marquee-track { display: flex; gap: 18px; width: max-content; animation: lp-marquee 35s linear infinite; }
        .lp-marquee-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="lp-marquee-track">
        {loop.map((f, i) => (
          <div key={i} style={{ width: 280, flexShrink: 0 }}>
            <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureHighlight({ color, stat, tag }: { color: string; stat: string; tag: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
      <style>{`
        @keyframes lp-fh-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.5; } }
      `}</style>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 12px", borderRadius: 20,
        background: `${color}22`, border: `1px solid ${color}66`,
        color, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: "lp-fh-pulse 1.5s ease-in-out infinite" }} />
        {tag}
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 20,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12, fontWeight: 700, color,
      }}>
        ⚡ {stat}
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

function useLoopProgress(duration = 3500) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - start) % duration;
      const k = elapsed / duration;
      // ease-out then hold
      const eased = k < 0.7 ? 1 - Math.pow(1 - k / 0.7, 3) : 1;
      setP(eased);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return p;
}

function fmt(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

function BlastMock() {
  // Lista de contatos com status que muda de "Enviando" → "Entregue" e alguns "Clicou"
  const baseContacts = [
    { id: 45, phone: "1819521226****", clicked: true, ip: "2804:389:a2aa:..." },
    { id: 46, phone: "1820212175****", clicked: false },
    { id: 47, phone: "1821539251****", clicked: true, ip: "186.237.107.132" },
    { id: 48, phone: "1822404284****", clicked: true, ip: "170.254.113.139" },
    { id: 49, phone: "1823325690****", clicked: false },
    { id: 50, phone: "1825533067****", clicked: false },
    { id: 51, phone: "1832197816****", clicked: true, ip: "45.186.221.111" },
    { id: 52, phone: "1843275476****", clicked: true, ip: "149.78.105.224" },
    { id: 53, phone: "1847353347****", clicked: false },
    { id: 54, phone: "1848560635****", clicked: false },
  ];

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 600);
    return () => clearInterval(id);
  }, []);

  // Quantos já estão "Entregue" (vai aumentando, depois reseta)
  const cycleLen = baseContacts.length + 4;
  const deliveredCount = tick % cycleLen;

  // Animação dos números do topo
  const baseProgress = Math.min(tick / 30, 1); // ~18s para encher
  const stats = {
    total: 654,
    entregues: Math.round(412 * baseProgress),
    enviando: 10,
    pendentes: Math.max(0, 654 - Math.round(412 * baseProgress) - 10),
    cancelados: 0,
    lidas: Math.round(1 * baseProgress),
    cliques: Math.round(134 * baseProgress),
  };
  const progressPct = Math.round((stats.entregues / stats.total) * 100);

  return (
    <MockShell title="Estatísticas · Envio em Massa">
      <style>{`
        @keyframes lp-blast-flash { 0% { background: rgba(34,197,94,0.35); } 100% { background: rgba(34,197,94,0); } }
        @keyframes lp-blast-spin { to { transform: rotate(360deg); } }
        .lp-blast-row { transition: background 0.4s ease; }
        .lp-blast-just-delivered { animation: lp-blast-flash 1.2s ease forwards; }
      `}</style>

      {/* Barra de progresso */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
          <span>Progresso do envio</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{progressPct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, #a78bfa, #22c55e)", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Cards de stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 12 }}>
        {[
          { l: "Total", v: stats.total, c: "rgba(255,255,255,0.7)" },
          { l: "Entregues", v: stats.entregues, c: "#22c55e" },
          { l: "Enviando", v: stats.enviando, c: "#38bdf8" },
          { l: "Pendentes", v: stats.pendentes, c: "#fbbf24" },
          { l: "Cancelados", v: stats.cancelados, c: "#f472b6" },
          { l: "Lidas", v: stats.lidas, c: "#a78bfa" },
          { l: "Cliques", v: stats.cliques, c: "#34d399" },
        ].map((s) => (
          <div key={s.l} style={{
            padding: "8px 6px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.3 }}>{s.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Lista de contatos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflow: "hidden" }}>
        {baseContacts.map((c, i) => {
          const isDelivered = i < deliveredCount;
          const justDelivered = i === deliveredCount - 1;
          const isSending = i === deliveredCount;
          return (
            <div
              key={c.id}
              className={`lp-blast-row ${justDelivered ? "lp-blast-just-delivered" : ""}`}
              style={{
                display: "grid", gridTemplateColumns: "70px 1fr 90px 80px",
                alignItems: "center", gap: 8,
                padding: "6px 8px", borderRadius: 6,
                fontSize: 11,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.55)" }}>Contato {c.id}</span>
              <span style={{ color: "rgba(255,255,255,0.75)", fontFamily: "monospace", fontSize: 10 }}>{c.phone}</span>
              {isDelivered ? (
                <span style={{
                  background: "rgba(34,197,94,0.15)", color: "#22c55e",
                  padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, textAlign: "center",
                }}>✓ Entregue</span>
              ) : isSending ? (
                <span style={{
                  background: "rgba(56,189,248,0.15)", color: "#38bdf8",
                  padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, textAlign: "center",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  <span style={{ width: 8, height: 8, border: "1.5px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", animation: "lp-blast-spin 0.8s linear infinite" }} />
                  Enviando
                </span>
              ) : (
                <span style={{
                  background: "rgba(251,191,36,0.12)", color: "#fbbf24",
                  padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, textAlign: "center",
                }}>Pendente</span>
              )}
              {isDelivered && c.clicked ? (
                <span style={{
                  background: "rgba(167,139,250,0.15)", color: "#a78bfa",
                  padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, textAlign: "center",
                }}>Clicou</span>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.25)", textAlign: "center" }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </MockShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function FlowVisualMock() {
  // Animate active node along flow path
  const nodes = [
    { id: 0, label: "Recebeu 'oi'", sub: "Gatilho", x: 30, y: 10, color: "#a78bfa" },
    { id: 1, label: "Cliente novo?", sub: "Condição", x: 30, y: 120, color: "#fbbf24" },
    { id: 2, label: "Boas-vindas", sub: "Mensagem", x: 30, y: 220, color: "#22c55e" },
    { id: 3, label: "Enviar catálogo", sub: "Ação", x: 260, y: 220, color: "#22c55e" },
    { id: 4, label: "Notificar atendente", sub: "Ação", x: 260, y: 280, color: "#f472b6" },
  ];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % nodes.length), 900);
    return () => clearInterval(id);
  }, [nodes.length]);
  return (
    <MockShell title="Editor de Fluxo">
      <style>{`
        @keyframes lp-dash { to { stroke-dashoffset: -16; } }
        @keyframes lp-node-pop { 0% { transform: scale(1); } 50% { transform: scale(1.18); } 100% { transform: scale(1.12); } }
      `}</style>
      <div style={{ position: "relative", height: 320 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line x1="100" y1="50" x2="100" y2="120" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 4" style={{ animation: "lp-dash 1s linear infinite" }} />
          <line x1="100" y1="170" x2="100" y2="220" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 4" style={{ animation: "lp-dash 1s linear infinite" }} />
          <line x1="160" y1="245" x2="260" y2="245" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 4" style={{ animation: "lp-dash 1s linear infinite" }} />
          <line x1="160" y1="265" x2="260" y2="295" stroke="#f472b6" strokeWidth="2" strokeDasharray="4 4" style={{ animation: "lp-dash 1s linear infinite" }} />
        </svg>
        {nodes.map((n) => {
          const isActive = n.id === active;
          return (
            <div key={n.id} style={{
              position: "absolute", left: n.x, top: n.y, padding: "10px 14px", borderRadius: 12,
              background: "rgba(20,22,32,0.95)", border: `1px solid ${n.color}`,
              boxShadow: isActive ? `0 0 0 3px ${n.color}55, 0 0 32px ${n.color}cc` : `0 0 18px ${n.color}33`,
              minWidth: 130,
              transformOrigin: "center",
              transform: isActive ? "scale(1.15)" : "scale(1)",
              zIndex: isActive ? 5 : 1,
              transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease",
            }}>
              <div style={{ fontSize: 10, color: n.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{n.sub}</div>
              <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginTop: 2 }}>{n.label}</div>
            </div>
          );
        })}
      </div>
    </MockShell>
  );
}

function ChatUnifiedMock() {
  const baseChats = [
    { name: "Maria Silva", msg: "Quero comprar 2 unidades", time: "2m", unread: 3 },
    { name: "João Pedro", msg: "Tem em estoque?", time: "5m", unread: 1 },
    { name: "Grupo VIP", msg: "Carlos: alguém disponível?", time: "12m", unread: 0 },
    { name: "Ana Costa", msg: "Obrigada! 🙏", time: "1h", unread: 0 },
  ];
  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setHighlight((h) => (h + 1) % baseChats.length), 1800);
    return () => clearInterval(id);
  }, [baseChats.length]);
  return (
    <MockShell title="Chat Unificado">
      <style>{`
        @keyframes lp-chat-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes lp-chat-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div style={{ display: "flex", gap: 12, height: 320 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {baseChats.map((c, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 10,
              background: i === highlight ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.03)",
              border: i === highlight ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.05)",
              animation: i === highlight ? "lp-chat-in 0.4s ease" : undefined,
              transition: "background 0.3s ease, border-color 0.3s ease",
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
                <div style={{ background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 7px", animation: "lp-chat-pulse 1.4s ease-in-out infinite" }}>{c.unread}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </MockShell>
  );
}

function GroupsMock() {
  const items = ["Vendas SP", "Vendas RJ", "Promoções", "Clientes VIP", "Suporte 01", "Suporte 02"];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % items.length), 700);
    return () => clearInterval(id);
  }, [items.length]);
  return (
    <MockShell title="Grupos · Gerenciamento">
      <style>{`
        @keyframes lp-dot-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.4; } }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map((g, i) => (
          <div key={g} style={{
            padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)",
            border: i === active ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.08)",
            boxShadow: i === active ? "0 0 20px rgba(34,197,94,0.25)" : "none",
            transition: "all 0.4s ease",
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
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "lp-dot-pulse 1.6s ease-in-out infinite" }} /> Ativo
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
  const p = useLoopProgress(3000);
  const msgsCount = Math.round(2847 * p);
  return (
    <MockShell title="Aquecimento · Reputação">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {numbers.map((it) => (
          <div key={it.n}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              <span>{it.n}</span>
              <span style={{ color: it.level > 70 ? "#22c55e" : it.level > 50 ? "#fbbf24" : "#f472b6", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{Math.round(it.level * p)}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                width: `${it.level * p}%`, height: "100%", borderRadius: 6,
                background: `linear-gradient(90deg, ${it.level > 70 ? "#22c55e" : it.level > 50 ? "#fbbf24" : "#f472b6"}, ${it.level > 70 ? "#16a34a" : it.level > 50 ? "#f59e0b" : "#ec4899"})`,
                transition: "width 0.1s linear",
              }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, padding: 12, borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", fontSize: 12, color: "#22c55e" }}>
          ✓ <span style={{ fontVariantNumeric: "tabular-nums" }}>{msgsCount.toLocaleString("pt-BR")}</span> mensagens trocadas hoje · Risco de banimento: baixo
        </div>
      </div>
    </MockShell>
  );
}

export default LandingWhatsApp;