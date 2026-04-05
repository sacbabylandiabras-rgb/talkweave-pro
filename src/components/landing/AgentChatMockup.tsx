import { useEffect, useRef, useState, useCallback } from "react";

const AVATAR_AGENT = "data:image/png;base64,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";
const AVATAR_CLIENT = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0QGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCABQAFADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC7L8XNNmTFx4WjuEDBSrzBuT9Vrn73xX8N9Y1uOS88FC2REmWSSFgDIxQhOFwOG5z2rh5IxAZmX7sriRCO5Kgfz/lSQaev/LVXdz/Ag5H1PaviZY+q3Zu69D9WwuSYSinNXj6Nr9TEeEA5A71Vl8PafqlwBcO1tI3AnQZwe24dx+tbs9v5MpRkZQem4c4rsdB8GNHYNrOtIEsEcRxxbtrXkh5VQeyY5Y9gD7V7GU4pSpSpTeq29DpziVGjD2s3o/zPLbr4Z+LLCVZ9PsG1FUP+stOcZ7EdqzNR+Hvik+D9Y8RXtlLGLKSMyRy8MYCcF1HQ4YjOD0INfUfgrQpvFEn22/Yro8beXDBFmNJMfwgA8RjnJ6nuetdp4ubwl4c0M6ZfeG9MfT7iExvDGUikdCMHC4GR1zXZ9akpWlqz8zxCVd82z/M+Y9L+H+veP/hv8Otf0CBbi9sLqSzu5JHCbI0mDBix7DDe/wA1eveGvh54V134jeIPiJFq95dPqj3Nj9mUCKNI+InGRySdoIOR1rd03W/D2k6fYW2jyWtlokCDy0RRGFG4E7h/ex1Pfk15R8O/idZ6B4Ea0fLTRXFyyherHerj81VsV0Ucloee1Z2Z7PbfDTwhYeD7zwxY6fJb6bfPvmjS4fc7dchySR07VlP8PLbQdC0yz0C5aGx0y6a8MdyTKz8gkb+xAXjIrJh+MmkSXKMglKMVkjHrjJAP+8jFfqldOfGOk6z4Xv1s7pWcW1w6qeGOACvH+6wpJST1JZ8/wW7i48udtiw8Et/D9PX2q1qF9FpllDJEgYSSAYPdRyx+uK5praJrxi2q6xZM+BuFx56A46lX5/I1W1nQPGFg8AsteXUVaXywoLIwYgEDuOR715OFyTlknO78rf8ABZ9Nm3HFCrT9nQkoyls7uy76NL8T0rRdAXxL4o0+3T/j3YeZI47px0+ucfjW74pv5Ne8RwaXpseywhJsrKOPocECSTHcsxAHsKofDtL7QPhDqGvX6smpaixSEF9zJGuVXH1O4/lXXeD9FA8YW8blWXT0SAnv5nVz/wB9MfyrWhhY4dytqY47NamPUHLRJaL9fmeo+HNJstD8OQQXB8u0sbcvM3+yo3SN+gFfImv6h8SPiH4zv9durW6ezuZmaytwvFvCD8iKPZcZ98nvX1j4/vBZ/Di6tI2xNqMsWmqqns53P/46K0/CGiWdnZwKLdFCgYO0cUoVOWTdjKjh1Ui22fN3w88HP441iG11W6ddP06Vbi6tgcGcjpGfQFgM+wx3r1eb4GfDa4uLuaTw8RLdSNKzR3DpsLEkhACAoyTxisr4gRj4c/HbT9X00CDT9TAe5iUYVjnD5HbqGr1LVDcR6dc3llJiaO3dkBXcGIUkZH19K9GnO6ujy8TDknZngHir9m6Wxj/tD4f6tcCWPkabfyBlYdcJJgYOfX86810+bV9M1+TTdXtJ7C/i3RS28w2soIOD7jkj06V3/h/4k+KtS8QJLr3jHUILMDMwsLQFYz/d2quc/nivRvFGh+EfiN4MbXtM1aC+vtJHmxXkY2yqByY5RwcEA8EDB5roTt8RzM+crmIEtEiO9wTuRAC3mg4G1QBwR8zEnqK7LQ5oNW0zT5c+ZsZMrwMOjc++Sp/IVT1vwpqFvEbqwkWfyyWTy2IcD+vHpVPwvJ9m8RQXNuoFtfE74woAikXkhVzkLzgH0J9K9LT2bn2Pz2a+sVYwpu+qPRNWvIfitel6WqqsMT+c8YHG1Pnx+i/rXT+AGYRrfzEk3Ny9wc9wuT+przudZ7jXriUAsREsAxycuST+OOPxr0qzjXS4La0XAFtCsZI7s2C36KPzr5iU7Q13Z+qwhrZbI3PFNzbXWveFtMubuFE82a9cSsF3HARevsa9E0/7OqxmFgU6HB/Kvmj4h6v4Y1XxgdH1S6CXVpZqsLLOUkTdljtx7BTziux8AXutaB8I9Z1O7vpL6Kyj32vnH5tvufrWUY+4pdz0qMmo8vQP2m41XSNG1BXybe7yTnsUJI/QV69DGvkxg/dKrn6Yr5h8beI/FOu+DNPuPGsVlDpDalE5a0O6ZUP3gV6/d3Yr3rQPiX4E8UCKHRdftZZpsKsDEo6nspB6N7d8cV6NCDUDx8dJOp8jybw/8MdYvJJYdUtl060S6kBmbG58O2GVc+g6n14q5e+G77wH4tN1ZTtdadqUElnKRgMwYYG7tlTtOfTNe3PbQTQlZ40fHIDDNZWrWdq/h+6iNtEVSNnQFQdrYOCPeulS7nAzxSPTL2aDN1AlvcHIJtpM9dvP16VQsfCj2vitruJwtpcHdJAVxhxnDA+nLce9ULjWbXwrpsa+bLeO4JUNJ/rOOq+ig5B+neui8E3uraqLyfUlhhMbbBbopDRH/AGifY5rvxsoww0ml5fefB5BRVXMIOC0vf7tS9omjpJqkt9Ih8mKZpmHXLD5EX68E1LqOpR/23BpqMC6AzTEHOMEcfyH/AAE1avb8aVoCww4EhJyxPBc9T+GcfnXAaFM91p99rUzvvvJFgjLdQmSAfqck/jXx85ObdtkfrdKFrLudJp3w5tvE2sXviOQRB7hipd49xCBQu0H0IHT3r0mTQLSbwRqPhGF2ihurBrRWjO0r8vykHsRxVWLUItI8HwWdoi+fKAoA5JJrmW8ezWnicabDYzPMn+seVDtDZxtz3Pf8a1jKTSS6Hsww8YrU8p8b+DdZ8J+FdP03WdRuHsZJmCLOxZo2VWOS3YMWAx+I60vwb8A2upO3iPxB4hg0ixkb7PaQecokupQQRkdVUEDngk9COteqfGy6ttV8FaVbMYw12yq7P0jAwzt+AU1F4c0T4U6P4ejvdX1SC7a5QAwTSEeSdo6KuDnHft2r2cNO9JNnyeYQ5azivI9iskuINJggvZknuVjVZZVXaHYDlgO2fSq+pY/s24XsYm/lVTwvFPDprwfblvtOXa1jcsxM3lEZCSAjkr0DdxjPNWtY2po13KWI2wuf0qjiPivWvESR3n9o6ltmvrlFNvBGolUxMrAqEHO4cEenU1698OJbyx+Fkd9f2MttdX0zskU4O85YhS2eegB/Kud8LaFDptpC8NsiXlxiSWTy8sV6BQ3UdjXoDkyNC7OfItFKpx99sDJ/Pj8Kec1n7FRWzZ8/wgoVMRPlj8K39eiRkavHJfapYaTGW2yXMcLNnopOWP4gEf8AAqfrujJpfh9YLWMRpHebFAPYcf1pumM1zq9tfbsqt3GBx1GHJ/z7Vs+PphY+Co7uQgKuqqjE9w2Tmvnoq1on6JBe8mLDqUWnXEN3qU8UNqgAEsp4Un+VbEHiTwTqt+k0Ws2r3UJ+UbTyTwOcVStbdb3Q3MaiRJYxjvXL2Nnpja/NdT6FYrNAPNkvPJCuFTJPTjJ6ZrajZrU9mPLZuTM7V/t3j34kP4S0zaFtFw0shxHFlgZGc9gFOAOpPA617TofhPwroRR/si6hfIu1ry7UOc+iKeEHsOfevjWXxBqUetT6hbXUsZmuxeFUbG5w5ZSfXGeK9I034k+Mrq2TyL4NKvUyRBj+Oa92NJwgoo+Ir1HVqSm+p9WLcwmLKAZ/u9Kw/FV1GnhDVHPDLayED32mvAIPiX8QYHMhu4ZsdUa1TH6YNSap8YdYlibRta0q3Zr+IwrLbhkKFhjJBJHej2bMT//Z";

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
  { id: "m4", side: "L", badge: "cl", badgeLabel: "Cliente", type: "audio", audioSecs: 6, audioBars: [8,12,18,24,20,14,10,16,22,18,12,8,14,20,24,18,12,8,10,16,20,14,8] },
  { id: "m5", side: "R", badge: "ag", badgeLabel: "Agente IA", type: "audio", audioSecs: 5, audioBars: [10,16,22,18,12,8,14,20,18,12,8,10,16,22,20,14,10,8,12,18,14,10,8] },
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

const badgeColors: Record<string, string> = {
  ag: "background: #7c4dbd; color: #e8d8ff;",
  cl: "background: #1e4d3a; color: #7fffd4;",
  bt: "background: #c45d00; color: #ffe0b2;",
};

function AudioBubble({ bars, secs, side }: { bars: number[]; secs: number; side: "L" | "R" }) {
  const avatar = side === "L" ? AVATAR_CLIENT : AVATAR_AGENT;
  return (
    <div style={{
      borderRadius: 14,
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 180,
      background: side === "R" ? "#2a5f45" : "#1e2530",
      borderBottomRightRadius: side === "R" ? 4 : 14,
      borderBottomLeftRadius: side === "L" ? 4 : 14,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", background: "#25d366",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width={11} height={11} viewBox="0 0 12 12" fill="#fff"><polygon points="2,1 11,6 2,11" /></svg>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 28 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 3, borderRadius: 2, height: h,
            background: "rgba(255,255,255,0.22)", flexShrink: 0,
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", fontFamily: "sans-serif" }}>
        0:0{secs}
      </span>
      <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#333" }}>
        <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "50%" }} />
      </div>
    </div>
  );
}

function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: "#1e2530", padding: "8px 12px", borderRadius: 14,
      borderBottomLeftRadius: 4, width: "fit-content",
      animation: "fadeIn 0.3s ease",
    }}>
      {[0, 0.2, 0.4].map((d, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#555",
          animation: `agentBounce 1.2s infinite ${d}s`,
        }} />
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
          setVisibleMsgs(prev => new Set(prev).add(step.show!));
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
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 16px",
        background: "transparent",
        borderRadius: 4, minHeight: 540, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          width: 300, background: "#111", borderRadius: 32,
          padding: 3, boxShadow: "0 24px 60px rgba(0,0,0,.3)",
          position: "relative", zIndex: 2,
        }}>
          <div style={{ background: "#0a0a0a", borderRadius: 30, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              background: "#1a1a2e", padding: "10px 16px 8px",
              display: "flex", alignItems: "center", gap: 10,
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", overflow: "hidden",
                flexShrink: 0, background: "#333", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <img src={AVATAR_AGENT} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>ZapLynx IA</div>
                <div style={{ fontSize: 10, color: "#25d366" }}>● online</div>
              </div>
            </div>

            {/* Chat area */}
            <div ref={chatRef} style={{
              background: "#0d1117", padding: "12px 10px", minHeight: 320,
              display: "flex", flexDirection: "column", gap: 6,
              overflowY: "auto", maxHeight: 360,
            }}>
              {messages.map((msg) => {
                const visible = visibleMsgs.has(msg.id);
                return (
                  <div key={msg.id} style={{
                    display: "flex", flexDirection: "column", maxWidth: "82%",
                    alignSelf: msg.side === "R" ? "flex-end" : "flex-start",
                    alignItems: msg.side === "R" ? "flex-end" : "flex-start",
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 0.3s, transform 0.3s",
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 7px",
                      borderRadius: 20, marginBottom: 3, fontFamily: "sans-serif",
                      ...(msg.badge === "ag" ? { background: "#7c4dbd", color: "#e8d8ff" } :
                        msg.badge === "cl" ? { background: "#1e4d3a", color: "#7fffd4" } :
                          { background: "#c45d00", color: "#ffe0b2" }),
                    }}>
                      {msg.badgeLabel}
                    </span>

                    {msg.type === "text" ? (
                      <div style={{
                        padding: "7px 11px", borderRadius: 14, fontSize: 12,
                        lineHeight: 1.5, color: "#e9e9e9", fontFamily: "sans-serif",
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
                      fontSize: 9, color: "rgba(255,255,255,0.35)",
                      marginTop: 2, padding: "0 4px", fontFamily: "sans-serif",
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
