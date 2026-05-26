import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Contact {
  phone: string;
  name?: string;
  lastMessage?: string;
  lastMessageDate?: string;
  status: "ativo" | "inativo" | "bloqueado";
  messageCount: number;
  firstContactDate?: string;
  tags: string[];
  notes?: { id: string; content: string; createdAt: number; lastUpdateAt: number };
  profilePictureUrl?: string;
  lastUpdated?: string;
}

export interface ContactStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractProfilePictureUrl = (payload: any): string | null => {
  if (!payload) return null;
  if (typeof payload === "string") {
    const s = payload.trim();
    if (!s || s.toLowerCase() === "null" || !/^https?:\/\//i.test(s)) return null;
    return s;
  }
  if (Array.isArray(payload)) return extractProfilePictureUrl(payload[0]);
  const rawUrl =
    payload?.link ??
    payload?.imgUrl ??
    payload?.profilePictureUrl ??
    payload?.imageUrl ??
    payload?.data?.link ??
    payload?.profileThumbnail ??
    payload?.imagePreview ??
    payload?.profilePicUrl ??
    payload?.profilePicture ??
    payload?.picture ??
    payload?.image ??
    payload?.photo ??
    payload?.preview ??
    payload?.pictureUrl;
  return extractProfilePictureUrl(rawUrl);
};

const extractNameFromPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, "");
  return `Contato ${clean.slice(-4)}`;
};

const determineStatus = (lastActivity: string): "ativo" | "inativo" | "bloqueado" => {
  const daysDiff = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff <= 7 ? "ativo" : "inativo";
};

const determineTags = (keywordMatched?: string): string[] => {
  if (!keywordMatched) return [];
  if (keywordMatched === "WELCOME_MESSAGE") return ["Novo"];
  return ["Resposta Automática"];
};

const isGroup = (phone: string) => phone.includes("-group") || phone.includes("@g.us");

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useContacts = (options?: { enabled?: boolean }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({ total: 0, active: 0, inactive: 0, blocked: 0 });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchedPhotosRef = useRef(new Set<string>());
  const inFlightPhotosRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);

      // Explicit user_id filter adds defence-in-depth on top of RLS
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: messageLogs, error: msgErr }, { data: campaignSends, error: campErr }] = await Promise.all([
        supabase
          .from("message_logs")
          .select("phone, message_received, created_at, keyword_matched")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("campaign_sends")
          .select("phone, contact_name, created_at, status")
          .eq("user_id", user.id) // FIX: explicit user filter
          .order("created_at", { ascending: false }),
      ]);

      if (msgErr) throw msgErr;
      if (campErr) throw campErr;
      if (!mountedRef.current) return;

      const contactMap = new Map<string, Contact>();

      for (const log of messageLogs ?? []) {
        if (isGroup(log.phone)) continue;
        const existing = contactMap.get(log.phone);
        if (!existing) {
          contactMap.set(log.phone, {
            phone: log.phone,
            name: extractNameFromPhone(log.phone),
            lastMessage: log.message_received ?? undefined,
            lastMessageDate: log.created_at,
            status: determineStatus(log.created_at),
            messageCount: 1,
            firstContactDate: log.created_at,
            tags: determineTags(log.keyword_matched ?? undefined),
          });
        } else {
          existing.messageCount++;
          if (new Date(log.created_at) > new Date(existing.lastMessageDate ?? "")) {
            existing.lastMessage = log.message_received ?? undefined;
            existing.lastMessageDate = log.created_at;
          }
          if (new Date(log.created_at) < new Date(existing.firstContactDate ?? "")) {
            existing.firstContactDate = log.created_at;
          }
        }
      }

      for (const send of campaignSends ?? []) {
        if (isGroup(send.phone)) continue;
        const existing = contactMap.get(send.phone);
        if (!existing) {
          contactMap.set(send.phone, {
            phone: send.phone,
            name: send.contact_name ?? extractNameFromPhone(send.phone),
            lastMessage: "Recebeu campanha",
            lastMessageDate: send.created_at,
            status: determineStatus(send.created_at),
            messageCount: 0,
            firstContactDate: send.created_at,
            tags: ["Campanha"],
          });
        } else {
          if (send.contact_name && !existing.name?.includes("Contato")) {
            existing.name = send.contact_name;
          }
          if (!existing.tags.includes("Campanha")) existing.tags.push("Campanha");
        }
      }

      const { data: savedContacts } = await supabase
        .from("saved_contacts")
        .select("phone, name, profile_picture_url, updated_at")
        .eq("user_id", user.id);

      for (const sc of savedContacts ?? []) {
        const existing = contactMap.get(sc.phone);
        if (!existing) continue;
        if (sc.profile_picture_url) existing.profilePictureUrl = sc.profile_picture_url;
        if (sc.name) existing.name = sc.name;
        if (sc.updated_at) existing.lastUpdated = sc.updated_at;
      }

      if (!mountedRef.current) return;

      const list = Array.from(contactMap.values());
      setContacts(list);
      setStats({
        total: list.length,
        active: list.filter((c) => c.status === "ativo").length,
        inactive: list.filter((c) => c.status === "inativo").length,
        blocked: list.filter((c) => c.status === "bloqueado").length,
      });
    } catch (err) {
      console.error("Error fetching contacts:", err);
      if (!mountedRef.current) return;
      toast({ title: "Erro", description: "Erro ao carregar contatos.", variant: "destructive" });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [toast]);

  /**
   * FIX: immutable update via setContacts functional form instead of
   * mutating contact objects in-place. Also respects mountedRef.
   */
  const autoFetchProfilePictures = useCallback(async (contactsList: Contact[]) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const now = Date.now();
    const toFetch = contactsList
      .filter((c) => {
        if (fetchedPhotosRef.current.has(c.phone)) return false;
        if (inFlightPhotosRef.current.has(c.phone)) return false;
        if (c.phone.includes("@lid")) return false;
        if (!c.profilePictureUrl) return true;
        if (c.lastUpdated) {
          const hoursSince = (now - new Date(c.lastUpdated).getTime()) / (1000 * 60 * 60);
          return hoursSince > 24;
        }
        return false;
      })
      .slice(0, 20);

    if (toFetch.length === 0) return;
    toFetch.forEach((c) => inFlightPhotosRef.current.add(c.phone));

    const CHUNK = 3;
    const updates: Record<string, string> = {};

    for (let i = 0; i < toFetch.length; i += CHUNK) {
      if (!mountedRef.current) break;
      const chunk = toFetch.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async (contact) => {
          try {
            const { data, error } = await supabase.functions.invoke("get-profile-picture", {
              body: { phone: contact.phone },
            });
            if (!error) {
              const url = extractProfilePictureUrl(data?.data ?? data);
              if (url) {
                updates[contact.phone] = url;
                await supabase
                  .from("saved_contacts")
                  .upsert(
                    {
                      phone: contact.phone,
                      name: contact.name ?? "",
                      user_id: session.user.id,
                      profile_picture_url: url,
                    },
                    { onConflict: "phone,user_id" },
                  );
              }
            }
            fetchedPhotosRef.current.add(contact.phone);
          } catch {
            /* ignore */
          } finally {
            inFlightPhotosRef.current.delete(contact.phone);
          }
        }),
      );
    }

    // FIX: immutable update — never mutate the objects inside contactsList
    if (mountedRef.current && Object.keys(updates).length > 0) {
      setContacts((prev) => prev.map((c) => (updates[c.phone] ? { ...c, profilePictureUrl: updates[c.phone] } : c)));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchContacts();
  }, [enabled, fetchContacts]);

  useEffect(() => {
    if (enabled && !loading && contacts.length > 0) {
      const timer = setTimeout(() => autoFetchProfilePictures(contacts), 1000);
      return () => clearTimeout(timer);
    }
  }, [enabled, loading, contacts.length, autoFetchProfilePictures]);

  const refreshProfilePicture = async (phone: string): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    try {
      const { data, error } = await supabase.functions.invoke("get-profile-picture", { body: { phone } });
      if (error) return null;
      const url = extractProfilePictureUrl(data?.data ?? data);
      if (url) {
        // FIX: immutable update
        setContacts((prev) =>
          prev.map((c) =>
            c.phone === phone ? { ...c, profilePictureUrl: url, lastUpdated: new Date().toISOString() } : c,
          ),
        );
        await supabase
          .from("saved_contacts")
          .upsert({ phone, user_id: session.user.id, profile_picture_url: url }, { onConflict: "phone,user_id" });
        return url;
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const forceUpdateAllPhotos = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);
    try {
      toast({ title: "Atualizando fotos", description: "Buscando fotos de perfil de todos os contatos..." });
      const uniquePhones = [...new Set(contacts.map((c) => c.phone))];
      let updatedCount = 0;
      for (const phone of uniquePhones) {
        try {
          const { data, error } = await supabase.functions.invoke("get-profile-picture", { body: { phone } });
          if (error) continue;
          const url = extractProfilePictureUrl(data?.data ?? data);
          if (url) {
            updatedCount++;
            await supabase
              .from("saved_contacts")
              .upsert({ phone, user_id: session.user.id, profile_picture_url: url }, { onConflict: "phone,user_id" });
          }
          await new Promise((r) => setTimeout(r, 100));
        } catch {
          /* ignore */
        }
      }
      await fetchContacts();
      toast({ title: "Atualização concluída", description: `${updatedCount} fotos de perfil foram atualizadas.` });
    } finally {
      setLoading(false);
    }
  };

  return { contacts, stats, loading, refetch: fetchContacts, refreshProfilePicture, forceUpdateAllPhotos };
};
