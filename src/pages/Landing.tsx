import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import logoImage from "@/assets/logo.png";
import screen0 from "@/assets/screen-0.png";
import screen1 from "@/assets/screen-1.png";
import screen2 from "@/assets/screen-2.png";
import logoKiwify from "@/assets/logo-kiwify.jpg";
import logoHotmart from "@/assets/logo-hotmart.jpg";
import logoDevzapp from "@/assets/logo-devzapp.jpg";
import logoSendflow from "@/assets/logo-sendflow.png";
import logoManychat from "@/assets/logo-manychat.webp";
import AgentChatMockup from "@/components/landing/AgentChatMockup";
import "./Landing.css";

const screens = [screen0, screen1, screen2];

const Landing = () => {
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

      {/* HERO: PAC-MAN */}
      <HeroSection />

      {/* HERO COPY */}
      <div className="lp-hero">
        <div className="lp-hero-glow" />
        <h1><em>Gateway de Pagamentos</em> + Sistema de Gestão<br />WhatsApp &amp; Instagram</h1>
        <p className="lp-hero-sub">Receba pagamentos via Pix, automatize WhatsApp e responda comentários do Instagram com IA — tudo em uma única plataforma.</p>
        <button className="lp-btn-cta" onClick={goSignup}>Criar Conta Grátis →</button>
      </div>

      {/* FEATURE CARDS */}
      <div className="lp-cards-row">
        <FeatureCard icon="gateway" title="Gateway Pix" desc="Checkout próprio com confirmação instantânea." />
        <FeatureCard icon="chat" title="Automação WhatsApp" desc="Envios em massa, IA e fluxos visuais." />
        <FeatureCard icon="instagram" title="Automação Instagram" desc="Responde comentários e envia DM automaticamente." ig />
        <FeatureCard icon="shield" title="KYC e Segurança" desc="Verificação de identidade e antifraude." />
        <FeatureCard icon="chart" title="Relatórios" desc="Métricas e conversões em tempo real." />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Gateway */}
      <div className="lp-section">
        <div>
          <div className="lp-section-tag">Pagamentos</div>
          <div className="lp-section-title">Gateway de Pagamentos Completo</div>
          <div className="lp-section-desc">Crie checkouts personalizados, receba via Pix instantâneo e gerencie saques — tudo com sua marca e sem intermediários.</div>
          <CheckList items={[
            "Checkout customizável com 6+ templates",
            "Pagamento via Pix com confirmação instantânea",
            "Painel de transações com filtros avançados",
            "Pixels de rastreamento (Facebook, Google, TikTok)",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Criar Meu Checkout →</button>
        </div>
        <GatewayMock />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Checkout */}
      <div className="lp-section lp-section-reverse lp-section-surface">
        <div>
          <div className="lp-section-tag">Checkout</div>
          <div className="lp-section-title">Checkout que Converte de Verdade</div>
          <div className="lp-section-desc">Crie páginas de pagamento profissionais com sua identidade visual. Templates prontos, timer de urgência, selos de confiança e integração com pixels — tudo para maximizar suas conversões.</div>
          <CheckList items={[
            "6 templates prontos e personalizáveis",
            "Editor drag-and-drop de elementos",
            "Timer de escassez e selos de confiança",
            "Validação de CPF/CNPJ em tempo real",
            "Integração com pixels e UTM tracking",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Montar Meu Checkout →</button>
        </div>
        <CheckoutMock />
      </div>

      {/* SEÇÃO: Instagram */}
      <div className="lp-section lp-section-reverse lp-section-surface">
        <div>
          <div className="lp-section-tag lp-ig">Novo — Instagram</div>
          <div className="lp-section-title">Automação de Comentários no Instagram</div>
          <div className="lp-section-desc">Quando alguém comenta em seu post, o sistema detecta a palavra-chave e envia um DM automático com o link de checkout — convertendo engajamento em venda.</div>
          <CheckList ig items={[
            "Detecta comentários por palavra-chave",
            "Envia DM automático com link de checkout",
            "Responde comentários publicamente",
            "Dashboard com métricas de conversão",
            "Integrado à API oficial do Instagram (Meta)",
          ]} />
          <button className="lp-btn-outline lp-btn-ig" onClick={goSignup}>Ativar Automação Instagram →</button>
        </div>
        <InstagramMock />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Agente IA */}
      <div className="lp-section">
        <div>
          <div className="lp-section-tag">Inteligência Artificial</div>
          <div className="lp-section-title">Agente de IA que Vende por Você 24h</div>
          <div className="lp-section-desc">Treine um agente com o conhecimento do seu negócio. Ele responde clientes, envia links de checkout e conduz a venda automaticamente.</div>
          <CheckList items={[
            "Treinável com FAQ, documentos e sites",
            "Envia links de checkout automaticamente",
            "Funciona 24 horas por dia, 7 dias por semana",
            "Integrado ao gateway de pagamentos",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Ativar Agente de IA →</button>
        </div>
        <AgentChatMockup />
      </div>

      <div className="lp-divider" />

      {/* SEÇÃO: Fluxos Visuais */}
      <div className="lp-section lp-section-reverse">
        <div>
          <div className="lp-section-tag">Automação Visual</div>
          <div className="lp-section-title">Fluxos Visuais de Automação</div>
          <div className="lp-section-desc">Monte jornadas completas arrastando blocos visuais. Gatilhos por palavra-chave, condições inteligentes e ações automáticas — sem código.</div>
          <CheckList items={[
            "Editor visual drag-and-drop",
            "Gatilhos por palavra-chave ou evento",
            "Condições e ramificações inteligentes",
            "Integração com webhooks e APIs",
          ]} />
          <button className="lp-btn-outline" onClick={goSignup}>Criar Meus Fluxos →</button>
        </div>
        <FlowMock />
      </div>

      <div className="lp-divider" />

      {/* CTA FINAL */}
      <div className="lp-cta-final">
        <h2>Venda mais com Gateway + WhatsApp + Instagram</h2>
        <p>Receba pagamentos e automatize toda sua comunicação em uma única plataforma.</p>
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

/* ===== HERO with Pac-Man Canvas ===== */
function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const screensRef = useRef<HTMLDivElement>(null);
  const [activeScreen, setActiveScreen] = useState(0);
  const slideIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showScreen = useCallback((idx: number) => {
    setActiveScreen(idx);
  }, []);

  useEffect(() => {
    // Pre-load logo images
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
    const sr = screensRef.current;
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
    let phase: "eating" | "done" = "eating";
    let doneTimer = 0;
    let animId: number;

    const tagline = stage.querySelector("#lp-tagline") as HTMLElement;
    const sub = stage.querySelector("#lp-sub") as HTMLElement;

    function initPositions() {
      const w = W();
      pacX = w * 0.06;
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
      doneTimer = 0;
      if (tagline) tagline.style.opacity = "0";
      if (sub) sub.style.opacity = "0";
      if (sr) {
        sr.classList.remove("lp-fly-in");
        sr.style.transition = "";
        sr.style.transform = "";
        sr.style.opacity = "";
      }
      if (slideIntervalRef.current) clearTimeout(slideIntervalRef.current);
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
      ctx.shadowColor = "#f05a28";
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

    function drawScore() {
      const eaten = objs.filter(o => o.eaten).length;
      if (!eaten) return;
      ctx.font = "bold 11px Plus Jakarta Sans, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`+${eaten} concorrente${eaten > 1 ? "s" : ""} engolido${eaten > 1 ? "s" : ""}`, 16, 26);
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
        if (!t) { phase = "done"; return; }
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
        doneTimer++;
        mouthOpen = Math.max(0.05, mouthOpen - 0.01);
        pacX = Math.min(W() * 0.82, pacX + 0.6);
        pacAngle = 0;
        if (doneTimer === 30) {
          if (tagline) tagline.style.opacity = "1";
          if (sub) sub.style.opacity = "1";
        }
        if (doneTimer === 55 && sr) {
          sr.classList.add("lp-fly-in");
          let si = 0;
          if (slideIntervalRef.current) clearTimeout(slideIntervalRef.current);
          const advanceSlide = () => {
            si = (si + 1) % 3;
            showScreen(si);
            const delay = si === 2 ? 5500 : 3200;
            slideIntervalRef.current = setTimeout(advanceSlide, delay);
          };
          slideIntervalRef.current = setTimeout(advanceSlide, 3200);
        }
        if (doneTimer === 440) {
          if (sr) {
            sr.style.transition = "opacity 0.5s ease, transform 0.8s cubic-bezier(.8,0,.85,1)";
            sr.style.transform = "translate(-50%, -50%) translateX(-120%)";
            sr.style.opacity = "0";
            setTimeout(() => {
              sr.classList.remove("lp-fly-in");
              sr.style.transition = "";
              sr.style.transform = "";
              sr.style.opacity = "";
              if (slideIntervalRef.current) clearTimeout(slideIntervalRef.current);
              showScreen(0);
              setTimeout(() => initPositions(), 200);
            }, 800);
          } else {
            setTimeout(() => initPositions(), 800);
          }
        }
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
      drawScore();
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
      if (slideIntervalRef.current) clearTimeout(slideIntervalRef.current);
    };
  }, [showScreen]);

  return (
    <div id="lp-hero-section">
      <div className="lp-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="lp-canvas" />
        <div className="lp-screens-reveal" ref={screensRef}>
          <div className="lp-screen-wrap">
            {screens.map((src, i) => (
              <div key={i} className={`lp-screen-slide ${activeScreen === i ? "active" : ""}`}>
                <img src={src} alt={`Screenshot ${i + 1}`} />
              </div>
            ))}
          </div>
          <div className="lp-screen-dots">
            {screens.map((_, i) => (
              <span key={i} className={`lp-screen-dot ${activeScreen === i ? "active" : ""}`} onClick={() => showScreen(i)} />
            ))}
          </div>
        </div>
      </div>
      <div className="lp-hero-tagline-block">
        <div id="lp-tagline">ZapLynx <em>engole</em> a concorrência</div>
        <div id="lp-sub">Gateway · WhatsApp · Instagram · IA — tudo em um só lugar</div>
      </div>
    </div>
  );
}

/* ===== Subcomponents ===== */

function FeatureCard({ icon, title, desc, ig }: { icon: string; title: string; desc: string; ig?: boolean }) {
  const svgMap: Record<string, JSX.Element> = {
    gateway: <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
    chat: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    instagram: <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
    shield: <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    chart: <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  };
  return (
    <div className={`lp-fcard${ig ? " lp-ig-gradient-border" : ""}`}>
      <div className={`lp-fcard-icon${ig ? " ig" : ""}`}>{svgMap[icon]}</div>
      <div className="lp-fcard-title">{title}</div>
      <div className="lp-fcard-desc">{desc}</div>
    </div>
  );
}

function CheckList({ items, ig }: { items: string[]; ig?: boolean }) {
  return (
    <div className="lp-check-list">
      {items.map((item, i) => (
        <div key={i} className={`lp-check-item${ig ? " ig" : ""}`}>
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          {item}
        </div>
      ))}
    </div>
  );
}

function GatewayMock() {
  return (
    <div className="lp-mock">
      <div className="lp-mock-header">
        <div className="lp-mock-icon"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg></div>
        <div className="lp-mock-title">ZapLynxPay</div>
        <div className="lp-mock-sub">ao vivo</div>
      </div>
      <div className="lp-mock-body">
        <div className="lp-mock-row"><div className="lp-mock-label">Vendas Hoje</div><div className="lp-mock-val accent">R$ 12.847,00</div></div>
        <div className="lp-mock-row"><div className="lp-mock-label">Transações</div><div className="lp-mock-val">148</div></div>
        <div className="lp-mock-row"><div className="lp-mock-label">Taxa de Conversão</div><div className="lp-mock-val">73,4%</div></div>
        <div className="lp-mock-row"><div className="lp-mock-label">Checkout Ativo</div><div className="lp-pill-green">Online</div></div>
        <div style={{ marginTop: 12, fontSize: 10, color: "var(--lp-muted2)", textAlign: "center" }}>Pix instantâneo · Sem mensalidade</div>
      </div>
    </div>
  );
}

function InstagramMock() {
  const events = [
    { initials: "MF", bg: "linear-gradient(135deg,#833ab4,#fd1d1d)", user: "@mariano_freitas_zz", msg: "fala comigo! mandei no direct", time: "13:26" },
    { initials: "ZL", bg: "linear-gradient(135deg,#f05a28,#fbbf24)", user: "@zap_lynx_pro", msg: "Seu presente chegou! basta res...", time: "13:26" },
    { initials: "GE", bg: "linear-gradient(135deg,#0ea5e9,#6366f1)", user: "@gomez_ecom", msg: "Catuaba", time: "13:26" },
  ];
  return (
    <div className="lp-ig-dash lp-ig-gradient-border">
      <div className="lp-ig-dash-header">
        <div className="lp-mock-icon ig">
          <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#e1306c" stroke="none" /></svg>
        </div>
        <div>
          <div className="lp-ig-dash-title">Dashboard Instagram</div>
          <div className="lp-ig-dash-sub">Métricas e performance da automação</div>
        </div>
      </div>
      <div className="lp-ig-kpis">
        <div className="lp-ig-kpi"><div className="lp-ig-kpi-label">Comentários</div><div className="lp-ig-kpi-val">26</div></div>
        <div className="lp-ig-kpi"><div className="lp-ig-kpi-label">Conversão DM</div><div className="lp-ig-kpi-val pink">53,8%</div></div>
        <div className="lp-ig-kpi"><div className="lp-ig-kpi-label">DMs Enviados</div><div className="lp-ig-kpi-val">14</div></div>
      </div>
      <div className="lp-ig-events">
        <div className="lp-ig-events-title">Últimos eventos</div>
        {events.map((e, i) => (
          <div key={i} className="lp-ig-event">
            <div className="lp-ig-avatar" style={{ background: e.bg }}>{e.initials}</div>
            <div>
              <div className="lp-ig-event-user">{e.user} <span className="lp-ig-dm-badge">DM</span></div>
              <div className="lp-ig-event-msg">{e.msg}</div>
            </div>
            <div className="lp-ig-event-time">{e.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatMock() {
  return (
    <div className="lp-chat-mock">
      <div className="lp-chat-header">
        <div className="lp-chat-dot" />
        <div>
          <div className="lp-chat-name">Agente Inteligente</div>
          <div className="lp-chat-status">Resposta automática via IA · 2s</div>
        </div>
      </div>
      <div className="lp-bubble-user">Oi, vocês têm esse produto disponível?</div>
      <div className="lp-bubble-bot">Olá! Sim, temos disponível. Posso te enviar o link de pagamento?</div>
      <div className="lp-bubble-user">Sim, por favor!</div>
      <div className="lp-bubble-link">Aqui está seu checkout: zaplynx.pay/produto</div>
      <div className="lp-auto-note">Resposta automática via IA · 2s</div>
    </div>
  );
}

function CheckoutMock() {
  return (
    <div className="lp-mock" style={{ maxWidth: 320 }}>
      <div className="lp-mock-header">
        <div className="lp-mock-icon"><svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg></div>
        <div className="lp-mock-title">Checkout Preview</div>
        <div className="lp-mock-sub">ao vivo</div>
      </div>
      <div className="lp-mock-body" style={{ padding: "14px 16px" }}>
        {/* Product */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 10, background: "linear-gradient(135deg, #f05a28, #fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Curso Marketing Pro</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Acesso vitalício</div>
          </div>
        </div>

        {/* Price */}
        <div style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#25d366" }}>R$ 197,00</div>
          </div>
          <div style={{ fontSize: 9, color: "#25d366", background: "rgba(37,211,102,0.15)", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>PIX</div>
        </div>

        {/* Timer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#f05a28" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span style={{ fontSize: 11, color: "#f05a28", fontWeight: 600 }}>Oferta expira em 14:59</span>
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {["Nome completo", "CPF", "E-mail", "WhatsApp"].map((label) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 10px", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              {label}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div style={{ background: "linear-gradient(135deg, #25d366, #128c3e)", borderRadius: 10, padding: "10px 0", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}>
          Pagar com Pix →
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
          {["🔒 Seguro", "⚡ Instantâneo", "✅ Garantia"].map((badge) => (
            <span key={badge} style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowMock() {
  const steps = [
    { num: "1", text: 'Gatilho: "quero comprar"' },
    { num: "2", text: "Enviar catálogo de produtos" },
    { num: "3", text: "Aguardar resposta (30s)" },
    { num: "4", text: "Enviar link de checkout" },
    { num: "5", text: "Confirmar pagamento via webhook" },
  ];
  return (
    <div className="lp-mock">
      <div className="lp-mock-header">
        <div className="lp-mock-icon"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
        <div className="lp-mock-title">Fluxo Ativo</div>
        <div className="lp-mock-sub">drag-and-drop</div>
      </div>
      <div className="lp-mock-body">
        <div className="lp-step-list">
          {steps.map((s, i) => (
            <div key={i} className="lp-step-item">
              <div className="lp-step-num">{s.num}</div>
              <div className="lp-step-text">{s.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Landing;
