# @vibe-gl/core

React components for declarative 3D scenes with integrated physics, built on top of React Three Fiber.

## Installation

```bash
npm install @vibe-gl/core
```

## Quick Start

```tsx
import { VibeCanvas, useVibeCoding } from '@vibe-gl/core';

function App() {
  const schema = { 
    objects: [{ id: '1', type: 'sphere', color: 'red', scale: 2 }], 
    canvas: { environment: 'space' } 
  };
  const { SceneComponents, canvasConfig } = useVibeCoding(schema);

  return (
    <VibeCanvas config={canvasConfig}>
      {SceneComponents}
    </VibeCanvas>
  );
}
```

## Documentation

For full documentation, visit the [main repository on GitHub](https://github.com/manuuuDEV/VibeGL-Core).
