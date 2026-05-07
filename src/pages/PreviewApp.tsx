import { useEffect, useState } from "react";

/**
 * Preview do App Mobile ZapLynx — réplica fiel do HTML enviado pelo usuário.
 * Renderiza o arquivo estático em /preview-app/index.html via iframe para garantir
 * paridade visual 100% com o design original.
 * Adicionamos um parâmetro de cache-busting para garantir o carregamento do arquivo mais recente.
 */
export default function PreviewApp() {
  const [version] = useState(Date.now());

  useEffect(() => {
    console.log("PreviewApp Mounted - Loading HTML version:", version);
  }, [version]);

  return (
    <div style={{ 
      width: "100vw", 
      height: "100vh", 
      background: "#0f1117", 
      margin: 0, 
      padding: 0,
      overflow: "hidden",
      position: "fixed",
      inset: 0,
      zIndex: 9999
    }}>
      <iframe
        src={`/preview-app/index.html?v=${version}`}
        title="ZapLynx App Preview"
        style={{ 
          width: "100%", 
          height: "100%", 
          border: "none", 
          display: "block" 
        }}
      />
    </div>
  );
}
