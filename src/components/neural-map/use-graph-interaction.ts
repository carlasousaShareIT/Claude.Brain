import { useRef, useCallback, useEffect, useState } from 'react';
import type { GNode } from './use-graph';

interface UseGraphInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  getNodeAt: (x: number, y: number) => GNode | null;
  nodesRef: React.RefObject<GNode[]>;
  hoveredNodeRef: React.RefObject<GNode | null>;
  pinnedNodeRef: React.RefObject<GNode | null>;
}

export function useGraphInteraction({
  canvasRef,
  getNodeAt,
  nodesRef,
  hoveredNodeRef,
  pinnedNodeRef,
}: UseGraphInteractionOptions) {
  const dragNodeRef = useRef<GNode | null>(null);
  const isDraggingRef = useRef(false);

  // These use useState because React needs to know about them for rendering overlays.
  const [hoveredNode, setHoveredNode] = useState<GNode | null>(null);
  const [pinnedNode, setPinnedNode] = useState<GNode | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const getCanvasCoords = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [canvasRef],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      const { x, y } = getCanvasCoords(e);

      if (isDraggingRef.current && dragNodeRef.current) {
        dragNodeRef.current.x = x;
        dragNodeRef.current.y = y;
        dragNodeRef.current.vx = 0;
        dragNodeRef.current.vy = 0;
        return;
      }

      const node = getNodeAt(x, y);
      hoveredNodeRef.current = node;
      setHoveredNode(node);

      if (node) {
        setTooltipPosition({ x: e.clientX, y: e.clientY });
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = getCanvasCoords(e);
      const node = getNodeAt(x, y);

      if (node) {
        if (pinnedNodeRef.current?.id === node.id) {
          // Already pinned — start drag.
          dragNodeRef.current = node;
          isDraggingRef.current = true;
          canvas.style.cursor = 'grabbing';
        } else {
          // Pin the node.
          pinnedNodeRef.current = node;
          setPinnedNode(node);
          setTooltipPosition({ x: e.clientX, y: e.clientY });
        }
      } else {
        // Click on empty space — unpin.
        pinnedNodeRef.current = null;
        setPinnedNode(null);
      }
    };

    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        dragNodeRef.current = null;
        canvas.style.cursor = 'pointer';
      }
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
  }, [canvasRef, getCanvasCoords, getNodeAt, hoveredNodeRef, pinnedNodeRef]);

  const unpinNode = useCallback(() => {
    pinnedNodeRef.current = null;
    setPinnedNode(null);
  }, [pinnedNodeRef]);

  return {
    hoveredNode,
    pinnedNode,
    tooltipPosition,
    unpinNode,
  };
}
