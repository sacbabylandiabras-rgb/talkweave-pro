export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
        <h1 className="text-2xl font-bold text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-xs text-muted-foreground mb-8">Última atualização: 23 de março de 2026</p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          A <strong className="text-foreground">ZapLynx</strong> ("nós", "nosso") opera a plataforma de automação e envio de mensagens via WhatsApp. Esta Política de Privacidade descreve como coletamos, usamos e protegemos suas informações pessoais.
        </p>

        {[
          {
            title: "1. Informações que Coletamos",
            content: `Coletamos as seguintes informações quando você utiliza nossa plataforma:
• Dados de cadastro: nome, e-mail, número de WhatsApp.
• Dados de autenticação: informações fornecidas via login com Facebook/Google.
• Dados de uso: logs de mensagens enviadas, contatos importados, configurações de campanhas.
• Dados técnicos: endereço IP, tipo de navegador, dispositivo utilizado.
• Dados da API Meta: tokens de acesso, IDs de conta comercial e números de telefone vinculados.`
          },
          {
            title: "2. Como Usamos suas Informações",
            content: `Utilizamos seus dados para:
• Fornecer e manter os serviços da plataforma.
• Processar envios de mensagens via APIs de integração.
• Gerenciar sua conta e assinatura.
• Enviar notificações sobre o serviço.
• Melhorar e personalizar a experiência do usuário.
• Cumprir obrigações legais e regulatórias.`
          },
          {
            title: "3. Compartilhamento de Dados",
            content: `Não vendemos seus dados pessoais. Podemos compartilhar informações com:
• Meta Platforms, Inc.: para operação da API oficial do WhatsApp Business.
• Provedores de API: para operação de envios de mensagens.
• Supabase: nosso provedor de infraestrutura e banco de dados.
• Autoridades legais: quando exigido por lei ou ordem judicial.`
          },
          {
            title: "4. Armazenamento e Segurança",
            content: `Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. Tokens de acesso da Meta API são armazenados de forma criptografada. Implementamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração ou destruição.`
          },
          {
            title: "5. Seus Direitos (LGPD)",
            content: `De acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:
• Acessar seus dados pessoais.
• Corrigir dados incompletos ou desatualizados.
• Solicitar a exclusão dos seus dados.
• Revogar o consentimento a qualquer momento.
• Solicitar a portabilidade dos dados.
• Obter informações sobre o compartilhamento de dados.

Para exercer seus direitos, entre em contato: zaplynx2.0@gmail.com`
          },
          {
            title: "6. Cookies e Tecnologias de Rastreamento",
            content: `Utilizamos cookies e armazenamento local (localStorage) para manter sua sessão autenticada e preferências de interface. Não utilizamos cookies de terceiros para fins publicitários.`
          },
          {
            title: "7. Integração com Facebook/Meta",
            content: `Ao conectar sua conta via Facebook Login, solicitamos acesso às seguintes permissões:
• whatsapp_business_management: gerenciar configurações do WhatsApp Business.
• whatsapp_business_messaging: enviar e receber mensagens.
• business_management: gerenciar sua conta comercial.

Você pode revogar essas permissões a qualquer momento nas configurações do Facebook.`
          },
          {
            title: "8. Retenção de Dados",
            content: `Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento, os dados serão retidos por até 30 dias para fins de backup e, em seguida, excluídos permanentemente. Logs de mensagens podem ser retidos por até 90 dias para fins de auditoria.`
          },
          {
            title: "9. Alterações nesta Política",
            content: `Podemos atualizar esta Política periodicamente. Notificaremos sobre alterações significativas via e-mail ou aviso na plataforma. O uso continuado dos serviços após alterações constitui aceitação da política atualizada.`
          },
          {
            title: "10. Contato",
            content: `Para dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados:
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
