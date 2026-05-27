# Melhorias no Pipeline de Vendas

Implementar 4 melhorias no módulo de pipeline (`/pipeline`):

## 1. Editar funil existente

No `PipelineSelector.tsx`, adicionar botão de "editar" (ícone lápis) em cada card. Abre o mesmo dialog usado para criar, pré-preenchido, permitindo:
- Renomear o funil
- Mudar departamento/moeda
- Adicionar/remover etapas
- Renomear etapas existentes (clique no badge)

Persistência: atualiza o JSONB `pipeline_stages` no `profiles` (ou na nova tabela do item 3).

## 2. Reordenar etapas (drag & drop)

Dentro do editor de etapas, usar `@dnd-kit/sortable` (já presente no projeto se for o caso — senão instalar) para permitir arrastar e soltar as etapas. A ordem é refletida nas colunas do Kanban em `MensagensRecebidas`.

## 3. Métricas de conversão

No topo do Kanban (acima das colunas) e dentro de cada coluna mostrar:
- **Por coluna**: número de leads, valor total (se houver campo `deal_value` no `saved_contacts` — caso não exista, adicionar via migration nullable) e % do funil total
- **Entre colunas**: taxa de conversão `etapa N → etapa N+1` (com base em `saved_contacts` movidos historicamente — usar um log simples `pipeline_stage_history` para registrar transições)

Migration:
```sql
-- log de movimentações entre etapas (para métricas)
CREATE TABLE public.pipeline_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pipeline_id text NOT NULL,
  contact_id uuid NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pipeline_stage_history TO authenticated;
GRANT ALL ON public.pipeline_stage_history TO service_role;
ALTER TABLE public.pipeline_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history" ON public.pipeline_stage_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- valor opcional do lead
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS deal_value numeric DEFAULT 0;
```

## 4. Compartilhar funis entre membros

Hoje os pipelines vivem em `profiles.pipeline_stages` (1 dono). Para compartilhar, mover para uma tabela própria:

```sql
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  department text,
  currency text DEFAULT 'BRL',
  stages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pipeline_members (
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor', -- 'viewer' | 'editor'
  PRIMARY KEY (pipeline_id, user_id)
);

-- GRANTs + RLS: owner full access; member access via pipeline_members
```

O `PipelineSelector` passa a ler de `pipelines` (próprios + compartilhados via `pipeline_members`).
Em cada card aparece um botão "Compartilhar" que abre um dialog para adicionar membros por e-mail (lookup em `profiles.email`) e definir o papel.

**Migração de dados**: na primeira leitura, se `profiles.pipeline_stages` tiver dados e a tabela `pipelines` estiver vazia para o usuário, migrar automaticamente.

## Ordem de execução

1. Migrations (tabelas `pipelines`, `pipeline_members`, `pipeline_stage_history`, coluna `deal_value`)
2. Refator `PipelineSelector` para usar `pipelines` + migração automática do JSONB legado
3. Dialog de edição (reuso do dialog de criação) + reorder com `@dnd-kit/sortable`
4. Dialog "Compartilhar" (lookup por e-mail, lista de membros, remover)
5. Métricas no Kanban (`MensagensRecebidas`) + hook de log nas mudanças de etapa

## Observações

- Tudo respeita o tema atual (tokens semânticos, sem cores hardcoded).
- Sem expor nomes de provedores de terceiros (regra white-label).
- O hook que move o contato entre etapas vai inserir uma linha em `pipeline_stage_history` para alimentar as métricas.
