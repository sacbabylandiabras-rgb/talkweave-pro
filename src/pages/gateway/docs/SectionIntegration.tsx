import { CodeBlock, HttpBadge } from "./DocComponents";
import { AlertTriangle } from "lucide-react";

export default function SectionIntegration() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Integração com Checkout</h1>
      <p className="text-muted-foreground leading-relaxed">
        Existem 3 formas de integrar o checkout do ZapLynxPay na sua aplicação: <strong>Link Direto</strong>, <strong>Iframe (Embed)</strong> ou <strong>API de Criação de Checkout</strong>.
      </p>

      {/* 1 — Link Direto */}
      <h2 className="text-xl font-semibold mt-8">1. Link Direto</h2>
      <p className="text-muted-foreground text-sm">
        A forma mais simples: redirecione o cliente para a URL do checkout hospedado.
      </p>
      <CodeBlock language="text" code={`https://pay.zaplynxpro.online/pay/SEU_SLUG`} />
      <p className="text-muted-foreground text-sm">
        O <code className="font-mono text-[#a78bfa]">slug</code> é o identificador único do seu checkout, definido no builder.
      </p>
      <CodeBlock language="html" code={`<!-- Exemplo: botão de compra -->
<a href="https://pay.zaplynxpro.online/pay/meu-produto"
   target="_blank"
   rel="noopener noreferrer"
   style="background:#a78bfa;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
  Comprar Agora
</a>`} />

      {/* 2 — Iframe / Embed */}
      <h2 className="text-xl font-semibold mt-8">2. Iframe (Embed)</h2>
      <p className="text-muted-foreground text-sm">
        Incorpore o checkout diretamente na sua página sem redirecionar o usuário.
      </p>
      <CodeBlock language="html" code={`<iframe
  src="https://pay.zaplynxpro.online/pay/SEU_SLUG"
  width="100%"
  height="800"
  frameborder="0"
  allow="clipboard-write"
  style="border:none; border-radius:12px; max-width:480px; margin:0 auto; display:block;">
</iframe>`} />

      <h3 className="text-sm font-semibold mt-4">Modal Pop-up com JavaScript</h3>
      <CodeBlock language="html" code={`<script>
function abrirCheckout() {
  const overlay = document.createElement('div');
  overlay.id = 'zlp-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };

  const iframe = document.createElement('iframe');
  iframe.src = 'https://pay.zaplynxpro.online/pay/SEU_SLUG';
  iframe.style.cssText = 'width:480px;height:90vh;max-height:800px;border:none;border-radius:12px;';

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}
</script>

<button onclick="abrirCheckout()"
  style="background:#a78bfa;color:#fff;padding:12px 24px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;">
  Comprar Agora
</button>`} />

      {/* 3 — API de Checkout */}
      <h2 className="text-xl font-semibold mt-8">3. API de Criação de Checkout</h2>
      <p className="text-muted-foreground text-sm">
        Crie checkouts programaticamente via API e receba o link de pagamento.
      </p>
      <div className="flex items-center gap-2">
        <HttpBadge method="POST" />
        <code className="text-xs font-mono text-muted-foreground">/v1/checkouts</code>
      </div>
      <CodeBlock code={`{
  "product_id": "prod_xxxxx",
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "5511999998888",
    "document": "123.456.789-00"
  },
  "metadata": {
    "order_id": "pedido_123",
    "utm_source": "instagram"
  }
}`} />
      <p className="text-muted-foreground text-sm">
        O campo <code className="font-mono text-[#a78bfa]">document</code> aceita CPF (xxx.xxx.xxx-xx) ou CNPJ (xx.xxx.xxx/xxxx-xx) e é <strong>obrigatório</strong> para geração do PIX.
      </p>

      <h3 className="text-sm font-semibold mt-4">Resposta</h3>
      <CodeBlock code={`{
  "id": "chk_abc123",
  "url": "https://pay.zaplynxpro.online/pay/chk_abc123",
  "status": "active",
  "expires_at": "2026-04-03T12:00:00Z"
}`} />

      {/* 4 — Parâmetros UTM */}
      <h2 className="text-xl font-semibold mt-8">4. Rastreamento com UTM</h2>
      <p className="text-muted-foreground text-sm">
        Passe parâmetros UTM na URL para rastrear a origem das conversões.
      </p>
      <CodeBlock language="text" code={`https://pay.zaplynxpro.online/pay/SEU_SLUG?utm_source=facebook&utm_medium=cpc&utm_campaign=lancamento`} />
      <p className="text-muted-foreground text-sm">
        Os parâmetros são automaticamente capturados e disponibilizados nos relatórios e nos payloads de webhook.
      </p>

      {/* 5 — Webhook de Pagamento */}
      <h2 className="text-xl font-semibold mt-8">5. Recebendo Notificações (Webhooks)</h2>
      <p className="text-muted-foreground text-sm">
        Configure webhooks em <strong>Configurações → Integrações</strong> para receber notificações de eventos de pagamento em tempo real.
      </p>

      <h3 className="text-sm font-semibold mt-4">Eventos Disponíveis</h3>
      <div className="rounded-lg border border-[#2A2A2A] overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-muted/30 border-b border-[#2A2A2A]"><th className="text-left p-3 font-medium">Evento</th><th className="text-left p-3 font-medium">Descrição</th></tr></thead>
          <tbody>
            {[
              ["checkout.completed", "Pagamento aprovado com sucesso"],
              ["checkout.abandoned", "Checkout abandonado após timeout"],
              ["checkout.refunded", "Pagamento estornado"],
              ["receipt.uploaded", "Comprovante enviado (aguardando análise)"],
            ].map(([e, d]) => (
              <tr key={e} className="border-b border-[#2A2A2A]">
                <td className="p-3 font-mono text-[#a78bfa]">{e}</td>
                <td className="p-3 text-muted-foreground">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-semibold mt-4">Payload de Exemplo</h3>
      <CodeBlock code={`{
  "event": "checkout.completed",
  "data": {
    "transaction_id": "txn_3k8mN2pQrXvY",
    "checkout_id": "chk_abc123",
    "amount": 29700,
    "payment_method": "pix",
    "status": "approved",
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "phone": "5511999998888",
      "document": "123.456.789-00"
    },
    "metadata": {
      "order_id": "pedido_123",
      "utm_source": "facebook"
    },
    "paid_at": "2026-04-02T15:30:00Z"
  }
}`} />

      <h3 className="text-sm font-semibold mt-4">Exemplo de Recebimento (Node.js)</h3>
      <CodeBlock language="javascript" code={`const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook/zaplynxpay', (req, res) => {
  const { event, data } = req.body;

  switch (event) {
    case 'checkout.completed':
      console.log('Pagamento aprovado:', data.transaction_id);
      // Liberar acesso, enviar e-mail, etc.
      break;
    case 'checkout.refunded':
      console.log('Estorno:', data.transaction_id);
      // Revogar acesso
      break;
  }

  res.status(200).json({ received: true });
});

app.listen(3000);`} />

      <h3 className="text-sm font-semibold mt-4">Exemplo de Recebimento (PHP)</h3>
      <CodeBlock language="php" code={`<?php
$payload = json_decode(file_get_contents('php://input'), true);

$event = $payload['event'] ?? '';
$data  = $payload['data'] ?? [];

switch ($event) {
    case 'checkout.completed':
        // Pagamento aprovado — liberar acesso
        error_log("Aprovado: " . $data['transaction_id']);
        break;
    case 'checkout.refunded':
        // Estorno — revogar acesso
        error_log("Estornado: " . $data['transaction_id']);
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);`} />

      {/* 6 — Fluxo Completo */}
      <h2 className="text-xl font-semibold mt-8">6. Fluxo Completo de Integração</h2>
      <div className="rounded-lg border border-[#2A2A2A] p-4 bg-muted/20">
        <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
{`1. Crie seu produto em Produtos → Novo Produto
2. Configure o checkout no Builder (template, cores, campos)
3. Copie o slug do checkout
4. Integre na sua página (link, iframe ou API)
5. Configure o webhook em Configurações → Integrações
6. Teste com o ambiente sandbox
7. Publique e monitore em Dashboard → Transações`}
        </pre>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 mt-4">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-400">Dica</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sempre teste o fluxo completo no ambiente sandbox antes de ir para produção. Use os cartões de teste listados na seção "Sandbox & Testes".
          </p>
        </div>
      </div>
    </div>
  );
}
