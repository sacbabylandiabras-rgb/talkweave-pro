The profile pictures are not appearing because they are explicitly blocked in the frontend code when they come from the domain `pps.whatsapp.net`. This was likely done to avoid 403 (Forbidden) errors caused by WhatsApp's hotlinking protection. I will implement a proxy solution using a public image proxy service to allow these images to load correctly.

### Technical Details

*   Modify `src/pages/MensagensRecebidas.tsx`:
    *   Update `getHttpAvatarUrl` to use `https://images.weserv.nl/` as a proxy for any URL containing `pps.whatsapp.net`.
    *   Remove explicit checks that return `null` or `undefined` when `pps.whatsapp.net` is present in `AvatarImage` and other rendering logic.
*   Consistency:
    *   Check for other components like group member avatars in groups to ensure they also use the proxy.
*   Verification:
    *   The updated code will attempt to load the proxied URL, which should bypass the 403 errors and display the profile pictures for both private conversations and groups.

### Files to be modified:
*   `src/pages/MensagensRecebidas.tsx`
