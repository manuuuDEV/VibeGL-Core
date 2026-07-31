import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { VibeConfig } from '../types';
import { VibeCanvasAPI } from '../components/VibeCanvas';
import { PredictivePhysics } from '@vibe-gl/math-utils';
import { deepMerge } from '../utils/configMerge';

interface UseVibeAPIProps {
  setMergedConfig: React.Dispatch<React.SetStateAction<Required<VibeConfig>>>;
  physicsRef: React.MutableRefObject<PredictivePhysics | null>;
  onReady: ((api: VibeCanvasAPI) => void) | undefined;
  isMounted: boolean;
}

export function useVibeAPI({ setMergedConfig, physicsRef, onReady, isMounted }: UseVibeAPIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<VibeCanvasAPI | null>(null);
  const threeRefs = useRef<{scene?: THREE.Scene, camera?: THREE.Camera, gl?: THREE.WebGLRenderer}>({});
  const sceneObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());

  const api = useMemo((): VibeCanvasAPI => ({
    setConfig: (newConfig: Partial<VibeConfig>) => {
        setMergedConfig(prev => deepMerge(prev, newConfig) as Required<VibeConfig>);
    },
    addObject: (object: THREE.Object3D) => {
      const id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sceneObjectsRef.current.set(id, object);
    },
    removeObject: (object: THREE.Object3D) => {
      for (const [id, obj] of sceneObjectsRef.current) {
        if (obj === object) {
          sceneObjectsRef.current.delete(id);
          break;
        }
      }
    },
    getScene: () => threeRefs.current.scene || null,
    getCamera: () => threeRefs.current.camera || null,
    getRenderer: () => threeRefs.current.gl || null,
    screenshot: async (options = {}) => {
      if (!canvasRef.current) throw new Error('Canvas non disponibile');
      const type = options.type || 'image/png';
      const quality = options.encoderOptions || 0.92;
      return canvasRef.current.toDataURL(type, quality);
    },
    startPhysics: () => physicsRef.current?.start(),
    stopPhysics: () => physicsRef.current?.stop(),
    addPhysicsBody: (config) => {
      if (!physicsRef.current) throw new Error('Physics engine non inizializzato');
      return physicsRef.current.addBody(config);
    }
  }), [setMergedConfig, physicsRef]);

  useEffect(() => {
    if (onReady && isMounted && apiRef.current !== api) {
      apiRef.current = api;
      onReady(api);
    }
  }, [onReady, isMounted, api]);

  return { api, canvasRef, threeRefs, sceneObjectsRef };
}
