I will implement several new features and layout adjustments for the Instagram section of Zaplynx based on the provided images.

### Features to Add:
1.  **New Flow Triggers**: Add support for new automation triggers in `AutomacaoComentarios.tsx`:
    *   **Story Reply**: Automation starts when a user replies to a story.
    *   **Direct Message**: Automation starts when a user sends a first message.
    *   **Post/Reel Share**: Automation starts when a user shares content in their story.
    *   **Instagram Ads**: Trigger from ad clicks.
    *   **Live Comments**: Trigger from comments during a live stream.
2.  **Expanded Node Options**: Update the trigger node data to support these new trigger types and subtypes (e.g., specific words vs. any reaction for story replies).
3.  **Automation Templates (Modelos)**: Create a new page `src/pages/instagram/ModelosInstagram.tsx` based on images 6, 7, and 9, featuring:
    *   Categorization by objective (Grow followers, Engagement, Traffic).
    *   Categorization by trigger (Comment, DM, Story Reply, Live).
    *   Pre-defined flows like "Venda pelos comentários de Reels", "Envie cupons nos stories", etc.
4.  **Quick Automations (Iniciadores)**: Implement a "Quick Automation" or "Básico" section in `CampanhasInstagram.tsx` for common tasks like:
    *   Conversation Starters (FAQs).
    *   Story Mention replies.
    *   Default Reply (when no keyword matches).
    *   Main Menu (Persistent menu in DMs).

### Layout Adjustments:
1.  **Sidebar Update**: Add "Modelos" to the Instagram section in the sidebar.
2.  **Flow Builder UI**: Enhance the `AutomacaoComentarios.tsx` to match the "ManyChat-style" look from images:
    *   Improve block styling (borders, shadows, icons).
    *   Add a cleaner "Step-by-step" editing experience.
3.  **Dashboard/Campaign List**: Improve the visual hierarchy and cards in `CampanhasInstagram.tsx`.

### Technical Details:
*   **Database**: Ensure the `instagram_automations` table (or similar) can store the new trigger types.
*   **Components**: Create `src/pages/instagram/ModelosInstagram.tsx`.
*   **Routing**: Add `/instagram/modelos` to `App.tsx`.
*   **Navigation**: Update `src/components/layout/Sidebar.tsx`.
*   **Flow Logic**: Update `src/components/flow/ig/IGGatilhoNode.tsx` and its edit panel in `AutomacaoComentarios.tsx` to handle the new trigger categories.
