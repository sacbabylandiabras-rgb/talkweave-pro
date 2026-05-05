import { useNavigate } from "react-router-dom";
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

      {/* HERO */}
      <div className="lp-hero" style={{ paddingTop: 80 }}>
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

      {/* FEATURE CARDS */}
      <div className="lp-cards-row">
        <FeatureCard icon="chat" title="Disparos em Massa" desc="Envie milhares de mensagens com múltiplas instâncias e rotação automática." />
        <FeatureCard icon="flow" title="Fluxos Visuais" desc="Monte automações arrastando blocos. Sem código." />
        <FeatureCard icon="ai" title="Agente de IA" desc="Atendimento 24/7 com IA treinada no seu negócio." />
        <FeatureCard icon="group" title="Grupos & Comunidades" desc="Crie, clone e gerencie grupos automaticamente." />
        <FeatureCard icon="warm" title="Aquecimento" desc="Aqueça seus números e proteja contra banimento." />
        <FeatureCard icon="chart" title="Relatórios" desc="Métricas em tempo real de entregas, leituras e respostas." />
      </div>

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