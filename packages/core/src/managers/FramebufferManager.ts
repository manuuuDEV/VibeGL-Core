import { FramebufferConfig } from '../types';

export class FramebufferManager {
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
