import { useState, useEffect } from 'react';

export function useGPUDetect() {
  const [isMounted, setIsMounted] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [useWebGPU, setUseWebGPU] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      setUseWebGPU(true);
      setHasWebGL(true);
    } else {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        setHasWebGL(!!gl);
      } catch {
        setHasWebGL(false);
      }
    }
  }, []);

  return { isMounted, hasWebGL, useWebGPU };
}
