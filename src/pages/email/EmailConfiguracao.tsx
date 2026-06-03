import { Mail, Sparkles } from "lucide-react";
import CheckoutEmailSection from "@/components/gateway/CheckoutEmailSection";

export default function EmailConfiguracao() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#a78bfa]/10 via-background to-background p-6 md:p-8">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#a78bfa]/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#8b5cf6]/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#a78bfa] to-[#8b5cf6] text-white shadow-lg shadow-[#a78bfa]/20">
              <Mail className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#a78bfa]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#a78bfa] border border-[#a78bfa]/20">
                  <Sparkles className="h-3 w-3" />
                  E-mail
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configuração de E-mail</h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
                Configure o remetente e autentique seu domínio para garantir alta entregabilidade nos disparos.
              </p>
            </div>
          </div>
        </div>

        <CheckoutEmailSection />
      </div>
    </div>
  );
}