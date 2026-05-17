 import React from "react";
 import { createRoot } from "react-dom/client";
 import "./index.css";
 import { clearChunkRecoveryState, installChunkLoadRecovery } from "@/lib/chunk-load-recovery";
 
 installChunkLoadRecovery();
 
 const init = async () => {
   const path = window.location.pathname;
   
    // Fast path for app to avoid loading the entire app
     if (path === '/aplicativo' || path === '/aplicativo/') {
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

    }
 
   // Normal app loading
   const { default: App } = await import("./App.tsx");
   createRoot(document.getElementById("root")!).render(<App />);
 };
 
  init().then(() => {
    clearChunkRecoveryState();
  });
