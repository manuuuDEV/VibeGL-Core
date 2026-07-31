import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Canvas getContext for WebGL
HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
  if (contextId === 'webgl2' || contextId === 'webgl') {
    return {
      getExtension: vi.fn(),
      getParameter: vi.fn(() => 0),
      createTexture: vi.fn(),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      viewport: vi.fn(),
      canvas: document.createElement('canvas'),
    } as unknown as RenderingContext;
  }
  return null;
}) as any;

// Mock PointerEvent
if (!(globalThis as any).PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 0;
    }
  }
  (globalThis as any).PointerEvent = PointerEvent as any;
}

// Mock WebGPU globals
(globalThis as any).GPUShaderStage = {
  VERTEX: 1,
  FRAGMENT: 2,
  COMPUTE: 4,
} as any;
