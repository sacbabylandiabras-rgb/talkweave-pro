import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Search, MessageSquare, Phone, Filter, RefreshCw, Camera, Globe, Plus } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import ContactProfileDialog from "@/components/contatos/ContactProfileDialog";
import type { Contact } from "@/hooks/useContacts";
import { WhatsAppDefaultAvatar } from "@/components/ui/whatsapp-default-avatar";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useZapi } from "@/hooks/useZapi";
import { getHttpAvatarUrl } from "@/lib/avatar-utils";


const Contatos = () => {
  const { activeWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
   const { contacts, stats, loading, refetch, refreshProfilePicture, forceUpdateAllPhotos } = useContacts();
  const { addContacts } = useZapi();
  const navigate = useNavigate();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const filteredContacts = contacts.filter(contact => 
    contact.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'default';
      case 'inativo': return 'secondary';
      case 'bloqueado': return 'destructive';
      default: return 'secondary';
    }
  };

   const handleOpenProfile = (contact: Contact) => {
     setSelectedContact(contact);
     setProfileOpen(true);
   };
 
   const getInitials = (name: string | undefined, phone: string) => {
     if (name && name !== 'Contato') {
       return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
     }
     return phone.replace(/\D/g, '').slice(-2) || '??';
   };
 
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Contatos</h1>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Buscar contatos por nome, número ou mensagem..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
         <div className="flex gap-2">
           <Button 
             variant="outline" 
             className="flex items-center gap-2"
             onClick={refetch}
             disabled={loading}
             title="Atualizar lista de contatos"
           >
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             Atualizar
           </Button>
           <Button 
             variant="outline" 
             className="flex items-center gap-2"
             onClick={forceUpdateAllPhotos}
             disabled={loading}
             title="Forçar atualização de todas as fotos de perfil"
           >
             <Camera className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             Atualizar Fotos
           </Button>
         </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
        <Button 
          className="flex items-center gap-2"
          onClick={async () => {
            const name = prompt("Nome do contato:");
            const phone = prompt("Número do WhatsApp (com DDD):");
            if (name && phone) {
              await addContacts([{ firstName: name, phone: phone.replace(/\D/g, '') }]);
              refetch();
            }
          }}
        >

          <Plus className="w-4 h-4" />
          Novo Contato
        </Button>
      </div>


      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="ml-2">Carregando contatos...</span>
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum contato encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Nenhum contato corresponde à sua busca.' : 'Ainda não há contatos que interagiram com seu número.'}
            </p>
            <Button onClick={refetch} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar lista
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contato) => (
            <Card key={contato.phone} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleOpenProfile(contato)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border border-border/50 overflow-hidden bg-[#DFE5E7] flex items-center justify-center">
                    {contato.profilePictureUrl ? (
                      <AvatarImage 
                        src={contato.profilePictureUrl} 
                        className="h-full w-full object-cover"
                        onError={() => refreshProfilePicture(contato.phone)}
                      />
                    ) : null}
                    <AvatarFallback className="bg-[#DFE5E7] h-full w-full flex items-center justify-center">
                      <div className="w-full h-full text-white">
                        <WhatsAppDefaultAvatar />
                      </div>
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{contato.name || 'Contato'}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant={getStatusColor(contato.status)}>
                        {contato.status}
                      </Badge>
                      <span className="text-xs">
                        {contato.messageCount} mensagem{contato.messageCount !== 1 ? 's' : ''}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{contato.phone}</span>
                  </div>
                </div>

                {contato.lastMessage && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Última interação:</p>
                    <p className="text-sm text-muted-foreground italic">"{contato.lastMessage}"</p>
                    <p className="text-xs text-muted-foreground">
                      {contato.lastMessageDate ? new Date(contato.lastMessageDate).toLocaleDateString('pt-BR') : ''}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {contato.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {activeWorkspace === "meta" ? (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 flex items-center gap-1" onClick={(e) => { e.stopPropagation(); navigate(`/meta/mensagens?phone=${encodeURIComponent(contato.phone)}`); }}>
                      <Globe className="w-4 h-4" />
                      Conversa Oficial
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 flex items-center gap-1" onClick={(e) => { e.stopPropagation(); navigate(`/mensagens?phone=${encodeURIComponent(contato.phone)}`); }}>
                      <MessageSquare className="w-4 h-4" />
                      Mensagem
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Estatísticas de Contatos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total de Contatos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.inactive}</p>
              <p className="text-sm text-muted-foreground">Inativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
              <p className="text-sm text-muted-foreground">Bloqueados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ContactProfileDialog
        contact={selectedContact}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onUpdate={refetch}
      />
    </div>
  );
};

export default Contatos;
