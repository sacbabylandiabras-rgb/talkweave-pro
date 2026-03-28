import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PixelConfig {
  id: string;
  user_id: string;
  platform: string;
  pixel_id: string;
  api_token: string;
  extra_config: Record<string, string>;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useGatewayPixels() {
  const [pixels, setPixels] = useState<PixelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPixels = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("gateway_pixels" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPixels((data as any[]) || []);
    } catch (error: any) {
      console.error("Error fetching pixels:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPixels(); }, []);

  const savePixel = async (pixel: Partial<PixelConfig> & { platform: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        user_id: user.id,
        platform: pixel.platform,
        pixel_id: pixel.pixel_id || "",
        api_token: pixel.api_token || "",
        extra_config: pixel.extra_config || {},
        events: pixel.events || ["Purchase"],
        active: pixel.active ?? true,
      };

      if (pixel.id) {
        const { error } = await supabase
          .from("gateway_pixels" as any)
          .update(payload)
          .eq("id", pixel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gateway_pixels" as any)
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Pixel salvo com sucesso!" });
      await fetchPixels();
    } catch (error: any) {
      toast({ title: "Erro ao salvar pixel", description: error.message, variant: "destructive" });
    }
  };

  const deletePixel = async (id: string) => {
    try {
      const { error } = await supabase
        .from("gateway_pixels" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Pixel removido!" });
      await fetchPixels();
    } catch (error: any) {
      toast({ title: "Erro ao remover pixel", description: error.message, variant: "destructive" });
    }
  };

  return { pixels, loading, savePixel, deletePixel, refetch: fetchPixels };
}
