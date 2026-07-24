# 🌀 vibe-gl-core: ⚡ The Zero-Boilerplate 3D Engine for React

[![npm version](https://img.shields.io/npm/v/vibe-gl-core.svg?style=for-the-badge)](https://www.npmjs.com/package/vibe-gl-core)
[![downloads](https://img.shields.io/npm/dm/vibe-gl-core.svg?style=for-the-badge)](https://www.npmjs.com/package/vibe-gl-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

![VibeGL Core Hero Banner](./docs/assets/hero-banner.png)

> **Instantly generate high-performance WebGL physics, interactive 3D UIs, and cyberpunk vibes with declarative React components. Built for humans and AI Vibe Coding. Zero memory leaks.**

`vibe-gl-core` is a revolutionary, zero-boilerplate library built on top of React and React Three Fiber. It transforms how you build immersive 3D simulations.

## ⚡ The VibeGL Way (Clean & Declarative)
```tsx
import { VibeCanvas, PhysicsBody } from "vibe-gl-core";

export default function MyScene() {
  return (
    <VibeCanvas backgroundColor="#0a0a0a">
      <PhysicsBody mass={10} gravityCenter={[0, 0, 0]} initialPosition={[0, 5, 0]}>
        <mesh>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      </PhysicsBody>
    </VibeCanvas>
  );
}
```

## 🏎️ Performance & Architecture
VibeGL-Core is ruthless about performance. We are obsessed with giving you a buttery-smooth 60+ FPS experience.

![VibeGL Worker Architecture Engine](./docs/assets/architecture.jpeg)

As illustrated above, our architecture leverages a Web Worker Physics Engine that runs entirely off the main thread. A continuous Data Stream feeds physics calculations into the engine, while the Result Buffer synchronizes the updated positions back to the React Three Fiber render loop. This complete separation ensures zero-lag UI rendering regardless of scene complexity.

- **Zero-Allocation Physics Loop**: Under the hood, `@vibe-gl/math-utils` utilizes a strict `ObjectPool` architecture.
- **Automatic Memory Cleanup**: The internal `useVibeCleanup()` hook meticulously traverses your scene graphs on unmount, automatically calling `.dispose()`.

## License
MIT License © 2026 VibeGL Core Team