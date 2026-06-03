import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AfiliadosCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Concluindo conexão…");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Conexão cancelada: ${error}`);
        return;
      }
      if (!code || !state) {
        setStatus("error");
        setMessage("Parâmetros inválidos.");
        return;
      }

      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "mercadolivre-oauth-callback",
          { body: { code, state } },
        );
        if (fnErr || (data as any)?.error) {
          throw new Error((data as any)?.error || fnErr?.message || "Falha ao conectar");
        }
        setStatus("ok");
        setMessage(`Conta conectada${(data as any)?.nickname ? `: ${(data as any).nickname}` : ""}!`);
        setTimeout(() => navigate("/afiliados"), 1500);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Erro inesperado.");
      }
    };
    run();
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {status === "loading" && <Loader2 className="h-10 w-10 animate-spin text-primary" />}
        {status === "ok" && <CheckCircle2 className="h-10 w-10 text-green-500" />}
        {status === "error" && <XCircle className="h-10 w-10 text-destructive" />}
        <h1 className="text-lg font-semibold">{status === "ok" ? "Tudo certo!" : status === "error" ? "Não foi possível conectar" : "Conectando…"}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}