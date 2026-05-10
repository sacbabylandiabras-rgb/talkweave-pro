import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarClock, Pencil, Reply, Send, XCircle } from "lucide-react";

interface Props {
  sendEvent: (p: any) => Promise<any>;
  sendEditEvent: (p: any) => Promise<any>;
  sendEventResponse: (p: any) => Promise<any>;
  loading: boolean;
}

const toEpoch = (val: string) => {
  if (!val) return undefined;
  const t = new Date(val).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
};

export default function EventosSection({ sendEvent, sendEditEvent, sendEventResponse, loading }: Props) {
  // Criar
  const [cPhone, setCPhone] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cLocation, setCLocation] = useState("");
  const [cUrl, setCUrl] = useState("");
  const [cAllDay, setCAllDay] = useState(false);

  // Editar
  const [ePhone, setEPhone] = useState("");
  const [eMsgId, setEMsgId] = useState("");
  const [eTitle, setETitle] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eLocation, setELocation] = useState("");
  const [eUrl, setEUrl] = useState("");
  const [eAllDay, setEAllDay] = useState(false);

  // Responder
  const [rPhone, setRPhone] = useState("");
  const [rMsgId, setRMsgId] = useState("");
  const [rResponse, setRResponse] = useState("1");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendEvent({
      phone: cPhone,
      title: cTitle,
      description: cDescription || undefined,
      startTime: toEpoch(cStart),
      endTime: toEpoch(cEnd),
      location: cLocation || undefined,
      url: cUrl || undefined,
      isAllDay: cAllDay || undefined,
    });
  };

  const handleEdit = async (e: React.FormEvent, cancel = false) => {
    e.preventDefault();
    await sendEditEvent({
      phone: ePhone,
      messageIdToEdit: eMsgId,
      title: cancel ? undefined : eTitle,
      description: cancel ? undefined : (eDescription || undefined),
      startTime: cancel ? undefined : toEpoch(eStart),
      endTime: cancel ? undefined : toEpoch(eEnd),
      location: cancel ? undefined : (eLocation || undefined),
      url: cancel ? undefined : (eUrl || undefined),
      isAllDay: cancel ? undefined : (eAllDay || undefined),
      cancelEvent: cancel || undefined,
    });
  };

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendEventResponse({ phone: rPhone, eventMessageId: rMsgId, eventResponse: rResponse });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5" />
          Eventos
        </CardTitle>
        <CardDescription>
          Crie, edite/cancele ou responda eventos enviados pelo WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="criar" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="criar" className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Criar
            </TabsTrigger>
            <TabsTrigger value="editar" className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Editar / Cancelar
            </TabsTrigger>
            <TabsTrigger value="responder" className="flex items-center gap-2">
              <Reply className="w-4 h-4" /> Responder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criar" className="space-y-4 pt-4">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do destinatário *</Label>
                  <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="5511999999999" required />
                </div>
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Reunião de alinhamento" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={cDescription} onChange={(e) => setCDescription(e.target.value)} placeholder="Detalhes do evento" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início *</Label>
                  <Input type="datetime-local" value={cStart} onChange={(e) => setCStart(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Local</Label>
                  <Input value={cLocation} onChange={(e) => setCLocation(e.target.value)} placeholder="Endereço ou sala" />
                </div>
                <div className="space-y-2">
                  <Label>Link</Label>
                  <Input value={cUrl} onChange={(e) => setCUrl(e.target.value)} placeholder="https://" />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cAllDay" checked={cAllDay} onCheckedChange={(v) => setCAllDay(!!v)} />
                <Label htmlFor="cAllDay" className="cursor-pointer">Dia inteiro</Label>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Enviando..." : "Enviar evento"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="editar" className="space-y-4 pt-4">
            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do destinatário *</Label>
                  <Input value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="5511999999999" required />
                </div>
                <div className="space-y-2">
                  <Label>ID da mensagem do evento *</Label>
                  <Input value={eMsgId} onChange={(e) => setEMsgId(e.target.value)} placeholder="3EB0..." required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Novo título</Label>
                  <Input value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Local</Label>
                  <Input value={eLocation} onChange={(e) => setELocation(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="datetime-local" value={eStart} onChange={(e) => setEStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Link</Label>
                  <Input value={eUrl} onChange={(e) => setEUrl(e.target.value)} placeholder="https://" />
                </div>
                <div className="flex items-end space-x-2 pb-2">
                  <Checkbox id="eAllDay" checked={eAllDay} onCheckedChange={(v) => setEAllDay(!!v)} />
                  <Label htmlFor="eAllDay" className="cursor-pointer">Dia inteiro</Label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button type="button" onClick={(ev) => handleEdit(ev as any, false)} disabled={loading}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {loading ? "Atualizando..." : "Salvar alterações"}
                </Button>
                <Button type="button" variant="destructive" onClick={(ev) => handleEdit(ev as any, true)} disabled={loading}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar evento
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="responder" className="space-y-4 pt-4">
            <form onSubmit={handleRespond} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do destinatário *</Label>
                  <Input value={rPhone} onChange={(e) => setRPhone(e.target.value)} placeholder="5511999999999" required />
                </div>
                <div className="space-y-2">
                  <Label>ID da mensagem do evento *</Label>
                  <Input value={rMsgId} onChange={(e) => setRMsgId(e.target.value)} placeholder="3EB0..." required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resposta *</Label>
                <Select value={rResponse} onValueChange={setRResponse}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sim — vou participar</SelectItem>
                    <SelectItem value="2">Talvez</SelectItem>
                    <SelectItem value="3">Não — não vou participar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                <Reply className="w-4 h-4 mr-2" />
                {loading ? "Enviando..." : "Enviar resposta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}