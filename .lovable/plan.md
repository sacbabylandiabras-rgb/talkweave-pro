I will implement a "Sales Recovery" (Recuperação de Vendas) template in the Visual Flow builder. This template will include a series of steps to guide the user: first showing the webhook for Zaplynx integration, then asking for store details and remarketing preferences, and finally opening a configuration dialog for AI Agents (mirroring the /agente-ia settings).

### Changes

#### 1. Visual Flow Templates
- Add a new template "Recuperação de Vendas" to `src/components/flow/flowTemplates.ts`.
- This template will pre-configure nodes for:
    - **Gateway Trigger**: A webhook node configured for checkout events.
    - **Data Capture**: Asking for the store/landing page URL.
    - **Decision/Parameter**: Asking for remarketing days.
    - **AI Agent**: A node to process the recovery.

#### 2. AI Agent Configuration Dialog
- Create a new component `src/components/flow/AgentConfigDialog.tsx` that replicates the core UI from `src/pages/AgenteIA.tsx` (Personality, Knowledge, Tools).
- This dialog will allow users to configure the AI agent directly within the Visual Flow editor.
- Changes made here will sync with the global AI Agent configuration via the `useAgentConfig` hook patterns.

#### 3. Visual Flow Editor Integration
- Update `src/pages/FluxoVisual.tsx` to handle the specific requirements of the Sales Recovery template.
- When the "Recuperação de Vendas" template is selected, it will trigger a guided setup flow.
- Add a state to show the "Zaplynx Webhook" information specifically for this template.
- Integrate the new `AgentConfigDialog` to be accessible from the flow editor.

#### 4. Webhook Information
- Update the `BlocoGatewayTriggerNode.tsx` or create a specific variant to easily show the webhook URL (likely using a project-specific identifier).

### Technical Details
- **Syncing**: The `AgentConfigDialog` will use the same `useAgentConfig` and `useAgentTools` hooks as the `/agente-ia` page, ensuring that changes are persisted to the `agent_config` and `agent_knowledge` tables.
- **Node Data**: Store/Remarketing parameters will be saved in the node data of the respective blocks in the flow.
- **Webhook URL**: I will construct the webhook URL based on the Supabase project ID and a standard endpoint (e.g., `https://[project].supabase.co/functions/v1/gateway-webhook`).
