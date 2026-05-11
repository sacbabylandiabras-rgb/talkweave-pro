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
  whatsapp: string | null;
  business_data?: Record<string, any> | null;
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
        .from("gateway_kyc")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setKyc(data as KycData | null);
    } catch (error: any) {
      console.error("Error fetching KYC:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKyc(); }, []);

  const uploadDocument = async (file: File, type: "selfie" | "doc_front" | "doc_back" | "cnpj_doc") => {
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

  const submitKyc = async (selfieFile: File, docFrontFile: File, docBackFile: File, whatsapp?: string, businessData?: { [key: string]: string }, cnpjDocFile?: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const uploads: Promise<string>[] = [
        uploadDocument(selfieFile, "selfie"),
        uploadDocument(docFrontFile, "doc_front"),
        uploadDocument(docBackFile, "doc_back"),
      ];
      if (cnpjDocFile) {
        uploads.push(uploadDocument(cnpjDocFile, "cnpj_doc"));
      }

      const results = await Promise.all(uploads);
      const [selfieUrl, docFrontUrl, docBackUrl] = results;
      const cnpjDocUrl = results[3] || null;

      const finalBusinessData = { ...(businessData || {}), ...(cnpjDocUrl ? { cnpj_doc_url: cnpjDocUrl } : {}) };

      const kycPayload = {
        user_id: user.id,
        selfie_url: selfieUrl,
        doc_front_url: docFrontUrl,
        doc_back_url: docBackUrl,
        status: "submitted" as const,
        submitted_at: new Date().toISOString(),
        ...(whatsapp ? { whatsapp } : {}),
        business_data: finalBusinessData,
      };

      if (kyc) {
        const { error } = await supabase
          .from("gateway_kyc")
          .update(kycPayload)
          .eq("id", kyc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gateway_kyc")
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
        .from("gateway_kyc")
        .select("*")
        .order("submitted_at", { ascending: true });

      if (error) throw error;

      // Fetch profile info for each user
      const kycData = data as unknown as KycData[];
      const userIds = kycData?.map(k => k.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, whatsapp")
        .in("id", userIds);

      const enriched = kycData?.map(k => {
        const profile = profiles?.find(p => p.id === k.user_id);
        return { ...k, email: profile?.email || "", full_name: profile?.full_name || "", whatsapp_profile: (profile as any)?.whatsapp || "" };
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
        .from("gateway_kyc")
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
        .from("gateway_kyc")
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
