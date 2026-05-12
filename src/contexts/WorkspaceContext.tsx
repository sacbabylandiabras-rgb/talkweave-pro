import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type WorkspaceType = "zapi" | "meta" | "gateway";

interface WorkspaceContextType {
  activeWorkspace: WorkspaceType;
  setActiveWorkspace: (ws: WorkspaceType) => void;
  workspaceLabel: string;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  activeWorkspace: "zapi",
  setActiveWorkspace: () => {},
  workspaceLabel: "ZapLynx",
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>(() => {
    return (localStorage.getItem("active_workspace") as WorkspaceType) || "gateway";
  });

  useEffect(() => {
    localStorage.setItem("active_workspace", activeWorkspace);
  }, [activeWorkspace]);

  const workspaceLabel = activeWorkspace === "gateway" ? "ZaplynxPay" : activeWorkspace === "meta" ? "ZapLynx Oficial" : "ZapLynx";

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, setActiveWorkspace, workspaceLabel }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Renders inside <Router> to auto-sync workspace with the current route.
 */
export function WorkspaceRouteSync() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    let next: WorkspaceType | null = null;
    if (path.startsWith("/meta")) next = "meta";
    else if (path.startsWith("/gateway-checkout")) next = "gateway";
    else if (
      path.startsWith("/dashboard") ||
      path.startsWith("/mensagens") ||
      path.startsWith("/dispositivos") ||
      path.startsWith("/perfil-empresa") ||
      path.startsWith("/etiquetas") ||
      path.startsWith("/modelos") ||
      path.startsWith("/fluxo-visual") ||
      path.startsWith("/campanhas") ||
      path.startsWith("/enviar-mensagem") ||
      path.startsWith("/contatos") ||
      path.startsWith("/relatorio") ||
      path.startsWith("/apanhador-grupos") ||
      path.startsWith("/criar-grupos") ||
      path.startsWith("/comunidades") ||
      path.startsWith("/canais") ||
      path.startsWith("/campanhas-grupo") ||
      path.startsWith("/fluxo-grupos") ||
      path.startsWith("/agente-ia") ||
      path.startsWith("/aquecimento")
    ) next = "zapi";
    if (next && next !== activeWorkspace) setActiveWorkspace(next);
  }, [location.pathname]);
  return null;
}
