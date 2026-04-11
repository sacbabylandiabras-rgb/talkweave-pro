import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { GLOBE_COUNTRY_OUTLINES } from "./globe-country-outlines";

export interface GlobeVisitor {
  sessionId: string;
  ownerUserId: string;
  checkoutSlug: string;
  productName?: string;
  joinedAt?: string;
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
  { lat: -23.5, lon: -46.6, spread: 8 },
  { lat: -22.9, lon: -43.2, spread: 5 },
  { lat: -34.6, lon: -58.4, spread: 6 },
  { lat: 4.7, lon: -74.1, spread: 5 },
  { lat: -15.8, lon: -47.9, spread: 6 },
  { lat: -12.97, lon: -38.5, spread: 5 },
  { lat: 40.7, lon: -74.0, spread: 6 },
  { lat: 19.4, lon: -99.1, spread: 6 },
  { lat: 34.1, lon: -118.2, spread: 5 },
  { lat: 48.9, lon: 2.3, spread: 5 },
  { lat: 51.5, lon: -0.1, spread: 4 },
  { lat: 40.4, lon: -3.7, spread: 5 },
  { lat: 38.7, lon: -9.1, spread: 4 },
  { lat: 6.5, lon: 3.4, spread: 5 },
  { lat: -33.9, lon: 18.4, spread: 4 },
  { lat: 35.7, lon: 139.7, spread: 5 },
  { lat: 28.6, lon: 77.2, spread: 6 },
  { lat: 1.3, lon: 103.8, spread: 3 },
  { lat: -33.9, lon: 151.2, spread: 5 },
];

function createVisitorCoordinates(seed: string) {
  const zoneSeed = hashString(`${seed}-zone`);
  const zone = POPULATION_ZONES[zoneSeed % POPULATION_ZONES.length];
  const latOffset = ((hashString(`${seed}-lat`) % 200) - 100) / 100 * zone.spread;
  const lonOffset = ((hashString(`${seed}-lon`) % 200) - 100) / 100 * zone.spread;
  return { lat: zone.lat + latOffset, lon: zone.lon + lonOffset };
}

function CountryOutlineLines({ geoData }: { geoData: any }) {
  const lineSegments = useMemo(() => {
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
          const step = Math.max(1, Math.floor(ring.length / 180));
          const points: THREE.Vector3[] = [];
          for (let i = 0; i < ring.length; i += step) {
            const [lon, lat] = ring[i];
            points.push(latLonToVec3(lat, lon, 2.01));
          }
          if (points.length > 2) points.push(points[0].clone());
          if (points.length > 1) segments.push(new THREE.BufferGeometry().setFromPoints(points));
        });
      });
    });
    return segments;
  }, [geoData]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.58 }),
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
    () => new THREE.LineBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.07 }),
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
}

function VisitorMarker({ marker, onHover, onLeave }: { marker: MarkerData; onHover: (m: MarkerData) => void; onLeave: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={marker.position.toArray()}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onHover(marker); }}
        onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
      >
        <sphereGeometry args={[0.045, 14, 14]} />
        <meshBasicMaterial color="#34D399" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.085, 14, 14]} />
        <meshBasicMaterial color="#34D399" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function VisitorMarkers({ visitors, onHover, onLeave }: { visitors: GlobeVisitor[]; onHover: (m: MarkerData) => void; onLeave: () => void }) {
  const markers = useMemo(
    () => visitors.map((visitor) => {
      const coords = createVisitorCoordinates(visitor.sessionId);
      return {
        id: visitor.sessionId,
        position: latLonToVec3(coords.lat, coords.lon, 2.08),
        label: visitor.productName || visitor.checkoutSlug || "Visitante",
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
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-md px-3 py-1.5 shadow-lg whitespace-nowrap" style={{ transform: "translateY(-28px)" }}>
        <p className="text-xs font-medium text-foreground">{marker.label}</p>
        <p className="text-[10px] text-muted-foreground">Visitante ativo</p>
      </div>
    </Html>
  );
}

function GlobeGlow() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.05, 2.2, 64]} />
      <meshBasicMaterial color="#22C55E" transparent opacity={0.06} side={THREE.DoubleSide} />
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
      return { key: index, geometry: new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)) };
    });
  }, []);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.18 }),
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
      <CountryOutlineLines geoData={GLOBE_COUNTRY_OUTLINES} />
      <VisitorMarkers visitors={visitors} onHover={onHover} onLeave={onLeave} />
      {hoveredMarker && <TooltipOverlay marker={hoveredMarker} />}
    </group>
  );
}

export default function InteractiveGlobe({ visitors = [] }: { visitors?: GlobeVisitor[] }) {
  const [hoveredMarker, setHoveredMarker] = useState<MarkerData | null>(null);

  const handleHover = useCallback((m: MarkerData) => setHoveredMarker(m), []);
  const handleLeave = useCallback(() => setHoveredMarker(null), []);

  return (
    <div className="w-full h-[380px] relative">
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
