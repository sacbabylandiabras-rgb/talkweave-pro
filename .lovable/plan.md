Implement safety improvements in the Campaigns page and Realtime hooks to prevent client-side exceptions causing blank screens.

1. **Safety Enhancements in `useCampaignRealtime.ts`**:
   - Update `sortSends` to handle cases where `created_at` or the record itself might be undefined.
   - Limit the length of the `dataKey` hash to prevent potential browser string length issues with massive campaigns.

2. **Safety Enhancements in `Campanhas.tsx`**:
   - Refactor `formatErrorMessage` to safely handle any input type (including objects) by converting to string first.
   - Wrap the main campaign list and dialogs in additional null/undefined checks.
   - Ensure `fullContactList` generation in `StatsDialog` is resilient to missing data.
   - Add a "Try/Catch" block or safe fallback within the `statsDialog` render logic.

3. **Duplication Logic Fix**:
   - Ensure that duplicating a campaign correctly clones the `target_audience` and other metadata without causing reference issues.

Technical details:
- Using `String(msg).toLowerCase()` in `formatErrorMessage`.
- Adding `isValid` checks to all date formatting calls.
- Ensuring `Map` lookups handle undefined keys gracefully.
- Checking for the existence of properties before accessing them in the render phase.