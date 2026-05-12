import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ExclusaoDados() {
  const handleRequestDeletion = () => {
    window.location.href = "mailto:zaplynx2.0@gmail.com?subject=Solicitação de Exclusão de Dados";
    toast.info("Abrindo seu app de e-mail para a solicitação.");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Instruções de Exclusão de Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            De acordo com as políticas do Facebook e a LGPD, você tem o direito de solicitar a exclusão de suas informações pessoais coletadas pela nossa plataforma.
          </p>
          
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Como solicitar:</h3>
            <p className="text-sm text-muted-foreground">
              Para solicitar a exclusão definitiva da sua conta e de todos os dados associados (contatos, tokens de acesso e logs), envie um e-mail para:
            </p>
            <p className="text-sm font-medium text-primary">zaplynx2.0@gmail.com</p>
          </div>

          <div className="pt-4">
            <Button onClick={handleRequestDeletion} className="w-full">
              Solicitar Exclusão via E-mail
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            O processamento da exclusão pode levar até 48 horas úteis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}