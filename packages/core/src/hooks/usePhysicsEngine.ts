import { useEffect, useRef } from 'react';
import { createPredictivePhysics, PredictivePhysics } from '@vibe-gl/math-utils';
import { VibeConfig } from '../types';

export function usePhysicsEngine(physicsConfig: VibeConfig['physics']) {
  const physicsRef = useRef<PredictivePhysics | null>(null);

  useEffect(() => {
    if (physicsConfig && physicsConfig !== 'none') {
      physicsRef.current = createPredictivePhysics();
      
      const gravityMap: Record<string, [number, number, number]> = {
        'low-gravity': [0, -1.62, 0],
        'earth': [0, -9.81, 0],
        'moon': [0, -1.62, 0],
        'jupiter': [0, -24.79, 0],
        'zero-g': [0, 0, 0],
        'fluid': [0, -9.81, 0],
      };
      
      if (typeof physicsConfig === 'string' && gravityMap[physicsConfig]) {
        physicsRef.current.setGravity(...gravityMap[physicsConfig] as [number, number, number]);
      }
      
      physicsRef.current.start();
    }
    
    return () => {
      physicsRef.current?.dispose();
      physicsRef.current = null;
    };
  }, [physicsConfig]);

  return physicsRef;
}
