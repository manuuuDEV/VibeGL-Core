import React, { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { SoftShadows, Environment } from "@react-three/drei";

export interface VibeCanvasProps {
  children: ReactNode;
  backgroundColor?: string;
}

export function VibeCanvas({ children, backgroundColor = "#0a0a0a" }: VibeCanvasProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 10], fov: 45 }}
      style={{ background: backgroundColor, width: "100vw", height: "100vh" }}
      dpr={[1, 2]}
    >
      <SoftShadows size={10} samples={16} focus={0.5} />
      <ambientLight intensity={0.5} />
      <directionalLight
        castShadow
        position={[10, 20, 5]}
        intensity={1.5}
        shadow-mapSize={[1024, 1024]}
      />
      <Environment preset="city" />
      {children}
    </Canvas>
  );
}