import { useState, useEffect } from 'react';

export function useGPUDetect() {
  const [gpuInfo, setGpuInfo] = useState({
    isMounted: false,
    hasWebGL: false,
    useWebGPU: false,
  });

  useEffect(() => {
    // Disable WebGPU for now as Three.js r160 WebGPURenderer is too unstable
    const useWebGPU = false;
    
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      setGpuInfo({
        isMounted: true,
        hasWebGL: !!gl,
        useWebGPU,
      });
    } catch (e) {
      setGpuInfo({ isMounted: true, hasWebGL: false, useWebGPU: false });
    }
  }, []);

  return gpuInfo;
}
