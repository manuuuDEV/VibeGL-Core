# ⚡ @vibe-gl/core

> **The Zero-Boilerplate 3D Engine for React. Instantly generate high-performance WebGL & WebGPU physics, interactive 3D UIs, and cyberpunk vibes.**

![npm version](https://img.shields.io/npm/v/@vibe-gl/core?color=neon)
![Bundle Size](https://img.shields.io/bundlephobia/minzip/@vibe-gl/core)

`@vibe-gl/core` is a lightweight, declarative 3D engine built on top of React Three Fiber and Three.js. It gives you the power of a custom Web Worker physics engine, automatic post-processing (bloom, chromatic aberration, grain), and WebGPU fallback detection without writing any boilerplate code.

---

## 🚀 Features

- **Zero-Boilerplate 3D**: Get a fully working 3D scene in less than 10 lines of code.
- **Lock-Free Physics**: A custom physics engine running on a Web Worker using `SharedArrayBuffer` for 0ms GC pauses and buttery-smooth 120FPS.
- **WebGPU Ready**: Automatically detects WebGPU and falls back to WebGL2 gracefully.
- **AI Vibe Coding**: First-class support for `useVibeCoding`, allowing dynamic generation of 3D objects from JSON schemas.
- **Modular Architecture**: Built with tree-shakable hooks (`usePhysicsEngine`, `useGPUDetect`, `useVibeAPI`) for maximum bundle efficiency.

---

## 📦 Installation

```bash
npm install @vibe-gl/core @vibe-gl/math-utils three @react-three/fiber
```

*(Note: `three` and `@react-three/fiber` are required peer dependencies).*

---

## ⚡ Quick Start (The "Zero-to-Hero")

Simply drop the `VibeCanvas` component into your app and pass a JSON configuration object.

```tsx
import { VibeCanvas } from '@vibe-gl/core';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <VibeCanvas 
        config={{
          environment: 'cyberpunk-neon',
          physics: 'low-gravity',
          postProcessing: {
            bloom: 0.5,
            chromaticAberration: 0.02,
            vignette: 0.3
          }
        }} 
      />
    </div>
  );
}
```

## 🛠 Advanced Usage (The Imperative Bridge)

If you need programmatic control over the canvas (e.g., to take screenshots, access the raw Three.js camera, or dynamically add physical bodies), you can use the `onReady` API:

```tsx
import { VibeCanvas, VibeCanvasAPI } from '@vibe-gl/core';

export default function ScreenshotGenerator() {
  const handleReady = async (api: VibeCanvasAPI) => {
    // Dynamically inject a physical object
    api.addObject({ id: 'box-1', type: 'box', mass: 10, position: [0, 5, 0] });

    // Take an instant screenshot of the WebGL buffer
    const dataUrl = await api.screenshot();
    console.log("Screenshot saved:", dataUrl);
  };

  return <VibeCanvas config={{ environment: 'studio' }} onReady={handleReady} />;
}
```

## 🧠 Security Requirements (SharedArrayBuffer)

Because VibeGL uses a high-performance Lock-Free Physics engine on a Web Worker, you **must** serve your application with the following HTTP headers to enable Cross-Origin Isolation:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If you use **Next.js**, add this to your `next.config.mjs`:
```javascript
export default {
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
```

---

## 📖 Full Documentation
For the complete API reference, architecture details, and more advanced guides, please visit the [Main GitHub Repository](https://github.com/manuuuDEV/VibeGL-Core).
