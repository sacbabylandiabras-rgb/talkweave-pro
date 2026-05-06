import { Hash } from "lucide-react";
import CanaisTab from "@/components/grupos/CanaisTab";

const Canais = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Hash className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground font-bebas tracking-wider uppercase">Canais</h1>
          <p className="text-muted-foreground text-sm">
            Crie e gerencie canais do WhatsApp.
          </p>
        </div>
      </div>
      <CanaisTab />
    </div>
  );
};

export default Canais;
