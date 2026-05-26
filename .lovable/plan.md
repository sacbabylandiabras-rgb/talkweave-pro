Para implementar o sistema de disparos de e-mail usando o domínio customizado do usuário, seguiremos estes passos técnicos:

1. **Infraestrutura de E-mail**: Utilizaremos a integração nativa do Lovable para configurar o domínio.
2. **Interface de Configuração**: Adicionaremos uma nova seção em `Configurações > Domínio` para gerenciar a verificação de e-mail do domínio customizado.
3. **Template de E-mail**: Criaremos templates profissionais para confirmação de compra e notificações transacionais.
4. **Disparo Automático**: Configuraremos uma Edge Function que será disparada após o sucesso de um pagamento, utilizando o domínio do vendedor como remetente.

### Detalhes Técnicos

- **Interface**: Adição de botões para iniciar a verificação de e-mail (DKIM/SPF) dentro do componente `CheckoutDomainSection`.
- **Edge Function**: Nova função `send-transactional-email` que identifica o domínio vinculado ao `user_id` do vendedor e realiza o envio via API do Lovable.
- **Banco de Dados**: Verificação e atualização da tabela `profiles` ou `custom_domains` para rastrear o status de verificação de e-mail de cada domínio.

Deseja que eu comece pela interface de configuração do DNS de e-mail ou pela lógica de disparo?