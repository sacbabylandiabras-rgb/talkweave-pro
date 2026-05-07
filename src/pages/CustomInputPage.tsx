/**
 * CustomInputPage — renderiza o HTML enviado pelo usuário em iframe full-screen
 * para garantir paridade visual 100% com o design original.
 */
import { useState } from "react";

export default function CustomInputPage() {
  const [v] = useState(Date.now());
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f1117", zIndex: 9999 }}>
      <iframe
        src={`/notificacoes-realtime/index.html?v=${v}`}
        title="ZapLynx Realtime"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
}
