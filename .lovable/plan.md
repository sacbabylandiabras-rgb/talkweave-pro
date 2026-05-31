## Fluxo Visual do Telegram — Plano de Implementação

Objetivo: espelhar o `FluxoVisual` (WhatsApp) para o Telegram, com todos os blocos do editor visual + motor de execução próprio.

### 1. Banco de Dados (migration)

Tabela `flow_automations` ganha colunas para suportar múltiplos provedores:

```sql
ALTER TABLE public.flow_automations
  ADD COLUMN provider text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN bot_id uuid REFERENCES public.telegram_bots(id) ON DELETE SET NULL;
CREATE INDEX idx_flow_automations_provider ON public.flow_automations(user_id, provider);
```

Nova tabela `telegram_flow_sessions` (estado por chat, idempotência e variáveis):

```sql
CREATE TABLE public.telegram_flow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  flow_id uuid REFERENCES public.flow_automations(id) ON DELETE SET NULL,
  current_node_id text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  waiting_for text, -- 'message' | 'callback' | null
  last_update_id bigint,
  status text NOT NULL DEFAULT 'active', -- active | finished | paused
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(bot_id, chat_id)
);
-- GRANT + RLS por bot.user_id
```

### 2. Editor Visual (Frontend)

Reaproveitar `src/pages/FluxoVisual.tsx`:
- Adicionar `"telegram"` ao tipo do prop `mode`.
- Criar `isTelegramMode = mode === "telegram"`.
- Quando telegram:
  - Selector de **Bot do Telegram** (do `telegram_bots`) substitui o selector de instâncias.
  - Esconder blocos exclusivos do WhatsApp Cloud API (templates oficiais, áudio ElevenLabs PTT, carrossel) e exibir variantes do Telegram (texto, foto, vídeo, documento, áudio, botões inline com `callback_data` ou URL, botões de teclado).
  - Salvar com `provider='telegram'` e `bot_id` selecionado.

Criar wrapper:

```ts
// src/pages/FluxoTelegram.tsx
import FluxoVisual from "./FluxoVisual";
export default function FluxoTelegram() {
  return <FluxoVisual mode="telegram" />;
}
```

Registrar rota em `src/App.tsx`: `/telegram/fluxo` → `FluxoTelegram`.

Adicionar item "Fluxo Visual" na seção Telegram do `src/components/layout/Sidebar.tsx`.

### 3. Gatilhos Suportados

Os 4 escolhidos pelo usuário, mapeados no bloco gatilho:
- `command` — `/start`, `/menu`, etc.
- `keyword` — texto contém ou igual.
- `callback` — clique em botão inline (compara `callback_data`).
- `new_member` — primeira mensagem do contato com o bot.

### 4. Motor de Execução (Edge Function)

Nova `supabase/functions/telegram-flow-engine/index.ts`:
- Recebe `{ bot_id, update }` do `telegram-poll-bots`.
- Resolve sessão por `(bot_id, chat_id)`.
- Se `waiting_for === 'callback'` e veio `callback_query` → consome botão.
- Se `waiting_for === 'message'` → salva resposta em `variables[currentNodeVar]` e segue.
- Caso contrário, procura fluxo ativo cujo gatilho case com o update.
- Executa nós em sequência:
  - `blocoConteudo` (text/photo/video/document/audio) → `sendMessage`/`sendPhoto`/etc via gateway.
  - `blocoAcao` com `actionType:'typing'` → `sendChatAction`.
  - `blocoAcao` com `actionType:'delay'` → grava `resume_at` e sai (cron retoma).
  - `blocoCondicao` → avalia `variables` e segue handle correto.
  - Botões inline → envia `reply_markup` com `inline_keyboard` e marca `waiting_for='callback'`.
  - `fimFluxo` → marca `status='finished'`.

Integração em `telegram-poll-bots`: para cada update, fazer `fetch` interno para `telegram-flow-engine` (fire-and-forget) após salvar em `telegram_messages`.

`supabase/config.toml`: `[functions.telegram-flow-engine] verify_jwt = false`.

### 5. Itens fora de escopo (não nesta entrega)

- Agente IA / ferramentas custom dentro do fluxo Telegram (bloco aparece mas em "soon").
- CRM (atualizar lead / criar registro) — só funciona se já houver mapeamento de contato Telegram → lead.
- ElevenLabs e templates WhatsApp oficiais (não se aplicam ao Telegram).

### Arquivos afetados

- `supabase/migrations/<timestamp>_telegram_flow.sql` (novo)
- `supabase/functions/telegram-flow-engine/index.ts` (novo)
- `supabase/functions/telegram-poll-bots/index.ts` (editar — dispara engine)
- `supabase/config.toml` (registrar `telegram-flow-engine`)
- `src/pages/FluxoVisual.tsx` (suporte a `mode="telegram"`, bot selector, render condicional)
- `src/pages/FluxoTelegram.tsx` (novo wrapper)
- `src/App.tsx` (rota `/telegram/fluxo`)
- `src/components/layout/Sidebar.tsx` (item de menu)
