import { Check, ShoppingBag, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function ShopifyPricing() {
  const features = [
    "Instalação e conexão da loja em 1 clique via OAuth",
    "Sincronização ilimitada de produtos da Shopify",
    "Criação automática de pedidos a partir de pagamentos aprovados",
    "Suporte a múltiplas lojas por conta",
    "Sem taxas de instalação, sem mensalidade da integração",
    "Atualizações e melhorias incluídas",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Integração com Shopify
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            100% gratuito para integrar com a Shopify
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            A integração da ZapLynx com a Shopify não tem custo algum. Você conecta sua loja, sincroniza
            produtos e processa pedidos sem pagar nada à ZapLynx por essa funcionalidade.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Plano Grátis</h2>
                <p className="text-sm text-muted-foreground">Tudo o que você precisa para vender</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-foreground">R$ 0</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
              <p className="text-xs text-muted-foreground">Sem cobrança via Shopify Billing API</p>
            </div>
          </div>

          <div className="my-8 h-px bg-border" />

          <ul className="grid gap-3 md:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Zap className="h-4 w-4" />
              Começar agora gratuitamente
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Voltar para a página inicial
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-muted/30 p-5 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Observação:</span> a ZapLynx não cobra pela
            integração com a Shopify. Custos cobrados diretamente pela Shopify (assinatura da loja,
            taxas de transação do checkout, apps de terceiros) seguem a política da própria Shopify e
            não fazem parte desta integração.
          </p>
        </div>
      </div>
    </div>
  );
}