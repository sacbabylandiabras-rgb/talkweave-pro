import { useState } from "react";
import { Plus, Pencil, Settings2, Calendar, Search, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PlanRow {
  id: string;
  title: string;
  price: string;
  charge: string;
  cycle: string;
  message: string;
}

export default function TelegramPlanos() {
  const [plans] = useState<PlanRow[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filtered = plans.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-white">Planos</h1>
        <p className="text-sm text-white/60 mt-1">
          Crie, gerencie e organize seus planos de pagamento de forma rápida, simples e eficiente
        </p>
      </div>

      {/* Banner de boas-vindas */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-r from-primary/30 via-primary/15 to-primary/5 p-8 relative">
        <div className="grid md:grid-cols-2 gap-6 items-center relative z-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              Seu lugar já está <span className="text-primary">reservado</span>
              <br />
              na nossa <span className="bg-primary/30 px-2 py-0.5 rounded">comunidade</span>
            </h2>
          </div>
          <div className="text-right">
            <h3 className="text-xl md:text-2xl font-semibold text-white">
              Faça parte da nossa
              <br />
              <span className="text-primary">comunidade de Networking</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Gestão de planos */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-white">Gestão de Planos</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar Mensagem PIX
          </Button>
          <Button variant="outline" size="sm">
            <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Configuração de Planos
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Criar Novo Plano
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f0a24]/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-white/50">
              Ganhos nos últimos 7 dias com planos
            </span>
            <span className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs text-white/70">
              7
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">R$ 0</span>
            <span className="text-xs text-white/50 mb-1">23 ABR – 30 ABR</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0a24]/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-white/50">
              Ganhos mensais com planos
            </span>
            <Calendar className="w-4 h-4 text-white/50" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">R$ 0</span>
            <span className="text-xs text-white/50 mb-1">ABR 2026</span>
          </div>
        </div>
      </div>

      {/* Tabela de planos ativos */}
      <div className="rounded-2xl border border-white/10 bg-[#0f0a24]/60 overflow-hidden">
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Planos de pagamento ativos</h3>
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                {plans.length}
              </span>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Visualize todos os planos de pagamento atualmente ativos, com informações sobre
              valores, período de vigência, status e condições de cada plano.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showSearch ? (
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setShowSearch(false)}
                placeholder="Buscar..."
                className="h-8 w-48"
              />
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setShowSearch(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
            )}
            <button className="h-8 px-3 rounded-md border border-white/10 bg-white/5 text-xs text-white/80 inline-flex items-center gap-1.5 hover:bg-white/10">
              <Globe className="w-3.5 h-3.5" /> Português <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/50 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Título</th>
                <th className="px-5 py-3 font-medium">Preço</th>
                <th className="px-5 py-3 font-medium">Cobrança</th>
                <th className="px-5 py-3 font-medium">Ciclo</th>
                <th className="px-5 py-3 font-medium">Mensagem</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-white/50">
                    Nenhum plano encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-5 py-3 text-white">{p.title}</td>
                    <td className="px-5 py-3 text-white/80">{p.price}</td>
                    <td className="px-5 py-3 text-white/80">{p.charge}</td>
                    <td className="px-5 py-3 text-white/80">{p.cycle}</td>
                    <td className="px-5 py-3 text-white/80">{p.message}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost">
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
