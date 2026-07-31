'use client';
"use client";
import { 
  useRef, 
  useEffect, 
  useState, 
  useImperativeHandle,
  forwardRef 
} from 'react';
import * as THREE from 'three';
import { FramebufferManager } from '../managers/FramebufferManager';
import { ShaderManager } from '../managers/ShaderManager';
import { PredictivePhysics } from '@vibe-gl/math-utils';
import { FramebufferConfig, ShaderPassConfig, RawGLPipelineAPI, RawGLPipelineProps } from '../types';




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

