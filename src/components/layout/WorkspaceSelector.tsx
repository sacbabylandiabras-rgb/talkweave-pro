import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Globe, Zap, CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace, WorkspaceType } from "@/contexts/WorkspaceContext";
import { FacebookConnectDialog } from "./FacebookConnectDialog";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const workspaceDefaultRoutes: Record<WorkspaceType, string> = {
  zapi: "/dashboard",
  meta: "/meta/dashboard",
  gateway: "/gateway-checkout/dashboard",
};

const workspaces = [
  {
    id: "gateway" as WorkspaceType,
    label: "ZaplynxPay",
    description: "Integrações e pagamentos",
    icon: CreditCard,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    id: "zapi" as WorkspaceType,
    label: "ZapLynx",
    description: "Mensagens e Automações",
    icon: Zap,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "meta" as WorkspaceType,
    label: "Meta API Oficial",
    description: "WhatsApp Business Platform",
    icon: Globe,
    color: "text-[#0668E1]",
    bg: "bg-[#0668E1]/10",
  },
];

export function WorkspaceSelector() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { data: metaCreds } = useMetaCredentials();
  const { isPaid, loading: subLoading } = useSubscriptionStatus();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [fbDialogOpen, setFbDialogOpen] = useState(false);
  const [pendingMetaSwitch, setPendingMetaSwitch] = useState(false);

  const isMetaConnected = metaCreds?.connected === true;

  useEffect(() => {
    if (pendingMetaSwitch && isMetaConnected) {
      setActiveWorkspace("meta");
      setPendingMetaSwitch(false);
      navigate(workspaceDefaultRoutes.meta);
    }
  }, [isMetaConnected, pendingMetaSwitch, setActiveWorkspace, navigate]);

  useEffect(() => {
    if (activeWorkspace === "meta" && metaCreds !== undefined && !isMetaConnected) {
      setActiveWorkspace("zapi");
      navigate(workspaceDefaultRoutes.zapi);
    }
  }, [isMetaConnected, activeWorkspace, metaCreds, setActiveWorkspace, navigate]);

  // Redirect away from Meta if subscription is not active
  useEffect(() => {
    if (activeWorkspace === "meta" && !subLoading && !isPaid) {
      setActiveWorkspace("zapi");
      navigate(workspaceDefaultRoutes.zapi);
    }
  }, [isPaid, subLoading, activeWorkspace, setActiveWorkspace, navigate]);

  const current = workspaces.find((w) => w.id === activeWorkspace) || workspaces[0];
  const CurrentIcon = current.icon;

  const handleSelect = (ws: WorkspaceType) => {
    // Gate Meta workspace behind paid subscription
    if (ws === "meta" && !isPaid) {
      toast({
        title: "Assinatura necessária",
        description: "A Meta API está disponível apenas para assinantes com plano ativo.",
        variant: "destructive",
      });
      setOpen(false);
      return;
    }

    if (ws === "meta") {
      if (isMetaConnected) {
        setActiveWorkspace("meta");
        navigate(workspaceDefaultRoutes.meta);
      } else {
        setPendingMetaSwitch(true);
        setFbDialogOpen(true);
      }
    } else {
      setActiveWorkspace(ws);
      navigate(workspaceDefaultRoutes[ws]);
    }
    setOpen(false);
  };

  const handleFbDialogClose = (open: boolean) => {
    setFbDialogOpen(open);
    if (!open && !isMetaConnected) {
      // User closed dialog without connecting, cancel pending switch
      setPendingMetaSwitch(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-medium gap-2 rounded-lg"
          >
            <div className={cn("w-5 h-5 rounded flex items-center justify-center", current.bg)}>
              <CurrentIcon className={cn("w-3 h-3", current.color)} />
            </div>
            <span className="hidden sm:inline">{current.label}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 py-1.5">
            Workspace
          </p>
          {workspaces.map((ws) => {
            const Icon = ws.icon;
            const isActive = activeWorkspace === ws.id;
            const isLocked = ws.id === "meta" && !isPaid && !subLoading;
            return (
              <button
                key={ws.id}
                onClick={() => handleSelect(ws.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                  isActive
                    ? "bg-muted"
                    : "hover:bg-muted/60",
                  isLocked && "opacity-60"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ws.bg)}>
                  <Icon className={cn("w-4 h-4", ws.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    {ws.label}
                    {isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isLocked ? "Requer assinatura ativa" : ws.description}
                  </p>
                </div>
                {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      <FacebookConnectDialog open={fbDialogOpen} onOpenChange={handleFbDialogClose} />
    </>
  );
}
