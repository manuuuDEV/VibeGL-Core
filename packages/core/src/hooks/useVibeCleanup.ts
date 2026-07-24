import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export function useVibeCleanup() {
  const { scene } = useThree();

  useEffect(() => {
    return () => {
      scene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
    };
  }, [scene]);
}