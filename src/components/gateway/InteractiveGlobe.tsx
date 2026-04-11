import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLOBE_COUNTRY_OUTLINES } from "./globe-country-outlines";

const GEOJSON_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

export interface GlobeVisitor {
  sessionId: string;
  ownerUserId: string;
  checkoutSlug: string;
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

function createVisitorCoordinates(seed: string) {
  const latSeed = hashString(`${seed}-lat`);
  const lonSeed = hashString(`${seed}-lon`);
  const lat = (latSeed % 140) - 70;
  const lon = (lonSeed % 360) - 180;
  return { lat, lon };
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

          if (points.length > 2) {
            points.push(points[0].clone());
          }

          if (points.length > 1) {
            segments.push(new THREE.BufferGeometry().setFromPoints(points));
          }
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

function VisitorMarkers({ visitors }: { visitors: GlobeVisitor[] }) {
  const pulseRef = useRef<THREE.Group>(null);

  const markers = useMemo(
    () => visitors.map((visitor) => ({
      id: visitor.sessionId,
      position: latLonToVec3(createVisitorCoordinates(visitor.sessionId).lat, createVisitorCoordinates(visitor.sessionId).lon, 2.08),
    })),
    [visitors]
  );

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;

    const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
    pulseRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={pulseRef}>
      {markers.map((marker) => (
        <group key={marker.id} position={marker.position.toArray()}>
          <mesh>
            <sphereGeometry args={[0.045, 14, 14]} />
            <meshBasicMaterial color="#34D399" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.085, 14, 14]} />
            <meshBasicMaterial color="#34D399" transparent opacity={0.18} />
          </mesh>
        </group>
      ))}
    </group>
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
      return {
        key: index,
        geometry: new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)),
      };
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

function RotatingGlobe({ geoData, visitors }: { geoData: any; visitors: GlobeVisitor[] }) {
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
      {geoData ? <CountryOutlineLines geoData={geoData} /> : null}
      <VisitorMarkers visitors={visitors} />
    </group>
  );
}

export default function InteractiveGlobe({ visitors = [] }: { visitors?: GlobeVisitor[] }) {
  const [geoData, setGeoData] = useState<any>(GLOBE_COUNTRY_OUTLINES);

  useEffect(() => {
    const loadGeoData = async () => {
      try {
        const response = await fetch(GEOJSON_URL);
        if (!response.ok) throw new Error("Falha ao carregar o mapa do globo");
        const data = await response.json();
        setGeoData(data);
      } catch (error) {
        console.warn("Usando mapa local do globo", error);
        setGeoData(GLOBE_COUNTRY_OUTLINES);
      }
    };

    void loadGeoData();
  }, []);

  return (
    <div className="w-full h-[380px] relative">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[10, 10, 10]} intensity={0.55} />
        <RotatingGlobe geoData={geoData} visitors={visitors} />
        <GlobeGlow />
        <ConnectionArcs />
        <OrbitControls enableZoom enablePan={false} minDistance={3.5} maxDistance={8} autoRotate={false} rotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
