import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
    return (localStorage.getItem("active_workspace") as WorkspaceType) || "zapi";
  });

  useEffect(() => {
    localStorage.setItem("active_workspace", activeWorkspace);
  }, [activeWorkspace]);

  const workspaceLabel = activeWorkspace === "gateway" ? "Gateway e Checkout" : activeWorkspace === "meta" ? "Meta API Oficial" : "ZapLynx";

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, setActiveWorkspace, workspaceLabel }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
