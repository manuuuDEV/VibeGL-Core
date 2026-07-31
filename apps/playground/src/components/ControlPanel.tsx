"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Zap, Globe, SlidersHorizontal } from "lucide-react";

export function ControlPanel() {
  const [particles, setParticles] = useState(50000);
  const [preset, setPreset] = useState("cyberpunk");

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-panel"
      style={{
        width: "320px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>
        <Settings size={20} color="var(--accent-cyan)" />
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>VibeGL Controls</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Globe size={14} /> Environment Preset
        </label>
        <select 
          className="glass-input" 
          value={preset} 
          onChange={(e) => setPreset(e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="cyberpunk">Cyberpunk Neon</option>
          <option value="space">Deep Space</option>
          <option value="minimal">Minimal Studio</option>
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Zap size={14} /> Particles ({particles.toLocaleString()})
        </label>
        <input 
          type="range" 
          min="1000" 
          max="1000000" 
          step="1000"
          value={particles}
          onChange={(e) => setParticles(parseInt(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent-magenta)" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          <SlidersHorizontal size={14} /> Behavior
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="glass-button active" style={{ flex: 1, fontSize: "12px" }}>Swarm</button>
          <button className="glass-button" style={{ flex: 1, fontSize: "12px" }}>Explode</button>
        </div>
      </div>
    </motion.div>
  );
}