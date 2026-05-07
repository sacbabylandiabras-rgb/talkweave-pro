 import React from "react";
 import { createRoot } from "react-dom/client";
 import "./index.css";
 import { clearChunkRecoveryState, installChunkLoadRecovery } from "@/lib/chunk-load-recovery";
 
 installChunkLoadRecovery();
 
 const init = async () => {
   const path = window.location.pathname;
   
   // Fast path for realtime notifications to avoid loading the entire app
   if (path === '/notificacoes-realtime' || path === '/notificacoes-realtime/') {
     const root = createRoot(document.getElementById("root")!);
      // Register SW for notifications even in the standalone realtime view
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw-push.js').catch(err => console.error('SW registration failed:', err));
      }

      root.render(
        <div style={{ position: "fixed", inset: 0, background: "#0f1117", zIndex: 9999 }}>
          <iframe
            src="/notificacoes-realtime/index.html"
            title="ZapLynx Realtime"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        </div>
      );
     return;
   }
 
   // Normal app loading
   const { default: App } = await import("./App.tsx");
   createRoot(document.getElementById("root")!).render(<App />);
 };
 
 init().finally(() => {
   clearChunkRecoveryState();
 });
