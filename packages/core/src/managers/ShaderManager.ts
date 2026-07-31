import * as THREE from 'three';
import { UniformMap } from '../types';

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  attributes: Map<string, number>;
}

export class ShaderManager {
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
