

## Improve sync error handling for disconnected instances

**Problem**: When WhatsApp is disconnected, the sync function throws a generic error. The user sees "Erro ao sincronizar histórico" without understanding why.

**Solution**: Update the `sync-zapi-history` edge function and the frontend to detect the "not connected" error and show a clear message to the user.

### Changes

1. **`supabase/functions/sync-zapi-history/index.ts`**
   - When Z-API returns a 400 with "You need to be connected with whatsapp", return a specific error message instead of throwing
   - Return `{ success: false, error: "disconnected" }` with status 200 so the frontend can handle it gracefully

2. **Frontend (wherever sync is called, likely in `src/pages/Contatos.tsx` or `src/pages/MensagensRecebidas.tsx`)**
   - Check for the "disconnected" error type in the response
   - Show a toast like "Instância WhatsApp desconectada. Reconecte na página de Dispositivos."

### Root cause
This is not a code bug. The user's WhatsApp instances are disconnected from Z-API. They need to go to Dispositivos and reconnect (scan QR code).

