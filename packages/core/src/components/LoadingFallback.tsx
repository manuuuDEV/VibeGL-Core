import React from 'react';

export interface LoadingFallbackProps {
  className?: string;
  style?: React.CSSProperties;
}

export function LoadingFallback({ className = '', style = {} }: LoadingFallbackProps) {
  return (
    <div className={className} style={{ ...style, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
