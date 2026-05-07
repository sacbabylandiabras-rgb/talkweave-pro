/**
 * CustomInputPage — renderiza o HTML enviado pelo usuário em iframe full-screen
 * para garantir paridade visual 100% com o design original.
 */
import { useState, useEffect, useCallback } from "react";
import { useWebPush } from "@/hooks/useWebPush";
import { toast } from "sonner";
import { Bell } from "lucide-react";

export default function CustomInputPage() {
  const [v] = useState(Date.now());
  const { enablePush, pushEnabled, permissionStatus } = useWebPush();

  const handleEnablePush = useCallback(async () => {
    try {
      await enablePush();
      toast.success("Notificações ativadas!");
    } catch (err: any) {
      console.error("Erro ao ativar push:", err);
      toast.error(err.message || "Erro ao ativar notificações");
    }
  }, [enablePush]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'ENABLE_PUSH') {
        handleEnablePush();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleEnablePush]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f1117", zIndex: 9999 }}>
      {(!pushEnabled || permissionStatus === "default") && (
        <div 
          style={{ 
            position: "absolute", 
            top: 20, 
            left: "50%", 
            transform: "translateX(-50%)", 
            zIndex: 10000,
            width: "90%",
            maxWidth: "400px"
          }}
        >
          <button
            onClick={handleEnablePush}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 animate-pulse"
          >
            <Bell className="w-5 h-5" />
            Ativar Notificações Realtime
          </button>
        </div>
      )}
      <iframe
        src={`/notificacoes-realtime/index.html?v=${v}`}
        title="ZapLynx Realtime"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
}
