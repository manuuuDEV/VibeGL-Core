import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { UniformValue } from '../types';

// ============================================
// HOOK: useShaderInjector
// ============================================

/**
 * Hook for injecting raw GLSL shaders into the render pipeline
 * Bypasses React Three Fiber's material system entirely
 * 
 * @example
 * ```tsx
 * const { injectVertex, injectFragment, setUniform } = useShaderInjector();
 * 
 * // Inject custom vertex shader
 * injectVertex(`
 *   uniform float time;
 *   varying vec3 vPos;
 *   void main() {
 *     vPos = position;
 *     vec3 pos = position + normal * sin(time + position.x * 10.0) * 0.1;
 *     gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
 *   }
 * `);
 * 
 * // Inject custom fragment shader
 * injectFragment(`
 *   uniform float time;
 *   varying vec3 vPos;
 *   void main() {
 *     float glow = sin(vPos.x * 10.0 + time) * 0.5 + 0.5;
 *     gl_FragColor = vec4(glow, 0.0, 1.0 - glow, 1.0);
 *   }
 * `);
 * ```
 */
export function useShaderInjector() {
  const { gl: renderer } = useThree();
  const programRef = useRef<WebGLProgram | null>(null);
  const vertexSrcRef = useRef<string>('');
  const fragmentSrcRef = useRef<string>('');
  const uniformsRef = useRef<Record<string, WebGLUniformLocation>>({});
  const isInjectedRef = useRef(false);
  
  // Get raw WebGL2 context from Three.js renderer
  const gl = renderer?.getContext() as WebGL2RenderingContext | undefined;
   
  const compileProgram = useCallback(() => {
    if (!gl || !vertexSrcRef.current || !fragmentSrcRef.current) return;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexSrcRef.current);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
      return;
    }
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentSrcRef.current);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
      return;
    }
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    
    // Cache uniform locations
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    const uniforms: Record<string, WebGLUniformLocation> = {};
    for (let i = 0; i < uniformCount; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        uniforms[info.name] = gl.getUniformLocation(program, info.name)!;
      }
    }
    
    programRef.current = program;
    uniformsRef.current = uniforms;
    isInjectedRef.current = true;
    
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }, [gl]);
  
  // Recompile when sources change
  useEffect(() => {
    if (vertexSrcRef.current || fragmentSrcRef.current) {
      compileProgram();
    }
  }, [compileProgram]);
  
  const injectVertex = useCallback((source: string) => {
    vertexSrcRef.current = source;
    compileProgram();
  }, [compileProgram]);
  
  const injectFragment = useCallback((source: string) => {
    fragmentSrcRef.current = source;
    compileProgram();
  }, [compileProgram]);
  
  const setUniform = useCallback((name: string, value: UniformValue) => {
    if (!gl || !programRef.current) return;
    
    const loc = uniformsRef.current[name];
    if (!loc) return;
    
    gl.useProgram(programRef.current);
    
    if (typeof value === 'number') {
      gl.uniform1f(loc, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2: gl.uniform2fv(loc, value); break;
        case 3: gl.uniform3fv(loc, value); break;
        case 4: gl.uniform4fv(loc, value); break;
        case 9: gl.uniformMatrix3fv(loc, false, value); break;
        case 16: gl.uniformMatrix4fv(loc, false, value); break;
        default: gl.uniform1fv(loc, value);
      }
    } else if (value instanceof THREE.Vector2) {
      gl.uniform2f(loc, value.x, value.y);
    } else if (value instanceof THREE.Vector3) {
      gl.uniform3f(loc, value.x, value.y, value.z);
    } else if (value instanceof THREE.Vector4) {
      gl.uniform4f(loc, value.x, value.y, value.z, value.w);
    } else if (value instanceof THREE.Color) {
      gl.uniform3f(loc, value.r, value.g, value.b);
    } else if (value instanceof THREE.Matrix3) {
      gl.uniformMatrix3fv(loc, false, value.elements);
    } else if (value instanceof THREE.Matrix4) {
      gl.uniformMatrix4fv(loc, false, value.elements);
    }
  }, [gl]);
  
  const useProgram = useCallback(() => {
    if (gl && programRef.current) {
      gl.useProgram(programRef.current);
    }
  }, [gl]);
  
  const getProgram = useCallback(() => programRef.current, []);
  
  const cleanup = useCallback(() => {
    if (gl && programRef.current) {
      gl.deleteProgram(programRef.current);
      programRef.current = null;
      isInjectedRef.current = false;
    }
  }, [gl]);
  
  return {
    injectVertex,
    injectFragment,
    setUniform,
    useProgram,
    getProgram,
    cleanup,
    isReady: isInjectedRef.current,
  };
}

