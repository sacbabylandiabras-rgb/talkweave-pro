import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const GEOJSON_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

/* Convert lat/lon to 3D point on sphere */
function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/* Parse GeoJSON and create line segments for country borders */
function CountryLines({ geoData }: { geoData: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 2.01;

  const lineSegments = useMemo(() => {
    if (!geoData?.features) return [];

    const segments: THREE.BufferGeometry[] = [];

    geoData.features.forEach((feature: any) => {
      const geom = feature.geometry;
      if (!geom) return;

      let polygons: number[][][][] = [];

      if (geom.type === "Polygon") {
        polygons = [geom.coordinates];
      } else if (geom.type === "MultiPolygon") {
        polygons = geom.coordinates;
      }

      polygons.forEach((polygon) => {
        polygon.forEach((ring) => {
          // Sample every Nth point for performance
          const step = Math.max(1, Math.floor(ring.length / 200));
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i < ring.length; i += step) {
            const [lon, lat] = ring[i];
            pts.push(latLonToVec3(lat, lon, radius));
          }
          // Close the ring
          if (pts.length > 2) {
            pts.push(pts[0].clone());
          }
          if (pts.length > 1) {
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            segments.push(geo);
          }
        });
      });
    });

    return segments;
  }, [geoData]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.6 }),
    []
  );

  return (
    <group ref={groupRef}>
      {/* Base sphere (dark) */}
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial color="#0d1117" transparent opacity={0.9} />
      </mesh>
      {/* Grid lines */}
      <GridLines />
      {/* Country outlines */}
      {lineSegments.map((geo, i) => (
        <primitive key={i} object={new THREE.Line(geo, material)} />
      ))}
    </group>
  );
}

/* Subtle lat/lon grid */
function GridLines() {
  const lines = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const r = 2.005;

    // Latitude lines every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 5) {
        pts.push(latLonToVec3(lat, lon - 180, r));
      }
      geos.push(new THREE.BufferGeometry().setFromPoints(pts));
    }

    // Longitude lines every 30°
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        pts.push(latLonToVec3(lat, lon, r));
      }
      geos.push(new THREE.BufferGeometry().setFromPoints(pts));
    }

    return geos;
  }, []);

  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.07 }),
    []
  );

  return (
    <>
      {lines.map((g, i) => (
        <primitive key={i} object={new THREE.Line(g, mat)} />
      ))}
    </>
  );
}

/* Glow ring */
function GlobeGlow() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.05, 2.2, 64]} />
      <meshBasicMaterial color="#22C55E" transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* Connection arcs */
function ConnectionArcs() {
  const arcs = useMemo(() => {
    const pairs = [
      { from: [-0.8, 0.8, 1.6], to: [1.2, 1.0, -1.0] },
      { from: [-1.5, 0.3, 0.8], to: [0.5, -0.8, 1.5] },
      { from: [1.0, 1.3, 0.8], to: [-0.8, -0.5, -1.5] },
    ];
    return pairs.map((p, idx) => {
      const start = new THREE.Vector3(...(p.from as [number, number, number]));
      const end = new THREE.Vector3(...(p.to as [number, number, number]));
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(3.5);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const pts = curve.getPoints(50);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return { geo, key: idx };
    });
  }, []);

  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.25 }),
    []
  );

  return (
    <>
      {arcs.map((a) => (
        <primitive key={a.key} object={new THREE.Line(a.geo, mat)} />
      ))}
    </>
  );
}

export default function InteractiveGlobe() {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then(setGeoData)
      .catch(console.error);
  }, []);

  return (
    <div className="w-full h-[380px] relative">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        {geoData ? <CountryLines geoData={geoData} /> : null}
        <GlobeGlow />
        <ConnectionArcs />
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3.5}
          maxDistance={8}
          autoRotate={false}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
