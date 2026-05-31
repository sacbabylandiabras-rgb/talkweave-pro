/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search,
  Star,
  Phone,
  Globe,
  Download,
  MapPin,
  Loader2,
  Bookmark,
  Copy,
  Trash2,
  MessageCircle,
  List as ListIcon,
  Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GOOGLE_MAPS_API_KEY = "AIzaSyDlWKfmiRkSnNyzmgrwRtR0ni4e2TuY8_E";
const LEADS_STORAGE_KEY = "prospeccao_leads_salvos";

interface Place {
  id: string;
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
  website?: string;
  openNow?: boolean;
  businessStatus?: string;
  location: { lat: number; lng: number };
}

interface SavedLead extends Place {
  savedAt: string;
}

const RADIUS_OPTIONS = [
  { label: "1 km", value: "1000" },
  { label: "2 km", value: "2000" },
  { label: "5 km", value: "5000" },
  { label: "10 km", value: "10000" },
  { label: "25 km", value: "25000" },
];

function toCsv(rows: Array<Record<string, string | number | undefined>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatPhoneForWhatsapp(phone?: string) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function Prospeccao() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState("5000");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [tab, setTab] = useState<"results" | "saved">("results");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  // Load saved leads
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEADS_STORAGE_KEY);
      if (raw) setSavedLeads(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

  const persistLeads = (leads: SavedLead[]) => {
    setSavedLeads(leads);
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  };

  // Init Google Maps
  useEffect(() => {
    setOptions({ key: GOOGLE_MAPS_API_KEY, v: "weekly" });
    Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
      importLibrary("places"),
    ]).then(([{ Map, InfoWindow }]) => {
      if (!mapDivRef.current) return;
      mapRef.current = new Map(mapDivRef.current, {
        center: { lat: -14.235, lng: -51.9253 }, // Brasil
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new InfoWindow();
      setMapsReady(true);
    }).catch((e) => {
      console.error(e);
      toast.error("Falha ao carregar o mapa");
    });
  }, []);

  // Render markers when results change
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    // clear
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    clustererRef.current?.clearMarkers();

    if (!results.length) return;

    const bounds = new google.maps.LatLngBounds();
    const markers = results.map((p) => {
      const marker = new google.maps.Marker({
        position: p.location,
        title: p.name,
      });
      marker.addListener("click", () => {
        setSelectedId(p.id);
        openInfo(p, marker);
      });
      bounds.extend(p.location);
      return marker;
    });
    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({ map: mapRef.current, markers });
    mapRef.current.fitBounds(bounds, 60);
  }, [results, mapsReady]);

  const openInfo = (p: Place, marker: google.maps.Marker) => {
    if (!infoWindowRef.current || !mapRef.current) return;
    const waPhone = formatPhoneForWhatsapp(p.phone);
    const content = `
      <div style="font-family: inherit; max-width: 280px; padding: 4px;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${escapeHtml(p.name)}</div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${escapeHtml(p.address)}</div>
        ${p.rating ? `<div style="font-size: 12px; margin-bottom: 4px;">⭐ ${p.rating} (${p.userRatingCount ?? 0})</div>` : ""}
        ${p.phone ? `<div style="font-size: 12px; margin-bottom: 4px;">📞 <a href="https://wa.me/${waPhone}" target="_blank" rel="noopener" style="color: hsl(var(--primary));">${escapeHtml(p.phone)}</a></div>` : ""}
        ${p.website ? `<div style="font-size: 12px; margin-bottom: 6px;">🌐 <a href="${p.website}" target="_blank" rel="noopener" style="color: hsl(var(--primary));">Site</a></div>` : ""}
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button id="iw-save-${p.id}" style="flex:1; padding:6px 8px; font-size:12px; background:hsl(var(--primary)); color:white; border:none; border-radius:6px; cursor:pointer;">Salvar Lead</button>
          <button id="iw-copy-${p.id}" style="flex:1; padding:6px 8px; font-size:12px; background:transparent; color:hsl(var(--foreground)); border:1px solid hsl(var(--border)); border-radius:6px; cursor:pointer;">Copiar</button>
        </div>
      </div>`;
    infoWindowRef.current.setContent(content);
    infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
    mapRef.current.panTo(p.location);
    google.maps.event.addListenerOnce(infoWindowRef.current, "domready", () => {
      document.getElementById(`iw-save-${p.id}`)?.addEventListener("click", () => saveLead(p));
      document.getElementById(`iw-copy-${p.id}`)?.addEventListener("click", () => copyContact(p));
    });
  };

  const handleCardClick = (p: Place) => {
    setSelectedId(p.id);
    const marker = markersRef.current.find((m) => m.getTitle() === p.name && m.getPosition()?.lat() === p.location.lat);
    if (marker && mapRef.current) {
      mapRef.current.panTo(p.location);
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 14, 15));
      openInfo(p, marker);
    }
    if (window.innerWidth < 768) setMobileView("map");
  };

  const saveLead = (p: Place) => {
    if (savedLeads.some((l) => l.id === p.id)) {
      toast.info("Lead já está salvo");
      return;
    }
    const lead: SavedLead = { ...p, savedAt: new Date().toISOString() };
    persistLeads([lead, ...savedLeads]);
    toast.success("Lead salvo");
  };

  const removeLead = (id: string) => {
    persistLeads(savedLeads.filter((l) => l.id !== id));
  };

  const copyContact = async (p: Place) => {
    const text = [p.name, p.address, p.phone, p.website].filter(Boolean).join(" | ");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Contato copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Informe o que você procura");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      if (!mapsReady) {
        toast.error("Aguarde o mapa carregar para buscar");
        return;
      }

      let center: { lat: number; lng: number } | null = null;
      if (city.trim()) {
        const geocoder = new google.maps.Geocoder();
        const { results: geoResults } = await geocoder.geocode({
          address: city,
          region: "BR",
        });
        const loc = geoResults?.[0]?.geometry?.location;
        if (loc) center = { lat: loc.lat(), lng: loc.lng() };
      }

      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      const request: google.maps.places.SearchByTextRequest = {
        textQuery: city.trim() ? `${query} em ${city}` : query,
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "nationalPhoneNumber",
          "rating",
          "userRatingCount",
          "websiteURI",
          "regularOpeningHours",
          "utcOffsetMinutes",
          "businessStatus",
          "location",
        ],
        language: "pt-BR",
        region: "BR",
        maxResultCount: 20,
      };
      if (center) {
        request.locationBias = {
          center,
          radius: Number(radius),
        };
      }

      const { places: searchResults } = await Place.searchByText(request);
      const places: Place[] = await Promise.all((searchResults ?? []).filter((p) => p.location).map(async (p) => ({
        id: p.id,
        name: p.displayName ?? "Sem nome",
        address: p.formattedAddress ?? "",
        phone: p.nationalPhoneNumber,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        website: p.websiteURI,
        openNow: await p.isOpen().catch(() => undefined),
        businessStatus: p.businessStatus,
        location: {
          lat: p.location!.lat(),
          lng: p.location!.lng(),
        },
      })));
      setResults(places);
      setTab("results");
      if (!places.length) toast.info("Nenhum resultado encontrado");
    } catch (e) {
      console.error(e);
      toast.error("Erro na busca");
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    if (!results.length) return;
    const rows = results.map((p) => ({
      Nome: p.name,
      Telefone: p.phone ?? "",
      Endereço: p.address,
      Site: p.website ?? "",
      Avaliação: p.rating ?? "",
      "Nº de Reviews": p.userRatingCount ?? "",
      Status: p.openNow === undefined ? "" : p.openNow ? "Aberto" : "Fechado",
    }));
    downloadCsv(`prospeccao_${Date.now()}.csv`, toCsv(rows));
  };

  const exportSaved = () => {
    if (!savedLeads.length) return;
    const rows = savedLeads.map((p) => ({
      Nome: p.name,
      Telefone: p.phone ?? "",
      Endereço: p.address,
      Site: p.website ?? "",
      Avaliação: p.rating ?? "",
      "Salvo em": new Date(p.savedAt).toLocaleString("pt-BR"),
    }));
    downloadCsv(`leads_salvos_${Date.now()}.csv`, toCsv(rows));
  };

  const listPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b bg-card space-y-3 shrink-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "results" | "saved")}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="results">Resultados</TabsTrigger>
            <TabsTrigger value="saved">
              Leads Salvos{savedLeads.length ? ` (${savedLeads.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "results" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="query">O que você procura?</Label>
              <Input
                id="query"
                placeholder='Ex: "Dentistas", "Academias"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade ou bairro</Label>
              <Input
                id="city"
                placeholder='Ex: "Moema, São Paulo"'
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label>Raio</Label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
            {results.length > 0 && (
              <Button variant="outline" onClick={exportResults} className="w-full">
                <Download className="h-4 w-4 mr-2" /> Exportar contatos (.csv)
              </Button>
            )}
          </>
        )}

        {tab === "saved" && savedLeads.length > 0 && (
          <Button variant="outline" onClick={exportSaved} className="w-full">
            <Download className="h-4 w-4 mr-2" /> Exportar Leads (.csv)
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {tab === "results" && loading && (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </>
        )}
        {tab === "results" && !loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
            <MapPin className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Faça uma busca para ver empresas próximas</p>
          </div>
        )}
        {tab === "results" && results.map((p) => (
          <button
            key={p.id}
            onClick={() => handleCardClick(p)}
            className={cn(
              "w-full text-left p-3 rounded-lg border bg-card transition-all hover:shadow-sm hover:border-primary/50",
              selectedId === p.id && "border-primary shadow-sm ring-1 ring-primary"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-semibold text-sm leading-tight">{p.name}</div>
              {p.openNow !== undefined && (
                <Badge variant={p.openNow ? "default" : "destructive"} className="shrink-0 text-[10px] h-5">
                  {p.openNow ? "Aberto" : "Fechado"}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mb-2 line-clamp-2">{p.address}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {p.rating !== undefined && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {p.rating} ({p.userRatingCount ?? 0})
                </span>
              )}
              {p.phone && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>
              )}
              {p.website && (
                <a
                  href={p.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-3 w-3" /> Site
                </a>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); saveLead(p); }}>
                <Bookmark className="h-3 w-3 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); copyContact(p); }}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
              {p.phone && (
                <a
                  href={`https://wa.me/${formatPhoneForWhatsapp(p.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                  </Button>
                </a>
              )}
            </div>
          </button>
        ))}

        {tab === "saved" && savedLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
            <Bookmark className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum lead salvo ainda</p>
          </div>
        )}
        {tab === "saved" && savedLeads.map((p) => (
          <div key={p.id} className="p-3 rounded-lg border bg-card">
            <div className="font-semibold text-sm mb-1">{p.name}</div>
            <div className="text-xs text-muted-foreground mb-2">{p.address}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
              {p.website && (
                <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Globe className="h-3 w-3" /> Site
                </a>
              )}
              <span className="text-[10px]">Salvo em {new Date(p.savedAt).toLocaleDateString("pt-BR")}</span>
            </div>
            <div className="flex gap-2 mt-3">
              {p.phone && (
                <a href={`https://wa.me/${formatPhoneForWhatsapp(p.phone)}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="default" className="h-7 text-xs">
                    <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                  </Button>
                </a>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => removeLead(p.id)}>
                <Trash2 className="h-3 w-3 mr-1" /> Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const mapPanel = (
    <div className="relative w-full h-full bg-muted">
      <div ref={mapDivRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] -m-4 md:-m-6 flex flex-col">
      {/* Mobile tabs */}
      <div className="md:hidden border-b bg-card flex shrink-0">
        <button
          onClick={() => setMobileView("list")}
          className={cn("flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2", mobileView === "list" ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
        >
          <ListIcon className="h-4 w-4" /> Lista
        </button>
        <button
          onClick={() => setMobileView("map")}
          className={cn("flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2", mobileView === "map" ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
        >
          <MapIcon className="h-4 w-4" /> Mapa
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Desktop: side by side */}
        <div className={cn("w-full md:w-2/5 md:border-r min-h-0", mobileView === "list" ? "block" : "hidden md:block")}>
          {listPanel}
        </div>
        <div className={cn("w-full md:w-3/5 min-h-0", mobileView === "map" ? "block" : "hidden md:block")}>
          {mapPanel}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}