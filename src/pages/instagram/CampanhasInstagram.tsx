import { Plus, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CampanhasInstagram() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Campanhas Instagram</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus fluxos de automação de comentários</p>
        </div>
        <Button onClick={() => navigate("/instagram/automacao")} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Fluxo
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Instagram className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-base font-medium">Nenhum fluxo criado ainda</p>
        <p className="text-sm mt-1">Crie seu primeiro fluxo de automação para começar</p>
        <Button onClick={() => navigate("/instagram/automacao")} className="gap-2 mt-4">
          <Plus className="w-4 h-4" />
          Criar Primeiro Fluxo
        </Button>
      </div>
    </div>
  );
}
