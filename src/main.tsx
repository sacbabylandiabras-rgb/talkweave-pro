import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { clearChunkRecoveryState, installChunkLoadRecovery } from "@/lib/chunk-load-recovery";

installChunkLoadRecovery();

createRoot(document.getElementById("root")!).render(<App />);

clearChunkRecoveryState();
