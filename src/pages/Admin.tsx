import { useWorkspace } from "@/contexts/WorkspaceContext";
import AdminZapLynx from "@/components/admin/AdminZapLynx";
import AdminGateway from "@/components/admin/AdminGateway";

const Admin = () => {
  const { activeWorkspace } = useWorkspace();

  if (activeWorkspace === "gateway") {
    return <AdminGateway />;
  }

  return <AdminZapLynx />;
};

export default Admin;
