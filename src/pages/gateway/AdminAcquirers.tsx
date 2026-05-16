import { useState, useEffect } from "react";
import { Settings, TestTube, Loader2, CheckCircle, CreditCard, Power, Users, Search, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyReais } from "./mock-data";
import { toast } from "sonner";

 type Acquirer = "openpix" | "hubpague" | "cartwave" | "pagarme";

interface UserAcquirer {
  id: string;
  email: string | null;
  full_name: string | null;
  pix_acquirer: string | null;
}

export default function AdminAcquirers() {
  const [volumeMonth, setVolumeMonth] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [approvalRate, setApprovalRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [testingWoovi, setTestingWoovi] = useState(false);
  const [testingHubpague, setTestingHubpague] = useState(false);
   const [testingCartwave, setTestingCartwave] = useState(false);
   const [testingPagarme, setTestingPagarme] = useState(false);
  const [activeAcquirer, setActiveAcquirer] = useState<Acquirer>("openpix");
  const [switching, setSwitching] = useState(false);

  const [hubVolumeMonth, setHubVolumeMonth] = useState(0);
  const [hubTxCount, setHubTxCount] = useState(0);
  const [hubApprovalRate, setHubApprovalRate] = useState(0);

  const [cwVolumeMonth, setCwVolumeMonth] = useState(0);
  const [cwTxCount, setCwTxCount] = useState(0);
  const [cwApprovalRate, setCwApprovalRate] = useState(0);

  // Per-user acquirer state
  const [users, setUsers] = useState<UserAcquirer[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingUser, setSavingUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const statsRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-stats`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
        });
        const stats = await statsRes.json();
        const acq = stats?.acquirers || {};

        setVolumeMonth((acq.openpix?.volumeTotal ?? acq.openpix?.volumeMonth ?? 0) / 100);
        setTxCount(acq.openpix?.txCount || 0);
        setApprovalRate(acq.openpix?.approvalRate ?? 100);

        setHubVolumeMonth((acq.hubpague?.volumeTotal ?? acq.hubpague?.volumeMonth ?? 0) / 100);
        setHubTxCount(acq.hubpague?.txCount || 0);
        setHubApprovalRate(acq.hubpague?.approvalRate ?? 100);

        setCwVolumeMonth((acq.cartwave?.volumeTotal ?? acq.cartwave?.volumeMonth ?? 0) / 100);
        setCwTxCount(acq.cartwave?.txCount || 0);
        setCwApprovalRate(acq.cartwave?.approvalRate ?? 100);
      } catch (e) {
        console.error('Failed to load acquirer stats:', e);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-config`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
        });
        const data = await res.json();
        if (data?.active_acquirer) {
          setActiveAcquirer(data.active_acquirer as Acquirer);
        }
      } catch {}

      setLoading(false);
    };

    const fetchUsers = async () => {
      let result = await supabase
        .from("profiles")
        .select("id, email, full_name") as any;
      
      const profiles = (result.data || []) as Array<{ id: string; email: string | null; full_name: string | null }>;
      
      let acquirerMap: Record<string, string | null> = {};
      try {
        const { data: withAcq } = await supabase
          .from("profiles")
          .select("id, pix_acquirer" as any) as any;
        if (withAcq && Array.isArray(withAcq)) {
          for (const row of withAcq) {
            acquirerMap[row.id] = row.pix_acquirer || null;
          }
        }
      } catch {}

      setUsers(profiles.map(p => ({
        ...p,
        pix_acquirer: acquirerMap[p.id] ?? null,
      })));
      setLoadingUsers(false);
    };

    fetchData();
    fetchUsers();
  }, []);

   const acquirerLabel = (acq: string) => {
     if (acq === 'openpix') return 'Woovi (OpenPix)';
     if (acq === 'hubpague') return 'HubPague';
     if (acq === 'cartwave') return 'CartWave';
     if (acq === 'pagarme') return 'Pagar.me';
     return acq;
   };
   const handleTestPagarme = async () => {
     setTestingPagarme(true);
     try {
       const { data: { session } } = await supabase.auth.getSession();
       const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pix-charge`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
           ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
         },
         body: JSON.stringify({ slug: "__test_pagarme__", amount: 100 }),
       });
       const rawBody = await response.text();
       let data: any = null;
       try { data = rawBody ? JSON.parse(rawBody) : null; } catch { data = { error: rawBody }; }
 
       if (response.status === 404 && data?.error === "Checkout not found") {
         toast.success("Conexão com Pagar.me está respondendo corretamente.");
       } else if (response.ok && data?.brCode) {
         toast.success("Conexão com Pagar.me está funcionando!");
       } else if (data?.error?.includes("Pagar.me not configured")) {
         toast.error("PAGARME_API_KEY não está configurado nos secrets.");
       } else {
         toast.error(`Erro ao testar: ${data?.error || `status ${response.status}`}`);
       }
     } catch (e: any) {
       toast.error("Falha no teste: " + (e.message || "erro desconhecido"));
     } finally {
       setTestingPagarme(false);
     }
   };

  const handleSwitchAcquirer = async (acquirer: Acquirer) => {
    if (acquirer === activeAcquirer || switching) return;
    setSwitching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ acquirer }),
      });
      const data = await res.json();
      if (data?.success) {
        setActiveAcquirer(acquirer);
        toast.success(`Adquirente padrão alterada para ${acquirerLabel(acquirer)}`);
      } else {
        toast.error(data?.error || "Erro ao alterar adquirente");
      }
    } catch (e: any) {
      toast.error("Falha ao alterar: " + (e.message || "erro desconhecido"));
    } finally {
      setSwitching(false);
    }
  };

  const handleUserAcquirerChange = async (userId: string, value: string) => {
    setSavingUser(userId);
    const acquirerValue = value === "default" ? null : value;
    const { error } = await supabase
      .from("profiles")
      .update({ pix_acquirer: acquirerValue } as any)
      .eq("id", userId);
    
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, pix_acquirer: acquirerValue } : u));
      const label = acquirerValue ? acquirerLabel(acquirerValue) : 'Padrão da plataforma';
      toast.success(`Adquirente do usuário alterada para: ${label}`);
    }
    setSavingUser(null);
  };

  const handleTestWoovi = async () => {
    setTestingWoovi(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pix-charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ slug: "__test__", amount: 100 }),
      });
      const rawBody = await response.text();
      let data: any = null;
      try { data = rawBody ? JSON.parse(rawBody) : null; } catch { data = { error: rawBody }; }

      if (response.status === 404 && data?.error === "Checkout not found") {
        toast.success("Conexão com a Edge Function e Woovi está respondendo corretamente.");
      } else if (response.ok && data?.qrCodeImage) {
        toast.success("Conexão com Woovi (OpenPix) está funcionando!");
      } else if (data?.error === "OpenPix not configured") {
        toast.error("OPENPIX_APP_ID não está configurado nos secrets do Supabase.");
      } else {
        toast.error(`Erro ao testar: ${data?.error || `status ${response.status}`}`);
      }
    } catch (e: any) {
      toast.error("Falha no teste: " + (e.message || "erro desconhecido"));
    } finally {
      setTestingWoovi(false);
    }
  };

  const handleTestHubpague = async () => {
    setTestingHubpague(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-hubpague-charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ slug: "__test__", amount: 100 }),
      });
      const rawBody = await response.text();
      let data: any = null;
      try { data = rawBody ? JSON.parse(rawBody) : null; } catch { data = { error: rawBody }; }

      if (response.status === 404 && data?.error === "Checkout not found") {
        toast.success("Conexão com HubPague está respondendo corretamente.");
      } else if (response.ok && data?.brCode) {
        toast.success("Conexão com HubPague está funcionando!");
      } else if (data?.error === "HubPague not configured") {
        toast.error("HUBPAGUE_TOKEN não está configurado nos secrets do Supabase.");
      } else {
        toast.error(`Erro ao testar: ${data?.error || `status ${response.status}`}`);
      }
    } catch (e: any) {
      toast.error("Falha no teste: " + (e.message || "erro desconhecido"));
    } finally {
      setTestingHubpague(false);
    }
  };

  const handleTestCartwave = async () => {
    setTestingCartwave(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pix-charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ slug: "__test_cartwave__", amount: 100 }),
      });
      const rawBody = await response.text();
      let data: any = null;
      try { data = rawBody ? JSON.parse(rawBody) : null; } catch { data = { error: rawBody }; }

      if (response.status === 404 && data?.error === "Checkout not found") {
        toast.success("Conexão com CartWave está respondendo corretamente.");
      } else if (response.ok && data?.brCode) {
        toast.success("Conexão com CartWave está funcionando!");
      } else if (data?.error === "CartWave not configured") {
        toast.error("CARTWAVE_CLIENT_ID/SECRET não está configurado nos secrets.");
      } else {
        toast.error(`Erro ao testar: ${data?.error || `status ${response.status}`}`);
      }
    } catch (e: any) {
      toast.error("Falha no teste: " + (e.message || "erro desconhecido"));
    } finally {
      setTestingCartwave(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const isWooviActive = activeAcquirer === "openpix";
  const isHubActive = activeAcquirer === "hubpague";
   const isCartwaveActive = activeAcquirer === "cartwave";
   const isPagarmeActive = activeAcquirer === "pagarme";
         {/* Pagar.me Card */}
         <Card className={`border transition-colors ${isPagarmeActive ? 'border-orange-500/50 shadow-orange-500/10 shadow-lg' : 'border-[#2A2A2A] opacity-60'}`}>
           <CardContent className="p-5 space-y-4">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                   <CreditCard className="w-6 h-6 text-orange-500" />
                 </div>
                 <div>
                   <h3 className="font-semibold">Pagar.me</h3>
                   <span className={`px-2 py-0.5 rounded-full text-[10px] ${isPagarmeActive ? 'text-orange-400 bg-orange-500/10' : 'text-muted-foreground bg-muted'}`}>
                     {isPagarmeActive ? 'Padrão' : 'Inativa'}
                   </span>
                 </div>
               </div>
               <Switch
                 checked={isPagarmeActive}
                 onCheckedChange={() => handleSwitchAcquirer('pagarme')}
                 disabled={switching || isPagarmeActive}
               />
             </div>
 
             <div className="grid grid-cols-3 gap-3">
               <div>
                 <p className="text-[10px] text-muted-foreground">Volume Mês</p>
                 <p className="font-bold text-sm">R$ 0,00</p>
               </div>
               <div>
                 <p className="text-[10px] text-muted-foreground">Transações</p>
                 <p className="font-bold text-sm">0</p>
               </div>
               <div>
                 <p className="text-[10px] text-muted-foreground">Aprovação</p>
                 <p className="font-bold text-sm text-orange-400">-%</p>
               </div>
             </div>
 
             <div className="flex gap-2">
               <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={() => window.open("https://dashboard.pagar.me", "_blank")}>
                 <Settings className="w-3 h-3 mr-1" /> Configurar
               </Button>
               <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={handleTestPagarme} disabled={testingPagarme}>
                 {testingPagarme ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                 Testar
               </Button>
             </div>
           </CardContent>
         </Card>

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (u.email?.toLowerCase().includes(term) || u.full_name?.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Adquirentes</h1>
        <p className="text-sm text-muted-foreground">Gerencie a adquirente padrão e configure por usuário</p>
      </div>

      {/* Active acquirer banner */}
      <div className="p-3 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5 flex items-center gap-3">
        <Power className="w-4 h-4 text-[#a78bfa]" />
        <span className="text-sm">
          Adquirente padrão: <strong>{acquirerLabel(activeAcquirer)}</strong>
          {switching && <Loader2 className="w-3 h-3 inline ml-2 animate-spin" />}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Woovi (OpenPix) Card */}
        <Card className={`border transition-colors ${isWooviActive ? 'border-emerald-500/50 shadow-emerald-500/10 shadow-lg' : 'border-[#2A2A2A] opacity-60'}`}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Woovi (OpenPix)</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${isWooviActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground bg-muted'}`}>
                    {isWooviActive ? 'Padrão' : 'Inativa'}
                  </span>
                </div>
              </div>
              <Switch
                checked={isWooviActive}
                onCheckedChange={() => handleSwitchAcquirer('openpix')}
                disabled={switching || isWooviActive}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Volume Mês</p>
                <p className="font-bold text-sm">{formatCurrencyReais(volumeMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Transações</p>
                <p className="font-bold text-sm">{txCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Aprovação</p>
                <p className="font-bold text-sm text-emerald-400">{approvalRate}%</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={() => window.open("https://app.woovi.com", "_blank")}>
                <Settings className="w-3 h-3 mr-1" /> Configurar
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={handleTestWoovi} disabled={testingWoovi}>
                {testingWoovi ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* HubPague Card */}
        <Card className={`border transition-colors ${isHubActive ? 'border-blue-500/50 shadow-blue-500/10 shadow-lg' : 'border-[#2A2A2A] opacity-60'}`}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">HubPague</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${isHubActive ? 'text-blue-400 bg-blue-500/10' : 'text-muted-foreground bg-muted'}`}>
                    {isHubActive ? 'Padrão' : 'Inativa'}
                  </span>
                </div>
              </div>
              <Switch
                checked={isHubActive}
                onCheckedChange={() => handleSwitchAcquirer('hubpague')}
                disabled={switching || isHubActive}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Volume Mês</p>
                <p className="font-bold text-sm">{formatCurrencyReais(hubVolumeMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Transações</p>
                <p className="font-bold text-sm">{hubTxCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Aprovação</p>
                <p className="font-bold text-sm text-blue-400">{hubApprovalRate}%</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={() => window.open("https://app.hubpague.io", "_blank")}>
                <Settings className="w-3 h-3 mr-1" /> Configurar
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={handleTestHubpague} disabled={testingHubpague}>
                {testingHubpague ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CartWave Card */}
        <Card className={`border transition-colors ${isCartwaveActive ? 'border-purple-500/50 shadow-purple-500/10 shadow-lg' : 'border-[#2A2A2A] opacity-60'}`}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Waves className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold">CartWave</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${isCartwaveActive ? 'text-purple-400 bg-purple-500/10' : 'text-muted-foreground bg-muted'}`}>
                    {isCartwaveActive ? 'Padrão' : 'Inativa'}
                  </span>
                </div>
              </div>
              <Switch
                checked={isCartwaveActive}
                onCheckedChange={() => handleSwitchAcquirer('cartwave')}
                disabled={switching || isCartwaveActive}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Volume Mês</p>
                <p className="font-bold text-sm">{formatCurrencyReais(cwVolumeMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Transações</p>
                <p className="font-bold text-sm">{cwTxCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Aprovação</p>
                <p className="font-bold text-sm text-purple-400">{cwApprovalRate}%</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={() => window.open("https://cartwave.com.br", "_blank")}>
                <Settings className="w-3 h-3 mr-1" /> Configurar
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={handleTestCartwave} disabled={testingCartwave}>
                {testingCartwave ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-user acquirer assignment */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-sm">Adquirente por Usuário</h3>
                <p className="text-xs text-muted-foreground">Defina qual adquirente cada usuário vai usar. "Padrão" usa a adquirente global.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Usuário</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Adquirente</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{user.full_name || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{user.email || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Select
                            value={user.pix_acquirer || "default"}
                            onValueChange={v => handleUserAcquirerChange(user.id, v)}
                            disabled={savingUser === user.id}
                          >
                            <SelectTrigger className="w-48 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">
                                🔄 Padrão ({acquirerLabel(activeAcquirer)})
                              </SelectItem>
                              <SelectItem value="openpix">🟢 Woovi (OpenPix)</SelectItem>
                              <SelectItem value="hubpague">🔵 HubPague</SelectItem>
                              <SelectItem value="cartwave">🟣 CartWave</SelectItem>
                            </SelectContent>
                          </Select>
                          {savingUser === user.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-sm">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="p-4 rounded-lg border border-[#2A2A2A] bg-muted/30">
          <h3 className="text-sm font-semibold mb-2">📌 Webhook do HubPague</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Configure a URL abaixo como webhook no painel do HubPague em{" "}
            <a href="https://app.hubpague.io/integrations" target="_blank" className="text-blue-400 underline">Integrações</a>:
          </p>
          <code className="text-xs bg-background px-3 py-2 rounded border border-[#2A2A2A] block break-all">
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-hubpague
          </code>
        </div>

        <div className="p-4 rounded-lg border border-[#2A2A2A] bg-muted/30">
          <h3 className="text-sm font-semibold mb-2">📌 Webhook da CartWave</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Configure a URL abaixo como webhook no painel da CartWave:
          </p>
          <code className="text-xs bg-background px-3 py-2 rounded border border-[#2A2A2A] block break-all">
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-cartwave
          </code>
        </div>
      </div>
    </div>
  );
}
