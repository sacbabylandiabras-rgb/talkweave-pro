import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface KycData {
  id: string;
  user_id: string;
  status: "pending" | "submitted" | "approved" | "rejected";
  selfie_url: string | null;
  doc_front_url: string | null;
  doc_back_url: string | null;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useGatewayKyc() {
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchKyc = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("gateway_kyc" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setKyc(data as unknown as KycData | null);
    } catch (error: any) {
      console.error("Error fetching KYC:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKyc(); }, []);

  const uploadDocument = async (file: File, type: "selfie" | "doc_front" | "doc_back") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/${type}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const submitKyc = async (selfieFile: File, docFrontFile: File, docBackFile: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const [selfieUrl, docFrontUrl, docBackUrl] = await Promise.all([
        uploadDocument(selfieFile, "selfie"),
        uploadDocument(docFrontFile, "doc_front"),
        uploadDocument(docBackFile, "doc_back"),
      ]);

      const kycPayload = {
        user_id: user.id,
        selfie_url: selfieUrl,
        doc_front_url: docFrontUrl,
        doc_back_url: docBackUrl,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      };

      if (kyc) {
        const { error } = await supabase
          .from("gateway_kyc" as any)
          .update(kycPayload)
          .eq("id", kyc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gateway_kyc" as any)
          .insert(kycPayload);
        if (error) throw error;
      }

      toast({ title: "Documentos enviados!", description: "Aguarde a análise do administrador." });
      await fetchKyc();
    } catch (error: any) {
      toast({ title: "Erro ao enviar documentos", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  return { kyc, loading, submitKyc, refetch: fetchKyc };
}

export function useAdminKycQueue() {
  const [queue, setQueue] = useState<(KycData & { email?: string; full_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchQueue = async () => {
    try {
      const { data, error } = await supabase
        .from("gateway_kyc" as any)
        .select("*")
        .order("submitted_at", { ascending: true });

      if (error) throw error;

      // Fetch profile info for each user
      const userIds = (data as KycData[])?.map(k => k.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const enriched = (data as KycData[])?.map(k => {
        const profile = profiles?.find(p => p.id === k.user_id);
        return { ...k, email: profile?.email || "", full_name: profile?.full_name || "" };
      }) || [];

      setQueue(enriched);
    } catch (error: any) {
      console.error("Error fetching KYC queue:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const approveKyc = async (kycId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("gateway_kyc" as any)
        .update({
          status: "approved",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", kycId);
      if (error) throw error;
      toast({ title: "KYC aprovado!" });
      await fetchQueue();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const rejectKyc = async (kycId: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("gateway_kyc" as any)
        .update({
          status: "rejected",
          reject_reason: reason,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", kycId);
      if (error) throw error;
      toast({ title: "KYC reprovado" });
      await fetchQueue();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return { queue, loading, approveKyc, rejectKyc, refetch: fetchQueue };
}
