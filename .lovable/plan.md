## Objetivo

Adicionar fluxos automatizados para enviar conteúdo **dentro** do grupo de prévia do Telegram (Canal Free), em três modalidades complementares.

## Escopo

1. **Sequência automática de mensagens** — usuário monta lista ordenada (msg 1, msg 2, ...) com intervalo entre elas. Pode iniciar manualmente ou repetir em loop.
2. **Fluxo visual (drag-and-drop)** — editor com nós: Mensagem, Delay, Condição (ex: dia da semana, horário), Aleatório (escolhe 1 de N), Fim. Gatilhos disponíveis: manual, agendado, recorrente, palavra-chave no grupo.
3. **Gatilho por palavra-chave no grupo** — quando membro envia um termo/comando no grupo, dispara uma sequência de respostas postadas no próprio grupo.

Tipos de conteúdo (já suportados pelo módulo de envio): texto HTML, foto/vídeo/documento, botões inline URL, modelos salvos.

## Plano técnico

### Banco de dados (nova migration)
- `telegram_group_flows` — id, user_id, bot_id, name, trigger_type (manual|scheduled|recurring|keyword), trigger_config jsonb (keywords[], cron, etc.), nodes jsonb (grafo do fluxo visual), is_active, created_at.
- `telegram_group_flow_runs` — id, flow_id, chat_id, triggered_by_user_id, current_node_id, status (running|completed|failed|paused), next_run_at, context jsonb, created_at, updated_at.
- RLS + GRANTs padrão (user_id = auth.uid()).

### Edge Functions
- `telegram-group-flow-trigger` — inicia uma execução (manual/keyword/scheduled). Cria `flow_run` e enfileira primeiro nó.
- `telegram-group-flow-tick` — worker rodando a cada minuto via `pg_cron` (reaproveita `telegram-poll-bots`). Avança nós pendentes: processa Mensagem (reusa lógica de `telegram-channel-post-send`), Delay (agenda next_run_at), Condição (avalia), Aleatório, Fim.
- `telegram-webhook` — adicionar matcher de palavra-chave: ao receber mensagem em grupo, buscar flows ativos com `trigger_type=keyword` cujo bot/grupo bate e disparar.

### Frontend
Nova aba **"Fluxos"** dentro de `TelegramCanalFree` (ao lado de Configuração / Enviar conteúdo).
- Lista de fluxos com status (ativo/inativo, gatilho, último disparo).
- Botão "Novo fluxo" → editor:
  - Painel de configuração do gatilho (radio: manual/agendado/recorrente/palavra-chave; campos contextuais).
  - Canvas visual baseado em `@xyflow/react` (já usado no projeto) com nós: Mensagem (compositor reutilizando o componente de envio), Delay, Condição (horário/dia), Aleatório, Fim.
  - Botão "Salvar" / "Ativar".
- Aba histórico mostrando `flow_runs` recentes.

### Reaproveitamento
- Compositor de mensagem do nó "Mensagem" reusa `TelegramCanalFreeEnvio` (extraído como subcomponente `<TelegramMessageComposer />`).
- Envio efetivo via helper compartilhado já presente em `telegram-channel-post-send` (inline copy — sem cross-function imports).

## Entregáveis

- 1 migration SQL nova com 2 tabelas + RLS/GRANTs.
- 2 edge functions novas + edição de `telegram-webhook` e `telegram-poll-bots`.
- Editor visual de fluxos em React (página + componentes).
- Aba "Fluxos" integrada à página Canal Free.

## Fora de escopo (próxima iteração se quiser)
- Variáveis dinâmicas (`{{nome}}`, `{{username}}`).
- Condições por tag/segmento do membro.
- A/B testing entre ramos.

Aprovar para eu começar a implementação? Se quiser cortar algo (ex: deixar visual editor para depois e entregar só sequência+palavra-chave primeiro), me diz.