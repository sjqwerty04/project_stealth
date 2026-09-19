import { oklabCentroid, paletteFrom } from './colour';

export type GraphNode = { id: string; x: number; y: number; r: number; cluster: number; colour: string; ghost: boolean };
export type GraphEdge = { from: string; to: string; dashed: boolean };
export type TasteGraph = { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number };

export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function fnv1aHex(input: string): string {
  return fnv1a(input).toString(16).padStart(8, '0');
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sum of three uniforms, recentred: cheap bell shape that keeps clusters dense in the middle. */
function jitter(rand: () => number): number {
  return (rand() + rand() + rand()) / 3 - 0.5;
}

const CLUSTERS = 4;
const GHOST_MIN = 6;
const GHOST_MAX = 8;
const NODES_MIN = 6;
const NODES_MAX = 10;

type Pt = { x: number; y: number };

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildTasteGraph(
  seed: string,
  colours: string[],
  opts: { width?: number; height?: number; nodes?: number } = {},
): TasteGraph {
  const width = opts.width ?? 300;
  const height = opts.height ?? 260;
  const rand = mulberry32(fnv1a(seed));
  const palette = colours.length > 0 ? colours : paletteFrom(oklabCentroid([]));

  const margin = 28;
  const cellW = (width - margin * 2) / 2;
  const cellH = (height - margin * 2) / 2;
  const centres: Pt[] = [];
  for (let c = 0; c < CLUSTERS; c++) {
    const col = c % 2;
    const row = Math.floor(c / 2);
    centres.push({
      x: margin + cellW * col + cellW * (0.3 + rand() * 0.4),
      y: margin + cellH * row + cellH * (0.3 + rand() * 0.4),
    });
  }

  const perCluster = opts.nodes ? Math.max(3, Math.round(opts.nodes / CLUSTERS)) : null;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let colourIndex = 0;
  const nextColour = () => palette[colourIndex++ % palette.length];

  for (let c = 0; c < CLUSTERS; c++) {
    const n = perCluster ?? NODES_MIN + Math.floor(rand() * (NODES_MAX - NODES_MIN + 1));
    const spread = Math.min(cellW, cellH) * 0.62;
    const members: GraphNode[] = [];
    for (let i = 0; i < n; i++) {
      const node: GraphNode = {
        id: `c${c}-${i}`,
        x: Math.round((centres[c].x + jitter(rand) * spread) * 10) / 10,
        y: Math.round((centres[c].y + jitter(rand) * spread) * 10) / 10,
        r: Math.round((2.4 + rand() * 3.2) * 10) / 10,
        cluster: c,
        colour: nextColour(),
        ghost: false,
      };
      members.push(node);
      nodes.push(node);
    }
    const seen = new Set<string>();
    for (const m of members) {
      const nearest = members
        .filter((o) => o !== m)
        .sort((a, b) => dist(a, m) - dist(b, m))
        .slice(0, 2);
      for (const o of nearest) {
        const key = [m.id, o.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: m.id, to: o.id, dashed: false });
      }
    }
  }

  // Bridges link each cluster to the next so the four islands read as one map.
  const bridgePairs: [number, number][] = [
    [0, 1],
    [1, 3],
    [3, 2],
  ];
  for (const [a, b] of bridgePairs) {
    const fromNodes = nodes.filter((n) => n.cluster === a);
    const toNodes = nodes.filter((n) => n.cluster === b);
    const from = fromNodes[Math.floor(rand() * fromNodes.length)];
    const to = toNodes[Math.floor(rand() * toNodes.length)];
    edges.push({ from: from.id, to: to.id, dashed: false });
  }

  const ghostCount = GHOST_MIN + Math.floor(rand() * (GHOST_MAX - GHOST_MIN + 1));
  const minClear = Math.min(cellW, cellH) * 0.45;
  for (let g = 0; g < ghostCount; g++) {
    let pt: Pt = { x: 0, y: 0 };
    for (let attempt = 0; attempt < 12; attempt++) {
      pt = { x: 10 + rand() * (width - 20), y: 10 + rand() * (height - 20) };
      if (centres.every((c) => dist(c, pt) > minClear)) break;
    }
    const ghost: GraphNode = {
      id: `g${g}`,
      x: Math.round(pt.x * 10) / 10,
      y: Math.round(pt.y * 10) / 10,
      r: Math.round((2 + rand() * 1.6) * 10) / 10,
      cluster: -1,
      colour: nextColour(),
      ghost: true,
    };
    nodes.push(ghost);
    const solid = nodes.filter((n) => !n.ghost);
    const anchor = solid.reduce((best, n) => (dist(n, ghost) < dist(best, ghost) ? n : best), solid[0]);
    edges.push({ from: ghost.id, to: anchor.id, dashed: true });
  }

  return { nodes, edges, width, height };
}
