# Plan: Complete Overhaul of Mercado Livre Affiliate System

I will completely rewrite the Mercado Livre affiliate integration to ensure it follows the official API documentation while maintaining high reliability through robust fallbacks. The current system has issues with products not appearing and potential OAuth session conflicts.

## Technical Details

### 1. Edge Function Overhaul
*   **mercadolivre-oauth-start**: Enhanced to include more aggressive session invalidation (`prompt=login`) and correct redirect URIs as per ML docs.
*   **mercadolivre-oauth-callback**: Fixed to properly extract and store the `affiliate_source_id` (tag) which is required for official link generation.
*   **mercadolivre-search-products**: Complete rewrite of the search logic.
    *   Prioritize official `/sites/MLB/search` API with proper authorization.
    *   Use `/items` multiget for enriched product data (high-quality images, accurate pricing).
    *   **Official Link Generation**: Use the `affiliate-program/v1/links` endpoint to generate official `mercadolivre.com/sec/` shortlinks if a `source_id` is available.
    *   **Robust Fallback**: If the API fails or returns no results, use a modernized scraping logic that mimics a real browser to fetch current deals from the public site.
*   **mercadolivre-connection-status**: Ensure it correctly reports connection health and account details.

### 2. Frontend Overhaul (Afiliados.tsx)
*   **Search Engine**: Improved search logic with better category handling.
*   **Loading States**: More granular feedback for the user during long searches or connection attempts.
*   **Link Handling**: Ensure generated links are correctly tracked and wrapped.
*   **UI/UX**: Refine the product grid and selection process.

### 3. Database Schema
*   Verify `ml_affiliate_link_cache` exists to optimize link generation and stay within API rate limits.

---

## Technical section

### Modified Files
*   `supabase/functions/mercadolivre-search-products/index.ts`
*   `supabase/functions/mercadolivre-oauth-callback/index.ts`
*   `supabase/functions/mercadolivre-oauth-start/index.ts`
*   `src/pages/Afiliados.tsx`

### API Reference
Using [Mercado Livre API Docs](https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br) for:
*   OAuth 2.0 flow
*   Search API (`/sites/MLB/search`)
*   Items API (`/items`)
*   Affiliate Program API (`/affiliate-program/v1/links`)
