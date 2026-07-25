"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Terminal, ArrowRight } from "lucide-react";

export function NaturalLanguageInput() {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    // Call the heuristic parser useVibeCoding().command(query)
    // NOTE: This is purely client-side heuristic logic, no LLM API key exposed.
    console.log(`[VibeGL] Executing natural language command: "${query}"`);
    setQuery("");
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="glass-panel"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        gap: "12px",
        width: "100%",
        borderRadius: "24px",
      }}
    >
      <Terminal size={18} color="var(--accent-magenta)" />
      
      <input
        type="text"
        placeholder="Type a command (e.g. 'make it rain particles')..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="glass-input"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          padding: "8px 0",
          fontSize: "14px",
          boxShadow: "none",
        }}
      />

      <button 
        type="submit" 
        className="glass-button"
        style={{
          padding: "6px",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          border: "none",
          background: query.trim() ? "var(--accent-cyan)" : "rgba(255,255,255,0.1)",
          color: query.trim() ? "#000" : "var(--text-muted)",
        }}
      >
        <ArrowRight size={16} />
      </button>
    </motion.form>
  );
}