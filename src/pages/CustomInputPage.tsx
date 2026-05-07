/**
 * CustomInputPage — renderiza o HTML enviado pelo usuário em iframe full-screen
 * para garantir paridade visual 100% com o design original.
 */
import { useState, useEffect } from "react";
import { useWebPush } from "@/hooks/useWebPush";
import { toast } from "sonner";

export default function CustomInputPage() {
  const [v] = useState(Date.now());
  const { enablePush } = useWebPush();

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'ENABLE_PUSH') {
        try {
          await enablePush();
          console.log("Push enabled from iframe request");
        } catch (err) {
          console.error("Error enabling push from iframe:", err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [enablePush]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f1117", zIndex: 9999 }}>
      <iframe
        src={`/notificacoes-realtime/index.html?v=${v}`}
        title="ZapLynx Realtime"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
}
