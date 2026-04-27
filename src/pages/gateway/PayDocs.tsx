import { useState } from "react";
import { BookOpen, Key, CreditCard, Users, Repeat, Webhook, AlertTriangle, Code, TestTube, Zap, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock, HttpBadge } from "./docs/DocComponents";
import SectionIntegration from "./docs/SectionIntegration";

const sections = [
  { id: "intro", label: "Introdução", icon: BookOpen },
  { id: "integration", label: "Integração Checkout", icon: Link2 },
  { id: "auth", label: "Autenticação", icon: Key },
  { id: "transactions", label: "Transações", icon: CreditCard },
  { id: "customers", label: "Clientes & Tokenização", icon: Users },
  { id: "subscriptions", label: "Assinaturas", icon: Repeat },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "errors", label: "Status & Erros", icon: AlertTriangle },
  { id: "sdks", label: "SDKs", icon: Code },
  { id: "sandbox", label: "Sandbox & Testes", icon: TestTube },
];

export default function PayDocs() {
  const [activeSection, setActiveSection] = useState("intro");

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <nav className="w-56 shrink-0 border-r border-[#2A2A2A] pr-4 hidden lg:block">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-[#a78bfa]" />
          <span className="font-bold text-sm">ZapLynx<span className="text-[#a78bfa]">Pay</span> Docs</span>
        </div>
        <ul className="space-y-0.5">
          {sections.map(s => (
            <li key={s.id}>
              <button onClick={() => setActiveSection(s.id)} className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors", activeSection === s.id ? "bg-[#a78bfa]/10 text-[#a78bfa]" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="flex-1 max-w-3xl">
        {activeSection === "intro" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Documentação da API</h1>
            <p className="text-muted-foreground leading-relaxed">O ZapLynxPay é um gateway de pagamentos que abstrai as adquirentes (Cielo, Rede, Stone, GetNet), gerenciando roteamento inteligente, retentativas automáticas e reconciliação financeira.</p>
            
            <div className="rounded-lg border border-[#2A2A2A] p-4 bg-muted/20">
              <h3 className="font-semibold text-sm mb-2">Fluxo de uma transação</h3>
              <pre className="text-xs font-mono text-muted-foreground">
{`Loja/App → ZapLynxPay API → Adquirente → Bandeira → Banco Emissor
               ↑                  ↓
          Webhook           Resposta (aprovado/recusado)`}
              </pre>
            </div>

            <h3 className="font-semibold">🔗 Base URL da API</h3>
            <div className="rounded-lg border-2 border-[#a78bfa]/40 bg-[#a78bfa]/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold">PRODUÇÃO</span>
              </div>
              <code className="block text-sm font-mono text-foreground bg-muted/40 rounded-lg px-4 py-3 select-all break-all">
                https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1
              </code>
            </div>

            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">⚠️ Erro Comum: "Requested function was not found"</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A URL base <strong>sozinha não funciona</strong>. Você <strong>deve</strong> adicionar o nome da função no final.<br /><br />
                  <span className="text-red-400 font-mono">❌ https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1</span><br />
                  <span className="text-red-400 font-mono">❌ https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/</span><br />
                  <span className="text-emerald-400 font-mono">✅ https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/get-checkout?slug=meu-produto</span><br />
                  <span className="text-emerald-400 font-mono">✅ https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/create-pix-charge</span>
                </p>
              </div>
            </div>

            <h3 className="font-semibold mt-4">Headers Obrigatórios</h3>
            <CodeBlock language="http" code={`apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8
Content-Type: application/json`} />
            <p className="text-xs text-muted-foreground">
              O header <code className="font-mono">apikey</code> é obrigatório em todas as requisições. Para endpoints protegidos, adicione também <code className="font-mono">Authorization: Bearer TOKEN_JWT</code>.
            </p>

            <h3 className="font-semibold mt-4">Endpoints Disponíveis</h3>
            <div className="rounded-lg border border-[#2A2A2A] overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/30 border-b border-[#2A2A2A]"><th className="text-left p-3 font-medium">Método</th><th className="text-left p-3 font-medium">Endpoint</th><th className="text-left p-3 font-medium">Descrição</th></tr></thead>
                <tbody>
                  {[
                    ["GET", "get-checkout?slug=xxx", "Buscar dados do checkout público"],
                    ["POST", "create-pix-charge", "Criar cobrança PIX"],
                    ["GET", "check-payment-status?id=xxx", "Verificar status do pagamento"],
                    ["POST", "upload-receipt", "Enviar comprovante de pagamento"],
                    ["POST", "webhook-gateway", "Receber webhooks de pagamento"],
                  ].map(([m, e, d]) => (
                    <tr key={e} className="border-b border-[#2A2A2A]">
                      <td className="p-3"><span className={`font-mono font-bold ${m === 'GET' ? 'text-emerald-400' : 'text-amber-400'}`}>{m}</span></td>
                      <td className="p-3 font-mono text-[#a78bfa]">{e}</td>
                      <td className="p-3 text-muted-foreground">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSection === "integration" && <SectionIntegration />}
        {activeSection === "auth" && (
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Autenticação</h1>
            <p className="text-muted-foreground">Todas as requisições devem incluir o <code className="font-mono text-xs">apikey</code> header com a chave anon do Supabase e, para rotas protegidas, o token JWT do usuário.</p>
            <CodeBlock language="http" code={`apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\nAuthorization: Bearer TOKEN_JWT_DO_USUARIO\nContent-Type: application/json`} />
            <p className="text-muted-foreground text-sm mt-2">Para endpoints públicos (como <code className="font-mono text-xs">get-checkout</code>), apenas o header <code className="font-mono text-xs">apikey</code> é necessário.</p>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div><p className="text-sm font-medium text-amber-400">Atenção</p><p className="text-xs text-muted-foreground mt-1">Nunca exponha sua Service Role Key em código frontend. Use apenas a chave anon (pública) no cliente.</p></div>
            </div>
          </div>
        )}

        {activeSection === "transactions" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Transações</h1>
            
            <h2 className="text-xl font-semibold mt-6">Cartão de Crédito</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/transactions</code></div>
            <CodeBlock code={`{
  "amount": 29700,
  "currency": "BRL",
  "payment_method": "credit_card",
  "installments": 3,
  "capture": true,
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com",
    "document": "123.456.789-00"
  },
  "card": {
    "number": "4111111111111111",
    "holder_name": "JOAO SILVA",
    "expiration_date": "12/2026",
    "cvv": "123"
  }
}`} />

            <h2 className="text-xl font-semibold mt-6">PIX</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/transactions</code></div>
            <CodeBlock code={`{
  "amount": 29700,
  "currency": "BRL",
  "payment_method": "pix",
  "pix": { "expiration_seconds": 3600 },
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com"
  }
}`} />

            <h2 className="text-xl font-semibold mt-6">Consultar Transação</h2>
            <div className="flex items-center gap-2"><HttpBadge method="GET" /><code className="text-xs font-mono text-muted-foreground">/v1/transactions/:id</code></div>

            <h2 className="text-xl font-semibold mt-6">Estorno</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/transactions/:id/refund</code></div>
            <CodeBlock code={`{ "amount": 29700, "reason": "Solicitação do cliente" }`} />
          </div>
        )}

        {activeSection === "customers" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Clientes & Tokenização</h1>
            <h2 className="text-xl font-semibold">Criar Cliente</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/customers</code></div>
            <CodeBlock code={`{ "name": "João Silva", "email": "joao@email.com", "document": "123.456.789-00", "phone": "11999998888" }`} />
            
            <h2 className="text-xl font-semibold">Salvar Cartão (Tokenizar)</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/customers/:id/cards</code></div>
            <CodeBlock code={`{ "number": "4111111111111111", "holder_name": "JOAO SILVA", "expiration_date": "12/2026", "cvv": "123" }`} />
          </div>
        )}

        {activeSection === "subscriptions" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Assinaturas Recorrentes</h1>
            <h2 className="text-xl font-semibold">Criar Plano</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/plans</code></div>
            <CodeBlock code={`{ "name": "Mentoria Mensal", "amount": 19700, "interval": "monthly", "trial_period_days": 7 }`} />
            
            <h2 className="text-xl font-semibold">Criar Assinatura</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/subscriptions</code></div>
            <CodeBlock code={`{ "plan_id": "plan_xxx", "customer_id": "cus_xxx", "card_token": "card_xxx" }`} />
            
            <h2 className="text-xl font-semibold">Cancelar</h2>
            <div className="flex items-center gap-2"><HttpBadge method="DELETE" /><code className="text-xs font-mono text-muted-foreground">/v1/subscriptions/:id</code></div>
          </div>
        )}

        {activeSection === "webhooks" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Webhooks</h1>
            <h2 className="text-xl font-semibold">Cadastrar Webhook</h2>
            <div className="flex items-center gap-2"><HttpBadge method="POST" /><code className="text-xs font-mono text-muted-foreground">/v1/webhooks</code></div>
            <CodeBlock code={`{ "url": "https://minha-loja.com/webhooks/zaplynxpay", "events": ["transaction.approved", "transaction.declined", "transaction.refunded"] }`} />
            
            <h2 className="text-xl font-semibold">Payload de Exemplo</h2>
            <CodeBlock code={`{
  "event": "transaction.approved",
  "data": {
    "id": "txn_3k8mN2pQrXvY",
    "status": "approved",
    "amount": 29700,
    "customer": { "name": "João Silva" }
  }
}`} />

            <h2 className="text-xl font-semibold">Validar Assinatura HMAC</h2>
            <CodeBlock language="javascript" code={`const crypto = require('crypto');
const secret = 'seu_webhook_secret';
const sig = 'sha256=' + crypto.createHmac('sha256', secret)
  .update(JSON.stringify(req.body)).digest('hex');
if (req.headers['x-zaplynxpay-signature'] !== sig) {
  return res.status(401).json({ error: 'Assinatura inválida' });
}`} />
          </div>
        )}

        {activeSection === "errors" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Status & Códigos de Erro</h1>
            <h2 className="text-xl font-semibold">Status de Transação</h2>
            <div className="rounded-lg border border-[#2A2A2A] overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/30 border-b border-[#2A2A2A]"><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Descrição</th></tr></thead>
                <tbody>
                  {[
                    ["approved", "Aprovada"], ["declined", "Recusada"], ["pending", "Aguardando (PIX/Boleto)"],
                    ["captured", "Pré-auth capturada"], ["refunded", "Estornada"], ["chargeback", "Contestação aberta"], ["failed", "Erro técnico"],
                  ].map(([s, d]) => <tr key={s} className="border-b border-[#2A2A2A]"><td className="p-3 font-mono text-[#a78bfa]">{s}</td><td className="p-3 text-muted-foreground">{d}</td></tr>)}
                </tbody>
              </table>
            </div>
            
            <h2 className="text-xl font-semibold">Códigos de Erro</h2>
            <div className="rounded-lg border border-[#2A2A2A] overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/30 border-b border-[#2A2A2A]"><th className="text-left p-3 font-medium">HTTP</th><th className="text-left p-3 font-medium">Código</th><th className="text-left p-3 font-medium">Mensagem</th></tr></thead>
                <tbody>
                  {[
                    ["400", "invalid_card_number", "Número inválido"],
                    ["401", "invalid_api_key", "Chave inválida"],
                    ["402", "insufficient_funds", "Saldo insuficiente"],
                    ["429", "rate_limit_exceeded", "Limite excedido"],
                    ["500", "acquirer_unavailable", "Adquirente indisponível"],
                  ].map(([h, c, m]) => <tr key={c} className="border-b border-[#2A2A2A]"><td className="p-3 text-amber-400">{h}</td><td className="p-3 font-mono text-red-400">{c}</td><td className="p-3 text-muted-foreground">{m}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSection === "sdks" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">SDKs & Bibliotecas</h1>
            {[
              { name: "Node.js", install: "npm install @zaplynxpay/node", code: `const ZapLynxPay = require('@zaplynxpay/node');\nconst client = new ZapLynxPay('sk_live_xxxxx');\nconst txn = await client.transactions.create({ amount: 29700 });` },
              { name: "PHP", install: "composer require zaplynxpay/zaplynxpay-php", code: `$client = new \\ZapLynxPay\\Client('sk_live_xxxxx');\n$txn = $client->transactions->create(['amount' => 29700]);` },
              { name: "Python", install: "pip install zaplynxpay", code: `import zaplynxpay\nclient = zaplynxpay.Client('sk_live_xxxxx')\ntxn = client.transactions.create(amount=29700)` },
            ].map(sdk => (
              <div key={sdk.name} className="space-y-2">
                <h2 className="text-xl font-semibold">{sdk.name}</h2>
                <CodeBlock language="bash" code={sdk.install} />
                <CodeBlock language={sdk.name.toLowerCase()} code={sdk.code} />
              </div>
            ))}
          </div>
        )}

        {activeSection === "sandbox" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Sandbox & Testes</h1>
            <p className="text-muted-foreground">Base URL: <code className="font-mono text-xs text-[#a78bfa]">https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1</code></p>
            
            <h2 className="text-xl font-semibold">Cartões de Teste</h2>
            <div className="rounded-lg border border-[#2A2A2A] overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/30 border-b border-[#2A2A2A]"><th className="text-left p-3 font-medium">Número</th><th className="text-left p-3 font-medium">Bandeira</th><th className="text-left p-3 font-medium">Resultado</th></tr></thead>
                <tbody>
                  {[
                    ["4111 1111 1111 1111", "Visa", "Aprovado"],
                    ["5500 0000 0000 0004", "Mastercard", "Aprovado"],
                    ["4000 0000 0000 0002", "Visa", "Recusado — saldo"],
                    ["4000 0000 0000 0069", "Visa", "Recusado — vencido"],
                    ["6011 1111 1111 1117", "Elo", "Aprovado"],
                  ].map(([n, b, r]) => <tr key={n} className="border-b border-[#2A2A2A]"><td className="p-3 font-mono">{n}</td><td className="p-3">{b}</td><td className={`p-3 ${r.startsWith('Aprovado') ? 'text-emerald-400' : 'text-red-400'}`}>{r}</td></tr>)}
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold">Chaves de Teste</h2>
            <CodeBlock language="text" code={`pk_test_zaplynxpay_sandbox_12345\nsk_test_zaplynxpay_sandbox_67890`} />
          </div>
        )}
      </div>
    </div>
  );
}
