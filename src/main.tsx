 import React from "react";
 import { createRoot } from "react-dom/client";
 import "./index.css";
 import { clearChunkRecoveryState, installChunkLoadRecovery } from "@/lib/chunk-load-recovery";
 
 installChunkLoadRecovery();
 
 const init = async () => {
   const path = window.location.pathname;
   
   // Fast path for realtime notifications to avoid loading the entire app
    if (path === '/notificacoes-realtime' || path === '/notificacoes-realtime/') {
      // Register SW at root scope to ensure it can be used by the iframe
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
          .then(reg => {
            console.log('SW registered at root:', reg.scope);
            // Auto-request permission on first load if not granted
            if (Notification.permission === 'default') {
              Notification.requestPermission();
            }
          })
          .catch(err => console.error('SW registration failed:', err));
      }

      const root = createRoot(document.getElementById("root")!);
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
