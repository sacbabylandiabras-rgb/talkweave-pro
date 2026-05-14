import { useState, useEffect } from "react";
import { 
  BarChart3, MessageCircle, Send, Clock, TrendingUp, CheckCircle2, XCircle, 
  Phone, User, Image, Loader2, AlertCircle, RefreshCw, Edit2, Camera, Globe, Mail, MapPin, X, Save,
  MessagesSquare
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";

interface PhoneInfo {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  name_status?: string;
  platform_type?: string;
}

interface BusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
}

interface MetaPhoneNumber {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  name_status?: string;
  code_verification_status?: string;
}

async function getInvokeErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (payload?.error) return payload.error;
      } catch {
        try { const text = await context.clone().text(); if (text) return text; } catch {}
      }
    }
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export default function DashboardMeta() {
  const { data: creds, isLoading: loadingCreds } = useMetaCredentials();
  const navigate = useNavigate();
  const isConnected = creds?.connected === true;

  const [profile, setProfile] = useState<BusinessProfile>(() => {
    const cached = localStorage.getItem("meta_dashboard_profile");
    return cached ? JSON.parse(cached) : {};
  });
  const [phoneInfo, setPhoneInfo] = useState<PhoneInfo>(() => {
    const cached = localStorage.getItem("meta_dashboard_phone_info");
    return cached ? JSON.parse(cached) : {};
  });
  const [phoneNumbers, setPhoneNumbers] = useState<MetaPhoneNumber[]>(() => {
    const cached = localStorage.getItem("meta_dashboard_phone_numbers");
    return cached ? JSON.parse(cached) : [];
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [hasLoadedPhoneNumbers, setHasLoadedPhoneNumbers] = useState(() => {
    return phoneNumbers.length > 0;
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ about: "", description: "", address: "", email: "" });

  // Quick send state
  const [quickPhone, setQuickPhone] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [quickSending, setQuickSending] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (isConnected) {
      void fetchProfile();
      setPhoneNumbers([]);
      setHasLoadedPhoneNumbers(false);
      return;
    }

    setPhoneNumbers([]);
    setHasLoadedPhoneNumbers(false);
  }, [isConnected]);

  const fetchProfile = async () => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "get_profile" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newProfile = data.profile || {};
      const newPhoneInfo = data.phone_info || {};
      setProfile(newProfile);
      setPhoneInfo(newPhoneInfo);
      localStorage.setItem("meta_dashboard_profile", JSON.stringify(newProfile));
      localStorage.setItem("meta_dashboard_phone_info", JSON.stringify(newPhoneInfo));
      setEditForm({
        about: data.profile?.about || "",
        description: data.profile?.description || "",
        address: data.profile?.address || "",
        email: data.profile?.email || "",
      });
    } catch (err) {
      const msg = await getInvokeErrorMessage(err, "Erro ao buscar perfil");
      toast.error(msg);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchPhoneNumbers = async (showError = false) => {
    setLoadingPhones(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "get_phone_numbers" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const phones = Array.isArray(data?.phone_numbers) ? data.phone_numbers : [];
      setPhoneNumbers(phones);
      localStorage.setItem("meta_dashboard_phone_numbers", JSON.stringify(phones));
      setHasLoadedPhoneNumbers(true);
    } catch (err) {
      setPhoneNumbers([]);

      if (showError) {
        const msg = await getInvokeErrorMessage(err, "Erro ao buscar números da conta");
        toast.error(msg);
      }
    } finally {
      setLoadingPhones(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "update_profile_name", ...editForm },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Perfil atualizado com sucesso!");
      setEditingProfile(false);
      fetchProfile();
    } catch (err) {
      const msg = await getInvokeErrorMessage(err, "Erro ao atualizar perfil");
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Usuário não autenticado");
      const fileName = `${currentUser.id}/meta-profile-${Date.now()}.${file.name.split(".").pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("template-media")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("template-media")
        .getPublicUrl(uploadData.path);

      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "update_profile_photo", photo_url: urlData.publicUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Foto de perfil atualizada!");
      fetchProfile();
    } catch (err) {
      const msg = await getInvokeErrorMessage(err, "Erro ao atualizar foto");
      toast.error(msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleQuickSend = async () => {
    if (!quickPhone || !quickMessage.trim()) {
      toast.error("Preencha número e mensagem");
      return;
    }
    setQuickSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "send_text", phone: quickPhone, message: quickMessage },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Mensagem enviada!");
      setQuickPhone("");
      setQuickMessage("");
    } catch (err) {
      const msg = await getInvokeErrorMessage(err, "Erro ao enviar");
      toast.error(msg);
    } finally {
      setQuickSending(false);
    }
  };

  const qualityColor: Record<string, string> = {
    GREEN: "text-emerald-500",
    YELLOW: "text-amber-500",
    RED: "text-destructive",
  };

  if (loadingCreds) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Painel</h1>
        <Card className="p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-medium">Conta não conectada</p>
          <p className="text-xs text-muted-foreground">Conecte via Configuração Meta para acessar o painel.</p>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/meta/configuracao"}>
            Ir para Configuração
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seu perfil WhatsApp Business e envie mensagens
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5 text-xs" 
            onClick={() => navigate("/meta/mensagens")}
          >
            <MessagesSquare className="w-3.5 h-3.5" />
            Ver Conversas
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetchProfile} disabled={loadingProfile}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingProfile ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="p-5">
        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {/* Profile Photo */}
              <div className="relative group">
                <Avatar className="w-16 h-16 border-2 border-border">
                  <AvatarImage src={profile.profile_picture_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {phoneInfo.verified_name?.[0] || "W"}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploadingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                </label>
              </div>

              {/* Name & Status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground truncate">
                    {phoneInfo.verified_name || "Sem nome"}
                  </h2>
                  {phoneInfo.quality_rating && (
                    <Badge variant="outline" className={`text-[9px] ${qualityColor[phoneInfo.quality_rating] || ""}`}>
                      Qualidade: {phoneInfo.quality_rating}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5" />
                  {phoneInfo.display_phone_number || "—"}
                </p>
                {profile.about && (
                  <p className="text-xs text-muted-foreground mt-1">{profile.about}</p>
                )}
                {phoneInfo.name_status && (
                  <Badge variant="secondary" className="text-[9px] mt-1.5">
                    Status: {phoneInfo.name_status}
                  </Badge>
                )}
              </div>

              {/* Edit Button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs flex-shrink-0"
                onClick={() => setEditingProfile(!editingProfile)}
              >
                <Edit2 className="w-3.5 h-3.5" />
                {editingProfile ? "Cancelar" : "Editar Perfil"}
              </Button>
            </div>

            {/* Profile Details */}
            {!editingProfile && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {profile.description && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <User className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{profile.description}</span>
                  </div>
                )}
                {profile.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{profile.email}</span>
                  </div>
                )}
                {profile.address && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{profile.address}</span>
                  </div>
                )}
                {profile.websites && profile.websites.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{profile.websites.join(", ")}</span>
                  </div>
                )}
              </div>
            )}

            {/* Edit Form */}
            {editingProfile && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Status (About)</Label>
                    <Input
                      value={editForm.about}
                      onChange={(e) => setEditForm({ ...editForm, about: e.target.value })}
                      placeholder="Ex: Atendimento 24h"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="contato@empresa.com"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Descrição do negócio..."
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Endereço</Label>
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Rua, número, cidade"
                    className="h-8 text-xs"
                  />
                </div>
                <Button size="sm" className="gap-1.5 text-xs" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar Alterações
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Números da conta conectada
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os números vinculados à conta WhatsApp Business conectada
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasLoadedPhoneNumbers && (
              <Badge variant="outline" className="text-[9px]">
                {phoneNumbers.length} número{phoneNumbers.length === 1 ? "" : "s"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => fetchPhoneNumbers(true)}
              disabled={loadingPhones}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPhones ? "animate-spin" : ""}`} />
              {hasLoadedPhoneNumbers ? "Atualizar" : "Carregar números"}
            </Button>
          </div>
        </div>

        {loadingPhones ? (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Carregando números da conta...</span>
          </div>
        ) : !hasLoadedPhoneNumbers ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Para evitar bloqueio temporário da Meta, a listagem completa dos números foi movida para carregamento manual.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              O número principal já continua disponível acima no perfil conectado.
            </p>
          </div>
        ) : phoneNumbers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">Nenhum número adicional foi encontrado nesta conta.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {phoneNumbers.map((phoneNumber) => {
              const isCurrentNumber = phoneNumber.id === creds?.phone_number_id;

              return (
                <div key={phoneNumber.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {phoneNumber.display_phone_number || "Número sem identificação"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {phoneNumber.verified_name || "Nome verificado não disponível"}
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-end gap-1.5">
                      {isCurrentNumber && (
                        <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
                          Ativo
                        </Badge>
                      )}
                      {phoneNumber.quality_rating && (
                        <Badge variant="secondary" className="text-[9px]">
                          {phoneNumber.quality_rating}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {phoneNumber.name_status && (
                      <Badge variant="outline" className="text-[9px]">
                        {phoneNumber.name_status}
                      </Badge>
                    )}
                    {phoneNumber.code_verification_status && (
                      <Badge variant="outline" className="text-[9px]">
                        {phoneNumber.code_verification_status}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Número Verificado", value: phoneInfo.display_phone_number || "—", icon: Phone },
          { label: "Nome Verificado", value: phoneInfo.verified_name || "—", icon: User },
          { label: "Qualidade", value: phoneInfo.quality_rating || "—", icon: TrendingUp },
          { label: "Verificação do Nome", value: phoneInfo.name_status || "—", icon: CheckCircle2 },
        ].map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <metric.icon className="w-4.5 h-4.5 text-primary" />
              </div>
            </div>
            <p className="text-sm font-bold text-foreground truncate">{metric.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{metric.label}</p>
          </Card>
        ))}
      </div>

      {/* Quick Send + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Send */}
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Envio Rápido
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Número</Label>
              <Input
                placeholder="5511999999999"
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Mensagem</Label>
              <Textarea
                placeholder="Digite sua mensagem..."
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                rows={3}
                className="text-xs resize-none"
              />
            </div>
            <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleQuickSend} disabled={quickSending}>
              {quickSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Enviar Texto
            </Button>
            <p className="text-[9px] text-muted-foreground">⚠️ Texto livre requer janela de 24h aberta.</p>
          </div>
        </Card>

        {/* Costs by Category */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Custos por Categoria
          </h3>
          <div className="space-y-3">
            {[
              { category: "Marketing", color: "bg-primary" },
              { category: "Utilidade", color: "bg-emerald-500" },
              { category: "Autenticação", color: "bg-amber-500" },
              { category: "Serviço", color: "bg-muted-foreground" },
            ].map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs text-foreground">{item.category}</span>
                </div>
                <span className="text-xs text-muted-foreground">Via Meta Insights</span>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-[10px] text-muted-foreground">
            💡 Consulte o painel da Meta para dados detalhados de custos e analytics.
          </p>
        </Card>
      </div>
    </div>
  );
}
