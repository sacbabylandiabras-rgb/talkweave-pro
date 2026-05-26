import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Campaign, CampaignSend } from "@/hooks/useCampaigns";

export function useCampaignsRealtime() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*, template:message_templates(*)")
        .order("created_at", { ascending: false });
      if (active) {
        setCampaigns((data as any) || []);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel("campaigns-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => load())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { campaigns, loading };
}

export function useCampaignSendsRealtime(campaignId: string | null) {
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaignId) {
      setSends([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    const load = async () => {
      const { data } = await supabase
        .from("campaign_sends")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (active) {
        setSends((data as any) || []);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`campaign-sends-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_sends", filter: `campaign_id=eq.${campaignId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return { sends, loading };
}

export function useAllCampaignSendsRealtime() {
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("campaign_sends")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (active) {
        setSends((data as any) || []);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel("campaign-sends-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_sends" }, () => load())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { sends, loading };
}
