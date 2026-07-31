'use client';
"use client";
import React, { 
  useRef, 
  useEffect, 
  useMemo, 
  useState
} from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import WebGPURenderer from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
// @ts-ignore
import * as Nodes from 'three/examples/jsm/nodes/Nodes.js';
import { 
  Environment, 
  SoftShadows, 
  ContactShadows,
} from '@react-three/drei';
import { 
  PredictivePhysics, 
  createPredictivePhysics, 
  PhysicsBodyHandle
} from '@vibe-gl/math-utils';

// Extend Three.js for React Three Fiber
import { VibeConfig } from '../types';
import { deepMerge } from '../utils/configMerge';

extend(THREE);

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

/** Particle system using WebGPU Compute Shaders / TSL */
function VibeParticles({ config, isWebGPU }: { config: Required<VibeConfig>['particles'], isWebGPU: boolean }) {
  const { count = 1000000, behavior = 'float', color = 'white', size = [0.05, 0.2] } = config;
  const ref = useRef<THREE.Points>(null);
  
  const [material] = useState(() => {
    if (isWebGPU && (Nodes as any).PointsNodeMaterial) {
      const mat = new (Nodes as any).PointsNodeMaterial({
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      // Set color based on config using nodes
      let colorNode;
      switch (color) {
        case 'neon': colorNode = (Nodes as any).color(0x00ffff); break;
        case 'fire': colorNode = (Nodes as any).color(0xff4400); break;
        case 'water': colorNode = (Nodes as any).color(0x00aaff); break;
        case 'galaxy': colorNode = (Nodes as any).color(0xaa00ff); break;
        default: colorNode = (Nodes as any).color(0xffffff);
      }
      mat.colorNode = colorNode;
      return mat;
    } else {
      // CPU Fallback Material
      return new THREE.PointsMaterial({ 
        size: 0.1, 
        transparent: true, 
        opacity: 0.8,
        vertexColors: true,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    }
  });

  const [geometry] = useState(() => new THREE.BufferGeometry());
  
  // TSL Compute Variables
  const computeShaderRef = useRef<any>(null);

  // Initialize geometry with instanced attributes (CPU fallback OR TSL initial state)
  useEffect(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 5 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      // Colors (used mostly by CPU fallback)
      const colorObj = new THREE.Color();
      switch (color) {
        case 'neon': colorObj.setHSL(0.8 + Math.random() * 0.2, 1, 0.5); break;
        case 'fire': colorObj.setHSL(Math.random() * 0.1, 1, 0.5); break;
        case 'water': colorObj.setHSL(0.5 + Math.random() * 0.1, 1, 0.5); break;
        case 'galaxy': colorObj.setHSL(0.7 + Math.random() * 0.2, 0.8, 0.6); break;
        default: colorObj.setHSL(Math.random(), 0.5, 0.7);
      }
      colors[i3] = colorObj.r;
      colors[i3 + 1] = colorObj.g;
      colors[i3 + 2] = colorObj.b;
      
      // Velocities
      velocities[i3] = (Math.random() - 0.5) * 2;
      velocities[i3 + 1] = (Math.random() - 0.5) * 2;
      velocities[i3 + 2] = (Math.random() - 0.5) * 2;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    // Setup TSL Compute Node if available (DISABLED due to Three.js compatibility issues)
    /*
    if (isWebGPU && (Nodes as any).storage) {
      try {
        const posAttr = geometry.attributes.position;
        const velAttr = geometry.attributes.velocity;
        if (!posAttr || !velAttr) {
          console.warn('Missing position or velocity attributes on geometry');
          return;
        }
        
        const positionBuffer = new (Nodes as any).StorageInstancedBufferAttribute(posAttr.array as Float32Array, 3);
        const velocityBuffer = new (Nodes as any).StorageInstancedBufferAttribute(velAttr.array as Float32Array, 3);
        
        const positionStorage = (Nodes as any).storage(positionBuffer, 'vec3', count);
        const velocityStorage = (Nodes as any).storage(velocityBuffer, 'vec3', count);
        
        // Define Compute Node Logic
        const computeLogic = (Nodes as any).tslFn(() => {
          const pos = positionStorage.element((Nodes as any).instanceIndex);
          const vel = velocityStorage.element((Nodes as any).instanceIndex);
          
          if (behavior === 'swarm') {
            // Simple swarm logic via nodes
            const dist = (Nodes as any).length(pos);
            const force = (Nodes as any).vec3(pos).div(dist).mul(0.1);
            vel.subAssign(force);
          } else if (behavior === 'explode') {
             vel.mulAssign(1.01);
          }
          
          pos.addAssign(vel.mul(0.016)); // approx delta
        });
        
        computeShaderRef.current = computeLogic().compute(count);
        (material as any).positionNode = positionStorage.toAttribute();
      } catch (e) {
        console.warn("TSL Compute not fully supported in this version", e);
      }
    }
    */
    
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [count, behavior, color, size, geometry, material, isWebGPU]);
  
  // Animation loop
  useFrame(({ gl }, delta) => {
    if (!ref.current) return;

    if (isWebGPU && computeShaderRef.current && (gl as any).compute) {
      // Run GPU Compute Shader
      (gl as any).compute(computeShaderRef.current);
    } else {
      // CPU Fallback for WebGL2 without Compute
      const positionAttr = geometry.getAttribute('position');
      const velocityAttr = geometry.getAttribute('velocity');
      if (!positionAttr || !velocityAttr) return;
    
      const positionArray: Float32Array = positionAttr.array as Float32Array;
      const velocityArray: Float32Array = velocityAttr.array as Float32Array;
    
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
      
        // Position update
        positionArray[i3]! += velocityArray[i3]! * delta;
        positionArray[i3 + 1]! += velocityArray[i3 + 1]! * delta;
        positionArray[i3 + 2]! += velocityArray[i3 + 2]! * delta;
      
        // Behavior
        if (behavior === 'swarm') {
          const dist = Math.sqrt(positionArray[i3]!**2 + positionArray[i3+1]!**2 + positionArray[i3+2]!**2);
          if (dist > 0) {
            velocityArray[i3]! -= positionArray[i3]! / dist * 0.5 * delta;
            velocityArray[i3 + 1]! -= positionArray[i3 + 1]! / dist * 0.5 * delta;
            velocityArray[i3 + 2]! -= positionArray[i3 + 2]! / dist * 0.5 * delta;
          }
        } else if (behavior === 'explode') {
            velocityArray[i3]! *= 1.01;
            velocityArray[i3 + 1]! *= 1.01;
            velocityArray[i3 + 2]! *= 1.01;
        }
      }
    
      positionAttr.needsUpdate = true;
    }
  });
  
  return <points ref={ref} geometry={geometry} material={material} />;
}

// ============================================
// POST-PROCESSING EFFECTS (Screen-Space Shaders)
// ============================================

interface PostProcessingEffectProps {
  config: Required<VibeConfig>['postProcessing'];
}

function PostProcessingEffect({ config }: PostProcessingEffectProps) {
  const composerRef = useRef<{
   scene: THREE.Scene;
   camera: THREE.OrthographicCamera;
   material: THREE.ShaderMaterial;
  } | null>(null);

  useEffect(() => {
   const ppScene = new THREE.Scene();
   const ppCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
   ppCamera.position.z = 1;

   const material = new THREE.ShaderMaterial({
     uniforms: {
       tDiffuse: { value: null },
       uTime: { value: 0 },
       uBloomIntensity: { value: 0 },
       uVignetteIntensity: { value: 0 },
       uGrainIntensity: { value: 0 },
       uChromaticIntensity: { value: 0 },
     },
     vertexShader: /* glsl */ `
       varying vec2 vUv;
       void main() {
         vUv = uv;
         gl_Position = vec4(position, 1.0);
       }
     `,
     fragmentShader: /* glsl */ `
       varying vec2 vUv;
       uniform sampler2D tDiffuse;
       uniform float uTime;
       uniform float uBloomIntensity;
       uniform float uVignetteIntensity;
       uniform float uGrainIntensity;
       uniform float uChromaticIntensity;

       float rand(vec2 uv) {
         return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
       }

       void main() {
         vec4 baseColor = texture2D(tDiffuse, vUv);
         vec3 color = baseColor.rgb;

         // Chromatic Aberration
         if (uChromaticIntensity > 0.0) {
           float ca = uChromaticIntensity * 4.0 / 1024.0;
           color.r = texture2D(tDiffuse, vUv + vec2(ca, 0.0)).r;
           color.b = texture2D(tDiffuse, vUv - vec2(ca, 0.0)).b;
         }

         // Vignette
         if (uVignetteIntensity > 0.0) {
           vec2 uvCenter = vUv - 0.5;
           float vignette = 1.0 - dot(uvCenter, uvCenter) * uVignetteIntensity;
           color *= vignette;
         }

         // Film Grain
         if (uGrainIntensity > 0.0) {
           float noise = (rand(vUv + fract(uTime * 100.0)) - 0.5) * uGrainIntensity;
           color += noise;
         }

         // Simple bloom-like brighten
         if (uBloomIntensity > 0.0) {
           float brightness = dot(color, vec3(0.299, 0.587, 0.114));
           color += color * brightness * uBloomIntensity;
         }

         gl_FragColor = vec4(color, baseColor.a);
       }
     `,
     transparent: true,
   });

   const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
   ppScene.add(quad);
   composerRef.current = { scene: ppScene, camera: ppCamera, material };

   return () => {
     material.dispose();
     quad.geometry.dispose();
   };
  }, []);

  useFrame(() => {
   const comp = composerRef.current;
   if (!comp) return;
    
   comp.material.uniforms.uTime!.value = performance.now() * 0.001;
   comp.material.uniforms.uBloomIntensity!.value = (config.bloom ?? 0) / 10;
   comp.material.uniforms.uVignetteIntensity!.value = (config.vignette ?? 0) / 5;
   comp.material.uniforms.uGrainIntensity!.value = (config.grain ?? 0) / 10;
   comp.material.uniforms.uChromaticIntensity!.value = config.chromaticAberration ?? 0;
  });

  return null;
}

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
  
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [hasWebGL, setHasWebGL] = useState(true);
  const [useWebGPU, setUseWebGPU] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<VibeCanvasAPI | null>(null);
  const threeRefs = useRef<{scene?: THREE.Scene, camera?: THREE.Camera, gl?: THREE.WebGLRenderer}>({});
  const physicsRef = useRef<PredictivePhysics | null>(null);
  const sceneObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  
  useEffect(() => {
    if (mergedConfig.physics !== 'none') {
      physicsRef.current = createPredictivePhysics();
      
      const gravityMap: Record<string, [number, number, number]> = {
        'low-gravity': [0, -1.62, 0],
        'earth': [0, -9.81, 0],
        'moon': [0, -1.62, 0],
        'jupiter': [0, -24.79, 0],
        'zero-g': [0, 0, 0],
        'fluid': [0, -9.81, 0],
      };
      
      if (mergedConfig.physics && gravityMap[mergedConfig.physics]) {
        physicsRef.current.setGravity(...gravityMap[mergedConfig.physics] as [number, number, number]);
      }
      
      physicsRef.current.start();
    }
    
    return () => {
      physicsRef.current?.dispose();
      physicsRef.current = null;
    };
  }, [mergedConfig.physics]);
  
  useEffect(() => {
    if ((navigator as any).gpu) {
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
  
  if (!isMounted) {
    return (
      <div className={className} style={{ ...style, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!hasWebGL && !useWebGPU) {
    return (
      <div 
        className={className} 
        style={{ ...style, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {fallback || (
          <div style={{ perspective: '1000px', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
            <div style={{ 
              width: 100, height: 100, position: 'relative', transformStyle: 'preserve-3d', animation: 'rotate3d 5s linear infinite' 
            }}>
              <style>{`
                @keyframes rotate3d { from { transform: rotateX(0deg) rotateY(0deg); } to { transform: rotateX(360deg) rotateY(360deg); } }
                .css3d-face { position: absolute; width: 100%; height: 100%; border: 2px solid #0ff; background: rgba(0, 255, 255, 0.1); box-shadow: 0 0 10px #0ff, inset 0 0 10px #0ff; }
                .css3d-front  { transform: translateZ(50px); }
                .css3d-back   { transform: rotateY(180deg) translateZ(50px); }
                .css3d-right  { transform: rotateY(90deg) translateZ(50px); }
                .css3d-left   { transform: rotateY(-90deg) translateZ(50px); }
                .css3d-top    { transform: rotateX(90deg) translateZ(50px); }
                .css3d-bottom { transform: rotateX(-90deg) translateZ(50px); }
              `}</style>
              <div className="css3d-face css3d-front"></div>
              <div className="css3d-face css3d-back"></div>
              <div className="css3d-face css3d-right"></div>
              <div className="css3d-face css3d-left"></div>
              <div className="css3d-face css3d-top"></div>
              <div className="css3d-face css3d-bottom"></div>
            </div>
            <div style={{ position: 'absolute', bottom: 20, color: '#0ff', fontFamily: 'monospace', textShadow: '0 0 5px #0ff', whiteSpace: 'nowrap', left: '50%', transform: 'translateX(-50%)' }}>
              WebGPU/WebGL Failed - Rendering CSS 3D Fallback
            </div>
          </div>
        )}
      </div>
    );
  }
  
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
    screenshot: async (options) => {
      const gl = threeRefs.current.gl;
      if (!gl) return '';
      return gl.domElement.toDataURL(options?.type || 'image/png', options?.encoderOptions);
    },
    startPhysics: () => physicsRef.current?.start(),
    stopPhysics: () => physicsRef.current?.stop(),
    addPhysicsBody: (config) => {
      if (!physicsRef.current) throw new Error('Physics not initialized');
      return physicsRef.current.addBody({
        mass: config.mass,
        position: config.position,
              velocity: [0, 0, 0],
              aabbHalfExtents: [config.size[0]/2, config.size[1]/2, config.size[2]/2],
              restitution: 0.5,
              friction: 0.3,
              isStatic: config.mass === 0,
            });
    },
  }), []);
  
  useEffect(() => {
    apiRef.current = api;
    onReady?.(api);
  }, [api, onReady]);
  
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
  
  return (
    <div className={className} style={{ width: '100%', height: '100%', ...style }}>
      <Canvas
        ref={canvasRef as any}
        camera={cameraSettings}
        shadows={lighting.shadows}
        dpr={mergedConfig.performance.dpr ?? [1, 2]}
        gl={(canvas) => {
          if (useWebGPU) {
            return new (WebGPURenderer as any)({ canvas, antialias: true, alpha: true });
          }
          return new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
        }}
      >
                <VibeCanvasAPIHelper refs={threeRefs} />
        <SoftShadows 
          size={lighting.shadowResolution} 
          samples={16} 
          focus={0.5} 
        />
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
        <ContactShadows opacity={0.3} scale={20} blur={2} far={10} />
        
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
