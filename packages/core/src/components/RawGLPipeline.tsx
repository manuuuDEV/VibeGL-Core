'use client';
"use client";
import { 
  useRef, 
  useEffect, 
  useState, 
  useCallback,
  useImperativeHandle,
  forwardRef 
} from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { PredictivePhysics } from '@vibe-gl/math-utils';
import { FramebufferConfig, ShaderPassConfig, UniformValue, UniformMap, RawGLPipelineAPI, RawGLPipelineProps } from '../types';


// ============================================
// FRAMEBUFFER MANAGER
// ============================================

class FramebufferManager {
  private gl: WebGL2RenderingContext;
  private framebuffers = new Map<string, WebGLFramebuffer>();
  private textures = new Map<string, WebGLTexture>();
    private depthTextures = new Map<string, WebGLTexture>();
    private width = 0;
    private height = 0;
  
    constructor(gl: WebGL2RenderingContext, width: number, height: number, _dpr: number) {
      this.gl = gl;
      this.resize(width, height, _dpr);
    }
  
  resize(width: number, height: number, _dpr: number): void {
      this.width = width;
      this.height = height;
    
    // Recreate all framebuffers at new size
    this.framebuffers.forEach((fb, name) => {
      const config = (fb as any).__config;
      if (config) {
        this.gl.deleteFramebuffer(fb);
        this.framebuffers.set(name, this.create(config));
      }
    });
  }
  
  create(config: FramebufferConfig): WebGLFramebuffer {
    const { 
      name, 
      width = this.width, 
      height = this.height,
      format = this.gl.RGBA16F,
      type = this.gl.FLOAT,
      minFilter = this.gl.LINEAR,
      magFilter = this.gl.LINEAR,
      wrapS = this.gl.CLAMP_TO_EDGE,
      wrapT = this.gl.CLAMP_TO_EDGE,
      depth = true,
      stencil = false,
      generateMipmaps = false,
    } = config;
    
    const gl = this.gl;
    const fb = gl.createFramebuffer()!;
    (fb as any).__config = config;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    
    // Color attachment
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    
    if (generateMipmaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    this.textures.set(name, texture);
    
    // Depth attachment
    if (depth) {
      const depthTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, depthTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
      this.depthTextures.set(name, depthTexture);
    }
    
    // Stencil attachment
    if (stencil) {
      const stencilTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, stencilTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.STENCIL_INDEX8, width, height, 0, gl.STENCIL_INDEX8, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.TEXTURE_2D, stencilTexture, 0);
    }
    
    // Check completeness
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer ${name} incomplete: ${status}`);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.framebuffers.set(name, fb);
    
    return fb;
  }
  
  getFramebuffer(name: string): WebGLFramebuffer | null {
    return this.framebuffers.get(name) || null;
  }
  
  getTexture(name: string): WebGLTexture | null {
    return this.textures.get(name) || null;
  }
  
  getDepthTexture(name: string): WebGLTexture | null {
    return this.depthTextures.get(name) || null;
  }
  
  destroy(): void {
    this.framebuffers.forEach(fb => this.gl.deleteFramebuffer(fb));
    this.textures.forEach(tex => this.gl.deleteTexture(tex));
    this.depthTextures.forEach(tex => this.gl.deleteTexture(tex));
    this.framebuffers.clear();
    this.textures.clear();
    this.depthTextures.clear();
  }
}

// ============================================
// SHADER PROGRAM MANAGER
// ============================================

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  attributes: Map<string, number>;
}

class ShaderManager {
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, ShaderProgram>();
  private currentProgram: WebGLProgram | null = null;
  
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }
  
  create(name: string, vertexSrc: string, fragmentSrc: string): WebGLProgram | null {
    const gl = this.gl;
    
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSrc);
    
    if (!vertexShader || !fragmentShader) return null;
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    
    // Cache uniform locations
    const uniforms = new Map<string, WebGLUniformLocation>();
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        uniforms.set(info.name, gl.getUniformLocation(program, info.name)!);
      }
    }
    
    // Cache attribute locations
    const attributes = new Map<string, number>();
    const attribCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < attribCount; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (info) {
        attributes.set(info.name, gl.getAttribLocation(program, info.name));
      }
    }
    
    this.programs.set(name, { program, uniforms, attributes });
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    return program;
  }
  
  get(name: string): ShaderProgram | undefined {
    return this.programs.get(name);
  }
  
  use(name: string): WebGLProgram | null {
    const sp = this.programs.get(name);
    if (sp) {
      this.gl.useProgram(sp.program);
      this.currentProgram = sp.program;
      return sp.program;
    }
    return null;
  }
  
  getCurrent(): WebGLProgram | null {
    return this.currentProgram;
  }
  
  setUniforms(uniforms: UniformMap): void {
    if (!this.currentProgram) return;
    
    const sp = Array.from(this.programs.values()).find(p => p.program === this.currentProgram);
    if (!sp) return;
    
    const gl = this.gl;
    
    Object.entries(uniforms).forEach(([name, value]) => {
      const loc = sp.uniforms.get(name);
      if (!loc) return;
      
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
      } else if (value instanceof THREE.Texture) {
        // Texture binding handled separately
      }
    });
  }
  
  destroy(): void {
    this.programs.forEach(({ program }) => this.gl.deleteProgram(program));
    this.programs.clear();
  }
  
  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
}

// ============================================
// RAW GL PIPELINE COMPONENT
// ============================================

/**
 * RawGLPipeline - The bare-metal layer for "Hardcore Shader Devs"
 * 
 * Provides direct access to WebGL2 context, framebuffers, shader programs,
 * and render passes. Bypasses React Three Fiber's render loop entirely.
 * 
 * @example
 * ```tsx
 * <RawGLPipeline
 *   config={{
 *     framebuffers: [
 *       { name: 'gbuffer', format: GL.RGBA16F },
 *       { name: 'bloom', format: GL.RGBA16F }
 *     ],
 *     passes: [
 *       { name: 'geometry', vertex: vertSrc, fragment: fragSrc, output: 'gbuffer' },
 *       { name: 'bloom', vertex: screenQuadVert, fragment: bloomFrag, input: 'gbuffer', output: 'bloom' },
 *       { name: 'composite', vertex: screenQuadVert, fragment: compFrag, input: 'bloom', renderToScreen: true }
 *     ]
 *   }}
 *   onRender={(api, delta, time) => {
 *     // Custom render loop with zero abstraction overhead
 *     api.beginPass(api.getFramebuffer('gbuffer'));
 *     api.draw(program, vao, { mode: GL.TRIANGLES, count: 36 });
 *     api.endPass();
 *   }}
 * />
 * ```
 */
export const RawGLPipeline = forwardRef<{ getAPI: () => RawGLPipelineAPI | null }, RawGLPipelineProps>(({
  config = {},
  children,
  onReady,
  onRender,
  onSetup,
  className = '',
  style = {}
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const apiRef = useRef<RawGLPipelineAPI | null>(null);
    const animationRef = useRef<number>(0);
    const lastTimeRef = useRef(0);
  
    // State
    const widthRef = useRef(config.width || window.innerWidth);
    const heightRef = useRef(config.height || window.innerHeight);
    const dprRef = useRef(config.dpr || Math.min(window.devicePixelRatio, 2));

    // Reactive state for UI updates
    const [width, setWidth] = useState(widthRef.current);
    const [height, setHeight] = useState(heightRef.current);
    const [dpr, setDpr] = useState(dprRef.current);

    // Managers
    const fbManagerRef = useRef<FramebufferManager | null>(null);
    const shaderManagerRef = useRef<ShaderManager | null>(null);
    const physicsRef = useRef<PredictivePhysics | null>(null);
    const passConfigsRef = useRef<ShaderPassConfig[]>(config.passes || []);
  
  // Initialize WebGL context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('webgl2', {
      alpha: config.alpha ?? true,
      antialias: config.antialias ?? true,
      preserveDrawingBuffer: config.preserveDrawingBuffer ?? false,
      powerPreference: config.powerPreference ?? 'high-performance',
      depth: true,
      stencil: true,
    });
    
    if (!context) {
      console.error('WebGL2 not supported');
      return;
    }
    
    // Enable extensions
    context.getExtension('EXT_color_buffer_float');
    context.getExtension('OES_texture_float_linear');
    context.getExtension('WEBGL_depth_texture');
    
    // Set initial state
    context.enable(context.DEPTH_TEST);
    context.enable(context.BLEND);
    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
    context.depthFunc(context.LEQUAL);
        context.clearColor(0, 0, 0, config.clearAlpha ?? 1);
    
        // Initialize managers
        fbManagerRef.current = new FramebufferManager(context, widthRef.current, heightRef.current, dprRef.current);
    shaderManagerRef.current = new ShaderManager(context);
    
    // Create configured framebuffers
    config.framebuffers?.forEach(fbConfig => {
      fbManagerRef.current!.create(fbConfig);
    });
    
    // Initialize physics
    physicsRef.current = new PredictivePhysics();
    physicsRef.current.init().then(() => {
      physicsRef.current!.setGravity(0, -9.81, 0);
      physicsRef.current!.start();
    });
    
    // Create API object
    const api: RawGLPipelineAPI = {
      getContext: () => ({
        gl: context,
        canvas,
            width: widthRef.current,
            height: heightRef.current,
            dpr: dprRef.current,
      }),
      createProgram: (vertexSrc, fragmentSrc) => {
        const name = `prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return shaderManagerRef.current!.create(name, vertexSrc, fragmentSrc);
      },
      createFramebuffer: (config: FramebufferConfig) => fbManagerRef.current?.create(config) ?? null,
      createTexture: (w, h, format = context.RGBA16F, type = context.FLOAT) => {
        const tex = context.createTexture()!;
        context.bindTexture(context.TEXTURE_2D, tex);
        context.texImage2D(context.TEXTURE_2D, 0, format, w, h, 0, context.RGBA, type, null);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
        return tex;
      },
      createUniformBuffer: (size, usage = context.DYNAMIC_DRAW) => {
        const buf = context.createBuffer()!;
        context.bindBuffer(context.UNIFORM_BUFFER, buf);
        context.bufferData(context.UNIFORM_BUFFER, size, usage);
        context.bindBuffer(context.UNIFORM_BUFFER, null);
        return buf;
      },
      updateUniformBuffer: (buffer, data, offset = 0) => {
        context.bindBuffer(context.UNIFORM_BUFFER, buffer);
        context.bufferSubData(context.UNIFORM_BUFFER, offset, data);
        context.bindBuffer(context.UNIFORM_BUFFER, null);
      },
      createVertexArray: (attributes, indexBuffer) => {
        const vao = context.createVertexArray()!;
        context.bindVertexArray(vao);
        
        attributes.forEach((attr, i) => {
          const buffer = attr.buffer;
          context.bindBuffer(context.ARRAY_BUFFER, buffer);
          context.enableVertexAttribArray(i);
          context.vertexAttribPointer(i, attr.size, attr.type, attr.normalized, attr.stride, attr.offset);
          
          if (attr.buffer instanceof THREE.InstancedBufferAttribute) {
            context.vertexAttribDivisor(i, attr.buffer.meshPerAttribute || 0);
          }
        });
        
        if (indexBuffer) {
          context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
        }
        
        context.bindVertexArray(null);
        context.bindBuffer(context.ARRAY_BUFFER, null);
        context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, null);
        
        return vao;
      },
      draw: (program, vao, drawCall, uniforms) => {
        context.useProgram(program);
        context.bindVertexArray(vao);
        
        if (uniforms) {
          shaderManagerRef.current!.setUniforms(uniforms);
        }
        
        if (drawCall.instanceCount && drawCall.instanceCount > 1) {
          if (drawCall.indexBuffer) {
            context.drawElementsInstanced(drawCall.mode, drawCall.count, context.UNSIGNED_SHORT, 0, drawCall.instanceCount);
          } else {
            context.drawArraysInstanced(drawCall.mode, drawCall.first, drawCall.count, drawCall.instanceCount);
          }
        } else {
          if (drawCall.indexBuffer) {
            context.drawElements(drawCall.mode, drawCall.count, context.UNSIGNED_SHORT, 0);
          } else {
            context.drawArrays(drawCall.mode, drawCall.first, drawCall.count);
          }
        }
        
        context.bindVertexArray(null);
      },
      beginPass: (framebuffer, clearColor = [0, 0, 0, 0]) => {
              const cc = clearColor as [number, number, number, number];
              context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
              if (framebuffer) {
                context.viewport(0, 0, width * dpr, height * dpr);
              } else {
                context.viewport(0, 0, width * dpr, height * dpr);
              }
              context.clearColor(cc[0], cc[1], cc[2], cc[3]);
              context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT | context.STENCIL_BUFFER_BIT);
            },
      endPass: () => {
        context.bindFramebuffer(context.FRAMEBUFFER, null);
      },
      addPostPass: (passConfig) => {
        passConfigsRef.current.push(passConfig);
      },
      removePostPass: (name) => {
        passConfigsRef.current = passConfigsRef.current.filter(p => p.name !== name);
      },
      getFramebuffer: (name) => fbManagerRef.current!.getFramebuffer(name),
      getTexture: (name) => fbManagerRef.current!.getTexture(name),
      readPixels: (fb, x, y, w, h, format, type, dest) => {
        context.bindFramebuffer(context.FRAMEBUFFER, fb);
        context.readPixels(x, y, w, h, format, type, dest);
        context.bindFramebuffer(context.FRAMEBUFFER, null);
      },
      resize: (w, h, newDpr) => {
              widthRef.current = w;
              heightRef.current = h;
              dprRef.current = newDpr ?? dprRef.current;
        setWidth(w);
        setHeight(h);
              setDpr(dprRef.current);
        
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        
        fbManagerRef.current?.resize(w, h, dpr);
        context.viewport(0, 0, w * dpr, h * dpr);
      },
      addPhysicsBody: (bodyConfig) => {
        return physicsRef.current!.addBody({
          mass: bodyConfig.mass,
          position: bodyConfig.position,
                velocity: [0, 0, 0],
                aabbHalfExtents: [bodyConfig.size[0]/2, bodyConfig.size[1]/2, bodyConfig.size[2]/2],
                restitution: 0.5,
                friction: 0.3,
                isStatic: bodyConfig.mass === 0,
              });
            },
      getPhysics: () => physicsRef.current,
    };
    
    apiRef.current = api;
    onReady?.(api);
    onSetup?.(api);
    
    // Start render loop
    lastTimeRef.current = performance.now();
    
    const renderLoop = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      
      // Call custom render function
      if (onRender) {
        onRender(api, delta, time / 1000);
      }
      
      animationRef.current = requestAnimationFrame(renderLoop);
    };
    
    animationRef.current = requestAnimationFrame(renderLoop);
    
    // Handle resize
    const handleResize = () => {
      const w = config.width || containerRef.current?.clientWidth || window.innerWidth;
      const h = config.height || containerRef.current?.clientHeight || window.innerHeight;
      api.resize(w, h, dpr);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      fbManagerRef.current?.destroy();
      shaderManagerRef.current?.destroy();
      physicsRef.current?.dispose();
    };
  }, []);
  
  // Expose ref
  useImperativeHandle(ref, () => ({
    getAPI: () => apiRef.current,
  }));
  
  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={{ width: '100%', height: '100%', position: 'relative', ...style }}
    >
      <canvas
        ref={canvasRef}
        width={width * dpr}
        height={height * dpr}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {children}
    </div>
  );
});

RawGLPipeline.displayName = 'RawGLPipeline';

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

// ============================================
// HOOK: useMemoryPool
// ============================================

/**
 * Hook for allocating pre-sized Float32Arrays for custom geometry attributes.
 * Eliminates GC pressure by reusing typed arrays.
 * 
 * @example
 * ```tsx
 * const { allocate, release, getBuffer } = useMemoryPool({
 *   position: { count: 10000, itemSize: 3 },
 *   velocity: { count: 10000, itemSize: 3 },
 *   color: { count: 10000, itemSize: 4 },
 * });
 * 
 * // Allocate buffers
 * const posBuffer = allocate('position');
 * const velBuffer = allocate('velocity');
 * 
 * // Use in WebGL
 * gl.bufferData(gl.ARRAY_BUFFER, posBuffer, gl.DYNAMIC_DRAW);
 * 
 * // Release when done
 * release('position');
 * ```
 */
export interface MemoryPoolConfig {
  [name: string]: {
    count: number;
    itemSize: number;
  };
}

export interface MemoryPoolAPI {
  /** Allocate a buffer from the pool */
  allocate: (name: string) => Float32Array | null;
  /** Release a buffer back to the pool */
  release: (name: string, buffer?: Float32Array) => void;
  /** Get buffer without allocating (for reading) */
  getBuffer: (name: string) => Float32Array | null;
  /** Get buffer info */
  getInfo: (name: string) => { count: number; itemSize: number; allocated: number; available: number } | null;
  /** Resize pool */
  resize: (name: string, newCount: number) => void;
  /** Clear all pools */
  clear: () => void;
  /** Get all pool names */
  getPoolNames: () => string[];
}

/**
 * Create a memory pool hook with zero-allocation buffer management
 */
export function useMemoryPool(config: MemoryPoolConfig): MemoryPoolAPI {
  const poolsRef = useRef<Map<string, { 
    buffers: Float32Array[]; 
    allocated: Set<Float32Array>;
    count: number; 
    itemSize: number; 
  }>>(new Map());
  
  // Initialize pools
  useEffect(() => {
    const pools = poolsRef.current;
    Object.entries(config).forEach(([name, { count, itemSize }]) => {
      const totalSize = count * itemSize;
      const buffers: Float32Array[] = [];
      for (let i = 0; i < Math.min(count, 100); i++) { // Pre-allocate up to 100 buffers
        buffers.push(new Float32Array(totalSize));
      }
      pools.set(name, { buffers, allocated: new Set(), count, itemSize });
    });
  }, [config]);
  
  const allocate = useCallback((name: string): Float32Array | null => {
    const pool = poolsRef.current.get(name);
    if (!pool) return null;
    
    let buffer = pool.buffers.pop();
    if (!buffer) {
      buffer = new Float32Array(pool.count * pool.itemSize);
    }
    pool.allocated.add(buffer);
    return buffer;
  }, []);
  
  const release = useCallback((name: string, buffer?: Float32Array) => {
    const pool = poolsRef.current.get(name);
    if (!pool) return;
    
    if (buffer) {
      pool.allocated.delete(buffer);
      pool.buffers.push(buffer);
    } else {
      // Release all allocated buffers for this pool
      pool.allocated.forEach(buf => pool.buffers.push(buf));
      pool.allocated.clear();
    }
  }, []);
  
  const getBuffer = useCallback((name: string): Float32Array | null => {
    const pool = poolsRef.current.get(name);
    if (!pool || pool.buffers.length === 0) return null;
      const buffer = pool.buffers[pool.buffers.length - 1];
      return buffer!;
    }, []);
  
  const getInfo = useCallback((name: string) => {
    const pool = poolsRef.current.get(name);
    if (!pool) return null;
    return {
      count: pool.count,
      itemSize: pool.itemSize,
      allocated: pool.allocated.size,
      available: pool.buffers.length,
    };
  }, []);
  
  const resize = useCallback((name: string, newCount: number) => {
    const pool = poolsRef.current.get(name);
    if (!pool) return;
    
    pool.count = newCount;
    const totalSize = newCount * pool.itemSize;
    
    // Resize existing buffers
    pool.buffers.forEach(buf => {
      if (buf.length !== totalSize) {
        const newBuf = new Float32Array(totalSize);
        newBuf.set(buf.subarray(0, Math.min(buf.length, totalSize)));
        Object.assign(buf, newBuf);
      }
    });
    
    pool.allocated.forEach(buf => {
      if (buf.length !== totalSize) {
        const newBuf = new Float32Array(totalSize);
        newBuf.set(buf.subarray(0, Math.min(buf.length, totalSize)));
        pool.allocated.delete(buf);
        pool.allocated.add(newBuf);
      }
    });
  }, []);
  
  const clear = useCallback(() => {
    poolsRef.current.forEach(pool => {
      pool.allocated.forEach(buf => pool.buffers.push(buf));
      pool.allocated.clear();
    });
  }, []);
  
  const getPoolNames = useCallback(() => {
    return Array.from(poolsRef.current.keys());
  }, []);
  
  return {
    allocate,
    release,
    getBuffer,
    getInfo,
    resize,
    clear,
    getPoolNames,
  };
}