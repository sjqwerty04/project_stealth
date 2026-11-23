import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { craftNodeCount, type CraftGraph } from '../lib/craftGraph';
import { loadCraftGraph, type CraftSeed } from '../lib/craftGraphLoad';

const CX = 200;
const CY = 210;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function place(angle: number, radius: number): { x: number; y: number } {
  return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius };
}

export function CraftWheel({ graph, onOpen }: { graph: CraftGraph; onOpen: (id: number) => void }) {
  const sectors = graph.sectors;
  return (
    <div className="craft-stage" data-testid="craft-graph" data-nodes={craftNodeCount(graph)}>
      <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label={`${graph.label} craft graph`}>
        <defs>
          <clipPath id="craft-node-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
        </defs>
        {sectors.map((sector, index) => {
          const start = -Math.PI / 2 + (index / sectors.length) * Math.PI * 2;
          const end = start + (Math.PI * 2) / sectors.length;
          const next = place(end - 0.08, 86);
          const from = place(start + 0.08, 86);
          return (
            <path
              key={sector.key}
              d={`M ${from.x} ${from.y} A 86 86 0 0 1 ${next.x} ${next.y}`}
              fill="none"
              stroke={sector.colour}
              strokeWidth="8"
              strokeLinecap="butt"
            />
          );
        })}
        {sectors.map((sector, index) => {
          const start = -Math.PI / 2 + (index / sectors.length) * Math.PI * 2;
          const span = (Math.PI * 2) / sectors.length;
          return sector.branches.map((branch, branchIndex) => {
            const angle = start + span * ((branchIndex + 0.5) / sector.branches.length);
            const person = place(angle, 132);
            const hub = place(angle, 96);
            return (
              <g key={branch.personId}>
                <line x1={hub.x} y1={hub.y} x2={person.x} y2={person.y} stroke={sector.colour} strokeOpacity="0.7" />
                <g data-testid="craft-node" data-kind="person" data-label={branch.name}>
                  <circle cx={person.x} cy={person.y} r="18" fill="#17171a" stroke={sector.colour} strokeWidth="2" />
                  <text x={person.x} y={person.y + 4} textAnchor="middle" fill="#EFEDE9" fontSize="11" fontFamily="ui-monospace, monospace">
                    {initials(branch.name)}
                  </text>
                </g>
                {branch.films.map((film, filmIndex) => {
                  const filmAngle = angle + (filmIndex - (branch.films.length - 1) / 2) * 0.34;
                  const spot = place(filmAngle, 176);
                  return (
                    <g key={film.id}>
                      <line x1={person.x} y1={person.y} x2={spot.x} y2={spot.y} stroke="rgba(239,237,233,0.28)" />
                      <g
                        data-testid="craft-node"
                        data-kind="film"
                        data-label={film.title}
                        onClick={() => onOpen(film.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle cx={spot.x} cy={spot.y} r="16" fill="#17171a" stroke={film.kept ? sector.colour : 'rgba(239,237,233,0.42)'} strokeWidth={film.kept ? 2.4 : 1.4} />
                        {film.poster ? (
                          <image href={film.poster} x={spot.x - 14} y={spot.y - 14} width="28" height="28" clipPath="url(#craft-node-clip)" preserveAspectRatio="xMidYMid slice" />
                        ) : null}
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          });
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" fill="#EFEDE9" fontSize="15" fontFamily="ui-monospace, monospace">
          {graph.label.slice(0, 16)}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="#6E6C68" fontSize="9" fontFamily="ui-monospace, monospace">
          {graph.sectors.map((sector) => sector.name).slice(0, 3).join(' · ').toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

export function CraftGraphView({
  seeds,
  label,
  colour,
  keptIds = [],
  heading,
}: {
  seeds: CraftSeed[];
  label: string;
  colour: string;
  keptIds?: number[];
  heading: string;
}) {
  const navigate = useNavigate();
  const [graph, setGraph] = useState<CraftGraph | null>(null);
  const key = seeds.map((seed) => seed.id).join(',');
  useEffect(() => {
    if (!seeds.length) {
      setGraph(null);
      return;
    }
    let cancelled = false;
    void loadCraftGraph(seeds, { label, colour, keptIds }).then((next) => {
      if (!cancelled) setGraph(next);
    });
    return () => {
      cancelled = true;
    };
  }, [key, label, colour, keptIds.join(',')]);
  if (!seeds.length) return null;
  return (
    <section className="craft-block" data-testid="craft-block">
      {heading ? <h2 className="font-display text-[28px] font-bold tracking-tight text-fg">{heading}</h2> : null}
      {graph && craftNodeCount(graph) > 0 ? (
        <CraftWheel graph={graph} onOpen={(id) => navigate(`/movie/${id}`)} />
      ) : (
        <div className="craft-stage" data-testid="craft-graph" data-nodes="0" />
      )}
    </section>
  );
}
