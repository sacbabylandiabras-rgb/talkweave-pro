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
import { Search, Users, Loader2 } from "lucide-react";

interface SelectContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedContacts: string[]) => void;
}

export function SelectContactsDialog({ 
  open, 
  onOpenChange, 
  onConfirm 
}: SelectContactsDialogProps) {
  const { contacts, loading } = useContacts();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedContacts([]);
      setSearchQuery("");
    }
  }, [open]);

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

  const handleConfirm = () => {
    if (selectedContacts.length === 0) return;
    onConfirm(selectedContacts);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Contatos</DialogTitle>
          <DialogDescription>
            Escolha os contatos que receberão o fluxo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedContacts.length === 0}
          >
            Enviar para {selectedContacts.length} contato{selectedContacts.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
