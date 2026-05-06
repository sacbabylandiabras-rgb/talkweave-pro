import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { Users, Search, MessageSquare, Phone, Filter, RefreshCw, Camera } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import ContactProfileDialog from "@/components/contatos/ContactProfileDialog";
import type { Contact } from "@/hooks/useContacts";

const WhatsAppDefaultAvatar = () => (
  <svg viewBox="0 0 212 212" className="w-full h-full text-white">
    <path fill="currentColor" d="M106.251 0.5C164.653 0.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 0.5 164.654 0.5 106.25S47.846 0.5 106.251 0.5Z" />
    <path fill="#ccc" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.623 0 52.661-11058 70.945-28.985v-.398s-.26-.61-.818-1.678a47.572 47.572 0 0 0-1.07-1.926c-.031-.055-.071-.118-.104-.174a56.024 56.024 0 0 0-1.447-2.324Z" />
    <path fill="#ccc" d="M106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-1.215-5.494 36.68 36.68 0 0 0-3.648-8.298 35.923 35.923 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342Z" />
  </svg>
);

const Contatos = () => {
  const [searchTerm, setSearchTerm] = useState("");
   const { contacts, stats, loading, refetch, refreshProfilePicture, forceUpdateAllPhotos } = useContacts();
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

      <div className="flex gap-4">
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
                   <Avatar className="overflow-hidden bg-[#DFE5E7]">
                     <AvatarImage 
                       src={contato.profilePictureUrl || undefined} 
                       className="object-cover"
                       onError={() => refreshProfilePicture(contato.phone)}
                     />
                     <AvatarFallback className="text-primary text-xs font-medium">
                       <WhatsAppDefaultAvatar />
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

                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1 flex items-center gap-1" onClick={(e) => { e.stopPropagation(); navigate(`/mensagens?phone=${encodeURIComponent(contato.phone)}`); }}>
                    <MessageSquare className="w-4 h-4" />
                    Mensagem
                  </Button>
                </div>
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
