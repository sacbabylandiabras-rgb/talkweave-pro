import { Camera, Type, Image as ImageIcon, Video, Reply } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useZapi } from "@/hooks/useZapi";
import { useState } from "react";
import { Label } from "@/components/ui/label";

const Status = () => {
  const { 
    sendTextStatus, 
    sendImageStatus, 
    sendVideoStatus, 
    replyStatusText, 
    replyStatusGif, 
    replyStatusSticker,
    loading 
  } = useZapi();

  const [textStatus, setTextStatus] = useState({ text: "", bgColor: "#000000", font: 1 });
  const [imageStatus, setImageStatus] = useState({ url: "", caption: "" });
  const [videoStatus, setVideoStatus] = useState({ url: "", caption: "" });
  const [reply, setReply] = useState({ statusId: "", phone: "", content: "", type: "text" });

  const handleSendText = async () => {
    if (!textStatus.text) return;
    await sendTextStatus(textStatus.text, textStatus.bgColor, textStatus.font);
    setTextStatus({ ...textStatus, text: "" });
  };

  const handleSendImage = async () => {
    if (!imageStatus.url) return;
    await sendImageStatus(imageStatus.url, imageStatus.caption);
    setImageStatus({ url: "", caption: "" });
  };

  const handleSendVideo = async () => {
    if (!videoStatus.url) return;
    await sendVideoStatus(videoStatus.url, videoStatus.caption);
    setVideoStatus({ url: "", caption: "" });
  };

  const handleReply = async () => {
    if (!reply.statusId || !reply.phone || !reply.content) return;
    if (reply.type === "text") await replyStatusText(reply.statusId, reply.phone, reply.content);
    else if (reply.type === "gif") await replyStatusGif(reply.statusId, reply.phone, reply.content);
    else if (reply.type === "sticker") await replyStatusSticker(reply.statusId, reply.phone, reply.content);
    setReply({ ...reply, content: "" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Camera className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground font-bebas tracking-wider uppercase">Status</h1>
          <p className="text-muted-foreground text-sm">
            Publique e responda a status do WhatsApp.
          </p>
        </div>
      </div>

      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
          <TabsTrigger value="text" className="gap-2"><Type className="w-4 h-4" /> Texto</TabsTrigger>
          <TabsTrigger value="image" className="gap-2"><ImageIcon className="w-4 h-4" /> Imagem</TabsTrigger>
          <TabsTrigger value="video" className="gap-2"><Video className="w-4 h-4" /> Vídeo</TabsTrigger>
          <TabsTrigger value="reply" className="gap-2"><Reply className="w-4 h-4" /> Responder</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Status de Texto</CardTitle>
              <CardDescription>Publique uma mensagem curta com cor de fundo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea 
                  placeholder="O que você está pensando?" 
                  value={textStatus.text} 
                  onChange={(e) => setTextStatus({...textStatus, text: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor de Fundo (Hex)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      className="w-12 h-10 p-1"
                      value={textStatus.bgColor} 
                      onChange={(e) => setTextStatus({...textStatus, bgColor: e.target.value})}
                    />
                    <Input 
                      value={textStatus.bgColor} 
                      onChange={(e) => setTextStatus({...textStatus, bgColor: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fonte (1-5)</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="5" 
                    value={textStatus.font} 
                    onChange={(e) => setTextStatus({...textStatus, font: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleSendText} disabled={loading || !textStatus.text}>
                {loading ? "Enviando..." : "Publicar Status"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Status de Imagem</CardTitle>
              <CardDescription>Publique uma imagem com legenda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL da Imagem</Label>
                <Input 
                  placeholder="https://exemplo.com/imagem.jpg" 
                  value={imageStatus.url} 
                  onChange={(e) => setImageStatus({...imageStatus, url: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Legenda (Opcional)</Label>
                <Input 
                  placeholder="Adicione uma legenda..." 
                  value={imageStatus.caption} 
                  onChange={(e) => setImageStatus({...imageStatus, caption: e.target.value})}
                />
              </div>
              <Button className="w-full" onClick={handleSendImage} disabled={loading || !imageStatus.url}>
                {loading ? "Enviando..." : "Publicar Imagem"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Status de Vídeo</CardTitle>
              <CardDescription>Publique um vídeo curto com legenda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Vídeo</Label>
                <Input 
                  placeholder="https://exemplo.com/video.mp4" 
                  value={videoStatus.url} 
                  onChange={(e) => setVideoStatus({...videoStatus, url: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Legenda (Opcional)</Label>
                <Input 
                  placeholder="Adicione uma legenda..." 
                  value={videoStatus.caption} 
                  onChange={(e) => setVideoStatus({...videoStatus, caption: e.target.value})}
                />
              </div>
              <Button className="w-full" onClick={handleSendVideo} disabled={loading || !videoStatus.url}>
                {loading ? "Enviando..." : "Publicar Vídeo"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reply" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Responder Status</CardTitle>
              <CardDescription>Responda a um status específico de um contato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID do Status</Label>
                  <Input 
                    placeholder="ID da mensagem de status" 
                    value={reply.statusId} 
                    onChange={(e) => setReply({...reply, statusId: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone do Contato</Label>
                  <Input 
                    placeholder="5511999999999" 
                    value={reply.phone} 
                    onChange={(e) => setReply({...reply, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Resposta</Label>
                <Tabs value={reply.type} onValueChange={(v) => setReply({...reply, type: v})} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text">Texto</TabsTrigger>
                    <TabsTrigger value="gif">GIF</TabsTrigger>
                    <TabsTrigger value="sticker">Figurinha</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="space-y-2">
                <Label>{reply.type === "text" ? "Mensagem" : "URL"}</Label>
                <Input 
                  placeholder={reply.type === "text" ? "Sua resposta..." : "URL do GIF ou Figurinha"} 
                  value={reply.content} 
                  onChange={(e) => setReply({...reply, content: e.target.value})}
                />
              </div>
              <Button className="w-full" onClick={handleReply} disabled={loading || !reply.statusId || !reply.phone || !reply.content}>
                {loading ? "Enviando..." : "Enviar Resposta"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Status;
