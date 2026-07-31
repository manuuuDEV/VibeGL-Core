# @vibe-gl/math-utils

Lock-free predictive physics engine for WebGL/WebGPU applications, utilizing SharedArrayBuffer and Sweep and Prune (SAP) broadphase collision detection.

## Installation

```bash
npm install @vibe-gl/math-utils
```

## Quick Start

```typescript
import { PredictivePhysics } from '@vibe-gl/math-utils';

const physics = new PredictivePhysics();
await physics.init();

physics.setGravity(0, -9.81, 0);
physics.start();

const bodyId = physics.addBody({
  mass: 1,
  position: [0, 10, 0],
  velocity: [0, 0, 0],
  aabbHalfExtents: [0.5, 0.5, 0.5],
  restitution: 0.5,
  friction: 0.3,
  isStatic: false
});
```

## Documentation

For full documentation, visit the [main repository on GitHub](https://github.com/manuuuDEV/VibeGL-Core).
