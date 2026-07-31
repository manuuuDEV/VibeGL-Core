import React from 'react';

export interface CSS3DFallbackProps {
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export function CSS3DFallback({ className = '', style = {}, fallback }: CSS3DFallbackProps) {
  return (
    <div 
      className={className} 
      style={{ ...style, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {fallback || (
        <div style={{ perspective: '1000px', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
          <div style={{ 
            width: 100, height: 100, position: 'relative', transformStyle: 'preserve-3d', animation: 'rotate3d 5s linear infinite' 
          }}>
            <style>{`
              @keyframes rotate3d { from { transform: rotateX(0deg) rotateY(0deg); } to { transform: rotateX(360deg) rotateY(360deg); } }
              .css3d-face { position: absolute; width: 100%; height: 100%; border: 2px solid #0ff; background: rgba(0, 255, 255, 0.1); box-shadow: 0 0 10px #0ff, inset 0 0 10px #0ff; }
              .css3d-front  { transform: translateZ(50px); }
              .css3d-back   { transform: rotateY(180deg) translateZ(50px); }
              .css3d-right  { transform: rotateY(90deg) translateZ(50px); }
              .css3d-left   { transform: rotateY(-90deg) translateZ(50px); }
              .css3d-top    { transform: rotateX(90deg) translateZ(50px); }
              .css3d-bottom { transform: rotateX(-90deg) translateZ(50px); }
            `}</style>
            <div className="css3d-face css3d-front"></div>
            <div className="css3d-face css3d-back"></div>
            <div className="css3d-face css3d-right"></div>
            <div className="css3d-face css3d-left"></div>
            <div className="css3d-face css3d-top"></div>
            <div className="css3d-face css3d-bottom"></div>
          </div>
          <div style={{ position: 'absolute', bottom: 20, color: '#0ff', fontFamily: 'monospace', textShadow: '0 0 5px #0ff', whiteSpace: 'nowrap', left: '50%', transform: 'translateX(-50%)' }}>
            WebGPU/WebGL Failed - Rendering CSS 3D Fallback
          </div>
        </div>
      )}
    </div>
  );
}
