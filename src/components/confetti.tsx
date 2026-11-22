"use client";

import type { CSSProperties } from "react";

const COLORS = ["var(--brand-red)", "var(--brand-gold)", "var(--brand-ink)", "#2f9e6e", "#3b82f6"];

/** Deterministic pseudo-random so every burst looks lively without Math.random in render. */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * A short confetti burst. Re-mount it (change `burstKey`) to fire again.
 * Purely decorative: hidden from screen readers and removed under reduced motion (CSS).
 */
export function Confetti({ burstKey = 0, pieces = 36, originY = "35%" }: { burstKey?: number; pieces?: number; originY?: string }) {
  return (
    <div key={burstKey} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: pieces }, (_, i) => {
        const r = (n: number) => rand(burstKey * 101 + i * 7 + n);
        const angle = r(1) * Math.PI * 2;
        const distance = 80 + r(2) * 160;
        const style = {
          "--x": `${46 + r(3) * 8}%`,
          "--y": originY,
          "--dx": `${Math.cos(angle) * distance}px`,
          "--dy": `${Math.sin(angle) * distance * 0.6 + 180}px`,
          "--rot": `${(r(4) - 0.5) * 1080}deg`,
          "--t": `${1.1 + r(5) * 0.8}s`,
          "--d": `${r(6) * 120}ms`,
          background: COLORS[i % COLORS.length],
          width: `${6 + r(7) * 5}px`,
          height: `${8 + r(8) * 8}px`,
          borderRadius: r(9) > 0.6 ? "999px" : "2px",
        } as CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
