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
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { Search, Users, Loader2, Plus, X, Phone, UsersRound, RefreshCw, Link2, MessageSquare } from "lucide-react";
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
  mode?: "contacts" | "groups";
}

export function SelectContactsDialog({ 
  open, 
  onOpenChange, 
  onConfirm,
  mode = "contacts",
}: SelectContactsDialogProps) {
  const isGroupsMode = mode === "groups";
  const { contacts, loading } = useContacts();
  const { groups, loading: loadingGroups, refetch: refetchGroups } = useWhatsAppGroups(
    isGroupsMode ? {} : undefined
  );
  const [rotativeLinks, setRotativeLinks] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    groups: Array<{ group_id: string; group_name: string; instance_id?: string | null }>;
  }>>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualPhones, setManualPhones] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(isGroupsMode ? "groups" : "contacts");
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [sendProvider, setSendProvider] = useState<FlowSendProvider>("zapi");
  const [metaPhoneNumbers, setMetaPhoneNumbers] = useState<MetaPhoneOption[]>([]);
  const [selectedMetaPhoneId, setSelectedMetaPhoneId] = useState("");
  const [loadingMetaPhones, setLoadingMetaPhones] = useState(false);
  const { data: metaCreds } = useMetaCredentials();
  const isMetaConnected = metaCreds?.connected === true;
  const { activeWorkspace } = useWorkspace();

  const fetchRotativeLinks = async () => {
    setLoadingLinks(true);
    try {
      const { data: links } = await (supabase as any)
        .from("redirect_links")
        .select("id, name, slug")
        .order("created_at", { ascending: false });
      const { data: linkGroups } = await (supabase as any)
        .from("redirect_link_groups")
        .select("redirect_link_id, group_id, group_name, instance_id");
      const enriched = (links || [])
        .map((l: any) => ({
          id: l.id,
          name: l.name,
          slug: l.slug,
          groups: (linkGroups || [])
            .filter((g: any) => g.redirect_link_id === l.id)
            .map((g: any) => ({
              group_id: g.group_id,
              group_name: g.group_name,
              instance_id: g.instance_id,
            })),
        }))
        .filter((l: any) => l.groups.length > 0);
      setRotativeLinks(enriched);
    } catch {
      setRotativeLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    if (open && isGroupsMode) {
      fetchRotativeLinks();
    }
  }, [open, isGroupsMode]);

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
      setActiveTab(isGroupsMode ? "groups" : "contacts");
      setSendProvider("zapi");
      if (activeWorkspace === "meta") {
        setSendProvider("meta");
      }
      setSelectedMetaPhoneId("");
      setMetaPhoneNumbers([]);
    }
  }, [open, isGroupsMode]);

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

  const filteredGroups = groups.filter(g => {
    const query = searchQuery.toLowerCase();
    return (
      g.nome?.toLowerCase().includes(query) ||
      g.id?.toLowerCase().includes(query)
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
    const list = isGroupsMode ? filteredGroups : filteredContacts;
    const allIds = isGroupsMode
      ? filteredGroups.map(g => g.id)
      : filteredContacts.map(c => c.phone);
    if (selectedContacts.length === list.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(allIds);
    }
  };

  const handleAddManualPhone = () => {
    const clean = manualPhone.replace(/\D/g, "");
    if (clean.length < 10 || clean.length > 15) return;
    if (manualPhones.includes(clean)) return;
    setManualPhones(prev => [...prev, clean]);
    setManualPhone("");
  };

  const handleToggleRotativeLink = (linkGroupIds: string[]) => {
    const allSelected = linkGroupIds.every(id => selectedContacts.includes(id));
    if (allSelected) {
      setSelectedContacts(prev => prev.filter(id => !linkGroupIds.includes(id)));
    } else {
      setSelectedContacts(prev => Array.from(new Set([...prev, ...linkGroupIds])));
    }
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
    const allPhones = isGroupsMode
      ? [...new Set(selectedContacts)]
      : [...new Set([...selectedContacts, ...manualPhones])];
    if (allPhones.length === 0) return;
    const finalProvider: FlowSendProvider = isGroupsMode ? "zapi" : effectiveProvider;
    onConfirm(
      allPhones,
      finalProvider === "zapi" && selectedInstanceIds.length > 0 ? selectedInstanceIds : undefined,
      finalProvider,
      finalProvider === "meta" ? selectedMetaPhoneId : undefined
    );
    onOpenChange(false);
  };

   const totalSelected = (activeWorkspace === "meta" && !isGroupsMode) 
     ? manualPhones.length 
     : new Set([...selectedContacts, ...manualPhones]).size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col z-[100]">
        <DialogHeader>
          <DialogTitle>
            {isGroupsMode ? "Selecionar Grupos" : "Selecionar Contatos"}
          </DialogTitle>
          <DialogDescription>
            {isGroupsMode
              ? "Escolha os grupos do WhatsApp que receberão o fluxo"
              : "Escolha contatos ou digite números manualmente"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className={`grid w-full ${isGroupsMode ? "grid-cols-1" : "grid-cols-2"}`}>
            {isGroupsMode ? (
              <TabsTrigger value="groups" className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                Grupos
                {selectedContacts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {selectedContacts.length}
                  </Badge>
                )}
              </TabsTrigger>
            ) : (
              <>
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
              </>
            )}
          </TabsList>

          {isGroupsMode && (
            <TabsContent value="groups" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar grupo pelo nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedContacts.length === filteredGroups.length && filteredGroups.length > 0 ? "Desmarcar" : "Selecionar"} Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchGroups()}
                  disabled={loadingGroups}
                  title="Sincronizar grupos"
                >
                  {loadingGroups ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1.5">Sincronizar</span>
                </Button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <UsersRound className="h-4 w-4" />
                  {filteredGroups.length} grupos encontrados
                </span>
                <Badge variant="secondary">
                  {selectedContacts.length} selecionados
                </Badge>
              </div>

              {(loadingGroups || loadingLinks) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="flex-1 min-h-0 h-[400px] border rounded-lg">
                  <div className="p-4 space-y-2">
                    {/* Links Rotativos */}
                    {rotativeLinks.map(link => {
                      const q = searchQuery.toLowerCase();
                      const linkFilteredGroups = link.groups.filter(g =>
                        g.group_name.toLowerCase().includes(q) ||
                        link.name.toLowerCase().includes(q)
                      );
                      if (linkFilteredGroups.length === 0) return null;
                      const linkGroupIds = linkFilteredGroups.map(g => g.group_id);
                      const allSelected = linkGroupIds.every(id => selectedContacts.includes(id));
                      return (
                        <div key={link.id} className="mb-2">
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-md mb-1">
                            <Link2 className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary flex-1">{link.name}</span>
                            <span className="text-[10px] text-muted-foreground">/{link.slug}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleToggleRotativeLink(linkGroupIds)}
                            >
                              {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                            </Button>
                          </div>
                          {linkFilteredGroups.map(g => (
                            <div
                              key={`${link.id}-${g.group_id}`}
                              className="flex items-center space-x-3 p-2 pl-6 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                              onClick={() => handleToggleContact(g.group_id)}
                            >
                              <Checkbox
                                checked={selectedContacts.includes(g.group_id)}
                                onCheckedChange={() => handleToggleContact(g.group_id)}
                              />
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <UsersRound className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{g.group_name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {/* Header da seção de Grupos quando há links rotativos */}
                    {rotativeLinks.length > 0 && filteredGroups.length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-md mb-1 mt-2">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">Grupos</span>
                      </div>
                    )}

                    {filteredGroups.length === 0 && rotativeLinks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "Nenhum grupo encontrado" : "Nenhum grupo disponível na sua conexão"}
                      </div>
                    ) : (
                      filteredGroups.map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handleToggleContact(group.id)}
                        >
                          <Checkbox
                            checked={selectedContacts.includes(group.id)}
                            onCheckedChange={() => handleToggleContact(group.id)}
                          />
                          {group.foto ? (
                            <img
                              src={group.foto}
                              alt={group.nome}
                              className="w-9 h-9 rounded-full object-cover bg-muted"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                              <UsersRound className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{group.nome || "Grupo sem nome"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {group.membros || 0} membros
                              {group.sourceInstanceName ? ` · ${group.sourceInstanceName}` : ""}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          )}

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
            {(isGroupsMode || effectiveProvider === "zapi") && (
              <InstanceSelector
                onMultiInstanceChange={(ids) => setSelectedInstanceIds(ids)}
              />
            )}

            {!isGroupsMode && effectiveProvider === "meta" && (
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
            Enviar para {totalSelected} {isGroupsMode ? `grupo${totalSelected !== 1 ? "s" : ""}` : `contato${totalSelected !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
