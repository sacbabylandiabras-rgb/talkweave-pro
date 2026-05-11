import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import logoImage from "@/assets/lynx-logo-new.png";
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
        <h1><em>Gateway de Pagamentos</em> + Sistema de Gestão {" "}<br />WhatsApp &amp; Instagram</h1>
        <p className="lp-hero-sub">Receba pagamentos via Pix, automatize WhatsApp e responda comentários do Instagram com IA — tudo em uma única plataforma.</p>
         <div className="lp-hero-ctas">
           <button className="lp-btn-cta" onClick={goSignup}>Experimentar Grátis →</button>
           <div className="lp-hero-trial-tag">7 dias de teste gratuito • Sem cartão de crédito</div>
         </div>
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

      {/* SEÇÃO: Fluxos Visuais (movida para o topo) */}
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

      {/* SEÇÃO: Agente IA (segunda posição) */}
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
      <div className="lp-section lp-section-surface">
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

      {/* CTA FINAL */}
      <div className="lp-cta-final">
        <h2>Venda mais com Gateway + WhatsApp + Instagram</h2>
        <p>Receba pagamentos e automatize toda sua comunicação em uma única plataforma.</p>
         <button className="lp-btn-cta" onClick={goSignup}>Começar Teste Grátis →</button>
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
    let phase: "eating" | "exiting" = "eating";
    let animId: number;

    const tagline = stage.querySelector("#lp-tagline") as HTMLElement;
    const sub = stage.querySelector("#lp-sub") as HTMLElement;

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
      if (tagline) tagline.style.opacity = "1";
      if (sub) sub.style.opacity = "1";
      if (sr) {
        sr.classList.remove("lp-fly-in");
        sr.style.transition = "";
        sr.style.transform = "";
        sr.style.opacity = "";
      }
      if (slideIntervalRef.current) clearTimeout(slideIntervalRef.current);
    }
    initPositions();
    // Tagline sempre visível — loop é contínuo
    if (tagline) tagline.style.opacity = "1";
    if (sub) sub.style.opacity = "1";

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
        // Loop contínuo: atravessa até sair da tela e reaparece do outro lado
        if (pacX > W() + 40) {
          initPositions();
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [progress, setProgress] = useState(0);

  const raw = [980,1240,1100,1580,1420,2100,1880,2450,2200,2980,2700,3350,3100,3800,3500,4300,3900,5100,4600,5900,5300,6700,6100,7500,6900,8600,8100,10200,11400,12847];
  const today = new Date();
  const labels = raw.map((_, i) => { const d = new Date(today); d.setDate(d.getDate() - 29 + i); return d.getDate() + '/' + (d.getMonth() + 1); });
  const xlabels = [0, 7, 14, 22, 29].map(i => labels[Math.min(i, 29)]);

  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const ep = ease(progress);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !animated) { setAnimated(true); } }, { threshold: 0.3 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [animated]);

  useEffect(() => {
    if (!animated) return;
    let start: number | null = null;
    const dur = 1800;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setProgress(p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [animated]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    ctx.clearRect(0, 0, cw, ch);

    const count = Math.round(ep * 30);
    if (count < 2) return;
    const data = raw.slice(0, count);
    const maxVal = Math.max(...raw) * 1.1;
    const padL = 0, padR = 4, padT = 4, padB = 0;
    const plotW = cw - padL - padR, plotH = ch - padT - padB;

    const pts = data.map((v, i) => ({
      x: padL + (i / (29)) * plotW,
      y: padT + plotH - (v / maxVal) * plotH,
    }));

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = padT + (plotH / 3) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(cw - padR, y); ctx.stroke();
    }

    // gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, 'rgba(167,139,250,0.30)');
    grad.addColorStop(0.7, 'rgba(244,114,182,0.08)');
    grad.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cp1x = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(cp1x, pts[i - 1].y, cp1x, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, padT + plotH);
    ctx.lineTo(pts[0].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cp1x = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(cp1x, pts[i - 1].y, cp1x, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [ep]);

  return (
    <div ref={containerRef} className="lp-gw-card">
      <div className="lp-gw-header">
        <div className="lp-gw-brand">
          <div className="lp-gw-brand-icon"><svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,10 6,5 10,8 14,3"/></svg></div>
          <span className="lp-gw-brand-name">ZapLynxPay</span>
        </div>
        <div className="lp-gw-live"><div className="lp-gw-live-dot" />ao vivo</div>
      </div>
      <div className="lp-gw-kpis">
        <div className="lp-gw-kpi">
          <div className="lp-gw-kpi-label">Vendas hoje</div>
          <div className="lp-gw-kpi-val accent">R$&nbsp;{progress >= 1 ? '12.847' : fmt(Math.round(ep * 12847))}</div>
          <div className="lp-gw-kpi-sub"><span className="lp-gw-up">↑ {Math.round(ep * 34)}%</span> <span className="lp-gw-neutral">vs ontem</span></div>
        </div>
        <div className="lp-gw-kpi">
          <div className="lp-gw-kpi-label">Transações</div>
          <div className="lp-gw-kpi-val">{Math.round(ep * 148)}</div>
          <div className="lp-gw-kpi-sub"><span className="lp-gw-up">↑ {Math.round(ep * 22)}%</span> <span className="lp-gw-neutral">vs ontem</span></div>
        </div>
        <div className="lp-gw-kpi">
          <div className="lp-gw-kpi-label">Conversão</div>
          <div className="lp-gw-kpi-val">{progress >= 1 ? '73,4%' : (ep * 73.4).toFixed(1) + '%'}</div>
          <div className="lp-gw-kpi-sub"><span className="lp-gw-up">↑ {(ep * 8.2).toFixed(1)}%</span> <span className="lp-gw-neutral">vs ontem</span></div>
        </div>
        <div className="lp-gw-kpi lp-gw-kpi-last">
          <div className="lp-gw-kpi-label">Ticket médio</div>
          <div className="lp-gw-kpi-val">{progress >= 1 ? 'R$ 86,80' : 'R$ ' + fmt(Math.round(ep * 86))}</div>
          <div className="lp-gw-kpi-sub"><span className="lp-gw-neutral">Últimas 24h</span></div>
        </div>
      </div>
      <div className="lp-gw-chart-area">
        <div className="lp-gw-chart-top">
          <div className="lp-gw-chart-title">Volume de vendas — 30 dias</div>
          <div className="lp-gw-tabs">
            <button className="lp-gw-tab">7d</button>
            <button className="lp-gw-tab active">30d</button>
            <button className="lp-gw-tab">90d</button>
          </div>
        </div>
        <div className="lp-gw-chart-wrap"><canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} /></div>
        <div className="lp-gw-xlabels">{xlabels.map((l, i) => <span key={i}>{l}</span>)}</div>
      </div>
      <div className="lp-gw-footer">
        <div className="lp-gw-fstat"><div className="lp-gw-fstat-val">R$ {fmt(Math.round(ep * 980))}</div><div className="lp-gw-fstat-label">Menor dia</div></div>
        <div className="lp-gw-fdiv" />
        <div className="lp-gw-fstat"><div className="lp-gw-fstat-val">R$ {fmt(Math.round(ep * 12847))}</div><div className="lp-gw-fstat-label">Maior dia</div></div>
        <div className="lp-gw-fdiv" />
        <div className="lp-gw-fstat"><div className="lp-gw-fstat-val">R$ {fmt(Math.round(ep * 4280))}</div><div className="lp-gw-fstat-label">Média diária</div></div>
        <div className="lp-gw-fdiv" />
        <div className="lp-gw-fstat"><div className="lp-gw-fstat-val">R$ {fmt(Math.round(ep * 128400))}</div><div className="lp-gw-fstat-label">Total 30d</div></div>
      </div>
    </div>
  );
}

function InstagramMock() {
  const idsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const IDS = ['ig-tc','ig-nb','ig-ai','ig-al','ig-c1','ig-c2','ig-c3','ig-c4','ig-d0','ig-d1','ig-d2','ig-d3','ig-d4','ig-dtyp'];
    idsRef.current = IDS;

    const show = (id: string, delay: number) => setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.add('show');
    }, delay);

    const hide = (id: string, delay: number) => setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    }, delay);

    function runLoop() {
      IDS.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('show'); });
      const ah = document.getElementById('ig-ah'); if (ah) ah.classList.remove('active');
      const af = document.getElementById('ig-af'); if (af) af.style.height = '0%';

      show('ig-tc', 400);
      hide('ig-tc', 1200);
      show('ig-c1', 1300);
      show('ig-c2', 1900);
      show('ig-c3', 2500);
      show('ig-c4', 3100);
      show('ig-nb', 3500);
      show('ig-ai', 3900);
      setTimeout(() => { const a = document.getElementById('ig-af'); if (a) a.style.height = '100%'; }, 4300);
      setTimeout(() => { const a = document.getElementById('ig-ah'); if (a) a.classList.add('active'); }, 4900);
      show('ig-al', 5000);
      show('ig-d0', 5300);
      show('ig-dtyp', 5900);
      hide('ig-dtyp', 6900);
      show('ig-d1', 7000);
      show('ig-d2', 7700);
      show('ig-d3', 8400);
      show('ig-d4', 9300);

      loopRef.current = setTimeout(runLoop, 13000);
    }

    loopRef.current = setTimeout(runLoop, 500);
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, []);

  return (
    <div className="lp-ig-scene" ref={containerRef}>
      {/* POST */}
      <div className="lp-ig-post-card">
        <div className="lp-ig-post-header">
          <div className="lp-ig-post-av"><div className="lp-ig-post-av-inner">ZL</div></div>
          <div><div className="lp-ig-post-user">zaplynxpro</div><div className="lp-ig-post-handle">ZapLynx</div></div>
        </div>
        <div className="lp-ig-post-img">
          <div className="lp-ig-crown">👑</div>
          <div className="lp-ig-post-img-text">
            <div className="lp-ig-big">2.7</div>
            <div className="lp-ig-sub">BIRTHDAY EDITION</div>
          </div>
        </div>
        <div className="lp-ig-post-actions">
          <svg viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </div>
        <div className="lp-ig-post-caption"><strong>zaplynxpro</strong> Perfume lançamento Virginia Fonseca 2.7 Birthday Edition 👑 Comente <strong>"QUERO"</strong> e receba no direct!</div>
        <div className="lp-ig-typing-comment" id="ig-tc">
          <div className="lp-ig-tc-av"></div>
          <div className="lp-ig-tc-dots"><div className="lp-ig-tc-dot"></div><div className="lp-ig-tc-dot"></div><div className="lp-ig-tc-dot"></div></div>
        </div>
        <div className="lp-ig-comments-label">Comentários</div>
        <div className="lp-ig-comments-list">
          <div className="lp-ig-comment" id="ig-c1"><div className="lp-ig-c-av" style={{background:'#833ab4'}}>M</div><div className="lp-ig-c-bubble"><strong>mari_souza</strong> QUERO 👑</div></div>
          <div className="lp-ig-comment" id="ig-c2"><div className="lp-ig-c-av" style={{background:'#0095f6'}}>J</div><div className="lp-ig-c-bubble"><strong>ju.freitas</strong> QUERO sim! ❤️</div></div>
          <div className="lp-ig-comment" id="ig-c3"><div className="lp-ig-c-av" style={{background:'#e1306c'}}>A</div><div className="lp-ig-c-bubble"><strong>ana_vf_lover</strong> QUERO 💙</div></div>
          <div className="lp-ig-comment" id="ig-c4"><div className="lp-ig-c-av" style={{background:'#fd1d1d'}}>P</div><div className="lp-ig-c-bubble"><strong>pedra.lima</strong> QUERO!! muito 😍</div></div>
        </div>
      </div>

      {/* SETA */}
      <div className="lp-ig-arrow-wrap">
        <div className="lp-ig-notif-badge" id="ig-nb"><div className="lp-ig-notif-dot"></div>IA detectou</div>
        <div className="lp-ig-arrow-icon" id="ig-ai">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <div className="lp-ig-arrow-line"><div className="lp-ig-arrow-fill" id="ig-af"></div></div>
        <div className="lp-ig-arrow-head" id="ig-ah"></div>
        <div className="lp-ig-arrow-label" id="ig-al">DM automático</div>
      </div>

      {/* DM */}
      <div className="lp-ig-dm-card">
        <div className="lp-ig-dm-header">
          <div className="lp-ig-dm-av" style={{background:'linear-gradient(135deg,#833ab4,#fd1d1d)'}}>M</div>
          <div className="lp-ig-dm-info"><div className="lp-ig-dm-user">mari_souza</div><div className="lp-ig-dm-sub">Instagram Direct</div></div>
          <div className="lp-ig-dm-online"></div>
        </div>
        <div className="lp-ig-dm-body">
          <div className="lp-ig-dm-msg recv" id="ig-d0"><div className="lp-ig-dm-bubble">Oi! Vi seu post e comentei QUERO 👑</div><div className="lp-ig-dm-time">agora</div></div>
          <div className="lp-ig-dm-typing" id="ig-dtyp">
            <div className="lp-ig-dt-dots"><div className="lp-ig-dt-dot"></div><div className="lp-ig-dt-dot"></div><div className="lp-ig-dt-dot"></div></div>
          </div>
          <div className="lp-ig-dm-msg sent" id="ig-d1"><div className="lp-ig-dm-bubble">Oi, Mari! 👋 Vi seu comentário e já separei o link exclusivo para você 😉</div><div className="lp-ig-dm-time">ZapLynx IA</div></div>
          <div className="lp-ig-dm-msg sent" id="ig-d2"><div className="lp-ig-dm-bubble">🎁 <strong>Virginia Fonseca 2.7 Birthday Edition</strong><br/>💵 R$ 197,00 — Frete grátis<br/>🔗 pay.zaplynxpro.online/pay/wenpink</div><div className="lp-ig-dm-time">ZapLynx IA</div></div>
          <div className="lp-ig-dm-msg sent" id="ig-d3"><div className="lp-ig-dm-bubble">Aproveite! Estoque limitado ⏳</div><div className="lp-ig-dm-time">ZapLynx IA</div></div>
          <div className="lp-ig-dm-msg recv" id="ig-d4"><div className="lp-ig-dm-bubble">Amei!! Vou comprar agora 💙💙</div><div className="lp-ig-dm-time">agora</div></div>
        </div>
        <div className="lp-ig-dm-input-row">
          <input className="lp-ig-dm-input" placeholder="Mensagem..." readOnly/>
          <button className="lp-ig-dm-send"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div>
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
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev === 0 ? 1 : 0));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const notebook = (
    <div className="lp-laptop">
      <div className="lp-lid">
        <div className="lp-browser-bar">
          <div className="lp-bdots"><div className="lp-bd lp-bd-r" /><div className="lp-bd lp-bd-y" /><div className="lp-bd lp-bd-g" /></div>
          <div style={{ width: 28 }} />
          <div className="lp-burl">
            <svg width={10} height={10} viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="10" height="7" rx="1.5" stroke="#28c840" strokeWidth="1.2" /><path d="M4 3V2.5a2 2 0 0 1 4 0V3" stroke="#28c840" strokeWidth="1.2" strokeLinecap="round" /></svg>
            pay.zaplynxpro.online/pay/wenpink
          </div>
          <div style={{ width: 50 }} />
        </div>
        <img className="lp-screen-img" src="/checkout-mock-0.jpg" alt="Checkout desktop preview" />
      </div>
      <div className="lp-hinge" />
      <div className="lp-palm"><div className="lp-trackpad" /></div>
      <div className="lp-laptop-shadow" />
    </div>
  );

  const phone = (
    <div className="lp-phone-wrap">
      <div className="lp-phone-device">
        <div className="lp-btn-mute" /><div className="lp-btn-vup" /><div className="lp-btn-vdn" /><div className="lp-btn-pwr" />
        <div className="lp-p-screen">
          <div className="lp-island" />
          <div className="lp-sbar">
            <span>9:41</span>
            <div className="lp-sicons">
              <div className="lp-sbars"><span style={{ height: 4 }} /><span style={{ height: 6 }} /><span style={{ height: 8 }} /><span style={{ height: 10 }} /></div>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2.5}><path d="M1 6.2C4.1 2.4 7.8.5 12 .5s7.9 1.9 11 5.7M5 10.5c2-2 4.4-3 7-3s5 1 7 3M9 14.8c1.7-1.5 3.5-2 5-1.5" /></svg>
              <svg width={14} height={10} viewBox="0 0 25 12" fill="#111"><rect x="0" y="1" width="21" height="10" rx="2" /><rect x="1" y="2" width="16" height="8" rx="1" fill="#34c759" /><rect x="22" y="4" width="2.5" height="4" rx="1" /></svg>
            </div>
          </div>
          <video className="lp-phone-video" src="/checkout-mock-0.mp4" autoPlay muted loop playsInline />
          <div className="lp-hbar"><div className="lp-hind" /></div>
        </div>
      </div>
      <div className="lp-phone-shadow" />
    </div>
  );

  return (
    <>
      {/* Desktop: side by side */}
      <div className="lp-checkout-desktop">
        <div className="lp-checkout-sidebyside">
          {notebook}
          {phone}
        </div>
      </div>
      {/* Mobile: one at a time */}
      <div className="lp-checkout-mobile">
        <div className="lp-checkout-mobile-stage">
          <div className={`lp-checkout-mobile-panel ${activeSlide === 0 ? "is-notebook" : "is-phone"}`}>
            {activeSlide === 0 ? notebook : phone}
          </div>
        </div>
        <div className="lp-checkout-dots">
          <button className={`lp-checkout-dot ${activeSlide === 0 ? "active" : ""}`} onClick={() => setActiveSlide(0)} aria-label="Ver notebook" />
          <button className={`lp-checkout-dot ${activeSlide === 1 ? "active" : ""}`} onClick={() => setActiveSlide(1)} aria-label="Ver celular" />
        </div>
      </div>
    </>
  );
}

function FlowMock() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev === 0 ? 1 : 0));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const notebook = (
    <div className="lp-flow-laptop">
      <div className="lp-flow-lid">
        <div className="lp-flow-browser-bar">
          <div className="lp-flow-bdots">
            <span className="lp-flow-bd r" /><span className="lp-flow-bd y" /><span className="lp-flow-bd g" />
          </div>
          <div style={{width:28}} />
          <div className="lp-flow-burl">
            <svg className="lp-flow-lock" width="10" height="11" viewBox="0 0 12 13" fill="none">
              <rect x="1" y="5" width="10" height="7" rx="1.5" stroke="#28c840" strokeWidth="1.2"/>
              <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="#28c840" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            zaplynx.com/fluxo-visual
          </div>
          <div style={{width:48}} />
        </div>
        <img className="lp-flow-screen-img" src="/images/flow-editor-screenshot.jpg" alt="Editor de Fluxo Visual ZapLynx" />
      </div>
      <div className="lp-flow-hinge" />
      <div className="lp-flow-palm"><div className="lp-flow-trackpad" /></div>
      <div className="lp-flow-nb-shadow" />
    </div>
  );

  const phone = (
    <div className="lp-flow-phone-wrap">
      <div className="lp-flow-phone">
        <div className="lp-flow-btn-m" />
        <div className="lp-flow-btn-vu" />
        <div className="lp-flow-btn-vd" />
        <div className="lp-flow-btn-pw" />
        <div className="lp-flow-p-screen">
          <div className="lp-flow-island" />
          <div className="lp-flow-sbar">
            <span>9:41</span>
            <div className="lp-flow-sicons">
              <div className="lp-flow-sbars">
                <span style={{height:4}} /><span style={{height:6}} /><span style={{height:9}} /><span style={{height:11}} />
              </div>
              <svg width="13" height="10" viewBox="0 0 14 11" fill="none">
                <path d="M7 2.5C9 2.5 10.8 3.3 12.1 4.6L13.5 3.1C11.8 1.5 9.5 0.5 7 0.5C4.5 0.5 2.2 1.5 0.5 3.1L1.9 4.6C3.2 3.3 5 2.5 7 2.5Z" fill="#111"/>
                <path d="M7 5.5C8.3 5.5 9.5 6 10.4 6.9L11.8 5.4C10.5 4.2 8.8 3.5 7 3.5C5.2 3.5 3.5 4.2 2.2 5.4L3.6 6.9C4.5 6 5.7 5.5 7 5.5Z" fill="#111"/>
                <circle cx="7" cy="9.5" r="1.5" fill="#111"/>
              </svg>
              <svg width="24" height="11" viewBox="0 0 26 12" fill="none">
                <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#111" strokeOpacity="0.35"/>
                <rect x="2" y="2" width="18" height="8" rx="2" fill="#111"/>
                <path d="M24 4C25 4.4 25.5 5 25.5 6C25.5 7 25 7.6 24 8V4Z" fill="#111" fillOpacity="0.4"/>
              </svg>
            </div>
          </div>
          <video autoPlay muted loop playsInline>
            <source src="/images/flow-phone-demo.mp4" type="video/mp4" />
          </video>
          <div className="lp-flow-hbar"><div className="lp-flow-hind" /></div>
        </div>
      </div>
      <div className="lp-flow-ph-shadow" />
    </div>
  );

  return (
    <>
      {/* Desktop: sobrepostos */}
      <div className="lp-flow-desktop">
        <div className="lp-flow-devices">
          {notebook}
          {phone}
        </div>
      </div>
      {/* Mobile: um de cada vez */}
      <div className="lp-flow-mobile">
        <div className="lp-flow-mobile-stage">
          {activeSlide === 0 ? notebook : phone}
        </div>
        <div className="lp-checkout-dots">
          <button className={`lp-checkout-dot ${activeSlide === 0 ? "active" : ""}`} onClick={() => setActiveSlide(0)} aria-label="Ver notebook" />
          <button className={`lp-checkout-dot ${activeSlide === 1 ? "active" : ""}`} onClick={() => setActiveSlide(1)} aria-label="Ver celular" />
        </div>
      </div>
    </>
  );
}

export default Landing;
