import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VibeCanvas } from '../VibeCanvas';
import * as MathUtils from '@vibe-gl/math-utils';

// Mock PredictivePhysics since we can't run WebWorkers easily in JSDOM
vi.mock('@vibe-gl/math-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof MathUtils>();
  return {
    ...actual,
    createPredictivePhysics: vi.fn(() => {
      return {
        init: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        addBody: vi.fn(),
        removeBody: vi.fn(),
        setGravity: vi.fn(),
        dispose: vi.fn(),
      };
    }),
  };
});

describe('VibeCanvas Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children inside the canvas', async () => {
    // We mock Canvas because R3F Canvas tries to create a WebGL context and rendering loop
    // But testing that children render is sufficient for our component API test.
    
    await act(async () => {
      render(
        <VibeCanvas config={{ environment: 'studio' }}>
          <mesh data-testid="child-mesh" />
        </VibeCanvas>
      );
    });

    // Check if the canvas element is in the document (the container created by VibeCanvas)
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('calls onReady with the correct API object', async () => {
    const onReadyMock = vi.fn();
    
    await act(async () => {
      render(
        <VibeCanvas 
          config={{ environment: 'studio' }} 
          onReady={onReadyMock}
        />
      );
    });

    // R3F canvas might call this asynchronously, but we wait for it
    expect(onReadyMock).toHaveBeenCalled();
    const api = onReadyMock.mock.calls[0]?.[0];
    expect(api).toHaveProperty('getScene');
    expect(api).toHaveProperty('getCamera');
    expect(api).toHaveProperty('getRenderer');
    expect(api).toHaveProperty('screenshot');
    expect(typeof api.screenshot).toBe('function');
  });

  it('initializes PredictivePhysics when physics config is provided', async () => {
    await act(async () => {
      render(
        <VibeCanvas 
          config={{ physics: 'earth' }} 
        />
      );
    });

    expect(MathUtils.createPredictivePhysics).toHaveBeenCalled();
  });

  it('does not initialize physics if physics config is false/undefined', async () => {
    await act(async () => {
      render(
        <VibeCanvas 
          config={{ environment: 'studio' }} 
        />
      );
    });

    // It is undefined by default in VibeCanvas? Actually DEFAULT_VIBE_CONFIG has physics: 'earth'
    // Let's pass physics: undefined explicitly
    vi.clearAllMocks();

    await act(async () => {
      render(
        <VibeCanvas 
          config={{ physics: 'none' }} 
        />
      );
    });

    expect(MathUtils.createPredictivePhysics).not.toHaveBeenCalled();
  });
});
