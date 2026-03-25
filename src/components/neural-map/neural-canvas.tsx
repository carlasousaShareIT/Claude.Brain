import { useRef, useEffect, useState } from 'react';
import type { Brain } from '@/lib/types';
import { useGraph } from './use-graph';
import { useGraphInteraction } from './use-graph-interaction';
import { GraphTooltip } from './graph-tooltip';
import type { GNode } from './use-graph';

interface NeuralCanvasProps {
  brain: Brain | undefined;
  sessionFilterId: string;
  graphProjectFilterId: string;
  timeTravelDate: React.RefObject<Date | null>;
  rebuildTrigger: number;
  onStatsChange?: (nodeCount: number, edgeCount: number) => void;
}

export function NeuralCanvas({
  brain,
  sessionFilterId,
  graphProjectFilterId,
  timeTravelDate,
  rebuildTrigger,
  onStatsChange,
}: NeuralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dpr, setDpr] = useState(window.devicePixelRatio || 1);

  // Shared refs for hovered/pinned state — owned here, passed to both hooks.
  const hoveredNodeRef = useRef<GNode | null>(null);
  const pinnedNodeRef = useRef<GNode | null>(null);

  const { nodesRef, edgesRef, getNodeAt, flashNode } = useGraph({
    brain,
    canvasRef,
    dpr,
    sessionFilterId,
    graphProjectFilterId,
    hoveredNodeRef,
    pinnedNodeRef,
    timeTravelDate,
    rebuildTrigger,
  });

  const { hoveredNode, pinnedNode, tooltipPosition, unpinNode } = useGraphInteraction({
    canvasRef,
    getNodeAt,
    nodesRef,
    hoveredNodeRef,
    pinnedNodeRef,
  });

  // Report stats to parent.
  useEffect(() => {
    if (onStatsChange) {
      const interval = setInterval(() => {
        onStatsChange(nodesRef.current.length, edgesRef.current.length);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [onStatsChange, nodesRef, edgesRef]);

  // DPR-aware sizing via ResizeObserver.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const currentDpr = window.devicePixelRatio || 1;
        setDpr(currentDpr);
        canvas.width = width * currentDpr;
        canvas.height = height * currentDpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const activeNode = pinnedNode ?? hoveredNode;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {activeNode && (
        <GraphTooltip
          node={activeNode}
          position={tooltipPosition}
          isPinned={!!pinnedNode && pinnedNode.id === activeNode.id}
          onClose={unpinNode}
        />
      )}
    </div>
  );
}
