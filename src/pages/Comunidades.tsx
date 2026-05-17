import { Card } from "@/components/ui/card";
import ComunidadesTab from "@/components/grupos/ComunidadesTab";
import { Building2 } from "lucide-react";

const Comunidades = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
           <h1 className="text-2xl font-bold text-foreground font-bebas tracking-wider">Comunidades</h1>
          <p className="text-muted-foreground text-sm">
            Crie e gerencie comunidades do WhatsApp, vincule grupos e controle participantes.
          </p>
        </div>
      </div>

      <ComunidadesTab />
    </div>
  );
};

export default Comunidades;