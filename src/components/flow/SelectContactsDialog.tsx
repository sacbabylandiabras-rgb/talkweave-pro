import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useContacts } from "@/hooks/useContacts";
import { Search, Users, Loader2, Plus, X, Phone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InstanceSelector from "@/components/envio/InstanceSelector";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export type FlowSendProvider = "zapi" | "meta";

interface MetaPhoneOption {
  id: string;
  display_phone_number: string;
  verified_name: string;
}

interface SelectContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedContacts: string[], instanceIds?: string[], provider?: FlowSendProvider, metaPhoneNumberId?: string) => void;
}

export function SelectContactsDialog({ 
  open, 
  onOpenChange, 
  onConfirm 
}: SelectContactsDialogProps) {
  const { contacts, loading } = useContacts();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualPhones, setManualPhones] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("contacts");
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [sendProvider, setSendProvider] = useState<FlowSendProvider>("zapi");
  const [metaPhoneNumbers, setMetaPhoneNumbers] = useState<MetaPhoneOption[]>([]);
  const [selectedMetaPhoneId, setSelectedMetaPhoneId] = useState("");
  const [loadingMetaPhones, setLoadingMetaPhones] = useState(false);
  const { data: metaCreds } = useMetaCredentials();
  const isMetaConnected = metaCreds?.connected === true;
  const { activeWorkspace } = useWorkspace();

  // Auto-select meta provider when in Meta workspace
  const effectiveProvider = activeWorkspace === "meta" ? "meta" : sendProvider;

  const fetchMetaPhones = async () => {
    setLoadingMetaPhones(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "get_phone_numbers" },
      });
      if (error) throw error;
      setMetaPhoneNumbers(data?.phone_numbers || []);
      if (data?.phone_numbers?.length > 0 && !selectedMetaPhoneId) {
        setSelectedMetaPhoneId(data.phone_numbers[0].id);
      }
    } catch {
      setMetaPhoneNumbers([]);
    } finally {
      setLoadingMetaPhones(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedContacts([]);
      setSearchQuery("");
      setManualPhone("");
      setManualPhones([]);
      setActiveTab("contacts");
      setSendProvider("zapi");
      if (activeWorkspace === "meta") {
        setSendProvider("meta");
      }
      setSelectedMetaPhoneId("");
      setMetaPhoneNumbers([]);
    }
  }, [open]);

  useEffect(() => {
    if (effectiveProvider === "meta" && isMetaConnected && metaPhoneNumbers.length === 0) {
      fetchMetaPhones();
    }
  }, [effectiveProvider, isMetaConnected]);

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    return (
      contact.phone.includes(query) ||
      contact.name?.toLowerCase().includes(query) ||
      contact.tags.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const handleToggleContact = (phone: string) => {
    setSelectedContacts(prev =>
      prev.includes(phone)
        ? prev.filter(p => p !== phone)
        : [...prev, phone]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.phone));
    }
  };

  const handleAddManualPhone = () => {
    const clean = manualPhone.replace(/\D/g, "");
    if (clean.length < 10 || clean.length > 15) return;
    if (manualPhones.includes(clean)) return;
    setManualPhones(prev => [...prev, clean]);
    setManualPhone("");
  };

  const handleRemoveManualPhone = (phone: string) => {
    setManualPhones(prev => prev.filter(p => p !== phone));
  };

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddManualPhone();
    }
  };

  const handleConfirm = () => {
    const allPhones = [...new Set([...selectedContacts, ...manualPhones])];
    if (allPhones.length === 0) return;
    onConfirm(
      allPhones,
      effectiveProvider === "zapi" && selectedInstanceIds.length > 0 ? selectedInstanceIds : undefined,
      effectiveProvider,
      effectiveProvider === "meta" ? selectedMetaPhoneId : undefined
    );
    onOpenChange(false);
  };

  const totalSelected = new Set([...selectedContacts, ...manualPhones]).size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col z-[100]">
        <DialogHeader>
          <DialogTitle>Selecionar Contatos</DialogTitle>
          <DialogDescription>
            Escolha contatos ou digite números manualmente
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contatos
              {selectedContacts.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  {selectedContacts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Digitar Número
              {manualPhones.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  {manualPhones.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por telefone, nome ou tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedContacts.length === filteredContacts.length ? "Desmarcar" : "Selecionar"} Todos
              </Button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                {filteredContacts.length} contatos encontrados
              </span>
              <Badge variant="secondary">
                {selectedContacts.length} selecionados
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-2">
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Nenhum contato encontrado" : "Nenhum contato disponível"}
                    </div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div
                        key={contact.phone}
                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => handleToggleContact(contact.phone)}
                      >
                        <Checkbox
                          checked={selectedContacts.includes(contact.phone)}
                          onCheckedChange={() => handleToggleContact(contact.phone)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {contact.name || contact.phone}
                            </p>
                            <Badge
                              variant={
                                contact.status === "ativo"
                                  ? "default"
                                  : contact.status === "inativo"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {contact.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{contact.phone}</p>
                          {contact.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {contact.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contact.messageCount} msgs
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="manual" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: 5511999999999"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  onKeyDown={handleManualKeyDown}
                  className="pl-9"
                />
              </div>
              <Button size="sm" onClick={handleAddManualPhone} disabled={manualPhone.replace(/\D/g, "").length < 10}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Digite o número com DDD e código do país (ex: 5511999999999) e pressione Enter ou clique em Adicionar.
            </p>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-2">
                {manualPhones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum número adicionado ainda
                  </div>
                ) : (
                  manualPhones.map((phone) => (
                    <div
                      key={phone}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                    >
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{phone}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemoveManualPhone(phone)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4">
          <div className="space-y-3">
            {effectiveProvider === "zapi" && (
              <InstanceSelector
                providerFilter="uazapi"
                onMultiInstanceChange={(ids) => setSelectedInstanceIds(ids)}
              />
            )}

            {effectiveProvider === "meta" && (
              <div className="space-y-2">
                <Label className="text-xs">Número remetente</Label>
                {loadingMetaPhones ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando números...
                  </div>
                ) : metaPhoneNumbers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum número encontrado na conta Meta.</p>
                ) : (
                  <Select value={selectedMetaPhoneId} onValueChange={setSelectedMetaPhoneId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione o número" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]" position="popper" side="top">
                      {metaPhoneNumbers.map((pn) => (
                        <SelectItem key={pn.id} value={pn.id}>
                          {pn.display_phone_number} — {pn.verified_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[10px] text-muted-foreground">
                  ⚠️ Via Meta API, apenas templates aprovados podem iniciar conversas. Texto livre requer janela de 24h.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={totalSelected === 0}
          >
            Enviar para {totalSelected} contato{totalSelected !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
