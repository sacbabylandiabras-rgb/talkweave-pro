 import { useState, useEffect } from "react";
 import { useWebPush } from "@/hooks/useWebPush";
 import { Button } from "@/components/ui/button";
 import { Bell, Download, X } from "lucide-react";
 import { toast } from "sonner";
 import { Capacitor } from "@capacitor/core";
 
 export function PWAInstaller() {
   const { pushEnabled, pushBusy, permissionStatus, enablePush } = useWebPush();
   const [installPrompt, setInstallPrompt] = useState<any>(null);
   const [isVisible, setIsVisible] = useState(false);
   const isNative = Capacitor.isNativePlatform();
 
   useEffect(() => {
     const handler = (e: any) => {
       e.preventDefault();
       setInstallPrompt(e);
       setIsVisible(true);
     };
     window.addEventListener("beforeinstallprompt", handler);
     
     // Check if already installed
     if (window.matchMedia('(display-mode: standalone)').matches) {
       setIsVisible(false);
     }
 
     return () => window.removeEventListener("beforeinstallprompt", handler);
   }, []);
 
   const handleInstall = async () => {
     if (!installPrompt) return;
     installPrompt.prompt();
     const { outcome } = await installPrompt.userChoice;
     if (outcome === 'accepted') {
       setInstallPrompt(null);
       setIsVisible(false);
       toast.success("App instalado com sucesso!");
     }
   };
 
   const handleEnableNotifications = async () => {
     try {
       await enablePush();
       toast.success("Notificações ativadas!");
     } catch (error: any) {
       toast.error(error.message || "Erro ao ativar notificações");
     }
   };
 
  if (isNative) return null;
  if (!isVisible) return null;

  // Hide on public checkout / payment routes
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (/^\/(c|pay|checkout|obrigado|thank-you|r)\//.test(path)) return null;

  // Only show if not installed OR if notifications are not enabled
  const showNotificationsPrompt = permissionStatus === "default" && !pushEnabled;
  const showInstallPrompt = !!installPrompt;

  if (!showInstallPrompt && !showNotificationsPrompt) return null;
 
   return (
     <div className="fixed bottom-20 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
       <div className="bg-card border border-border rounded-xl p-4 shadow-2xl flex flex-col gap-3">
         <div className="flex items-start justify-between">
           <div className="flex gap-3">
             <div className="bg-primary/10 p-2 rounded-lg">
               {showInstallPrompt ? (
                 <Download className="w-5 h-5 text-primary" />
               ) : (
                 <Bell className="w-5 h-5 text-primary" />
               )}
             </div>
             <div>
               <h3 className="font-semibold text-sm">
                 {showInstallPrompt ? "Instale o ZapLynx" : "Ative as Notificações"}
               </h3>
               <p className="text-xs text-muted-foreground">
                 {showInstallPrompt 
                   ? "Acesse o app mais rápido direto da sua tela inicial."
                   : "Receba alertas importantes e resumos de vendas em tempo real."}
               </p>
             </div>
           </div>
           <button 
             onClick={() => setIsVisible(false)}
             className="text-muted-foreground hover:text-foreground p-1"
           >
             <X className="w-4 h-4" />
           </button>
         </div>
         
         <div className="flex gap-2">
           {showInstallPrompt && (
             <Button 
               onClick={handleInstall}
               size="sm" 
               className="flex-1 gap-2 text-xs"
             >
               <Download className="w-3 h-3" />
               Instalar App
             </Button>
           )}
           {showNotificationsPrompt && (
             <Button 
               onClick={handleEnableNotifications}
               variant={showInstallPrompt ? "outline" : "default"}
               size="sm" 
               disabled={pushBusy}
               className="flex-1 gap-2 text-xs"
             >
               <Bell className="w-3 h-3" />
               {pushBusy ? "Ativando..." : "Ativar Alertas"}
             </Button>
           )}
         </div>
       </div>
     </div>
   );
 }