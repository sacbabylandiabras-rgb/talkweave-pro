import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, RoundedBox, OrbitControls, Float } from "@react-three/drei";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface BarProps {
  position: [number, number, number];
  height: number;
  color: string;
  label: string;
  value: number;
  maxHeight: number;
}

function Bar({ position, height, color, label, value, maxHeight }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [animatedHeight, setAnimatedHeight] = useState(0);

  useFrame((_, delta) => {
    if (animatedHeight < height) {
      setAnimatedHeight(prev => Math.min(prev + delta * 3, height));
    }
    if (meshRef.current) {
      meshRef.current.scale.y = THREE.MathUtils.lerp(
        meshRef.current.scale.y,
        hovered ? 1.08 : 1,
        0.1
      );
    }
  });

  const displayHeight = Math.max(animatedHeight, 0.05);

  return (
    <group position={position}>
      {/* Bar */}
      <mesh
        ref={meshRef}
        position={[0, displayHeight / 2, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <RoundedBox args={[1.2, displayHeight, 1.2]} radius={0.08} smoothness={4}>
          <meshStandardMaterial
            color={hovered ? new THREE.Color(color).multiplyScalar(1.3) : color}
            metalness={0.1}
            roughness={0.4}
            transparent
            opacity={0.9}
          />
        </RoundedBox>
      </mesh>

      {/* Glow effect */}
      <mesh position={[0, displayHeight / 2, 0]}>
        <boxGeometry args={[1.3, displayHeight, 1.3]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>

      {/* Value on top */}
      <Float speed={2} floatIntensity={0.1}>
        <Text
          position={[0, displayHeight + 0.4, 0]}
          fontSize={0.4}
          color="white"
          fontWeight={700}
          anchorX="center"
          anchorY="middle"
        >
          {value.toLocaleString("pt-BR")}
        </Text>
      </Float>

      {/* Label below */}
      <Text
        position={[0, -0.4, 0]}
        fontSize={0.25}
        color="#94a3b8"
        anchorX="center"
        anchorY="top"
        maxWidth={2}
        textAlign="center"
      >
        {label}
      </Text>
    </group>
  );
}

function GridFloor() {
  return (
    <group>
      <gridHelper args={[12, 12, "#1e293b", "#0f172a"]} position={[0, -0.01, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#020617" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function Scene({ data }: { data: { sent: number; delivered: number; failed: number } }) {
  const maxVal = Math.max(data.sent, data.delivered, data.failed, 1);
  const scale = 4 / maxVal;

  const bars = useMemo(() => [
    { label: "Enviadas", value: data.sent, color: "#10b981", x: -2.5 },
    { label: "Entregues", value: data.delivered, color: "#3b82f6", x: 0 },
    { label: "Erros", value: data.failed, color: "#ef4444", x: 2.5 },
  ], [data]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <pointLight position={[-3, 5, -3]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[3, 5, 3]} intensity={0.3} color="#06b6d4" />

      <GridFloor />

      {bars.map((bar) => (
        <Bar
          key={bar.label}
          position={[bar.x, 0, 0]}
          height={bar.value * scale}
          color={bar.color}
          label={bar.label}
          value={bar.value}
          maxHeight={4}
        />
      ))}

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export function Chart3D() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ sent: 0, delivered: 0, failed: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: sends } = await supabase.from("campaign_sends").select("status");
      if (sends) {
        setData({
          sent: sends.filter((s) => s.status === "sent").length,
          delivered: sends.filter((s) => s.status === "delivered").length,
          failed: sends.filter((s) => s.status === "failed").length,
        });
      }
    } catch (error) {
      console.error("Error loading 3D chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[350px] rounded-xl border bg-card">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">📊 Visão 3D de Mensagens</span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Enviadas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Entregues
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Erros
          </span>
        </div>
      </div>
      <div className="h-[350px] bg-[#020617]">
        <Canvas
          camera={{ position: [6, 5, 6], fov: 45 }}
          shadows
          dpr={[1, 2]}
        >
          <Scene data={data} />
        </Canvas>
      </div>
    </div>
  );
}
