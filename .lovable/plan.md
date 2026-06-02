
# Equipes ZapLynx — Funcionários gerenciados pelo dono

Permitir que o dono de uma conta ZapLynx convide funcionários por email. Funcionários entram na plataforma e operam **dentro da conta do dono**, com permissões granulares por módulo e por conexão WhatsApp. Plano do dono cobre todos.

## 1. Modelo de dados (migration)

Novas tabelas em `public`:

- **`teams`** — uma por dono.
  - `id uuid pk`, `owner_id uuid` (referência ao dono), `name text`, `created_at`.
- **`team_roles`** — cargos customizáveis criados pelo dono.
  - `id`, `team_id`, `name`, `permissions jsonb` (ex.: `{ "campanhas": true, "contatos": true, "admin": false, ... }`), `created_at`.
- **`team_members`** — vínculo funcionário ↔ time.
  - `id`, `team_id`, `user_id uuid` (do funcionário, único globalmente — um funcionário pertence a um único time), `role_id` (FK opcional para `team_roles`), `allowed_instance_ids uuid[]` (lista de `zapi_instances.id` permitidas; vazio = todas), `status` (`active`/`suspended`), `invited_email text`, `created_at`.
- **`team_invites`** — convites pendentes.
  - `id`, `team_id`, `email`, `role_id`, `allowed_instance_ids uuid[]`, `token text unique`, `expires_at`, `accepted_at`, `created_at`.

GRANTs padrão (`authenticated` + `service_role`) e RLS em todas. Helpers SECURITY DEFINER:

- `get_effective_user_id(_user_id uuid) returns uuid` — se o usuário é funcionário, devolve `team.owner_id`; senão devolve o próprio id.
- `is_team_member_of(_owner_id uuid, _user_id uuid) returns boolean`.
- `team_member_has_permission(_user_id uuid, _key text) returns boolean`.
- `team_member_can_use_instance(_user_id uuid, _instance_id uuid) returns boolean`.

## 2. Identidade efetiva no frontend

Hoje quase todo hook usa `auth.getUser().id` direto. Criar:

- `src/hooks/useEffectiveUser.ts` — devolve `{ effectiveUserId, isEmployee, ownerId, permissions, allowedInstanceIds }` consultando `team_members` + `team_roles`. Cacheado em `sessionStorage`.
- `src/contexts/TeamContext.tsx` — provider em `App.tsx` que carrega o effective user uma vez e expõe via `useTeam()`.

Refatorar pontos críticos para usar `effectiveUserId` no lugar de `user.id` nas queries de dados (campanhas, contatos, instâncias, fluxos, mensagens, etc.). RLS no banco passa a aceitar tanto dono quanto funcionário via `get_effective_user_id`.

`useZapiInstances` passa a filtrar pelas `allowedInstanceIds` quando o usuário é funcionário.

`useUserRole` continua: funcionário **nunca** é admin do sistema (papel `admin` global ignora vínculo de equipe).

## 3. Permissões na UI

- `src/components/auth/PermissionGate.tsx` — wrapper que esconde rotas/botões quando o funcionário não tem a permissão.
- `Sidebar.tsx`: oculta itens conforme permissões. Funcionário **nunca** vê: Admin, Perfil da empresa (faturamento), Conexões WhatsApp (gerenciamento), Equipe.
- `App.tsx`: guard nas rotas sensíveis.

Chaves de permissão (módulos): `chat`, `campanhas`, `contatos`, `etiquetas`, `modelos`, `fluxos`, `grupos`, `canais`, `comunidades`, `agente_ia`, `relatorios`, `aquecimento`, `disparo`.

## 4. Página de gestão `/equipe`

Visível só para o dono (não-funcionário, com instância Z-API ativa).

Abas:

1. **Funcionários** — lista com nome/email/cargo/status, ações: editar cargo, escolher inst\u00e2ncias permitidas, suspender, remover.
2. **Convites pendentes** — reenviar / cancelar.
3. **Cargos** — CRUD de `team_roles` com matriz de permissões + lista de inst\u00e2ncias padr\u00e3o.

Bot\u00e3o "Convidar funcion\u00e1rio" → dialog com email + cargo + inst\u00e2ncias permitidas.

## 5. Fluxo de convite (edge functions)

- `team-invite-send` — valida que o caller \u00e9 dono, gera token, insere em `team_invites`, envia email via `send-transactional-email` com link `https://app/aceitar-convite?token=...`.
- `team-invite-accept` — recebe token + dados de signup (se novo) / sess\u00e3o (se existente), cria/usa `auth.users`, insere `team_members`, marca `accepted_at`.

P\u00e1gina nova `src/pages/AceitarConvite.tsx` (p\u00fablica) que coleta nome/senha quando o email ainda n\u00e3o tem conta.

## 6. Itens fora de escopo (n\u00e3o muda agora)

- Sem cobran\u00e7a extra por assento.
- Cargo global `admin` (do `user_roles`) n\u00e3o muda; equipes s\u00e3o ortogonais.
- Funcion\u00e1rio j\u00e1 vinculado n\u00e3o pode ter conta pr\u00f3pria do ZapLynx em paralelo (single team).

## Detalhes t\u00e9cnicos

````text
auth.users (funcionario)
        │
        ▼
team_members.user_id ──► team_members.team_id ──► teams.owner_id (dono)
                                  │
                                  └─► role_id ─► team_roles.permissions (jsonb)
                                  └─► allowed_instance_ids[] (filtro Z-API)
````

- RLS gen\u00e9rica para tabelas de dados do dono (ex.: `campaigns`): permitir quando `user_id = get_effective_user_id(auth.uid())`.
- Inserts feitos pelo funcion\u00e1rio gravam `user_id = effectiveUserId` (do dono) para n\u00e3o quebrar relat\u00f3rios existentes.
- Migration nova; tabelas existentes n\u00e3o s\u00e3o alteradas estruturalmente, apenas suas pol\u00edticas RLS recebem `OR get_effective_user_id(auth.uid()) = user_id` quando necess\u00e1rio. Isso ser\u00e1 feito de forma incremental por m\u00f3dulo conforme permiss\u00f5es ativadas — nesta primeira entrega cobrimos: campanhas, contatos, mensagens/chat, fluxos, grupos, canais, etiquetas, modelos.
- Convite usa `send-transactional-email` (j\u00e1 dispon\u00edvel no projeto) — sem servi\u00e7os externos.

## Entregas desta itera\u00e7\u00e3o

1. Migration `teams` + `team_roles` + `team_members` + `team_invites` + helpers + GRANT + RLS.
2. Migration de ajuste de RLS nas tabelas dos m\u00f3dulos cobertos.
3. `TeamContext` + `useEffectiveUser` + `PermissionGate` + filtro no `useZapiInstances`.
4. P\u00e1gina `/equipe` com 3 abas (Funcion\u00e1rios / Convites / Cargos).
5. P\u00e1gina p\u00fablica `/aceitar-convite`.
6. Edge functions `team-invite-send` e `team-invite-accept`.
7. Item "Equipe" no `Sidebar` (s\u00f3 dono) e oculta\u00e7\u00e3o de itens conforme permiss\u00f5es.
