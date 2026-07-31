import * as THREE from 'three';
import { PredictivePhysics, PhysicsBodyHandle } from '@vibe-gl/math-utils';
import React from 'react';

// ============================================
// VIBE CANVAS TYPES
// ============================================
export interface VibeConfig {
  environment?: 'studio' | 'cyberpunk-neon' | 'space' | 'nature' | 'minimal' | 'void';
  physics?: 'none' | 'low-gravity' | 'earth' | 'moon' | 'jupiter' | 'zero-g' | 'fluid';
  particles?: {
    count?: number;
    behavior?: 'float' | 'swarm' | 'explode' | 'trail' | 'morph' | 'attract';
    color?: 'white' | 'neon' | 'fire' | 'water' | 'galaxy' | 'custom';
    customColors?: string[];
    size?: [number, number];
    life?: number;
  };
  postProcessing?: {
    bloom?: number;
    vignette?: number;
    grain?: number;
    chromaticAberration?: number;
    lut?: string;
  };
  camera?: {
    type?: 'perspective' | 'orthographic';
    position?: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
    controls?: boolean;
    autoRotate?: boolean;
    autoRotateSpeed?: number;
  };
  lighting?: {
    preset?: 'studio' | 'dramatic' | 'natural' | 'neon' | 'minimal';
    ambientIntensity?: number;
    directionalIntensity?: number;
    directionalPosition?: [number, number, number];
    shadows?: boolean;
    shadowResolution?: number;
  };
  performance?: {
    targetFPS?: 30 | 60 | 120;
    autoLOD?: boolean;
    frustumCulling?: boolean;
    maxParticles?: number;
    dpr?: [number, number];
  };
  customShader?: {
    vertex?: string;
    fragment?: string;
    uniforms?: Record<string, any>;
  };
}

// ============================================
// RAW GL PIPELINE TYPES
// ============================================
/** Raw WebGL2 context wrapper for direct GL access */
export interface RawGLContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
}

/** Framebuffer configuration for multi-pass rendering */
export interface FramebufferConfig {
  /** Attachment name */
  name: string;
  /** Width (default: canvas width) */
  width?: number;
  /** Height (default: canvas height) */
  height?: number;
  /** Format (default: RGBA16F) */
  format?: number;
  /** Type (default: FLOAT) */
  type?: number;
  /** Filter (default: LINEAR) */
  minFilter?: number;
  magFilter?: number;
  /** Wrap mode (default: CLAMP_TO_EDGE) */
  wrapS?: number;
  wrapT?: number;
  /** Attach depth buffer */
  depth?: boolean;
  /** Attach stencil buffer */
  stencil?: boolean;
  /** Generate mipmaps */
  generateMipmaps?: boolean;
}

/** Shader pass configuration */
export interface ShaderPassConfig {
  /** Unique pass name */
  name: string;
  /** Vertex shader source */
  vertexShader: string;
  /** Fragment shader source */
  fragmentShader: string;
  /** Uniform values */
  uniforms?: Record<string, any>;
  /** Input framebuffer to read from */
  input?: string;
  /** Output framebuffer to write to */
  output?: string;
  /** Render to screen (final pass) */
  renderToScreen?: boolean;
  /** Clear before render */
  clear?: boolean;
  /** Clear color */
  clearColor?: number;
  /** Clear depth */
  clearDepth?: number;
}

/** Pipeline configuration for RawGLPipeline */
export interface RawGLPipelineConfig {
  /** Canvas dimensions */
  width?: number;
  height?: number;
  /** Device pixel ratio */
  dpr?: number;
  /** Enable alpha channel */
  alpha?: boolean;
  /** Antialias */
  antialias?: boolean;
  /** Preserve drawing buffer */
  preserveDrawingBuffer?: boolean;
  /** Power preference */
  powerPreference?: 'default' | 'low-power' | 'high-performance';
  /** Framebuffers for multi-pass rendering */
  framebuffers?: FramebufferConfig[];
  /** Shader passes */
  passes?: ShaderPassConfig[];
  /** Initial clear color */
  clearColor?: number;
  /** Initial clear alpha */
  clearAlpha?: number;
}

/** Uniform value type */
export type UniformValue = 
  | number 
  | number[] 
  | THREE.Vector2 
  | THREE.Vector3 
  | THREE.Vector4 
  | THREE.Color 
  | THREE.Matrix3 
  | THREE.Matrix4 
    | THREE.Texture 
    | THREE.CubeTexture 
    | THREE.DataTexture;

/** Uniform map */
export interface UniformMap {
  [key: string]: UniformValue;
}

/** Custom attribute configuration */
export interface AttributeConfig {
  name: string;
  size: 1 | 2 | 3 | 4;
  type: number;
  normalized: boolean;
  stride: number;
  offset: number;
  buffer: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
}

/** Draw call configuration */
export interface DrawCall {
  mode: number;
  first: number;
  count: number;
  instanceCount?: number;
  indexBuffer?: THREE.BufferAttribute;
}

/** RawGLPipeline API */
export interface RawGLPipelineAPI {
  /** Get raw WebGL2 context */
  getContext: () => RawGLContext | null;
  /** Create shader program */
  createProgram: (vertexSrc: string, fragmentSrc: string) => WebGLProgram | null;
  /** Create framebuffer */
    createFramebuffer: (config: FramebufferConfig) => WebGLFramebuffer | null;
  /** Create texture */
  createTexture: (width: number, height: number, format?: number, type?: number) => WebGLTexture;
  /** Create uniform buffer */
  createUniformBuffer: (size: number, usage?: number) => WebGLBuffer;
  /** Update uniform buffer */
  updateUniformBuffer: (buffer: WebGLBuffer, data: ArrayBufferView, offset?: number) => void;
  /** Create vertex array */
  createVertexArray: (attributes: AttributeConfig[], indexBuffer?: THREE.BufferAttribute) => WebGLVertexArrayObject;
  /** Submit draw call */
  draw: (program: WebGLProgram, vao: WebGLVertexArrayObject, drawCall: DrawCall, uniforms?: UniformMap) => void;
  /** Begin render pass */
  beginPass: (framebuffer: WebGLFramebuffer | null, clearColor?: number[]) => void;
  /** End render pass */
  endPass: () => void;
  /** Add post-processing pass */
  addPostPass: (config: ShaderPassConfig) => void;
  /** Remove post-processing pass */
  removePostPass: (name: string) => void;
  /** Get framebuffer by name */
  getFramebuffer: (name: string) => WebGLFramebuffer | null;
  /** Get texture by name */
  getTexture: (name: string) => WebGLTexture | null;
  /** Read pixels from framebuffer */
  readPixels: (framebuffer: WebGLFramebuffer, x: number, y: number, width: number, height: number, format: number, type: number, dest: ArrayBufferView) => void;
  /** Resize all resources */
  resize: (width: number, height: number, dpr?: number) => void;
  /** Add physics body */
  addPhysicsBody: (config: { mass: number; position: [number, number, number]; size: [number, number, number] }) => PhysicsBodyHandle;
  /** Get physics controller */
  getPhysics: () => PredictivePhysics | null;
}

/** Props for RawGLPipeline component */
export interface RawGLPipelineProps {
  /** Pipeline configuration */
  config?: RawGLPipelineConfig;
  /** Children components */
  children?: React.ReactNode;
  /** Callback when pipeline is ready */
  onReady?: (api: RawGLPipelineAPI) => void;
  /** Custom render function (called every frame) */
  onRender?: (api: RawGLPipelineAPI, delta: number, time: number) => void;
  /** Custom setup function (called once after init) */
  onSetup?: (api: RawGLPipelineAPI) => void;
  /** Class name */
  className?: string;
  /** Style */
  style?: React.CSSProperties;
}
