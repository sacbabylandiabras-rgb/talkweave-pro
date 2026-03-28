import { useWorkspace } from "@/contexts/WorkspaceContext";
import PerfilWhatsApp from "@/components/perfil/PerfilWhatsApp";
import PerfilGateway from "@/components/perfil/PerfilGateway";

const Perfil = () => {
  const { activeWorkspace } = useWorkspace();

  if (activeWorkspace === "gateway") {
    return <PerfilGateway />;
  }

  return <PerfilWhatsApp />;
};

export default Perfil;
