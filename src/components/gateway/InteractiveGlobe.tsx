import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { WORLD_COUNTRY_OUTLINES } from "./world-country-outlines";

export interface GlobeVisitor {
  sessionId: string;
  ownerUserId: string;
  checkoutSlug: string;
  productName?: string;
  joinedAt?: string;
  latitude?: number;
  longitude?: number;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
}

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function hashString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

const POPULATION_ZONES = [
  // Spread kept small (<=1.5°) so fallback markers stay over land near city centers,
  // never drifting into the ocean or neighboring countries.
  { lat: -23.5, lon: -46.6, spread: 1.2 },
  { lat: -22.9, lon: -43.2, spread: 0.8 },
  { lat: -15.8, lon: -47.9, spread: 1.0 },
  { lat: -19.9, lon: -43.9, spread: 1.0 },
  { lat: -25.4, lon: -49.2, spread: 1.0 },
  { lat: -3.7, lon: -38.5, spread: 1.0 },
  { lat: -8.0, lon: -34.9, spread: 0.8 },
  { lat: -12.97, lon: -38.5, spread: 0.8 },
  { lat: -30.0, lon: -51.2, spread: 1.0 },
  { lat: -16.7, lon: -49.3, spread: 1.0 },
];

function createFallbackCoordinates(seed: string) {
  const zoneSeed = hashString(`${seed}-zone`);
  const zone = POPULATION_ZONES[zoneSeed % POPULATION_ZONES.length];
  const latOffset = (((hashString(`${seed}-lat`) % 200) - 100) / 100) * zone.spread;
  const lonOffset = (((hashString(`${seed}-lon`) % 200) - 100) / 100) * zone.spread;

  return { lat: zone.lat + latOffset, lon: zone.lon + lonOffset };
}

function resolveVisitorCoordinates(visitor: GlobeVisitor) {
  if (typeof visitor.latitude === "number" && typeof visitor.longitude === "number") {
    return { lat: visitor.latitude, lon: visitor.longitude };
  }

  return createFallbackCoordinates(visitor.sessionId);
}

function CountryOutlineLines() {
  const lineSegments = useMemo(() => {
    const geoData = WORLD_COUNTRY_OUTLINES as any;
    if (!geoData?.features) return [] as THREE.BufferGeometry[];

    const segments: THREE.BufferGeometry[] = [];

    geoData.features.forEach((feature: any) => {
      const geometry = feature.geometry;
      if (!geometry) return;

      const polygons = geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : [];

      polygons.forEach((polygon: number[][][]) => {
        polygon.forEach((ring: number[][]) => {
          if (!Array.isArray(ring) || ring.length < 2) return;

          const step = Math.max(1, Math.floor(ring.length / 240));
          const points: THREE.Vector3[] = [];

          for (let i = 0; i < ring.length; i += step) {
            const [lon, lat] = ring[i];
            points.push(latLonToVec3(lat, lon, 2.01));
          }

          if (points.length > 2) {
            points.push(points[0].clone());
            segments.push(new THREE.BufferGeometry().setFromPoints(points));
          }
        });
      });
    });

    return segments;
  }, []);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.52 }),
    []
  );

  return (
    <>
      {lineSegments.map((geometry, index) => (
        <primitive key={index} object={new THREE.Line(geometry, material)} />
      ))}
    </>
  );
}

function GridLines() {
  const lines = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const radius = 2.005;

    for (let lat = -60; lat <= 60; lat += 30) {
      const points: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        points.push(latLonToVec3(lat, lon, radius));
      }
      geometries.push(new THREE.BufferGeometry().setFromPoints(points));
    }

    for (let lon = -180; lon < 180; lon += 30) {
      const points: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        points.push(latLonToVec3(lat, lon, radius));
      }
      geometries.push(new THREE.BufferGeometry().setFromPoints(points));
    }

    return geometries;
  }, []);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.07 }),
    []
  );

  return (
    <>
      {lines.map((geometry, index) => (
        <primitive key={index} object={new THREE.Line(geometry, material)} />
      ))}
    </>
  );
}

interface MarkerData {
  id: string;
  position: THREE.Vector3;
  label: string;
  ip?: string;
  location?: string;
}

function VisitorMarker({ marker, onHover, onLeave }: { marker: MarkerData; onHover: (m: MarkerData) => void; onLeave: () => void }) {
  const pulseRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
    pulseRef.current.scale.setScalar(scale);
  });

  return (
    <group position={marker.position.toArray()}>
      <group
        ref={pulseRef}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(marker);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          onLeave();
        }}
      >
        <mesh>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#FF7856" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color="#FF7856" transparent opacity={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function VisitorMarkers({ visitors, onHover, onLeave }: { visitors: GlobeVisitor[]; onHover: (m: MarkerData) => void; onLeave: () => void }) {
  const markers = useMemo(
    () => visitors.map((visitor) => {
      const coords = resolveVisitorCoordinates(visitor);
      const locationParts = [visitor.city, visitor.region, visitor.country].filter(Boolean);
      return {
        id: visitor.sessionId,
        position: latLonToVec3(coords.lat, coords.lon, 2.08),
        label: visitor.productName || visitor.checkoutSlug || "Visitante",
        ip: visitor.ip,
        location: locationParts.join(", "),
      };
    }),
    [visitors]
  );

  return (
    <group>
      {markers.map((marker) => (
        <VisitorMarker key={marker.id} marker={marker} onHover={onHover} onLeave={onLeave} />
      ))}
    </group>
  );
}

function TooltipOverlay({ marker }: { marker: MarkerData }) {
  return (
    <Html position={marker.position.toArray()} distanceFactor={6} zIndexRange={[100, 0]} style={{ pointerEvents: "none" }}>
      <div className="rounded-md border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm whitespace-nowrap" style={{ transform: "translateY(-28px)" }}>
        <p className="text-xs font-medium text-foreground">{marker.label}</p>
        {marker.ip && (
          <p className="text-[10px] text-muted-foreground mt-0.5">IP: {marker.ip}</p>
        )}
        {marker.location && (
          <p className="text-[10px] text-muted-foreground">{marker.location}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">Visitante ativo</p>
      </div>
    </Html>
  );
}

function GlobeGlow() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.05, 2.2, 64]} />
      <meshBasicMaterial color="#a78bfa" transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ConnectionArcs() {
  const arcs = useMemo(() => {
    const pairs = [
      { from: [-0.8, 0.8, 1.6], to: [1.2, 1.0, -1.0] },
      { from: [-1.5, 0.3, 0.8], to: [0.5, -0.8, 1.5] },
      { from: [1.0, 1.3, 0.8], to: [-0.8, -0.5, -1.5] },
    ];

    return pairs.map((pair, index) => {
      const start = new THREE.Vector3(...(pair.from as [number, number, number]));
      const end = new THREE.Vector3(...(pair.to as [number, number, number]));
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(3.5);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      return {
        key: index,
        geometry: new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)),
      };
    });
  }, []);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.18 }),
    []
  );

  return (
    <>
      {arcs.map((arc) => (
        <primitive key={arc.key} object={new THREE.Line(arc.geometry, material)} />
      ))}
    </>
  );
}

function RotatingGlobe({ visitors, hoveredMarker, onHover, onLeave }: {
  visitors: GlobeVisitor[];
  hoveredMarker: MarkerData | null;
  onHover: (m: MarkerData) => void;
  onLeave: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial color="#0d1117" transparent opacity={0.92} />
      </mesh>
      <GridLines />
      <CountryOutlineLines />
      <VisitorMarkers visitors={visitors} onHover={onHover} onLeave={onLeave} />
      {hoveredMarker && <TooltipOverlay marker={hoveredMarker} />}
    </group>
  );
}

export default function InteractiveGlobe({ visitors = [] }: { visitors?: GlobeVisitor[] }) {
  const [hoveredMarker, setHoveredMarker] = useState<MarkerData | null>(null);

  const handleHover = useCallback((marker: MarkerData) => setHoveredMarker(marker), []);
  const handleLeave = useCallback(() => setHoveredMarker(null), []);

  return (
    <div className="relative h-[380px] w-full">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[10, 10, 10]} intensity={0.55} />
        <RotatingGlobe visitors={visitors} hoveredMarker={hoveredMarker} onHover={handleHover} onLeave={handleLeave} />
        <GlobeGlow />
        <ConnectionArcs />
        <OrbitControls enableZoom enablePan={false} minDistance={3.5} maxDistance={8} autoRotate={false} rotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
