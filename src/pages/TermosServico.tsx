export default function TermosServico() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
        <h1 className="text-2xl font-bold text-foreground mb-2">Termos de Serviço</h1>
        <p className="text-xs text-muted-foreground mb-8">Última atualização: 23 de março de 2026</p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Estes Termos de Serviço regulam o uso da plataforma <strong className="text-foreground">ZapLynx</strong>, operada por meio do domínio zaplynx.com. Ao utilizar nossos serviços, você concorda com os termos descritos abaixo.
        </p>

        {[
          {
            title: "1. Descrição do Serviço",
            content: `A ZapLynx é uma plataforma SaaS de automação e envio de mensagens via WhatsApp, oferecendo:
• Envio de mensagens em massa e campanhas.
• Automação de respostas e fluxos visuais.
• Integração com APIs do WhatsApp.
• Gestão de contatos, grupos e templates.
• Agente de inteligência artificial para atendimento.`
          },
          {
            title: "2. Cadastro e Conta",
            content: `Para utilizar a plataforma, você deve:
• Criar uma conta com informações verdadeiras e atualizadas.
• Manter a confidencialidade das suas credenciais de acesso.
• Ser responsável por todas as atividades realizadas em sua conta.
• Ter pelo menos 18 anos de idade.

Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.`
          },
          {
            title: "3. Uso Aceitável",
            content: `Ao utilizar a ZapLynx, você concorda em NÃO:
• Enviar spam ou mensagens não solicitadas.
• Violar as políticas do WhatsApp Business ou da Meta.
• Utilizar a plataforma para atividades ilegais ou fraudulentas.
• Compartilhar conteúdo ofensivo, discriminatório ou ilegal.
• Tentar acessar contas de outros usuários.
• Realizar engenharia reversa ou explorar vulnerabilidades do sistema.

O descumprimento dessas regras pode resultar no cancelamento imediato da conta.`
          },
          {
            title: "4. Planos e Pagamentos",
            content: `• Os planos e preços estão disponíveis na plataforma.
• Pagamentos são processados por meio de provedores terceiros.
• Assinaturas são renovadas automaticamente, salvo cancelamento prévio.
• Não há reembolso para períodos parcialmente utilizados.
• Reservamo-nos o direito de alterar preços com aviso prévio de 30 dias.`
          },
          {
            title: "5. Limitações de Responsabilidade",
            content: `• A ZapLynx não se responsabiliza por bloqueios ou restrições impostos pelo WhatsApp ou Meta às suas contas.
• Não garantimos disponibilidade ininterrupta do serviço.
• Não nos responsabilizamos por perdas decorrentes do uso indevido da plataforma.
• O serviço é fornecido "como está", sem garantias implícitas de adequação a um propósito específico.`
          },
          {
            title: "6. Propriedade Intelectual",
            content: `• Todo o código, design e conteúdo da plataforma são propriedade da ZapLynx.
• Você mantém a propriedade do conteúdo que criar ou importar na plataforma.
• É proibida a reprodução, distribuição ou modificação não autorizada da plataforma.`
          },
          {
            title: "7. Privacidade e Dados",
            content: `O tratamento de dados pessoais é regido pela nossa Política de Privacidade, disponível em zaplynx.com/politica-privacidade. Ao utilizar o serviço, você concorda com a coleta e uso de dados conforme descrito nessa política.`
          },
          {
            title: "8. Rescisão",
            content: `• Você pode cancelar sua conta a qualquer momento.
• Podemos suspender ou encerrar sua conta por violação destes termos.
• Após o cancelamento, seus dados serão retidos por 30 dias e depois excluídos.`
          },
          {
            title: "9. Alterações nos Termos",
            content: `Podemos atualizar estes Termos de Serviço periodicamente. Alterações significativas serão comunicadas via e-mail ou notificação na plataforma. O uso continuado após alterações constitui aceitação dos novos termos.`
          },
          {
            title: "10. Legislação Aplicável",
            content: `Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca do domicílio do usuário para dirimir quaisquer controvérsias.`
          },
          {
            title: "11. Contato",
            content: `Para dúvidas sobre estes Termos de Serviço:
• E-mail: zaplynx2.0@gmail.com
• Plataforma: zaplynx.com`
          },
        ].map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="text-base font-semibold text-foreground mb-2">{section.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
