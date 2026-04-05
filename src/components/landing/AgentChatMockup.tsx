import { useEffect, useRef, useState, useCallback } from "react";
import logoImage from "@/assets/logo.png";
import avatarClientImg from "@/assets/avatar-client.jpg";

const AVATAR_AGENT = logoImage;
const AVATAR_CLIENT = avatarClientImg;

interface Message {
  id: string;
  side: "L" | "R";
  badge: "ag" | "cl" | "bt";
  badgeLabel: string;
  type: "text" | "audio";
  text?: string;
  audioSecs?: number;
  audioBars?: number[];
}

const messages: Message[] = [
  { id: "m1", side: "R", badge: "ag", badgeLabel: "Agente IA", type: "text", text: "Boa tarde, Pedro! Tudo certinho? 😊" },
  { id: "m2", side: "L", badge: "cl", badgeLabel: "Cliente", type: "text", text: "Oi, tudo ótimo!" },
  { id: "m3", side: "R", badge: "ag", badgeLabel: "Agente IA", type: "text", text: "Aqui é o assistente da ZapLynx.\nVocê acabou de se cadastrar no nosso site, né?" },
  { id: "m4", side: "L", badge: "cl", badgeLabel: "Cliente", type: "audio", audioSecs: 6, audioBars: [8, 12, 18, 24, 20, 14, 10, 16, 22, 18, 12, 8, 14, 20, 24, 18, 12, 8, 10, 16, 20, 14, 8] },
  { id: "m5", side: "R", badge: "ag", badgeLabel: "Agente IA", type: "audio", audioSecs: 5, audioBars: [10, 16, 22, 18, 12, 8, 14, 20, 18, 12, 8, 10, 16, 22, 20, 14, 10, 8, 12, 18, 14, 10, 8] },
  { id: "m6", side: "R", badge: "ag", badgeLabel: "Agente IA", type: "text", text: "Essas são as informações que preciso:" },
  { id: "m7", side: "R", badge: "bt", badgeLabel: "Chatbot", type: "text", text: "Quantos funcionários tem sua empresa?" },
];

const sequence = [
  { show: "m1", delay: 400 },
  { typing: true, delay: 900 },
  { typing: false, show: "m2", delay: 1600 },
  { show: "m3", delay: 2400 },
  { show: "m4", delay: 3400 },
  { typing: true, delay: 4200 },
  { typing: false, show: "m5", delay: 5000 },
  { show: "m6", delay: 6000 },
  { show: "m7", delay: 6800 },
];

function AudioBubble({ bars, secs, side }: { bars: number[]; secs: number; side: "L" | "R" }) {
  const isAgent = side === "R";

  return (
    <div style={{
      borderRadius: 14,
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 180,
      background: isAgent ? "#2a5f45" : "#1e2530",
      borderBottomRightRadius: isAgent ? 4 : 14,
      borderBottomLeftRadius: isAgent ? 14 : 4,
    }}>
      <div style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "#25d366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width={11} height={11} viewBox="0 0 12 12" fill="#fff"><polygon points="2,1 11,6 2,11" /></svg>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 28 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 3,
            borderRadius: 2,
            height: h,
            background: "rgba(255,255,255,0.22)",
            flexShrink: 0,
          }} />
        ))}
      </div>

      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", fontFamily: "sans-serif" }}>
        0:0{secs}
      </span>

      {isAgent ? (
        <div style={{
          width: 34,
          height: 16,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <img src={AVATAR_AGENT} alt="ZapLynx" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        </div>
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#333" }}>
          <img src={AVATAR_CLIENT} alt="Cliente" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
    </div>
  );
}

function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: "#1e2530",
      padding: "8px 12px",
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      width: "fit-content",
      animation: "fadeIn 0.3s ease",
    }}>
      {[0, 0.2, 0.4].map((d, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#555",
            animation: `agentBounce 1.2s infinite ${d}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function AgentChatMockup() {
  const [visibleMsgs, setVisibleMsgs] = useState<Set<string>>(new Set());
  const [showTyping, setShowTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);

  const runSequence = useCallback(() => {
    sequence.forEach((step) => {
      setTimeout(() => {
        if (step.typing !== undefined) setShowTyping(step.typing);
        if (step.show) {
          setVisibleMsgs((prev) => new Set(prev).add(step.show!));
          requestAnimationFrame(() => {
            if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
          });
        }
      }, step.delay);
    });
  }, []);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(() => runSequence(), 300);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    const el = chatRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [runSequence]);

  return (
    <>
      <style>{`
        @keyframes agentBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "transparent",
        borderRadius: 4,
        minHeight: 540,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          width: 300,
          background: "#111",
          borderRadius: 32,
          padding: 3,
          boxShadow: "0 24px 60px rgba(0,0,0,.3)",
          position: "relative",
          zIndex: 2,
        }}>
          <div style={{ background: "#0a0a0a", borderRadius: 30, overflow: "hidden" }}>
            <div style={{
              background: "#1a1a2e",
              padding: "10px 16px 8px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}>
              <div style={{
                width: 48,
                height: 18,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <img src={AVATAR_AGENT} alt="ZapLynx" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>ZapLynx IA</div>
                <div style={{ fontSize: 10, color: "#25d366" }}>● online</div>
              </div>
            </div>

            <div ref={chatRef} style={{
              background: "#0d1117",
              padding: "12px 10px",
              minHeight: 420,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              overflowY: "auto",
              maxHeight: 460,
            }}>
              {messages.map((msg) => {
                const visible = visibleMsgs.has(msg.id);

                return (
                  <div key={msg.id} style={{
                    display: "flex",
                    flexDirection: "column",
                    maxWidth: "82%",
                    alignSelf: msg.side === "R" ? "flex-end" : "flex-start",
                    alignItems: msg.side === "R" ? "flex-end" : "flex-start",
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 0.3s, transform 0.3s",
                  }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 20,
                      marginBottom: 3,
                      fontFamily: "sans-serif",
                      ...(msg.badge === "ag"
                        ? { background: "#7c4dbd", color: "#e8d8ff" }
                        : msg.badge === "cl"
                          ? { background: "#1e4d3a", color: "#7fffd4" }
                          : { background: "#c45d00", color: "#ffe0b2" }),
                    }}>
                      {msg.badgeLabel}
                    </span>

                    {msg.type === "text" ? (
                      <div style={{
                        padding: "7px 11px",
                        borderRadius: 14,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: "#e9e9e9",
                        fontFamily: "sans-serif",
                        whiteSpace: "pre-line",
                        background: msg.side === "R" ? "#2a5f45" : "#1e2530",
                        borderBottomRightRadius: msg.side === "R" ? 4 : 14,
                        borderBottomLeftRadius: msg.side === "L" ? 4 : 14,
                      }}>
                        {msg.text}
                      </div>
                    ) : (
                      <AudioBubble bars={msg.audioBars!} secs={msg.audioSecs!} side={msg.side} />
                    )}

                    <span style={{
                      fontSize: 9,
                      color: "rgba(255,255,255,0.35)",
                      marginTop: 2,
                      padding: "0 4px",
                      fontFamily: "sans-serif",
                    }}>
                      14:{28 + messages.indexOf(msg)}
                    </span>
                  </div>
                );
              })}
              <TypingIndicator visible={showTyping} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
