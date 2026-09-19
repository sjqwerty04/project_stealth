import { motion } from 'framer-motion';
import type { TasteGraph as TasteGraphData } from '../../lib/onboarding/graph';

type Props = { graph: TasteGraphData; accent: string };

const SOLID_EDGE = 'rgba(239,237,233,0.25)';

export function TasteGraph({ graph, accent }: Props) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <svg
      data-testid="taste-graph"
      viewBox={`0 0 ${graph.width} ${graph.height}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="Your taste map"
      style={{ color: accent }}
    >
      <g>
        {graph.edges.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={e.dashed ? 'text-fg-3' : undefined}
              stroke={e.dashed ? 'currentColor' : SOLID_EDGE}
              strokeWidth={e.dashed ? 0.8 : 1}
              strokeDasharray={e.dashed ? '2 3' : undefined}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g>
        {graph.nodes.map((n, i) => (
          <motion.circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.ghost ? 'none' : n.colour}
            stroke={n.ghost ? n.colour : undefined}
            strokeWidth={n.ghost ? 1 : undefined}
            strokeOpacity={n.ghost ? 0.7 : undefined}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.008, duration: 0.4, ease: 'easeOut' }}
          />
        ))}
      </g>
    </svg>
  );
}

export default TasteGraph;
