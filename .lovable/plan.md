### Overview
The user wants a dedicated DM section for Instagram with real-time updates. Since the application already has a `MetaMessages.tsx` for WhatsApp Cloud API (Meta), I will create a specialized `InstagramMessages.tsx` page. I will also update the `webhook-instagram` edge function to log incoming DMs into a common table (like `message_logs`) or a new `instagram_messages` table to support this feature.

### Technical Implementation Plan

1.  **Database Update**:
    *   I will use the existing `instagram_events` table if suitable, but for a real chat experience, I'll ensure `message_logs` can handle Instagram entries or create a dedicated `instagram_messages` table if needed. Given the current structure, adding a column to `message_logs` or ensuring `instance_id` can be `instagram:IG_PAGE_ID` is a good approach.
    *   I'll check if `instagram_events` is enough. It currently stores comments and DMs. I'll stick with `instagram_events` for now but enhance its usage.

2.  **Backend (Edge Function)**:
    *   Update `supabase/functions/webhook-instagram/index.ts` to log every incoming `messaging` event into `instagram_events` with `event_type = 'dm'`.
    *   Update `supabase/functions/send-message/index.ts` to ensure it logs outgoing Instagram DMs properly so the chat history is complete.

3.  **Frontend (New Page)**:
    *   Create `src/pages/instagram/InstagramMessages.tsx`:
        *   Sidebar for conversation list (users who sent DMs).
        *   Main chat area for message history.
        *   Real-time subscription to `instagram_events` for incoming messages.
        *   Input area to send DMs back.
    *   Create `src/hooks/useInstagramMessages.ts` to handle fetching and real-time logic.

4.  **Navigation**:
    *   Add "Mensagens" to the Instagram section in `src/components/layout/Sidebar.tsx`.
    *   Register the route in `src/App.tsx`.

5.  **Refinement**:
    *   Ensure the "Enviar" page and the new "Mensagens" page are consistent.
    *   Add real-time feedback using Supabase Realtime.

### Technical Details
*   **Table**: `instagram_events` will be the source of truth.
*   **Realtime**: `supabase.channel('instagram_events').on('postgres_changes', ...)`
*   **API**: `supabase.functions.invoke('send-message')` with `isInstagram: true`.
