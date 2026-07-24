import React, { useEffect, useRef, useState } from "react";
import { Group } from "three";
import { createPhysicsWorker } from "@vibe-gl/math-utils";

export interface PhysicsBodyProps {
  children: React.ReactNode;
  mass?: number;
  initialPosition?: [number, number, number];
  gravityCenter?: [number, number, number];
}

export function PhysicsBody({ children, mass = 1, initialPosition = [0, 0, 0] }: PhysicsBodyProps) {
  const ref = useRef<Group>(null);
  const workerRef = useRef<Worker | null>(null);
  const [pos] = useState(initialPosition);

  useEffect(() => {
    workerRef.current = createPhysicsWorker();

    workerRef.current.onmessage = (e) => {
      if (ref.current) {
        ref.current.position.set(e.data.newPosition[0], e.data.newPosition[1], e.data.newPosition[2]);
      }
    };

    const interval = setInterval(() => {
      workerRef.current?.postMessage({
        mass,
        position: ref.current ? [ref.current.position.x, ref.current.position.y, ref.current.position.z] : pos
      });
    }, 16);

    return () => {
      clearInterval(interval);
      workerRef.current?.terminate();
    };
  }, [mass, pos]);

  return (
    <group ref={ref} position={initialPosition}>
      {children}
    </group>
  );
}