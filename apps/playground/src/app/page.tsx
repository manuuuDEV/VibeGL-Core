import { ControlPanel } from "@/components/ControlPanel";
import { NaturalLanguageInput } from "@/components/NaturalLanguageInput";
import { VibeCanvas } from "@vibe-gl/core";

export default function PlaygroundPage() {
  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {/* Background Canvas Layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none", // Prevent canvas from eating UI events
        }}
      >
        <VibeCanvas
          config={{
            environment: "cyberpunk-neon",
            physics: "zero-g",
            particles: { count: 50000 },
            postProcessing: { bloom: 0.5, vignette: 0.5 }
          }}
        />
      </div>

      {/* UI Overlay Layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none", // Let clicks pass through empty areas
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "24px",
        }}
      >
        {/* Top/Sidebar Area */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {/* We re-enable pointer events on the interactive components */}
          <div style={{ pointerEvents: "auto" }}>
            <ControlPanel />
          </div>
        </div>

        {/* Bottom Command Bar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <div style={{ pointerEvents: "auto", width: "100%", maxWidth: "600px" }}>
            <NaturalLanguageInput />
          </div>
        </div>
      </div>
    </main>
  );
}