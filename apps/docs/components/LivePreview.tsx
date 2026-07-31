import dynamic from 'next/dynamic';
import React from 'react';

const VibeCanvasDynamic = dynamic(
  () => import('@vibe-gl/core').then((mod) => mod.VibeCanvas),
  { ssr: false, loading: () => <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#fff', borderRadius: '8px' }}>Caricamento Motore 3D...</div> }
);

export default function LivePreview() {
  return (
    <div style={{ width: '100%', height: '300px', borderRadius: '8px', overflow: 'hidden', marginTop: '1rem', marginBottom: '1rem', border: '1px solid #333' }}>
      <VibeCanvasDynamic 
        config={{
          environment: 'cyberpunk-neon',
          physics: 'earth',
          postProcessing: {
            bloom: 1.5,
            chromaticAberration: 0.05
          }
        }} 
      />
    </div>
  );
}
