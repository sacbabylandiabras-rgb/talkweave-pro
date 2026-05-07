/**
 * Preview do App Mobile ZapLynx — réplica fiel do HTML enviado pelo usuário.
 * Renderiza o arquivo estático em /preview-app/index.html via iframe para garantir
 * paridade visual 100% com o design original.
 */
export default function PreviewApp() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0f1117", margin: 0, padding: 0 }}>
      <iframe
        src="/preview-app/index.html"
        title="ZapLynx App Preview"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
}
