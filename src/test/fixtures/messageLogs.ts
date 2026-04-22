import type { MessageLogLike, SavedContactLike } from "@/lib/group-name-resolution";

export const GROUP_PHONE = "120363405412051886-group";
export const GROUP_RAW_ID = "120363405412051886@g.us";

// Placeholder inserted by sync-zapi-history when the group already had a
// resolved subject ("Equipe Vendas").
export const goodPlaceholderLog: MessageLogLike = {
  id: "log-1",
  phone: GROUP_PHONE,
  message_received: "💬 Conversa com Equipe Vendas",
  response_sent: null,
  keyword_matched: "__history_import__",
  timestamp: "2026-04-22T09:00:00.000Z",
  created_at: "2026-04-22T09:00:00.000Z",
};

// Placeholder inserted by an OLDER sync (or first sync) when UAZAPI didn't
// return the subject — the message text is generic.
export const genericPlaceholderLog: MessageLogLike = {
  id: "log-0",
  phone: GROUP_PHONE,
  message_received: "💬 Conversa com Grupo",
  response_sent: null,
  keyword_matched: "__history_import__",
  timestamp: "2026-04-21T09:00:00.000Z",
  created_at: "2026-04-21T09:00:00.000Z",
};

// A real inbound message after the placeholder.
export const realInboundLog: MessageLogLike = {
  id: "log-2",
  phone: GROUP_PHONE,
  message_received: "Bom dia pessoal!",
  response_sent: null,
  keyword_matched: null,
  timestamp: "2026-04-22T09:30:00.000Z",
  created_at: "2026-04-22T09:30:00.000Z",
};

export const savedContactWithGoodName: SavedContactLike = {
  phone: GROUP_PHONE,
  name: "Equipe Vendas",
  profile_picture_url: null,
};

// What sync-zapi-history would have written before the fix: numeric id as name.
export const savedContactWithNumericName: SavedContactLike = {
  phone: GROUP_PHONE,
  name: "120363405412051886",
  profile_picture_url: null,
};

export const savedContactWithGenericName: SavedContactLike = {
  phone: GROUP_PHONE,
  name: "Grupo sem nome",
  profile_picture_url: null,
};
