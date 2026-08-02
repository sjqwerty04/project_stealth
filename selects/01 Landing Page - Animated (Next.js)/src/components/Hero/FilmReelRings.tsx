"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface FilmTrailer {
  id: number;
  title: string;
  youtubeKey: string | null;
  logoUrl: string | null;
  backdrop: string | null;
  start: number;
  end: number;
}

// Frame layout
const FRAME_W = 1.8;
const VIDEO_H = 0.5;      // video content height
const STRIP_H = 0.1;      // top sprocket strip height
const FRAME_H = VIDEO_H + STRIP_H; // total height used for ring gap calc

// Spacing between frames on the ring.
// FRAME_STEP > FRAME_W creates a visible gap; gap = FRAME_STEP - FRAME_W.
// At 1.55× there's ~0.99 world-unit breathing room between each frame,
// making the ring curvature legible and preventing edge overlap.
const FRAME_STEP = FRAME_W * 1.55;

// iframe pixel dimensions — aspect matches VIDEO_H/FRAME_W ≈ 3.6:1
// overflow: hidden will crop any extra height
const IFRAME_W = 240;
const IFRAME_H = 80;

// Samsung concave curve — bend along X axis
// Smaller radius = more curve. Edge fallback: (cos(arcHalf)-1)*CURVE_R
const CURVE_R = 3.0;

/**
 * Creates a curved BufferGeometry strip — like a bent plane.
 * Concave toward the viewer: center at z=0, edges fall back in z.
 * No open side edges (unlike CylinderGeometry) — seamless surface.
 */
function makeCurvedStrip(
  width: number,
  height: number,
  radius: number,
  segs = 32
): THREE.BufferGeometry {
  const arcAngle = width / radius;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = segs + 1;

  for (let j = 0; j < 2; j++) {
    const y = (j - 0.5) * height;
    for (let i = 0; i < cols; i++) {
      const t = i / segs;
      const theta = (t - 0.5) * arcAngle;
      positions.push(Math.sin(theta) * radius, y, (Math.cos(theta) - 1) * radius);
      uvs.push(t, j);
    }
  }

  for (let i = 0; i < segs; i++) {
    const a = i, b = i + 1, c = cols + i, d = cols + i + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Shared geometry instances — built once, reused across all film frames
const VIDEO_GEO = makeCurvedStrip(FRAME_W, VIDEO_H, CURVE_R);
const BACKDROP_GEO = makeCurvedStrip(FRAME_W, VIDEO_H, CURVE_R);

function FilmFrame({
  position,
  rotation,
  youtubeKey,
  logoUrl,
  backdropUrl,
  start,
  end,
  visible = true,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  youtubeKey: string | null;
  logoUrl: string | null;
  backdropUrl: string | null;
  start: number;
  end: number;
  visible?: boolean;
}) {
  if (!visible) return null;

  const embedSrc = youtubeKey
    ? `https://www.youtube.com/embed/${youtubeKey}?autoplay=1&mute=1&loop=1&playlist=${youtubeKey}&start=${start}&end=${end}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1`
    : null;

  return (
    <group position={position} rotation={rotation}>
      {/* ── Sprocket strip — TOP ONLY (film tape aesthetic) ── */}
      <mesh position={[0, VIDEO_H / 2 + STRIP_H / 2, 0]}>
        <planeGeometry args={[FRAME_W, STRIP_H]} />
        <meshStandardMaterial color="#111111" side={THREE.DoubleSide} />
      </mesh>
      {[-0.65, -0.22, 0.22, 0.65].map((xOff) => (
        <mesh key={xOff} position={[xOff, VIDEO_H / 2 + STRIP_H / 2, 0.005]}>
          <planeGeometry args={[0.09, 0.058]} />
          <meshStandardMaterial color="#040404" />
        </mesh>
      ))}

      {/* ── Dark backing — curved, no border edges ── */}
      <mesh geometry={VIDEO_GEO}>
        <meshStandardMaterial color="#0d0d0d" side={THREE.DoubleSide} />
      </mesh>

      {/* ── Content ── */}
      {embedSrc ? (
        <Html
          transform
          occlude={false}
          distanceFactor={5.5}
          position={[0, 0, 0.02]}
          style={{
            width: `${IFRAME_W}px`,
            height: `${IFRAME_H}px`,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <iframe
            src={embedSrc}
            width={IFRAME_W}
            height={IFRAME_H}
            allow="autoplay; encrypted-media"
            title={`film-${start}`}
            style={{
              border: "none",
              pointerEvents: "none",
              display: "block",
              transform: "scale(1.08)",
              transformOrigin: "center center",
            }}
          />
          {/* Cinematic 50% tint — hides low-res compression + adds film mood */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.50)",
              pointerEvents: "none",
            }}
          />
          {/* Edge darkening — reinforces the ring's natural curvature on sides */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.38) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.38) 100%)",
              pointerEvents: "none",
            }}
          />
          {/* Film logo — 25% smaller than before (58% → 43%), full-res source */}
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "43%",
                height: "auto",
                maxHeight: "52%",
                objectFit: "contain",
                pointerEvents: "none",
                imageRendering: "auto",
                filter: "drop-shadow(0 2px 10px rgba(0,0,0,1)) drop-shadow(0 0 4px rgba(0,0,0,0.9))",
              }}
            />
          )}
        </Html>
      ) : backdropUrl ? (
        <FallbackImage backdropUrl={backdropUrl} />
      ) : null}
    </group>
  );
}

function FallbackImage({ backdropUrl }: { backdropUrl: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(backdropUrl, (t) => setTex(t));
  }, [backdropUrl]);

  if (!tex) return null;
  return (
    <mesh geometry={BACKDROP_GEO}>
      <meshStandardMaterial
        map={tex}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function FilmRing({
  radius,
  trailers,
  rotationSpeed,
  tiltX,
  tiltZ,
  yOffset = 0,
  trailerOffset = 0,
}: {
  radius: number;
  trailers: FilmTrailer[];
  rotationSpeed: number;
  tiltX: number;
  tiltZ: number;
  yOffset?: number;
  trailerOffset?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  const circumference = 2 * Math.PI * radius;
  // Use FRAME_STEP (not FRAME_W) so frames are evenly spaced with visible gaps
  const frameCount = Math.round(circumference / FRAME_STEP);

  const frames = useMemo(() => {
    const items = [];
    for (let i = 0; i < frameCount; i++) {
      const angle = (i / frameCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const rotY = -angle + Math.PI / 2;
      items.push({
        position: [x, yOffset, z] as [number, number, number],
        rotation: [0, rotY, 0] as [number, number, number],
        trailer: trailers[(i + trailerOffset) % Math.max(trailers.length, 1)] ?? null,
      });
    }
    return items;
  }, [radius, frameCount, trailers, yOffset, trailerOffset]);

  return (
    <group ref={groupRef} rotation={[tiltX, 0, tiltZ]}>
      {frames.map((frame, i) => (
        <FilmFrame
          key={i}
          position={frame.position}
          rotation={frame.rotation}
          youtubeKey={frame.trailer?.youtubeKey ?? null}
          logoUrl={frame.trailer?.logoUrl ?? null}
          backdropUrl={frame.trailer?.backdrop ?? null}
          start={frame.trailer?.start ?? 35}
          end={frame.trailer?.end ?? 42}
        />
      ))}
    </group>
  );
}

function GlassRing({
  radius,
  tiltX,
  tiltZ,
  rotationSpeed,
  opacity = 0.12,
  tubeRadius = 0.06,
}: {
  radius: number;
  tiltX: number;
  tiltZ: number;
  rotationSpeed: number;
  opacity?: number;
  tubeRadius?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <group rotation={[tiltX, 0, tiltZ]}>
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, tubeRadius, 16, 128]} />
        <meshStandardMaterial
          color="#aaccff"
          transparent
          opacity={opacity}
          emissive="#4488ff"
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

function CameraRig() {
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((state) => {
    const cam = state.camera;
    cam.position.x += (mouse.current.x * 0.9 - cam.position.x) * 0.04;
    cam.position.y += (-mouse.current.y * 0.6 + 0.5 - cam.position.y) * 0.04;
    cam.lookAt(0, 0, 0);
  });

  return null;
}

function Scene({ trailers }: { trailers: FilmTrailer[] }) {
  const [ring2Ready, setRing2Ready] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRing2Ready(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const ring1Trailers = trailers.slice(0, 8);
  const ring2Trailers = trailers.slice(8, 14);

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 5, 5]} intensity={0.5} />
      <pointLight position={[-5, -3, -5]} intensity={0.25} color="#4488ff" />

      {/* Ring 1 — large orbital radius so the circular arc is clearly visible */}
      <FilmRing
        radius={6.5}
        trailers={ring1Trailers}
        rotationSpeed={0.05}
        tiltX={0.35}
        tiltZ={0.12}
      />

      {/* Ring 2 — inner counter-rotating ring for depth */}
      {ring2Ready && (
        <FilmRing
          radius={4.2}
          trailers={ring2Trailers}
          rotationSpeed={-0.045}
          tiltX={-0.25}
          tiltZ={-0.1}
          yOffset={0.35}
          trailerOffset={8}
        />
      )}

      {/* Ghost glass orbital rings */}
      <GlassRing radius={8.2} tiltX={0.45} tiltZ={-0.25} rotationSpeed={0.02} opacity={0.09} tubeRadius={0.055} />
      <GlassRing radius={9.1} tiltX={-0.35} tiltZ={0.18} rotationSpeed={-0.015} opacity={0.06} tubeRadius={0.045} />
      <GlassRing radius={3.0} tiltX={0.55} tiltZ={0.35} rotationSpeed={0.035} opacity={0.08} tubeRadius={0.05} />

      <CameraRig />
    </>
  );
}

export default function FilmReelRings() {
  const [trailers, setTrailers] = useState<FilmTrailer[]>([]);

  useEffect(() => {
    const loadTrailers = async () => {
      try {
        const response = await fetch("/api/films/trailers");
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        setTrailers(Array.isArray(data.trailers) ? data.trailers : []);
      } catch (error) {
        console.error("Failed to load trailers:", error);
        setTrailers([]);
      }
    };

    loadTrailers();
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0.5, 10], fov: 58 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene trailers={trailers} />
      </Canvas>
    </div>
  );
}
