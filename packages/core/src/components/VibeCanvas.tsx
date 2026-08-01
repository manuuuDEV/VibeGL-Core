'use client';
"use client";
import React, { 
    useEffect, 
  useMemo, 
  useState
} from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVibeAPI } from '../hooks/useVibeAPI';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine';
import { useGPUDetect } from '../hooks/useGPUDetect';
import { CSS3DFallback } from './CSS3DFallback';
import { LoadingFallback } from './LoadingFallback';
import { PostProcessingEffect } from './VibePostProcessing';


// @ts-ignore
import WebGPURenderer from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
// @ts-ignore
import * as Nodes from 'three/examples/jsm/nodes/Nodes.js';
import { 
  Environment, 
  ContactShadows,
} from '@react-three/drei';
import { 
  PhysicsBodyHandle
} from '@vibe-gl/math-utils';

// Extend Three.js for React Three Fiber
import { VibeConfig } from '../types';
import { VibeParticles } from './VibeParticles';
import { deepMerge } from '../utils/configMerge';


// ============================================
// TYPES - VIBE CODER API
// ============================================


const DEFAULT_VIBE_CONFIG: Required<VibeConfig> = {
  environment: 'studio',
  physics: 'earth',
  particles: {
    count: 1000,
    behavior: 'float',
    color: 'white',
    customColors: [],
    size: [0.05, 0.2],
    life: 5,
  },
  postProcessing: {
    bloom: 0.3,
    vignette: 0.2,
    grain: 0.05,
    chromaticAberration: 0,
    lut: '',
  },
  camera: {
    type: 'perspective',
    position: [0, 5, 10],
    fov: 45,
    near: 0.1,
    far: 1000,
    controls: true,
    autoRotate: false,
    autoRotateSpeed: 0.5,
  },
  lighting: {
    preset: 'studio',
    ambientIntensity: 0.5,
    directionalIntensity: 1.5,
    directionalPosition: [10, 20, 5],
    shadows: true,
    shadowResolution: 2048,
  },
  performance: {
    targetFPS: 60,
    autoLOD: true,
    frustumCulling: true,
    maxParticles: 1000000,
    dpr: [1, 2],
  },
  customShader: {
    vertex: '',
    fragment: '',
    uniforms: {},
  },
};

// ============================================
// INTERNAL COMPONENTS
// ============================================



// ============================================
// MAIN VIBE CANVAS COMPONENT
// ============================================

export interface VibeCanvasProps {
  config?: VibeConfig;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  onReady?: (api: VibeCanvasAPI) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface VibeCanvasAPI {
  setConfig: (config: Partial<VibeConfig>) => void;
  addObject: (object: THREE.Object3D) => void;
  removeObject: (object: THREE.Object3D) => void;
  getScene: () => THREE.Scene | null;
  getCamera: () => THREE.Camera | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  screenshot: (options?: { width?: number; height?: number; type?: string; encoderOptions?: number }) => Promise<string>;
  startPhysics: () => void;
  stopPhysics: () => void;
  addPhysicsBody: (config: { mass: number; position: [number, number, number]; size: [number, number, number] }) => PhysicsBodyHandle;
}

export function VibeCanvas({ 
  config = {}, 
  children, 
  fallback, 
  onReady,
  className = '',
  style = {}
}: VibeCanvasProps) {
  const [mergedConfig, setMergedConfig] = useState<Required<VibeConfig>>(() => 
    deepMerge(DEFAULT_VIBE_CONFIG, config) as Required<VibeConfig>
  );
  
  const { isMounted, hasWebGL, useWebGPU } = useGPUDetect();
  
  const physicsRef = usePhysicsEngine(mergedConfig.physics);
  const { canvasRef, threeRefs } = useVibeAPI({
    setMergedConfig,
    physicsRef,
    onReady,
    isMounted,
  });


  const environmentPreset = useMemo(() => {
    switch (mergedConfig.environment) {
      case 'cyberpunk-neon': return 'city';
      case 'space': return 'space';
      case 'nature': return 'forest';
      case 'minimal': return 'studio';
      case 'void': return 'warehouse';
      default: return 'studio';
    }
  }, [mergedConfig.environment]);
  
  const cameraSettings = useMemo(() => ({
      position: mergedConfig.camera?.position ?? [0, 0, 5],
      fov: mergedConfig.camera?.fov ?? 50,
      near: mergedConfig.camera?.near ?? 0.1,
      far: mergedConfig.camera?.far ?? 1000,
  }), [mergedConfig.camera]);
  
  const lighting = useMemo(() => {
      const l = mergedConfig.lighting || {};
      const { preset, ambientIntensity, directionalIntensity, directionalPosition, shadows, shadowResolution } = l;
    
      const presets: Record<string, { ambient: number; dir: number; pos: [number, number, number] }> = {
        studio: { ambient: 0.5, dir: 1.5, pos: [10, 20, 5] },
        dramatic: { ambient: 0.2, dir: 3, pos: [5, 30, 10] },
        natural: { ambient: 0.4, dir: 1, pos: [15, 25, 10] },
        neon: { ambient: 0.1, dir: 2, pos: [0, 15, 0] },
        minimal: { ambient: 0.6, dir: 1, pos: [10, 10, 10] },
      };
    
      const presetKey = preset ?? 'studio';
      const p = (presets[presetKey] ?? presets.studio)!;
      
      return {
        ambientIntensity: ambientIntensity ?? p.ambient,
        directionalIntensity: directionalIntensity ?? p.dir,
        directionalPosition: directionalPosition ?? p.pos,
        shadows: shadows ?? true,
        shadowResolution: shadowResolution ?? 2048,
      };
    }, [mergedConfig.lighting]);
  
  if (!isMounted) return <LoadingFallback className={className} style={style} />;

  if (!hasWebGL && !useWebGPU) return <CSS3DFallback className={className} style={style} fallback={fallback} />;

  return (
    <div className={className} style={{ width: '100%', height: '100%', ...style }}>
      <Canvas
        ref={canvasRef as any}
        camera={cameraSettings}
        shadows={lighting.shadows}
        dpr={mergedConfig.performance.dpr ?? [1, 2]}
        gl={(canvas: HTMLCanvasElement | OffscreenCanvas | undefined) => {
          if (useWebGPU) {
            return new (WebGPURenderer as any)({ canvas, antialias: true, alpha: true });
          }
          return new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: true, alpha: true, preserveDrawingBuffer: true });
        }}
      >
                <VibeCanvasAPIHelper refs={threeRefs} />
        <ambientLight intensity={lighting.ambientIntensity} />
        <directionalLight
          castShadow={lighting.shadows}
          position={lighting.directionalPosition as [number, number, number]}
          intensity={lighting.directionalIntensity}
          shadow-mapSize={lighting.shadowResolution ? [lighting.shadowResolution, lighting.shadowResolution] : [2048, 2048]}
          shadow-camera-near={0.1}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <Environment preset={environmentPreset as any} />
        {!useWebGPU && <ContactShadows opacity={0.3} scale={20} blur={2} far={10} />}
        
        {mergedConfig.particles && mergedConfig.particles.count! > 0 && (
          <VibeParticles config={mergedConfig.particles} isWebGPU={useWebGPU} />
        )}
        
        {mergedConfig.postProcessing && (
          <PostProcessingEffect config={mergedConfig.postProcessing} />
        )}
        
        <group>
          {children}
        </group>
        
        {mergedConfig.camera.autoRotate && (
          <AutoRotate speed={mergedConfig.camera.autoRotateSpeed ?? 0.5} />
        )}
      </Canvas>
    </div>
  );
}

// ============================================

// ============================================
// API HELPER
// ============================================

function VibeCanvasAPIHelper({ refs }: { refs: React.MutableRefObject<any> }) {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    refs.current.scene = scene;
    refs.current.camera = camera;
    refs.current.gl = gl;
  }, [scene, camera, gl, refs]);
  return null;
}

// AUTO ROTATE HELPER
// ============================================

function AutoRotate({ speed }: { speed?: number }) {
  const { camera, scene } = useThree();
  const speedValue = speed ?? 0.5;
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  
  useFrame((state) => {
    if (camera && scene) {
      const time = state.clock.getElapsedTime() * speedValue;
      camera.position.x = Math.cos(time) * 10;
      camera.position.z = Math.sin(time) * 10;
      camera.lookAt(target);
    }
  });
  
  return null;
}

// ============================================
