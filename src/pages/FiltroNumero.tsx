import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Filter, Plus, Trash2, Check, X, Upload } from "lucide-react";

const FiltroNumero = () => {
  const [filtroAtivo, setFiltroAtivo] = useState(true);
  
  const filtros = [
    {
      id: 1,
      nome: "Números Internacionais",
      tipo: "bloquear",
      regra: "Números que não começam com +55",
      ativo: true,
      numerosAfetados: 45
    },
    {
      id: 2,
      nome: "Lista Negra Personalizada",
      tipo: "bloquear",
      regra: "Lista de números específicos bloqueados",
      ativo: true,
      numerosAfetados: 23
    },
    {
      id: 3,
      nome: "Apenas Clientes VIP",
      tipo: "permitir",
      regra: "Apenas números da lista VIP",
      ativo: false,
      numerosAfetados: 78
    }
  ];

  const numerosRecentes = [
    { numero: "+55 11 99999-9999", status: "permitido", filtro: "Padrão" },
    { numero: "+1 555 123-4567", status: "bloqueado", filtro: "Números Internacionais" },
    { numero: "+55 11 88888-8888", status: "permitido", filtro: "Lista VIP" },
    { numero: "+55 11 77777-7777", status: "bloqueado", filtro: "Lista Negra" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Filtro de Número</h1>
        <p className="text-muted-foreground">Configure filtros para controlar quais números podem enviar mensagens</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Sistema de Filtros
              </CardTitle>
              <CardDescription>
                Ative ou desative o sistema de filtragem de números
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="filtro-ativo">Sistema Ativo</Label>
              <Switch 
                id="filtro-ativo"
                checked={filtroAtivo}
                onCheckedChange={setFiltroAtivo}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Números Permitidos</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">1,247</div>
            <p className="text-xs text-muted-foreground">
              +23 hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Números Bloqueados</CardTitle>
            <X className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">68</div>
            <p className="text-xs text-muted-foreground">
              +5 hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Bloqueio</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5.2%</div>
            <p className="text-xs text-muted-foreground">
              -0.5% desde ontem
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Filtros Configurados</h2>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Filtro
        </Button>
      </div>

      <div className="space-y-4">
        {filtros.map((filtro) => (
          <Card key={filtro.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={filtro.tipo === 'bloquear' ? 'destructive' : 'default'}>
                    {filtro.tipo === 'bloquear' ? 'Bloquear' : 'Permitir'}
                  </Badge>
                  <div>
                    <CardTitle className="text-base">{filtro.nome}</CardTitle>
                    <CardDescription>{filtro.regra}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {filtro.numerosAfetados} números
                  </span>
                  <Switch checked={filtro.ativo} />
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Filtro</CardTitle>
          <CardDescription>Configure um novo filtro de números</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome-filtro">Nome do Filtro</Label>
              <Input 
                id="nome-filtro"
                placeholder="Ex: Números Empresariais"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tipo-filtro">Tipo de Filtro</Label>
              <select className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md">
                <option value="bloquear">Bloquear</option>
                <option value="permitir">Permitir</option>
              </select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="regra-filtro">Regra do Filtro</Label>
            <Textarea 
              id="regra-filtro"
              placeholder="Descreva a regra do filtro..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="numeros-filtro">Lista de Números (um por linha)</Label>
            <Textarea 
              id="numeros-filtro"
              placeholder="+55 11 99999-9999
+55 11 88888-8888"
              className="mt-1 min-h-[100px]"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importar Lista
            </Button>
            <Button>
              Criar Filtro
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Números processados pelo filtro nas últimas 24 horas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {numerosRecentes.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {item.status === 'permitido' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                  <span className="font-mono">{item.numero}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === 'permitido' ? 'default' : 'destructive'}>
                    {item.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{item.filtro}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FiltroNumero;