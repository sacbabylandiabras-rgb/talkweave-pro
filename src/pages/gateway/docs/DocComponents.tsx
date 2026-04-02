import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] overflow-hidden my-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111] border-b border-[#2A2A2A]">
        <span className="text-[10px] text-muted-foreground font-mono">{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          {copied ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copiado!</span></> : <><Copy className="w-3 h-3" /><span>Copiar</span></>}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono overflow-x-auto text-muted-foreground leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

export function HttpBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    POST: "bg-emerald-500/10 text-emerald-400",
    GET: "bg-blue-500/10 text-blue-400",
    DELETE: "bg-red-500/10 text-red-400",
    PUT: "bg-amber-500/10 text-amber-400",
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${colors[method] || ''}`}>{method}</span>;
}
