# ⚡ VibeGL-Core

![VibeGL Core Hero Banner](./docs/assets/hero-banner.png)

> **The Zero-Boilerplate 3D Engine for React. Instantly generate high-performance WebGL & WebGPU physics, interactive 3D UIs, and cyberpunk vibes. Built for humans and AI Vibe Coding.**

![npm version](https://img.shields.io/npm/v/@vibe-gl/core?color=neon)
![Bundle Size](https://img.shields.io/bundlephobia/minzip/@vibe-gl/core)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![React](https://img.shields.io/badge/React-18%2B-blue)
![WebGPU](https://img.shields.io/badge/WebGPU-Ready-green)
![Next.js](https://img.shields.io/badge/Next.js-App_Router_Ready-black)

## 🚀 What's New in v1.1.0 (Evolution Update)

* **WebGPU Support**: WebGPU rendering support via Three.js WebGPURenderer, with automatic fallback to WebGL2/CSS3D. (TSL Compute Shaders: experimental, currently disabled pending upstream Three.js compatibility fixes).
* **Next.js 14+ App Router Ready (RSC compatible via dynamic import)**: Fully optimized for React Server Components with seamless SSR hydration.
* **True Lock-Free Atomics**: Completely rewritten SharedArrayBuffer (SAB) physics synchronization for zero GC micro-stutters and deterministic frame prediction!

## 🧠 The Bifurcated Architecture

VibeGL-Core is built for distinct personas:

### 1. For "Vibe Coders" (The Declarative Magic)
Just want a beautiful 3D background without learning matrix math? Use our natural-language-like JSON config.
```tsx
import { VibeCanvas } from '@vibe-gl/core';

export default function App() {
  return (
    <VibeCanvas config={{
      environment: 'cyberpunk-neon',
      physics: 'low-gravity',
      particles: { count: 10000, behavior: 'swarm' },
      postProcessing: { bloom: 0.5, chromaticAberration: 0.02 }
    }} />
  );
}
```

### 2. Dynamic Scene Generation (useVibeCoding)
Programmatically inject 3D components from JSON schemas (perfect for AI agents or CMS integration):
```tsx
import { useVibeCoding, VibeCanvas } from '@vibe-gl/core';

const mySchema = {
  canvas: { environment: 'space' },
  objects: [{ id: '1', type: 'sphere', color: 'red', scale: 2 }]
};

export default function DynamicScene() {
  const { SceneComponents, canvasConfig } = useVibeCoding(mySchema);
  return (
    <VibeCanvas config={canvasConfig}>
      {SceneComponents}
    </VibeCanvas>
  );
}
```
> **Note:** `useVibeCoding` is an early-stage API. Currently only `type: 'sphere'` is supported in the schema; other shapes are silently skipped. More primitive types are planned.

### 3. The Imperative Bridge (onReady API)
Need a screenshot, raw camera access, or custom rendering logic? The `onReady` callback exposes the core engine directly:
```tsx
import { VibeCanvas } from '@vibe-gl/core';

export default function ScreenshotGenerator() {
  return (
    <VibeCanvas
      config={{ environment: 'studio' }}
      onReady={async (api) => {
        // Take a screenshot instantly when ready
        const dataUrl = await api.screenshot();
        console.log("Screenshot ready for download!", dataUrl);
        
        // You also have direct access to:
        // api.getScene(), api.getCamera(), api.getRenderer()
      }}
    />
  );
}
```

### 4. For "Hardcore Graphics Devs" (The Bare-Metal Layer)
Need raw WebGL2/WebGPU access?
```tsx
import { RawGLPipeline, useShaderInjector, useMemoryPool } from '@vibe-gl/core';

export default function HardcoreScene() {
  const { injectVertex, injectFragment } = useShaderInjector();
  const { allocate } = useMemoryPool({ positions: { count: 1000, itemSize: 3 } });
  
  return (
    <RawGLPipeline
      onFrame={({ gl }) => {
        // Raw WebGL2 control
      }}
    />
  );
}
```

## 🛠 Installation & Setup

### 1. Install Dependencies
```bash
npm install @vibe-gl/core @vibe-gl/math-utils three @react-three/fiber
```
*(Or use `pnpm add` / `yarn add`)*

### 2. Configure Security Headers (CRITICAL)
VibeGL uses a revolutionary **lock-free physics engine** that runs on a Web Worker via `SharedArrayBuffer` for zero-stutter 60FPS performance. 
Modern browsers require strict security headers to enable `SharedArrayBuffer`.

**If you are using Next.js**, add this to your `next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};
export default nextConfig;
```
*(If you are using Vite, configure your dev server headers similarly).*

### 3. Usage in Next.js App Router (RSC)
VibeGL components use WebGL and are inherently client-side. To prevent hydration errors, always load your 3D scenes dynamically:

```tsx
// app/page.tsx (Server Component)
import dynamic from 'next/dynamic';

// Dynamically import to avoid SSR Canvas hydration issues
const Scene = dynamic(() => import('./Scene'), { ssr: false, loading: () => <div>Loading 3D Engine...</div> });

export default function Page() {
  return <main><Scene /></main>;
}
```

## 🔬 Predictive Physics Engine (SAB)

![VibeGL Worker Architecture Engine](./docs/assets/architecture.jpeg)

We run purely translational AABB physics at 120FPS on a dedicated Web Worker using `SharedArrayBuffer` (SAB).
* **Ring Buffer**: Pre-calculates 4 frames ahead.
* **O(N log N) Broadphase via Sweep and Prune (SAP)**: No naive O(N²) collision checks.
* **Lock-Free Atomics**: No spin-locks, zero main-thread blocking.
* **Zero Allocation**: We never instantiate `new THREE.Vector3()` in the render loop.

## 📊 Performance
* **Designed for zero-allocation, low-jitter physics simulation.**
* Memory GC Pauses: **0ms** (Zero allocation pattern in physics loop)

---
*Built with ❤️ for the Vibe Coding generation.*
