import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useZapi, setZapiInstanceOverride } from "@/hooks/useZapi";
import { useZapiInstances, ZapiInstance } from "@/hooks/useZapiInstances";
import { User, Image as ImageIcon, Upload, Smartphone } from "lucide-react";

const Perfil = () => {
  const { updateProfileName, updateProfilePicture, loading } = useZapi();
  const { instances, loading: loadingInstances } = useZapiInstances();
  const [selectedInstance, setSelectedInstance] = useState<ZapiInstance | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

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
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImageFile(base64String);
      setPreviewUrl(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePictureFromFile = async () => {
    if (!imageFile) return;
    await updateProfilePicture(imageFile);
    setImageFile("");
    setPreviewUrl("");
  };

  const handleUpdatePictureFromUrl = async () => {
    if (!imageUrl.trim()) return;
    await updateProfilePicture(imageUrl);
    setImageUrl("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Perfil do WhatsApp</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie o nome e foto de perfil do seu WhatsApp conectado
        </p>
      </div>

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
              disabled={loading}
            />
          </div>
          <Button 
            onClick={handleUpdateName}
            disabled={loading || !name.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? "Atualizando..." : "Atualizar Nome"}
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
              disabled={loading}
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
            disabled={loading || !imageFile}
            className="w-full sm:w-auto"
          >
            {loading ? "Atualizando..." : "Atualizar Foto"}
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
              disabled={loading}
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
            disabled={loading || !imageUrl.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? "Atualizando..." : "Atualizar Foto"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Perfil;
