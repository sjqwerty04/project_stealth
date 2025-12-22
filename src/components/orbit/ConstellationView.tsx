import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useOrbitStore, type ConnectionType } from '../../stores/orbitStore';

const buildImageUrl = (path: string | null) => {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w200${path}`;
};

// Connection colors
const getConnectionColor = (type: ConnectionType) => {
  switch (type) {
    case 'vibe': return '#3b82f6'; // Blue - left
    case 'auteur': return '#f59e0b'; // Amber - up
    case 'aesthetic': return '#ec4899'; // Pink - down
    default: return '#6b7280'; // Gray
  }
};

// Convert connection type to visual direction
// Note: swipe left = vibe, but visually we show it going LEFT
// swipe up = auteur, visually going UP
// swipe down = aesthetic, visually going DOWN
const connectionTypeToOffset = (type: ConnectionType): { dx: number; dy: number } => {
  switch (type) {
    case 'vibe': return { dx: -120, dy: 0 }; // Left
    case 'auteur': return { dx: 0, dy: -140 }; // Up
    case 'aesthetic': return { dx: 0, dy: 140 }; // Down
    case 'entry': return { dx: 120, dy: 0 }; // Right (entry point)
    default: return { dx: 120, dy: 0 };
  }
};

export default function ConstellationView() {
  const { history, historyIndex, edges, jumpToNode } = useOrbitStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Get container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate positions based on actual swipe directions
  const nodePositions = useMemo(() => {
    const positions: { x: number; y: number }[] = [];
    
    if (history.length === 0) return positions;
    
    // First node starts at origin
    positions.push({ x: 0, y: 0 });
    
    // Each subsequent node is positioned based on the edge direction
    for (let i = 1; i < history.length; i++) {
      const prevPos = positions[i - 1];
      const node = history[i];
      
      // Find the edge that leads TO this node
      const edge = edges.find(e => e.toId === node.movie.id);
      
      if (edge) {
        const { dx, dy } = connectionTypeToOffset(edge.connectionType);
        positions.push({
          x: prevPos.x + dx,
          y: prevPos.y + dy,
        });
      } else {
        // Fallback: just go right
        positions.push({
          x: prevPos.x + 120,
          y: prevPos.y,
        });
      }
    }
    
    return positions;
  }, [history, edges]);

  // Center on active node
  useEffect(() => {
    if (nodePositions[historyIndex] && containerSize.width > 0) {
      const activePos = nodePositions[historyIndex];
      setOffset({
        x: containerSize.width / 2 - activePos.x,
        y: containerSize.height / 2 - activePos.y,
      });
    }
  }, [historyIndex, nodePositions, containerSize.width, containerSize.height]);

  // Handle drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
  }, [offset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      setOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleNodeClick = useCallback((index: number) => {
    jumpToNode(index);
  }, [jumpToNode]);

  if (history.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/50">No films explored yet</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing relative"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Trail container */}
      <div
        className="absolute"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {/* Connection lines */}
        <svg 
          className="absolute pointer-events-none"
          style={{ 
            left: -1000,
            top: -1000,
            width: 2000,
            height: 2000,
            overflow: 'visible',
          }}
        >
          {edges.map((edge, index) => {
            const fromIndex = history.findIndex((n) => n.movie.id === edge.fromId);
            const toIndex = history.findIndex((n) => n.movie.id === edge.toId);
            
            if (fromIndex === -1 || toIndex === -1) return null;
            
            const from = nodePositions[fromIndex];
            const to = nodePositions[toIndex];
            
            if (!from || !to) return null;
            
            const color = getConnectionColor(edge.connectionType);
            
            return (
              <g key={`edge-${index}`}>
                {/* Glow effect */}
                <line
                  x1={from.x + 1000}
                  y1={from.y + 1000}
                  x2={to.x + 1000}
                  y2={to.y + 1000}
                  stroke={color}
                  strokeWidth={8}
                  strokeLinecap="round"
                  opacity={0.3}
                />
                {/* Main line */}
                <line
                  x1={from.x + 1000}
                  y1={from.y + 1000}
                  x2={to.x + 1000}
                  y2={to.y + 1000}
                  stroke={color}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              </g>
            );
          })}
        </svg>

        {/* Movie poster nodes */}
        {history.map((node, index) => {
          const pos = nodePositions[index];
          if (!pos) return null;
          
          const isActive = index === historyIndex;
          const posterUrl = buildImageUrl(node.movie.posterPath);
          
          // Find connection type to this node
          const edgeToThis = edges.find(e => e.toId === node.movie.id);
          const connectionColor = edgeToThis ? getConnectionColor(edgeToThis.connectionType) : '#666';
          
          return (
            <motion.div
              key={node.movie.id}
              className="absolute cursor-pointer"
              style={{
                left: pos.x - 40,
                top: pos.y - 60,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: isActive ? 1.2 : 1, 
                opacity: 1,
              }}
              transition={{ 
                type: 'spring', 
                stiffness: 300, 
                damping: 20,
                delay: index * 0.05,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(index);
              }}
            >
              {/* Poster */}
              <div
                className={`
                  w-20 h-28 rounded-xl overflow-hidden border-3 shadow-2xl
                  transition-all duration-200
                  ${isActive ? 'border-white' : 'border-gray-700'}
                `}
                style={{
                  boxShadow: isActive 
                    ? `0 0 30px ${connectionColor}, 0 0 60px ${connectionColor}44` 
                    : '0 4px 20px rgba(0,0,0,0.8)',
                  borderWidth: isActive ? 3 : 2,
                }}
              >
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={node.movie.title}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-white/50 text-sm"
                    style={{ backgroundColor: node.movie.dominantHex }}
                  >
                    ?
                  </div>
                )}
              </div>
              
              {/* Title */}
              <p className={`
                text-xs text-center mt-2 truncate w-20
                ${isActive ? 'text-white font-bold' : 'text-white/70'}
              `}>
                {node.movie.title}
              </p>
              
              {/* Index badge */}
              <div 
                className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                style={{
                  backgroundColor: isActive ? connectionColor : '#374151',
                  color: 'white',
                }}
              >
                {index + 1}
              </div>
              
              {/* Saved indicator */}
              {node.saved && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                  <span className="text-xs">✓</span>
                </div>
              )}
              
              {/* Direction arrow for non-entry nodes */}
              {edgeToThis && index > 0 && (
                <div 
                  className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ 
                    backgroundColor: connectionColor + '33',
                    color: connectionColor,
                  }}
                >
                  {edgeToThis.connectionType === 'vibe' && '← Vibe'}
                  {edgeToThis.connectionType === 'auteur' && '↑ Auteur'}
                  {edgeToThis.connectionType === 'aesthetic' && '↓ Aesthetic'}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-24 left-4 right-4 flex justify-center pointer-events-none">
        <div className="flex gap-4 px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-500 rounded" />
            <span className="text-white/70 text-xs">← Vibe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-amber-500 rounded" />
            <span className="text-white/70 text-xs">↑ Auteur</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-pink-500 rounded" />
            <span className="text-white/70 text-xs">↓ Aesthetic</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 right-4 flex justify-center pointer-events-none">
        <div className="px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-gray-800">
          <span className="text-white/60 text-xs">Drag to explore • Tap poster to jump</span>
        </div>
      </div>
    </div>
  );
}
