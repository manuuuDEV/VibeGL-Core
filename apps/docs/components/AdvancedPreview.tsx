import dynamic from 'next/dynamic';
import React, { useState } from 'react';

const VibeCanvasDynamic = dynamic(
  () => import('@vibe-gl/core').then((mod) => mod.VibeCanvas),
  { ssr: false, loading: () => <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#fff', borderRadius: '8px' }}>Caricamento Motore 3D...</div> }
);

export default function AdvancedPreview() {
  const [gravity, setGravity] = useState<'earth' | 'low-gravity' | 'none'>('earth');
  const [env, setEnv] = useState<'cyberpunk-neon' | 'space' | 'studio'>('cyberpunk-neon');

  return (
    <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', marginTop: '1rem', marginBottom: '1rem', border: '1px solid #333', background: '#000' }}>
      
      <div style={{ padding: '10px', display: 'flex', gap: '10px', borderBottom: '1px solid #333', flexWrap: 'wrap' }}>
        <select value={env} onChange={(e) => setEnv(e.target.value as any)} style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px' }}>
          <option value="cyberpunk-neon">Cyberpunk Neon</option>
          <option value="space">Space</option>
          <option value="studio">Studio</option>
        </select>

        <select value={gravity} onChange={(e) => setGravity(e.target.value as any)} style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px' }}>
          <option value="earth">Gravità Terrestre</option>
          <option value="low-gravity">Bassa Gravità</option>
          <option value="none">Zero Gravità</option>
        </select>
      </div>

      <div style={{ height: '400px', position: 'relative' }}>
        <VibeCanvasDynamic 
          config={{
            environment: env,
            physics: gravity,
            postProcessing: {
              bloom: 2.0,
              chromaticAberration: 0.1,
              vignette: 0.5,
              grain: 0.05
            }
          }} 
        />
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', pointerEvents: 'none' }}>
          Trascina per ruotare la camera. Il motore fisico sta girando a 120Hz su un Worker isolato.
        </div>
      </div>
    </div>
  );
}
