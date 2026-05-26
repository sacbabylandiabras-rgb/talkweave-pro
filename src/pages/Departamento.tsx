import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Building2 } from "lucide-react";

export default function Departamento() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Departamento</h1>
            <p className="text-xs text-muted-foreground">Organize sua equipe por departamentos.</p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum departamento criado ainda.
        </div>
      </div>
    </DashboardLayout>
  );
}