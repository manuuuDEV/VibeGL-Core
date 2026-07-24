import React, { useEffect, useState } from "react";

export function VibeFallback({ children }: { children: React.ReactNode }) {
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) setHasWebGL(false);
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  if (hasWebGL) return <>{children}</>;

  return (
    <div style={{ padding: 20, textAlign: "center", background: "#f0f0f0", color: "#333", height: "100vh" }}>
      <h2>WebGL is not supported on this device.</h2>
      <p>Please upgrade your browser or check your device settings to enjoy the full VibeGL experience.</p>
    </div>
  );
}