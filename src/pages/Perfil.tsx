import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useZapi, setZapiInstanceOverride } from "@/hooks/useZapi";
import { useZapiInstances, ZapiInstance } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Image as ImageIcon, Upload, Smartphone, Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Perfil = () => {
  const { updateProfileName, updateProfilePicture, loading } = useZapi();
  const { instances, loading: loadingInstances } = useZapiInstances();
  const { toast } = useToast();
  const [selectedInstance, setSelectedInstance] = useState<ZapiInstance | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name || user.user_metadata?.full_name || "");
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (instances.length > 0 && !selectedInstance) {
      const defaultInst = instances.find(i => i.is_default) || instances[0];
      setSelectedInstance(defaultInst);
      setZapiInstanceOverride(defaultInst);
    }
  }, [instances]);

  const handleSelectInstance = (instanceId: string) => {
    const inst = instances.find(i => i.id === instanceId);
    if (inst) {
      setSelectedInstance(inst);
      setZapiInstanceOverride(inst);
    }
  };

  useEffect(() => {
    return () => { setZapiInstanceOverride(null); };
  }, []);

  const handleUpdateName = async () => {
    if (!name.trim()) return;
    await updateProfileName(name);
    setName("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo de imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpdatePictureFromFile = async () => {
    if (!imageFile) return;
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const ext = imageFile.name.split('.').pop() || 'jpg';
      const filePath = `profile-pictures/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('template-media')
        .upload(filePath, imageFile, { upsert: true });

      if (uploadError) throw new Error("Erro no upload: " + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from('template-media')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      console.log("URL pública da foto:", publicUrl);

      await updateProfilePicture(publicUrl);
      setImageFile(null);
      setPreviewUrl("");
    } catch (error) {
      console.error("Erro ao atualizar foto:", error);
      toast({
        title: "Erro ao atualizar foto",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePictureFromUrl = async () => {
    if (!imageUrl.trim()) return;
    await updateProfilePicture(imageUrl);
    setImageUrl("");
  };

  const isLoading = loading || uploading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Perfil do WhatsApp</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie o nome e foto de perfil do seu WhatsApp conectado
        </p>
      </div>

      {/* Dados do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Dados da Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {userName ? userName.charAt(0).toUpperCase() : userEmail.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            {userName && <p className="font-semibold text-foreground">{userName}</p>}
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              {userEmail}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Seletor de Instância */}
      {instances.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Instância
            </CardTitle>
            <CardDescription>
              Selecione qual dispositivo deseja editar o perfil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedInstance?.id || ""}
              onValueChange={handleSelectInstance}
              disabled={loadingInstances}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.instance_name} {inst.is_default ? "(padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Nome do Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Nome do Perfil
          </CardTitle>
          <CardDescription>
            Altere o nome de exibição do seu WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Novo Nome</Label>
            <Input
              id="profile-name"
              placeholder="Digite o novo nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button 
            onClick={handleUpdateName}
            disabled={isLoading || !name.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? "Atualizando..." : "Atualizar Nome"}
          </Button>
        </CardContent>
      </Card>

      {/* Foto de Perfil - Upload de Arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload de Foto
          </CardTitle>
          <CardDescription>
            Faça upload de uma imagem do seu computador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Selecionar Imagem</Label>
            <Input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: JPG, PNG, GIF (máx. 5MB)
            </p>
          </div>
          {previewUrl && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium mb-2">Prévia:</p>
              <img 
                src={previewUrl} 
                alt="Prévia da foto de perfil" 
                className="w-32 h-32 rounded-full object-cover"
              />
            </div>
          )}
          <Button 
            onClick={handleUpdatePictureFromFile}
            disabled={isLoading || !imageFile}
            className="w-full sm:w-auto"
          >
            {uploading ? "Enviando imagem..." : isLoading ? "Atualizando..." : "Atualizar Foto"}
          </Button>
        </CardContent>
      </Card>

      {/* Foto de Perfil - URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Foto via URL
          </CardTitle>
          <CardDescription>
            Ou use uma URL de imagem já hospedada online
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-picture-url">URL da Imagem</Label>
            <Input
              id="profile-picture-url"
              type="url"
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {imageUrl && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium mb-2">Prévia:</p>
              <img 
                src={imageUrl} 
                alt="Prévia da foto de perfil" 
                className="w-32 h-32 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/150?text=Erro";
                }}
              />
            </div>
          )}
          <Button 
            onClick={handleUpdatePictureFromUrl}
            disabled={isLoading || !imageUrl.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? "Atualizando..." : "Atualizar Foto"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Perfil;
