"use client";

/**
 * DottedCanvas — mixed teal + gold animated dots for the Premise panel.
 * Opacity is driven by CSS (.dots-wrap hover rule) so it transitions
 * smoothly without re-initializing the canvas.
 */

import { useEffect, useRef } from "react";

const TEAL   = "rgba(42,157,143,0.6)";
const GOLD   = "rgba(233,168,37,0.55)";
const GLOW   = "#e9a825";
const GAP    = 36;
const RADIUS = 1.6;
const SPEED_MIN = 0.35;
const SPEED_MAX = 1.6;
const GLOW_DENSITY = 0.14;

export function DottedCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dots: {
      x: number; y: number;
      phase: number; speed: number;
      glows: boolean; color: string;
    }[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      canvas.width  = Math.floor(rect.width  * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      dots = [];
      const cols = Math.ceil(rect.width  / GAP);
      const rows = Math.ceil(rect.height / GAP);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: c * GAP + GAP / 2,
            y: r * GAP + GAP / 2,
            phase: Math.random() * Math.PI * 2,
            speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
            glows: Math.random() < GLOW_DENSITY,
            color: Math.random() < 0.5 ? TEAL : GOLD,
          });
        }
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      for (const d of dots) {
        d.phase += dt * d.speed;
        const t = (Math.sin(d.phase) + 1) / 2;

        if (d.glows && t > 0.82) {
          const i = (t - 0.82) / 0.18;
          ctx.shadowBlur  = 12 * i;
          ctx.shadowColor = GLOW;
          ctx.fillStyle   = GLOW;
          ctx.beginPath();
          ctx.arc(d.x, d.y, RADIUS + 0.7 * i, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle  = d.color;
          ctx.beginPath();
          ctx.arc(d.x, d.y, RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
