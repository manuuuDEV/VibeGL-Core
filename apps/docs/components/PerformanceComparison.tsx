import { useMemo, useRef, useState, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import dynamic from 'next/dynamic';

const VibeCanvasDynamic = dynamic(
  () => import('@vibe-gl/core').then((mod) => mod.VibeCanvas),
  { ssr: false }
);

function ClassicSwarmNode({ initialPos, color }: { initialPos: [number, number, number], color: THREE.Color }) {
  const ref = useRef<THREE.Mesh>(null);
  const velocity = useRef(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
  
  // Logica Swarm identica a quella nel Compute Shader / VibeParticles
  useFrame((state, delta) => {
    if (ref.current) {
      const pos = ref.current.position;
      pos.x += velocity.current.x * delta;
      pos.y += velocity.current.y * delta;
      pos.z += velocity.current.z * delta;

      const dist = Math.sqrt(pos.x**2 + pos.y**2 + pos.z**2);
      if (dist > 0) {
        velocity.current.x -= (pos.x / dist) * 0.5 * delta;
        velocity.current.y -= (pos.y / dist) * 0.5 * delta;
        velocity.current.z -= (pos.z / dist) * 0.5 * delta;
      }
    }
  });

  return (
    <mesh ref={ref} position={initialPos}>
      {/* Usiamo piccoli box che somigliano ai punti del PointsMaterial di VibeGL */}
      <boxGeometry args={[0.08, 0.08, 0.08]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function StandardHeavyScene() {
  const count = 15000;
  const nodes = useMemo(() => {
    return Array.from({ length: count }).map(() => {
      const radius = 5 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const pos = [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      ] as [number, number, number];
      
      // Riproduciamo il colore 'water' di VibeGL
      const color = new THREE.Color().setHSL(0.5 + Math.random() * 0.1, 1, 0.5);
      
      return { pos, color };
    });
  }, [count]);
  
  return (
    <>
      <ambientLight intensity={1} />
      {nodes.map((n, i) => <ClassicSwarmNode key={i} initialPos={n.pos} color={n.color} />)}
    </>
  );
}

function StandardSceneWrapper() {
  return (
    <Canvas camera={{ position: [0, 0, 30], fov: 50 }} style={{ background: '#000' }}>
      <Suspense fallback={null}>
        <StandardHeavyScene />
        <OrbitControls />
      </Suspense>
    </Canvas>
  );
}

export default function PerformanceComparison() {
  const [mode, setMode] = useState<'standard' | 'vibegl'>('vibegl');

  return (
    <div style={{ marginTop: '2rem', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
      <div style={{ padding: '15px', background: '#111', borderBottom: '1px solid #333', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button 
          onClick={() => setMode('standard')}
          style={{ padding: '8px 16px', background: mode === 'standard' ? '#f44336' : '#222', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Approccio Classico (15.000 oggetti) - LAG ⚠️
        </button>
        <button 
          onClick={() => setMode('vibegl')}
          style={{ padding: '8px 16px', background: mode === 'vibegl' ? '#00e5ff' : '#222', color: mode === 'vibegl' ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Approccio VibeGL (100.000 oggetti) - FLUIDO ⚡
        </button>
      </div>

      <div style={{ height: '400px', position: 'relative' }}>
        {mode === 'standard' ? (
          <StandardSceneWrapper />
        ) : (
          <VibeCanvasDynamic 
            config={{
              environment: 'minimal',
              particles: {
                count: 100000,
                behavior: 'swarm',
                color: 'water'
              },
              postProcessing: {
                bloom: 1.0,
                chromaticAberration: 0.05
              }
            }}
          />
        )}
        
        <div style={{ position: 'absolute', bottom: '15px', left: '15px', right: '15px', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '14px', border: '1px solid #333' }}>
          {mode === 'standard' 
            ? "Simulazione 'Swarm' con 15.000 oggetti usando componenti React classici (<mesh>). Il lag è evidente."
            : "Stessa scena visiva, ma VibeGL sta gestendo ben 100.000 oggetti (quasi 7 volte di più!). Grazie all'instancing nativo le performance restano impeccabili."}
        </div>
      </div>
    </div>
  );
}
