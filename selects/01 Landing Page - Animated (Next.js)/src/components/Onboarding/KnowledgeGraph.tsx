"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { motion } from "framer-motion";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  type: string;
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  personaName: string;
  personaColor: string;
  personaDescription: string;
}

const NODE_COLORS: Record<string, string> = {
  film: "#FFFFFF",
  director: "#CCCCCC",
  actor: "#AAAAAA",
  visual_style: "#4ECDC4",
  storytelling: "#F2C94C",
  vibe: "#9B59B6",
  subgenre: "#E74C3C",
  cinematographer: "#E87722",
};

const NODE_SIZES: Record<string, number> = {
  film: 12,
  director: 9,
  actor: 8,
  visual_style: 10,
  storytelling: 10,
  vibe: 10,
  subgenre: 9,
  cinematographer: 8,
};

export default function KnowledgeGraph({
  nodes,
  edges,
  personaName,
  personaColor,
  personaDescription,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
    type: string;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDims = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight * 0.7,
      });
    };
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, []);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    const container = svg.append("g");

    // Initial zoom to center
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
    );

    // Build simulation
    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(edges)
          .id((d) => (d as GraphNode).id)
          .distance(120)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide().radius(30));

    // Edge lines
    const link = container
      .append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => {
        const color = NODE_COLORS[d.type] || "#444";
        return color;
      })
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1);

    // Edge labels
    const linkLabels = container
      .append("g")
      .selectAll("text")
      .data(edges)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", "8px")
      .attr("fill", "rgba(255,255,255,0.2)")
      .attr("text-anchor", "middle")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("pointer-events", "none");

    // Node groups
    const node = container
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer");

    node.call(
      d3
        .drag<SVGGElement, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => NODE_SIZES[d.type] || 8)
      .attr("fill", (d) => NODE_COLORS[d.type] || "#FFFFFF")
      .attr("fill-opacity", 0.8)
      .attr("stroke", (d) => NODE_COLORS[d.type] || "#FFFFFF")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.3);

    // Glow effect
    node
      .append("circle")
      .attr("r", (d) => (NODE_SIZES[d.type] || 8) + 8)
      .attr("fill", (d) => NODE_COLORS[d.type] || "#FFFFFF")
      .attr("fill-opacity", 0.05);

    // Node labels
    node
      .append("text")
      .text((d) => d.label)
      .attr("dy", (d) => (NODE_SIZES[d.type] || 8) + 14)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.6)")
      .attr("font-size", "10px")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("pointer-events", "none");

    // Type labels (small badge)
    node
      .append("text")
      .text((d) => d.type.replace("_", " "))
      .attr("dy", (d) => (NODE_SIZES[d.type] || 8) + 25)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => NODE_COLORS[d.type] || "#555")
      .attr("fill-opacity", 0.4)
      .attr("font-size", "7px")
      .style(
        "font-family",
        "Inter, system-ui, sans-serif"
      )
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.1em")
      .style("pointer-events", "none");

    // Hover interactions
    node
      .on("mouseenter", (event, d) => {
        const [x, y] = d3.pointer(event, svgRef.current);
        setTooltip({
          x,
          y: y - 20,
          content: d.label,
          type: d.type.replace("_", " "),
        });

        // Highlight connected edges
        link
          .attr("stroke-opacity", (l) => {
            const src = typeof l.source === "object" ? l.source.id : l.source;
            const tgt = typeof l.target === "object" ? l.target.id : l.target;
            return src === d.id || tgt === d.id ? 0.6 : 0.05;
          })
          .attr("stroke-width", (l) => {
            const src = typeof l.source === "object" ? l.source.id : l.source;
            const tgt = typeof l.target === "object" ? l.target.id : l.target;
            return src === d.id || tgt === d.id ? 2 : 0.5;
          });
      })
      .on("mouseleave", () => {
        setTooltip(null);
        link.attr("stroke-opacity", 0.2).attr("stroke-width", 1);
      });

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);

      linkLabels
        .attr("x", (d) => {
          const sx = (d.source as GraphNode).x || 0;
          const tx = (d.target as GraphNode).x || 0;
          return (sx + tx) / 2;
        })
        .attr("y", (d) => {
          const sy = (d.source as GraphNode).y || 0;
          const ty = (d.target as GraphNode).y || 0;
          return (sy + ty) / 2;
        });

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Cinematic zoom-in reveal
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.1)
    );
    svg
      .transition()
      .duration(2000)
      .ease(d3.easeCubicOut)
      .call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
      );

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="w-full relative"
    >
      {/* Persona badge */}
      <div className="text-center mb-6">
        <div
          className="inline-block px-6 py-2 rounded-full text-sm font-medium tracking-[0.2em] uppercase mb-3"
          style={{
            backgroundColor: `${personaColor}20`,
            color: personaColor,
            border: `1px solid ${personaColor}40`,
          }}
        >
          {personaName}
        </div>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          {personaDescription}
        </p>
      </div>

      {/* Graph */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="mx-auto"
          style={{ background: "transparent" }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-50 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-white font-medium">{tooltip.content}</p>
            <p className="text-white/40 uppercase tracking-wider text-[10px]">
              {tooltip.type}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-white/30 text-[10px] tracking-wider uppercase">
              {type.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
