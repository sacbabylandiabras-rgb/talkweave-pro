import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Zap, Shield, TrendingUp, Crown, Sparkles } from "lucide-react";
import zaplynxLogo from "@/assets/zaplynx-logo.png";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Envios em Massa",
      description: "Envie mensagens para milhares de contatos de forma rápida e eficiente"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Seguro e Confiável",
      description: "Integração direta com WhatsApp via Z-API com máxima segurança"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Relatórios Detalhados",
      description: "Acompanhe estatísticas e métricas de todas as suas campanhas"
    }
  ];

  const plans = [
    {
      name: "Plano Básico",
      price: "197",
      description: "Perfeito para começar",
      instances: 1,
      features: [
        "1 Instância WhatsApp",
        "Envios em massa ilimitados",
        "Automação de boas-vindas",
        "Respostas automáticas",
        "Gestão de campanhas",
        "Modelos de mensagens",
        "Filtros e segmentação",
        "Relatórios detalhados",
        "Suporte via chat"
      ],
      popular: false
    },
    {
      name: "Plano Profissional",
      price: "397",
      description: "Para crescer seu negócio",
      instances: 2,
      features: [
        "2 Instâncias WhatsApp",
        "Envios em massa ilimitados",
        "Automação de boas-vindas",
        "Respostas automáticas",
        "Gestão de campanhas",
        "Modelos de mensagens",
        "Filtros e segmentação",
        "Relatórios detalhados",
        "Suporte prioritário",
        "API de integração"
      ],
      popular: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={zaplynxLogo} alt="ZapLynx" className="h-16 w-auto" />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/auth?signup=true")}>
              Começar Grátis
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex justify-center mb-6">
            <img src={zaplynxLogo} alt="ZapLynx" className="h-32 md:h-40 w-auto" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Gerencie suas mensagens do{" "}
            <span className="text-primary">WhatsApp</span> em escala
          </h1>
          <p className="text-xl text-muted-foreground">
            Plataforma completa para automação, envio em massa e gestão profissional
            de mensagens via WhatsApp
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth?signup=true")} className="gap-2">
              Começar Agora <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Fazer Login
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Recursos Poderosos
          </h2>
          <p className="text-muted-foreground text-lg">
            Tudo que você precisa para gerenciar suas mensagens
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-muted-foreground text-lg">
            Preços transparentes, sem taxas ocultas
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Crown className="w-4 h-4" /> Mais Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-8 pt-8">
                <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-5xl font-bold">R$ {plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">
                    {plan.instances} {plan.instances === 1 ? 'Instância' : 'Instâncias'} WhatsApp
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  size="lg" 
                  className="w-full" 
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => navigate("/auth?signup=true")}
                >
                  Começar Agora
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Pronto para começar?
          </h2>
          <p className="text-xl text-muted-foreground">
            Crie sua conta gratuitamente e comece a gerenciar suas mensagens hoje mesmo
          </p>
          <Button size="lg" onClick={() => navigate("/auth?signup=true")} className="gap-2">
            Criar Conta Grátis <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 ZapLynx. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
