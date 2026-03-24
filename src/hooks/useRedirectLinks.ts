import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RedirectLinkClick {
  id: string;
  redirect_link_id: string;
  group_redirected_to: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface RedirectLink {
  id: string;
  name: string;
  slug: string;
  max_members_per_group: number;
  active: boolean;
  created_at: string;
  groups?: RedirectLinkGroup[];
  click_count?: number;
  clicks_by_day?: { date: string; clicks: number }[];
  clicks_raw?: RedirectLinkClick[];
}

export interface RedirectLinkGroup {
  id: string;
  redirect_link_id: string;
  group_id: string;
  group_name: string;
  invite_link: string | null;
  sort_order: number;
  is_full: boolean;
  current_members: number;
  instance_id: string | null;
  group_photo: string | null;
}

export function useRedirectLinks() {
  const [links, setLinks] = useState<RedirectLink[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: linksData, error } = await (supabase as any)
        .from("redirect_links")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: groupsData } = await (supabase as any)
        .from("redirect_link_groups")
        .select("*")
        .order("sort_order", { ascending: true });

      // Fetch click data with dates
      const { data: clicksData } = await (supabase as any)
        .from("redirect_link_clicks")
        .select("redirect_link_id, created_at");

      const clickCounts: Record<string, number> = {};
      const clicksByDay: Record<string, Record<string, number>> = {};

      (clicksData || []).forEach((c: any) => {
        clickCounts[c.redirect_link_id] = (clickCounts[c.redirect_link_id] || 0) + 1;
        const day = new Date(c.created_at).toISOString().split("T")[0];
        if (!clicksByDay[c.redirect_link_id]) clicksByDay[c.redirect_link_id] = {};
        clicksByDay[c.redirect_link_id][day] = (clicksByDay[c.redirect_link_id][day] || 0) + 1;
      });

      const enriched = (linksData || []).map((link: any) => {
        const dayMap = clicksByDay[link.id] || {};
        const sortedDays = Object.entries(dayMap)
          .map(([date, clicks]) => ({ date, clicks }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Fill gaps in last 7 days
        const last7: { date: string; clicks: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split("T")[0];
          last7.push({ date: key, clicks: dayMap[key] || 0 });
        }

        return {
          ...link,
          groups: (groupsData || []).filter((g: any) => g.redirect_link_id === link.id),
          click_count: clickCounts[link.id] || 0,
          clicks_by_day: last7,
        };
      });

      setLinks(enriched);
    } catch (err: any) {
      console.error("Erro ao buscar links:", err);
      toast.error("Erro ao buscar links de redirecionamento");
    } finally {
      setLoading(false);
    }
  }, []);

  const createLink = async (name: string, slug: string, maxMembers: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { error } = await (supabase as any).from("redirect_links").insert({
      user_id: user.id,
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      max_members_per_group: maxMembers,
    });

    if (error) throw error;
    await fetchLinks();
  };

  const deleteLink = async (id: string) => {
    const { error } = await (supabase as any).from("redirect_links").delete().eq("id", id);
    if (error) throw error;
    await fetchLinks();
  };

  const toggleLink = async (id: string, active: boolean) => {
    const { error } = await (supabase as any).from("redirect_links").update({ active }).eq("id", id);
    if (error) throw error;
    await fetchLinks();
  };

  const addGroupToLink = async (
    linkId: string,
    groupId: string,
    groupName: string,
    inviteLink: string | null,
    instanceId: string | null,
    currentMembers: number,
    groupPhoto?: string | null
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const existingLink = links.find((l) => l.id === linkId);
    const nextOrder = existingLink?.groups?.length || 0;

    const { error } = await (supabase as any).from("redirect_link_groups").insert({
      redirect_link_id: linkId,
      user_id: user.id,
      group_id: groupId,
      group_name: groupName,
      invite_link: inviteLink,
      instance_id: instanceId,
      sort_order: nextOrder,
      current_members: currentMembers,
      group_photo: groupPhoto || null,
    });

    if (error) throw error;
    await fetchLinks();
  };

  const removeGroupFromLink = async (groupRecordId: string) => {
    const { error } = await (supabase as any).from("redirect_link_groups").delete().eq("id", groupRecordId);
    if (error) throw error;
    await fetchLinks();
  };

  const updateGroupInLink = async (groupRecordId: string, updates: Partial<RedirectLinkGroup>) => {
    const { error } = await (supabase as any).from("redirect_link_groups").update(updates).eq("id", groupRecordId);
    if (error) throw error;
    await fetchLinks();
  };

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return {
    links,
    loading,
    refetch: fetchLinks,
    createLink,
    deleteLink,
    toggleLink,
    addGroupToLink,
    removeGroupFromLink,
    updateGroupInLink,
  };
}
