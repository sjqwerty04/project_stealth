import { describe, expect, it } from 'vitest';
import { buildTasteGraph, fnv1aHex, mulberry32 } from './graph';

describe('fnv1aHex', () => {
  it('is stable and eight hex chars', () => {
    expect(fnv1aHex('')).toBe('811c9dc5');
    expect(fnv1aHex('a')).toBe('e40c292c');
    expect(fnv1aHex('selects')).toBe(fnv1aHex('selects'));
    expect(fnv1aHex('selects')).not.toBe(fnv1aHex('Selects'));
  });
});

describe('mulberry32', () => {
  it('yields values in [0, 1) and repeats for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(b()).toBe(v);
    }
  });
});

describe('buildTasteGraph', () => {
  const colours = ['#111111', '#222222', '#333333'];

  it('is deterministic for the same seed', () => {
    const a = buildTasteGraph('seed-1', colours);
    const b = buildTasteGraph('seed-1', colours);
    expect(a).toEqual(b);
  });

  it('moves nodes for a different seed', () => {
    const a = buildTasteGraph('seed-1', colours);
    const b = buildTasteGraph('seed-2', colours);
    const posA = a.nodes.map((n) => `${n.x},${n.y}`).join(';');
    const posB = b.nodes.map((n) => `${n.x},${n.y}`).join(';');
    expect(posA).not.toBe(posB);
  });

  it('defaults to 300 by 260 and keeps every node inside the frame', () => {
    const g = buildTasteGraph('frame', colours);
    expect(g.width).toBe(300);
    expect(g.height).toBe(260);
    for (const n of g.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(300);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(260);
    }
  });

  it('builds four clusters of 6 to 10, 6 to 8 ghosts, three bridges and dashed ghost edges', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const g = buildTasteGraph(seed, colours);
      const solid = g.nodes.filter((n) => !n.ghost);
      const ghosts = g.nodes.filter((n) => n.ghost);
      const clusters = new Set(solid.map((n) => n.cluster));
      expect(clusters.size).toBe(4);
      for (const c of clusters) {
        const size = solid.filter((n) => n.cluster === c).length;
        expect(size).toBeGreaterThanOrEqual(6);
        expect(size).toBeLessThanOrEqual(10);
      }
      expect(ghosts.length).toBeGreaterThanOrEqual(6);
      expect(ghosts.length).toBeLessThanOrEqual(8);
      expect(ghosts.every((n) => n.cluster === -1)).toBe(true);

      const byId = new Map(g.nodes.map((n) => [n.id, n]));
      const dashed = g.edges.filter((e) => e.dashed);
      expect(dashed.length).toBe(ghosts.length);
      for (const e of dashed) {
        expect(byId.get(e.from)?.ghost).toBe(true);
        expect(byId.get(e.to)?.ghost).toBe(false);
      }
      const bridges = g.edges.filter((e) => {
        const a = byId.get(e.from)!;
        const b = byId.get(e.to)!;
        return !e.dashed && !a.ghost && !b.ghost && a.cluster !== b.cluster;
      });
      expect(bridges.length).toBe(3);
      for (const e of g.edges) {
        expect(byId.has(e.from)).toBe(true);
        expect(byId.has(e.to)).toBe(true);
      }
      expect(new Set(g.nodes.map((n) => n.id)).size).toBe(g.nodes.length);
    }
  });

  it('cycles node colours through the given list and falls back to a palette when empty', () => {
    const g = buildTasteGraph('colour', colours);
    expect(g.nodes.every((n) => colours.includes(n.colour))).toBe(true);
    const f = buildTasteGraph('colour', []);
    const used = new Set(f.nodes.map((n) => n.colour));
    expect(used.size).toBe(5);
    expect(used.has('#FF3B14')).toBe(true);
  });

  it('honours size and node count overrides', () => {
    const g = buildTasteGraph('size', colours, { width: 500, height: 400, nodes: 16 });
    expect(g.width).toBe(500);
    expect(g.height).toBe(400);
    expect(g.nodes.filter((n) => !n.ghost)).toHaveLength(16);
  });
});
