import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useZapi } from "@/hooks/useZapi";
import { User, Image as ImageIcon } from "lucide-react";

const Perfil = () => {
  const { updateProfileName, updateProfilePicture, loading } = useZapi();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const handleUpdateName = async () => {
    if (!name.trim()) {
      return;
    }
    await updateProfileName(name);
    setName("");
  };

  const handleUpdatePicture = async () => {
    if (!imageUrl.trim()) {
      return;
    }
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

      {/* Foto de Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Foto de Perfil
          </CardTitle>
          <CardDescription>
            Altere a foto de perfil do seu WhatsApp usando uma URL de imagem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-picture">URL da Imagem</Label>
            <Input
              id="profile-picture"
              type="url"
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              A imagem deve estar hospedada online e ser acessível publicamente
            </p>
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
            onClick={handleUpdatePicture}
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
