import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ---- Dotted-sphere globe ---- */
function DottedGlobe() {
  const meshRef = useRef<THREE.Points>(null);

  // Generate points on a sphere that approximate land masses
  const geometry = useMemo(() => {
    const points: number[] = [];
    const colors: number[] = [];
    const radius = 2;
    const dotCount = 12000;
    const green = new THREE.Color("#22C55E");
    const dim = new THREE.Color("#1a4a2e");

    for (let i = 0; i < dotCount; i++) {
      // Golden-angle spiral for even distribution
      const y = 1 - (i / (dotCount - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = ((Math.sqrt(5) + 1) / 2 - 1) * Math.PI * 2 * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Pseudo-land filter using noise-like formula
      const lat = Math.asin(y) * (180 / Math.PI);
      const lon = Math.atan2(z, x) * (180 / Math.PI);

      const isLand = pseudoLand(lat, lon);
      if (!isLand && Math.random() > 0.08) continue; // keep sparse ocean dots

      points.push(x * radius, y * radius, z * radius);
      const color = isLand ? green : dim;
      colors.push(color.r, color.g, color.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial size={0.035} vertexColors sizeAttenuation />
    </points>
  );
}

/* Simplified continent detection using coordinate ranges */
function pseudoLand(lat: number, lon: number): boolean {
  // South America
  if (lat > -56 && lat < 12 && lon > -82 && lon < -34) {
    if (lat < -20 && lon < -65) return true; // southern
    if (lat > -20 && lat < 0 && lon > -78 && lon < -45) return true;
    if (lat > 0 && lat < 12 && lon > -78 && lon < -50) return true;
    return Math.random() > 0.4;
  }
  // North America
  if (lat > 15 && lat < 72 && lon > -170 && lon < -50) return Math.random() > 0.3;
  // Europe
  if (lat > 35 && lat < 72 && lon > -12 && lon < 45) return Math.random() > 0.35;
  // Africa
  if (lat > -35 && lat < 37 && lon > -18 && lon < 52) return Math.random() > 0.3;
  // Asia
  if (lat > 5 && lat < 75 && lon > 45 && lon < 150) return Math.random() > 0.35;
  // Australia
  if (lat > -45 && lat < -10 && lon > 110 && lon < 155) return Math.random() > 0.4;
  return false;
}

/* Glow ring */
function GlobeGlow() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.05, 2.15, 64]} />
      <meshBasicMaterial color="#22C55E" transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* Connecting lines (decorative arcs) */
function ConnectionArcs() {
  const arcs = useMemo(() => {
    const pairs = [
      { from: [0.8, 1.2, 1.3], to: [-0.5, 1.5, -1.0] },
      { from: [-1.5, 0.5, 0.8], to: [1.0, 0.8, -1.2] },
      { from: [0.3, -1.0, 1.5], to: [-1.2, 0.3, 1.0] },
    ];
    return pairs.map((p, idx) => {
      const start = new THREE.Vector3(...(p.from as [number, number, number]));
      const end = new THREE.Vector3(...(p.to as [number, number, number]));
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(3.2);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const pts = curve.getPoints(40);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return { geo, key: idx };
    });
  }, []);

  return (
    <>
      {arcs.map(a => (
        <line key={a.key} geometry={a.geo}>
          <lineBasicMaterial color="#22C55E" transparent opacity={0.2} />
        </line>
      ))}
    </>
  );
}

export default function InteractiveGlobe() {
  return (
    <div className="w-full h-[380px] relative">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <DottedGlobe />
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
      {/* Legend overlay */}
      <div className="absolute top-4 right-4 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-foreground">Loja Principal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-foreground">Acessos ao Checkout</span>
        </div>
      </div>
    </div>
  );
}
