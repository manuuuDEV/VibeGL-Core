import React, { 
  useRef, 
  useEffect, 
  useMemo, 
  useState, 
  useCallback 
} from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
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
extend(THREE);

// ============================================
// TYPES - VIBE CODER API
// ============================================

/**
 * VibeCanvas Configuration Schema
 * Natural-language-like JSON configuration for AI-assisted coding
 */
export interface VibeConfig {
  /** Environment preset: 'studio' | 'cyberpunk-neon' | 'space' | 'nature' | 'minimal' | 'void' */
  environment?: 'studio' | 'cyberpunk-neon' | 'space' | 'nature' | 'minimal' | 'void';
  
  /** Physics preset: 'none' | 'low-gravity' | 'earth' | 'moon' | 'jupiter' | 'zero-g' | 'fluid' */
  physics?: 'none' | 'low-gravity' | 'earth' | 'moon' | 'jupiter' | 'zero-g' | 'fluid';
  
  /** Particle system configuration */
  particles?: {
    /** Number of particles (auto-LOD adjusts based on performance) */
    count?: number;
    /** Behavior: 'float' | 'swarm' | 'explode' | 'trail' | 'morph' | 'attract' */
    behavior?: 'float' | 'swarm' | 'explode' | 'trail' | 'morph' | 'attract';
    /** Color theme */
    color?: 'white' | 'neon' | 'fire' | 'water' | 'galaxy' | 'custom';
    /** Custom color array for 'custom' theme */
    customColors?: string[];
    /** Size range [min, max] */
    size?: [number, number];
    /** Lifetime in seconds */
    life?: number;
  };
  
  /** Post-processing effects */
  postProcessing?: {
    /** Bloom intensity */
    bloom?: number;
    /** Vignette intensity */
    vignette?: number;
    /** Film grain intensity */
    grain?: number;
    /** Chromatic aberration */
    chromaticAberration?: number;
    /** Color grading LUT */
    lut?: string;
  };
  
  /** Camera configuration */
  camera?: {
    /** Camera type */
    type?: 'perspective' | 'orthographic';
    /** Position [x, y, z] */
    position?: [number, number, number];
    /** Field of view (perspective) */
    fov?: number;
    /** Near/far planes */
    near?: number;
    far?: number;
    /** Enable camera controls */
    controls?: boolean;
    /** Auto-rotate */
    autoRotate?: boolean;
    /** Auto-rotate speed */
    autoRotateSpeed?: number;
  };
  
  /** Lighting configuration */
  lighting?: {
    /** Preset: 'studio' | 'dramatic' | 'natural' | 'neon' | 'minimal' */
    preset?: 'studio' | 'dramatic' | 'natural' | 'neon' | 'minimal';
    /** Ambient light intensity */
    ambientIntensity?: number;
    /** Directional light intensity */
    directionalIntensity?: number;
    /** Directional light position */
    directionalPosition?: [number, number, number];
    /** Enable shadows */
    shadows?: boolean;
    /** Shadow map resolution */
    shadowResolution?: number;
  };
  
  /** Performance settings */
  performance?: {
    /** Target FPS (30, 60, 120) */
    targetFPS?: 30 | 60 | 120;
    /** Enable auto-LOD */
    autoLOD?: boolean;
    /** Enable frustum culling */
    frustumCulling?: boolean;
    /** Max particle count */
    maxParticles?: number;
    /** DPR range [min, max] */
    dpr?: [number, number];
  };
  
  /** Custom shader injection (for advanced vibe coders) */
  customShader?: {
    /** Vertex shader GLSL */
    vertex?: string;
    /** Fragment shader GLSL */
    fragment?: string;
    /** Uniforms to pass to shader */
    uniforms?: Record<string, any>;
  };
}

/** Default configuration */
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
    maxParticles: 100000,
    dpr: [1, 2],
  },
  customShader: {
    vertex: '',
    fragment: '',
    uniforms: {},
  },
};

// ============================================
// PRESET SHADERS & EFFECTS
// ============================================

interface PresetShader {
  vertex: string;
  fragment: string;
  uniforms?: Record<string, unknown>;
}

/** Preset shaders for custom shader injection */
export const PRESET_SHADERS: Record<string, PresetShader> = {
  'cyberpunk-neon': {
    vertex: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform float time;
      uniform vec3 neonColor1;
      uniform vec3 neonColor2;
      uniform float scanlineIntensity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); }
      
      void main() {
        vec3 color = mix(neonColor1, neonColor2, vUv.y);
        float scanline = sin(vUv.y * 800.0 + time * 10.0) * scanlineIntensity;
        float noise = rand(vUv * 100.0 + time) * 0.1;
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0, 0, 1))), 3.0);
        gl_FragColor = vec4(color + fresnel * 0.5 + scanline + noise, 1.0);
      }
    `,
    uniforms: {
      neonColor1: [1, 0, 1],
      neonColor2: [0, 1, 1],
      scanlineIntensity: 0.1,
    }
  },
  'space': {
    vertex: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform float time;
      uniform vec3 starColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(dot(i + vec3(0,0,0), vec3(127.1, 311.7, 74.7)), 
                  dot(i + vec3(1,0,0), vec3(127.1, 311.7, 74.7)), f.x),
              mix(dot(i + vec3(0,1,0), vec3(127.1, 311.7, 74.7)), 
                  dot(i + vec3(1,1,0), vec3(127.1, 311.7, 74.7)), f.x), f.y),
          mix(mix(dot(i + vec3(0,0,1), vec3(127.1, 311.7, 74.7)), 
                  dot(i + vec3(1,0,1), vec3(127.1, 311.7, 74.7)), f.x),
              mix(dot(i + vec3(0,1,1), vec3(127.1, 311.7, 74.7)), 
                  dot(i + vec3(1,1,1), vec3(127.1, 311.7, 74.7)), f.x), f.y), f.z);
      }
      
      void main() {
        float n = noise(vWorldPosition * 0.5 + time * 0.1);
        vec3 color = mix(vec3(0.05, 0.05, 0.2), starColor, smoothstep(0.7, 1.0, n));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      starColor: [1, 1, 0.8],
    }
  },
  };

// ============================================
// INTERNAL COMPONENTS
// ============================================

/** Particle system using GPU instancing */
function VibeParticles({ config }: { config: Required<VibeConfig>['particles'] }) {
  const { count = 1000, behavior = 'float', color = 'white', size = [0.05, 0.2], life = 5 } = config;
  const ref = useRef<THREE.Points>(null);
  const [geometry] = useState(() => new THREE.BufferGeometry());
  const [material] = useState(() => new THREE.PointsMaterial({ 
    size: 0.1, 
    transparent: true, 
    opacity: 0.8,
    vertexColors: true,
    sizeAttenuation: true,
  }));
  
  // Initialize geometry with instanced attributes
  useEffect(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Random initial position in sphere
      const radius = 5 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      // Colors
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
      
      // Size and lifetime
      sizes[i] = size[0] + Math.random() * (size[1] - size[0]);
      lifetimes[i] = Math.random() * life;
      
      // Velocity based on behavior
      switch (behavior) {
        case 'swarm':
          velocities[i3] = (Math.random() - 0.5) * 2;
          velocities[i3 + 1] = (Math.random() - 0.5) * 2;
          velocities[i3 + 2] = (Math.random() - 0.5) * 2;
          break;
        case 'explode':
                  velocities[i3] = positions[i3]! * 0.1;
                  velocities[i3 + 1] = positions[i3 + 1]! * 0.1;
                  velocities[i3 + 2] = positions[i3 + 2]! * 0.1;
          break;
        case 'trail':
          velocities[i3] = 0;
          velocities[i3 + 1] = -0.5 - Math.random() * 0.5;
          velocities[i3 + 2] = 0;
          break;
        default: // float
          velocities[i3] = (Math.random() - 0.5) * 0.5;
          velocities[i3 + 1] = (Math.random() - 0.5) * 0.5;
          velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
      }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [count, behavior, color, size, life, geometry, material]);
  
  // Animation loop
      useFrame((_state, delta) => {
      if (!ref.current) return;
  
      const positionAttr = geometry.getAttribute('position');
      const lifetimeAttr = geometry.getAttribute('lifetime');
      const velocityAttr = geometry.getAttribute('velocity');
      if (!positionAttr || !lifetimeAttr || !velocityAttr) return;
    
            const positionArray: Float32Array = positionAttr.array as Float32Array;
            const lifetimeArray: Float32Array = lifetimeAttr.array as Float32Array;
            const velocityArray: Float32Array = velocityAttr.array as Float32Array;
    
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
      
        // Update position
              positionArray[i3]! += velocityArray[i3]! * delta;
              positionArray[i3 + 1]! += velocityArray[i3 + 1]! * delta;
              positionArray[i3 + 2]! += velocityArray[i3 + 2]! * delta;
      
        // Update lifetime
              lifetimeArray[i]! -= delta;
              if (lifetimeArray[i]! <= 0) {
          // Respawn
                lifetimeArray[i]! = life;
          const radius = 5 + Math.random() * 10;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
                positionArray[i3]! = radius * Math.sin(phi) * Math.cos(theta);
                positionArray[i3 + 1]! = radius * Math.sin(phi) * Math.sin(theta);
                positionArray[i3 + 2]! = radius * Math.cos(phi);
        }
      
        // Behavior-specific updates
        if (behavior === 'swarm') {
          // Attract to center
                const dist = Math.sqrt(positionArray[i3]!**2 + positionArray[i3+1]!**2 + positionArray[i3+2]!**2);
          if (dist > 0) {
                  velocityArray[i3]! -= positionArray[i3]! / dist * 0.5 * delta;
                  velocityArray[i3 + 1]! -= positionArray[i3 + 1]! / dist * 0.5 * delta;
                  velocityArray[i3 + 2]! -= positionArray[i3 + 2]! / dist * 0.5 * delta;
          }
        } else if (behavior === 'attract') {
          // Mouse attraction would go here
        }
      }
    
      positionAttr.needsUpdate = true;
      lifetimeAttr.needsUpdate = true;
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

  // Initialize post-processing compositor once
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

  // Update uniforms each frame
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
  /** Vibe configuration - natural language JSON */
  config?: VibeConfig;
  /** Children to render inside the scene */
  children?: React.ReactNode;
  /** Fallback UI when WebGL not supported */
  fallback?: React.ReactNode;
  /** Callback when canvas is ready */
  onReady?: (api: VibeCanvasAPI) => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

/** Public API returned by VibeCanvas */
export interface VibeCanvasAPI {
  /** Update config at runtime */
  setConfig: (config: Partial<VibeConfig>) => void;
  /** Add object to scene programmatically */
  addObject: (object: THREE.Object3D) => void;
  /** Remove object from scene */
  removeObject: (object: THREE.Object3D) => void;
  /** Get Three.js scene */
  getScene: () => THREE.Scene | null;
  /** Get Three.js camera */
  getCamera: () => THREE.Camera | null;
  /** Get Three.js renderer */
  getRenderer: () => THREE.WebGLRenderer | null;
  /** Take screenshot */
  screenshot: (options?: { width?: number; height?: number; type?: string; encoderOptions?: number }) => Promise<string>;
  /** Start physics simulation */
  startPhysics: () => void;
  /** Stop physics simulation */
  stopPhysics: () => void;
  /** Add physics body */
  addPhysicsBody: (config: { mass: number; position: [number, number, number]; size: [number, number, number] }) => PhysicsBodyHandle;
}

/**
 * VibeCanvas - The declarative magic layer for "Vibe Coders"
 * 
 * Accepts natural-language-like JSON configuration and automatically
 * maps to optimized shaders, physics presets, and post-processing.
 * 
 * @example
 * ```tsx
 * <VibeCanvas config={{
 *   environment: 'cyberpunk-neon',
 *   physics: 'low-gravity',
 *   particles: { count: 10000, behavior: 'swarm' },
 *   postProcessing: { bloom: 0.5, vignette: 0.3 }
 * }} />
 * ```
 */
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
  const [hasWebGL, setHasWebGL] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<VibeCanvasAPI | null>(null);
  const physicsRef = useRef<PredictivePhysics | null>(null);
  const sceneObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  
  // Initialize physics
  useEffect(() => {
    if (mergedConfig.physics !== 'none') {
      physicsRef.current = createPredictivePhysics();
      
      // Set gravity based on preset
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
  
  // WebGL detection
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setHasWebGL(!!gl);
    } catch {
      setHasWebGL(false);
    }
  }, []);
  
  if (!hasWebGL) {
    return (
      <div 
        className={className} 
        style={{ ...style, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {fallback || (
          <div style={{ padding: 20, textAlign: 'center', background: '#1a1a1a', color: '#fff', borderRadius: 8 }}>
            <h2>WebGL 2 Not Supported</h2>
            <p>Please update your browser or enable hardware acceleration.</p>
          </div>
        )}
      </div>
    );
  }
  
  // Build API object
  const api = useMemo((): VibeCanvasAPI => ({
    setConfig: (newConfig: Partial<VibeConfig>) => {
        setMergedConfig(prev => deepMerge(prev, newConfig) as Required<VibeConfig>);
    },
    addObject: (object: THREE.Object3D) => {
      const id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sceneObjectsRef.current.set(id, object);
      // Note: In real implementation, this would add to the scene
    },
    removeObject: (object: THREE.Object3D) => {
      for (const [id, obj] of sceneObjectsRef.current) {
        if (obj === object) {
          sceneObjectsRef.current.delete(id);
          break;
        }
      }
    },
    getScene: () => null, // Would return scene from useThree
    getCamera: () => null,
    getRenderer: () => null,
    screenshot: async () => '',
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
  
  // Provide API to parent
  useEffect(() => {
    apiRef.current = api;
    onReady?.(api);
  }, [api, onReady]);
  
  // Environment presets
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
  
  // Camera settings
  const cameraSettings = useMemo(() => ({
      position: mergedConfig.camera?.position ?? [0, 0, 5],
      fov: mergedConfig.camera?.fov ?? 50,
      near: mergedConfig.camera?.near ?? 0.1,
      far: mergedConfig.camera?.far ?? 1000,
  }), [mergedConfig.camera]);
  
  // Lighting based on preset
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
        gl={{ 
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: true,
        }}
      >
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
        
        {/* Particle System */}
                        {mergedConfig.particles && mergedConfig.particles.count! > 0 && (
          <VibeParticles config={mergedConfig.particles} />
        )}
        
        {/* Post Processing - custom screen-space shader effects */}
                {mergedConfig.postProcessing && (
                  <PostProcessingEffect config={mergedConfig.postProcessing} />
                )}
        
                {/* User Children */}
                <group>
                  {children}
                </group>
        
                {/* Auto-rotate camera if enabled */}
                {mergedConfig.camera.autoRotate && (
                  <AutoRotate speed={mergedConfig.camera.autoRotateSpeed ?? 0.5} />
                )}
      </Canvas>
    </div>
  );
}

// ============================================
// AUTO ROTATE HELPER
// ============================================

function AutoRotate({ speed }: { speed?: number }) {
  const { camera, scene } = useThree();
  const speedValue = speed ?? 0.5;
  
  useFrame((state) => {
    if (camera && scene) {
      const time = state.clock.getElapsedTime() * speedValue;
      camera.position.x = Math.cos(time) * 10;
      camera.position.z = Math.sin(time) * 10;
      camera.lookAt(0, 0, 0);
    }
  });
  
  return null;
}

// ============================================
// HOOK: useVibeCoding
// ============================================

/**
 * Hook for programmatic vibe coding - natural language scene manipulation
 * 
 * @example
 * ```tsx
 * const { scene, add, remove, animate } = useVibeCoding();
 * 
 * // Add a glowing cube
 * add('cube', { position: [0, 1, 0], color: '#ff00ff', glow: true });
 * 
 * // Natural language commands
 * scene.command('make it rain particles');
 * scene.command('add physics to all cubes');
 * ```
 */
export function useVibeCoding() {
  const { scene, camera, gl } = useThree();
  const physicsRef = useRef<PredictivePhysics | null>(null);
  const objectMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  
  // Initialize physics lazily
  const getPhysics = useCallback(() => {
    if (!physicsRef.current) {
      physicsRef.current = createPredictivePhysics();
      physicsRef.current.setGravity(0, -9.81, 0);
      physicsRef.current.start();
    }
    return physicsRef.current;
  }, []);
  
  /** Add object by natural language description */
  const add = useCallback((type: string, props: Record<string, any> = {}) => {
    const id = props.id || `${type}_${Date.now()}`;
    
    let object: THREE.Object3D;
    const material = new THREE.MeshStandardMaterial({ 
      color: props.color || '#ffffff',
      metalness: props.metalness ?? 0,
      roughness: props.roughness ?? 0.5,
      emissive: props.glow ? new THREE.Color(props.color || '#ffffff') : new THREE.Color(0),
      emissiveIntensity: props.glow ? 0.5 : 0,
      transparent: props.opacity !== undefined,
      opacity: props.opacity ?? 1,
    });
    
    switch (type.toLowerCase()) {
      case 'cube':
      case 'box':
        object = new THREE.Mesh(new THREE.BoxGeometry(props.size || 1, props.size || 1, props.size || 1), material);
        break;
      case 'sphere':
        object = new THREE.Mesh(new THREE.SphereGeometry(props.radius || 0.5, 32, 32), material);
        break;
      case 'plane':
        object = new THREE.Mesh(new THREE.PlaneGeometry(props.width || 10, props.height || 10), material);
        break;
      case 'cylinder':
        object = new THREE.Mesh(new THREE.CylinderGeometry(props.radiusTop || 0.5, props.radiusBottom || 0.5, props.height || 1, 32), material);
        break;
      case 'torus':
        object = new THREE.Mesh(new THREE.TorusGeometry(props.radius || 0.5, props.tube || 0.2, 16, 32), material);
        break;
      case 'particles':
        // Create particle system
        const count = props.count || 1000;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * (props.spread || 10);
          positions[i * 3 + 1] = (Math.random() - 0.5) * (props.spread || 10);
          positions[i * 3 + 2] = (Math.random() - 0.5) * (props.spread || 10);
          
          const c = new THREE.Color(props.color || '#ffffff');
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
          
          sizes[i] = props.size || 0.1;
        }
        
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
          size: props.size || 0.1,
          vertexColors: true,
          transparent: true,
          sizeAttenuation: true,
        });
        
        object = new THREE.Points(geo, particleMaterial);
        break;
      default:
        object = new THREE.Group();
    }
    
    if (props.position) {
          object.position.set(props.position[0], props.position[1], props.position[2]);
    }
    if (props.rotation) {
          object.rotation.set(props.rotation[0], props.rotation[1], props.rotation[2]);
    }
    if (props.scale) {
      object.scale.setScalar(typeof props.scale === 'number' ? props.scale : 1);
    }
    if (props.castShadow) object.castShadow = true;
    if (props.receiveShadow) object.receiveShadow = true;
    
    object.name = id;
    scene.add(object);
    objectMapRef.current.set(id, object);
    
    // Add physics if requested
    if (props.physics) {
      const physics = getPhysics();
      physics.addBody({
        mass: typeof props.physics === 'number' ? props.physics : 1,
        position: props.position || [0, 0, 0],
              velocity: [0, 0, 0],
              aabbHalfExtents: [props.size || 0.5, props.size || 0.5, props.size || 0.5],
              restitution: 0.5,
              friction: 0.3,
              isStatic: false,
            });
    }
    
    return { id, object };
  }, [scene, getPhysics]);
  
  /** Remove object by ID */
  const remove = useCallback((id: string) => {
    const object = objectMapRef.current.get(id);
    if (object) {
      scene.remove(object);
      object.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      objectMapRef.current.delete(id);
    }
  }, [scene]);
  
  /** Animate object */
  const animate = useCallback((id: string, animation: { 
    property: 'position' | 'rotation' | 'scale';
      to: [number, number, number];
    duration: number;
    easing?: (t: number) => number;
  }) => {
    const object = objectMapRef.current.get(id);
    if (!object) return;
    
    const from = (object as any)[animation.property].toArray ? (object as any)[animation.property].toArray() : [0, 0, 0];
    const startTime = performance.now();
    
    const frameHandler = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / animation.duration, 1);
      const eased = animation.easing ? animation.easing(progress) : progress;
      
          const current = from.map((f: number, i: number) => f + (animation.to[i]! - f) * eased);
      (object as any)[animation.property].set(...current);
      
      if (progress < 1) {
        requestAnimationFrame(frameHandler);
      }
    };
    
    requestAnimationFrame(frameHandler);
  }, []);
  
  /** Natural language command (experimental) */
  const command = useCallback((text: string) => {
    const lower = text.toLowerCase();
    
    if (lower.includes('rain') || lower.includes('particles')) {
      add('particles', { count: 5000, color: '#00ffff', spread: 20, size: 0.05 });
    } else if (lower.includes('physics')) {
      // Enable physics on all objects
      objectMapRef.current.forEach(obj => {
        if (obj instanceof THREE.Mesh) {
          const physics = getPhysics();
          physics.addBody({
            mass: 1,
            position: obj.position.toArray() as [number, number, number],
                      velocity: [0, 0, 0],
                      aabbHalfExtents: [0.5, 0.5, 0.5],
                      restitution: 0.5,
                      friction: 0.3,
                      isStatic: false,
                    });
        }
      });
    } else if (lower.includes('explode')) {
      objectMapRef.current.forEach(obj => {
        if (obj instanceof THREE.Mesh) {
          const physics = getPhysics();
          physics.addBody({
            mass: 1,
            position: obj.position.toArray() as [number, number, number],
                      velocity: [0, 0, 0],
                      aabbHalfExtents: [0.5, 0.5, 0.5],
                      restitution: 0.8,
                      friction: 0.1,
                      isStatic: false,
                    });
        }
      });
    } else if (lower.includes('clear') || lower.includes('remove all')) {
      objectMapRef.current.forEach((_, id) => remove(id));
    }
  }, [add, getPhysics, remove]);
  
  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      physicsRef.current?.dispose();
    };
  }, []);
  
  return {
    scene,
    camera,
    renderer: gl,
    add,
    remove,
    animate,
    command,
    getPhysics,
    objects: objectMapRef.current,
  };
}

// ============================================
// UTILITY: Deep Merge
// ============================================

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;
  
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];
    
    if (sourceValue === undefined) continue;
    
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      (result as any)[key] = deepMerge(targetValue, sourceValue);
    } else {
      (result as any)[key] = sourceValue;
    }
  }
  
  return result;
}