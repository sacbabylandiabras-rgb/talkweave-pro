import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PerfilWhatsApp = () => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Perfil do WhatsApp</h1>
        <p className="text-muted-foreground mt-2">Gerencie o nome e foto de perfil do seu WhatsApp conectado</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Dados da Conta</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {userName ? userName.charAt(0).toUpperCase() : userEmail.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            {userName && <p className="font-semibold text-foreground">{userName}</p>}
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{userEmail}</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default PerfilWhatsApp;
