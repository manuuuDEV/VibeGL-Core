"use client";
/**
 * @fileoverview VibeGL-Core: The Zero-Boilerplate 3D React Engine
 * 
 * A dual-API 3D React engine that bridges "Vibe Coders" (natural language JSON)
 * and "Hardcore Programmers" (raw WebGL2).
 * 
 * @features
 * - Declarative VibeCanvas for zero-config 3D scenes
 * - Raw WebGL2 RawGLPipeline for pixel-perfect control
 * - Sub-threaded predictive physics (120 FPS via Web Worker + SharedArrayBuffer)
 * - Zero-allocation render loop (object pooling, no GC pressure)
 * - Auto-LOD and frustum culling (invisible performance)
 * - Graceful degradation (CSS 3D fallback for non-WebGL browsers)
 * - 100% TypeScript with strict mode
 * - Multi-format distribution (ESM, CJS, UMD)
 * 
 * @version 0.1.0
 * @license MIT
 * @author VibeGL Contributors
 * 
 * @example
 * // Vibe Coder (Declarative API)
 * import { VibeCanvas } from '@vibe-gl/core';
 * 
 * export default function App() {
 *   return (
 *     <VibeCanvas config={{
 *       environment: 'cyberpunk-neon',
 *       particles: { count: 10000, behavior: 'swarm' },
 *       physics: 'low-gravity'
 *     }} />
 *   );
 * }
 * 
 * @example
 * // Hardcore Programmer (Raw WebGL2)
 * import { RawGLPipeline, useShaderInjector } from '@vibe-gl/core';
 * 
 * export default function HardcoreScene() {
 *   const { inject } = useShaderInjector();
 *   return (
 *     <RawGLPipeline
 *       onFrame={({ gl, scene, camera }) => {
 *         inject(vertexShader, fragmentShader, uniforms);
 *         gl.render(scene, camera);
 *       }}
 *     />
 *   );
 * }
 * 
 * @see {@link https://github.com/manuuuDEV/VibeGL-Core}
 * @see {@link https://npmjs.com/@vibe-gl/core}
 */

// Core Exports - VibeGL Core Package
// ============================================
// Dual-API Architecture:
//   • VibeCanvas / useVibeCoding  → "Vibe Coders" (Declarative JSON config)
//   • RawGLPipeline / useShaderInjector / useMemoryPool → "Hardcore Programmers" (Bare-metal WebGL2)

/**
 * Vibe Coder Layer (Declarative)
 * ============================================
 * Natural-language JSON configuration entry point.
 * Provides automatic LOD, frustum culling, physics, and post-processing.
 */
export * from './components/VibeCanvas';

/**
 * Cleanup utilities for strict memory management in React Suspense/unmounting.
 */
export * from './hooks/useVibeCleanup';

/**
 * Hardcore Programmer Layer (Bare-Metal WebGL2)
 * ============================================
 * Raw WebGL2 context, custom shaders, FBOs, memory pools.
 * No abstraction layers. Full control.
 */
export * from './components/RawGLPipeline';
export { useShaderInjector, useMemoryPool } from './components/RawGLPipeline';

/**
 * Fallback & Utilities
 * ============================================
 * Graceful degradation (CSS 3D fallback for WebGL2-less browsers).
 * Physics body components for integrating with React Three Fiber.
 */
export * from './components/VibeFallback';
export * from './components/PhysicsBody';

/**
 * Re-export key types from dependencies for convenience
 * ============================================
 * Direct access to Three.js math types for end users.
 * 
 * @example
 * import { Vector3, Matrix4, Quaternion } from '@vibe-gl/core';
 */
export type { 
  Vector3, 
  Matrix4, 
  Quaternion, 
  Euler, 
  Color 
} from 'three';