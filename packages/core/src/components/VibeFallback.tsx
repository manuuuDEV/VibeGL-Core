import React, { useEffect, useState, useMemo, CSSProperties } from "react";

export interface VibeFallbackProps {
  children: React.ReactNode;
  /** Custom fallback content */
  fallback?: React.ReactNode;
  /** Enable CSS 3D fallback when WebGL unavailable */
  enableCSS3DFallback?: boolean;
  /** Fallback quality: 'high' | 'medium' | 'low' */
  quality?: 'high' | 'medium' | 'low';
}

interface ParticleStyle extends CSSProperties {
  '--x'?: string;
  '--y'?: string;
  '--z'?: string;
}

/**
 * VibeFallback - Graceful degradation for non-WebGL environments
 * 
 * If WebGL2 is not supported, automatically mounts a stunning CSS 3D-based
 * UI fallback that mimics the 3D experience using CSS transforms and animations.
 * The host application never crashes.
 * 
 * @example
 * ```tsx
 * <VibeFallback enableCSS3DFallback quality="high">
 *   <My3DScene />
 * </VibeFallback>
 * ```
 */
export function VibeFallback({ 
  children, 
  fallback, 
  enableCSS3DFallback = true,
  quality = 'high'
}: VibeFallbackProps) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [webglChecked, setWebglChecked] = useState(false);
  const [css3dSupported, setCss3dSupported] = useState(false);
  
  // Loading state styles
  const loadingStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
    color: '#00ffff',
    fontFamily: 'system-ui, sans-serif',
  };
  
  const spinnerStyles: CSSProperties = {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(0, 255, 255, 0.1)',
    borderTopColor: '#00ffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  // Check WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { 
        failIfMajorPerformanceCaveat: quality === 'high' 
      }) || canvas.getContext('webgl', { 
        failIfMajorPerformanceCaveat: quality === 'high' 
      });
      
      const webgl2Supported = !!gl;
      setHasWebGL(webgl2Supported);
      
      // Check CSS 3D transform support
      const testEl = document.createElement('div');
      testEl.style.transform = 'translate3d(0,0,0)';
      const css3dSupported = testEl.style.transform !== '';
      setCss3dSupported(css3dSupported);
      
      setWebglChecked(true);
    } catch {
      setHasWebGL(false);
      setCss3dSupported(false);
      setWebglChecked(true);
    }
  }, [quality]);

  // CSS 3D Fallback Scene
  const CSS3DFallback = useMemo(() => {
    if (!enableCSS3DFallback || hasWebGL) return null;
    
    const particleCount = quality === 'high' ? 20 : quality === 'medium' ? 10 : 5;
    const particles = Array.from({ length: particleCount }).map((_, i) => {
      const particleStyle: ParticleStyle = {
        position: 'absolute',
        width: '4px',
        height: '4px',
        borderRadius: '50%',
        background: '#00ffff',
        boxShadow: '0 0 10px #00ffff, 0 0 20px #ff00ff',
        left: '50%',
        top: '50%',
        '--x': `${(Math.random() - 0.5) * 400}px`,
        '--y': `${(Math.random() - 0.5) * 400}px`,
        '--z': `${(Math.random() - 0.5) * 400}px`,
        animationDelay: `${Math.random() * 10}s`,
        animationDuration: `${8 + Math.random() * 4}s`,
        animationName: 'float',
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
      };
      
      return React.createElement('div', {
        key: i,
        className: 'particle',
        style: particleStyle,
      });
    });

    const containerStyles: CSSProperties = {
      width: '100%',
      height: '100%',
      perspective: '1000px',
      perspectiveOrigin: 'center center',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      position: 'relative',
    };

    const sceneStyles: CSSProperties = {
      width: '100%',
      height: '100%',
      transformStyle: 'preserve-3d',
      animation: 'rotate 20s linear infinite',
    };

    const cubeStyles: CSSProperties = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '200px',
      height: '200px',
      transform: 'translate(-50%, -50%) translateZ(-100px)',
      transformStyle: 'preserve-3d',
    };

    const faceStyles: CSSProperties = {
      position: 'absolute',
      width: '200px',
      height: '200px',
      border: '2px solid rgba(0, 255, 255, 0.3)',
      background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(255, 0, 255, 0.1) 100%)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Monospace', monospace",
      fontSize: '14px',
      color: '#00ffff',
      textShadow: '0 0 10px #00ffff',
    };

    const particlesContainerStyles: CSSProperties = {
      position: 'absolute',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    };

    const messageStyles: CSSProperties = {
      position: 'absolute',
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      textAlign: 'center',
      color: 'rgba(255, 255, 255, 0.7)',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '80%',
    };

    const h2Styles: CSSProperties = {
      margin: '0 0 8px',
      fontSize: '1.5rem',
      background: 'linear-gradient(90deg, #00ffff, #ff00ff)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    };

    const pStyles: CSSProperties = {
      margin: 0,
      fontSize: '1rem',
      opacity: 0.8,
    };

    // Inject keyframes via a style element
    const globalStyles = React.createElement('style', { key: 'global-styles' }, `
      @keyframes rotate {
        from { transform: rotateY(0deg) rotateX(0deg); }
        to { transform: rotateY(360deg) rotateX(15deg); }
      }
      @keyframes float {
        0%, 100% { transform: translate3d(var(--x), var(--y), var(--z)) scale(1); opacity: 0.5; }
        50% { transform: translate3d(var(--x), calc(var(--y) - 100px), var(--z)) scale(1.5); opacity: 1; }
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `);

    return React.createElement('div', { style: containerStyles, key: 'css3d-fallback' },
      globalStyles,
      React.createElement('div', { style: sceneStyles, className: 'scene' },
        React.createElement('div', { style: cubeStyles, className: 'cube' },
          React.createElement('div', { style: { ...faceStyles, transform: 'rotateY(0deg) translateZ(100px)' }, className: 'face front' }, 'FRONT'),
          React.createElement('div', { style: { ...faceStyles, transform: 'rotateY(180deg) translateZ(100px)' }, className: 'face back' }, 'BACK'),
          React.createElement('div', { style: { ...faceStyles, transform: 'rotateY(90deg) translateZ(100px)' }, className: 'face right' }, 'RIGHT'),
          React.createElement('div', { style: { ...faceStyles, transform: 'rotateY(-90deg) translateZ(100px)' }, className: 'face left' }, 'LEFT'),
          React.createElement('div', { style: { ...faceStyles, transform: 'rotateX(90deg) translateZ(100px)' }, className: 'face top' }, 'TOP'),
          React.createElement('div', { style: { ...faceStyles, transform: 'rotateX(-90deg) translateZ(100px)' }, className: 'face bottom' }, 'BOTTOM')
        ),
        React.createElement('div', { style: particlesContainerStyles, className: 'particles' }, particles)
      ),
      React.createElement('div', { style: messageStyles, className: 'message' },
        React.createElement('h2', { style: h2Styles }, 'WebGL Not Available'),
        React.createElement('p', { style: pStyles }, 'Running in CSS 3D Fallback Mode — Update your browser for full 3D experience')
      )
    );
  }, [enableCSS3DFallback, hasWebGL, quality]);

  // Show loading while checking
  if (!webglChecked) {
    return React.createElement('div', { style: loadingStyles },
      React.createElement('style', { key: 'loading-styles' }, `
        @keyframes spin { to { transform: rotate(360deg); } }
      `),
      React.createElement('div', { style: spinnerStyles, className: 'spinner' })
    );
  }

  // WebGL available - render children normally
  if (hasWebGL) {
    return <>{children}</>;
  }

  // No WebGL - show CSS 3D fallback or custom fallback
  if (css3dSupported && enableCSS3DFallback) {
    return CSS3DFallback;
  }

  // Ultimate fallback - simple message
  const ultimateFallbackStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    padding: '40px',
    textAlign: 'center',
    boxSizing: 'border-box',
  };

  const iconStyles: CSSProperties = {
    fontSize: '4rem',
    marginBottom: '1rem',
    animation: 'pulse 2s ease-in-out infinite',
  };

  const ultimateStyles = React.createElement('style', { key: 'ultimate-styles' }, `
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  `);

  return React.createElement('div', { style: ultimateFallbackStyles, key: 'ultimate-fallback' },
    ultimateStyles,
    React.createElement('div', { style: iconStyles, className: 'icon' }, '🌐'),
    React.createElement('h2', { style: { margin: '0 0 1rem', fontSize: '1.5rem' } }, 'WebGL Not Supported'),
    React.createElement('p', { style: { opacity: 0.8, maxWidth: '400px' } }, 'Your browser does not support WebGL. Please update to a modern browser for the full 3D experience.'),
    fallback
  );
}