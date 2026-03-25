import { useRef, useCallback, useEffect } from 'react';
import type { Brain, BrainEntry, Decision, SectionName } from '@/lib/types';
import { tokenize, similarity } from '@/lib/text-utils';
import { entryText } from '@/lib/utils';
import {
  SECTION_COLORS,
  REPULSION,
  ATTRACTION,
  DAMPING,
  CENTER_GRAVITY,
  MAX_SPEED,
  SIM_THRESHOLD,
} from '@/lib/constants';

// RGB values for glow effects (parsed from hex).
const SECTION_RGB: Record<string, [number, number, number]> = {
  workingStyle: [167, 139, 250],
  architecture: [34, 211, 238],
  agentRules: [52, 211, 153],
  decisions: [251, 191, 36],
};

export interface GNode {
  id: string;
  text: string;
  section: SectionName;
  tokens: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  confidence: 'firm' | 'tentative';
  createdAt: string;
  lastTouched: string;
  sessionId: string | null;
  project: string[];
  flashUntil: number;
}

export interface GEdge {
  source: number;
  target: number;
  weight: number;
}

interface UseGraphOptions {
  brain: Brain | undefined;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  dpr: number;
  sessionFilterId: string;
  graphProjectFilterId: string;
  hoveredNodeRef: React.RefObject<GNode | null>;
  pinnedNodeRef: React.RefObject<GNode | null>;
  timeTravelDate: React.RefObject<Date | null>;
  rebuildTrigger: number;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function daysSince(dateStr: string): number {
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export function useGraph({
  brain,
  canvasRef,
  dpr,
  sessionFilterId,
  graphProjectFilterId,
  hoveredNodeRef,
  pinnedNodeRef,
  timeTravelDate,
  rebuildTrigger,
}: UseGraphOptions) {
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const animIdRef = useRef<number>(0);
  const stablePositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const buildGraph = useCallback(
    (brainData: Brain) => {
      const canvas = canvasRef.current;
      const w = canvas ? canvas.width / dpr : 800;
      const h = canvas ? canvas.height / dpr : 600;

      const entries: { entry: BrainEntry | Decision; section: SectionName }[] = [];
      const sections: SectionName[] = ['workingStyle', 'architecture', 'agentRules', 'decisions'];

      for (const section of sections) {
        const list = brainData[section] as (BrainEntry | Decision)[];
        for (const entry of list) {
          // Session filter.
          if (sessionFilterId && entry.sessionId !== sessionFilterId) continue;
          // Project filter.
          if (graphProjectFilterId && !entry.project.includes(graphProjectFilterId)) continue;
          // Time-travel filter.
          if (timeTravelDate.current && new Date(entry.createdAt) > timeTravelDate.current) continue;

          entries.push({ entry, section });
        }
      }

      const nodes: GNode[] = entries.map(({ entry, section }, i) => {
        const text = entryText(entry);
        const id = `${section}::${text}`;
        const prev = stablePositions.current.get(id);
        return {
          id,
          text,
          section,
          tokens: tokenize(text),
          x: prev?.x ?? w * 0.2 + Math.random() * w * 0.6,
          y: prev?.y ?? h * 0.2 + Math.random() * h * 0.6,
          vx: 0,
          vy: 0,
          radius: clamp(text.length * 0.15, 3, 12),
          confidence: entry.confidence,
          createdAt: entry.createdAt,
          lastTouched: entry.lastTouched,
          sessionId: entry.sessionId,
          project: entry.project,
          flashUntil: 0,
        };
      });

      // Build edges.
      const edges: GEdge[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const sim = similarity(nodes[i].tokens, nodes[j].tokens);
          if (sim > SIM_THRESHOLD) {
            edges.push({ source: i, target: j, weight: sim });
          } else if (nodes[i].section === nodes[j].section) {
            // Weak same-section edge.
            edges.push({ source: i, target: j, weight: 0.05 });
          }
        }
      }

      nodesRef.current = nodes;
      edgesRef.current = edges;
    },
    [canvasRef, dpr, sessionFilterId, graphProjectFilterId, timeTravelDate],
  );

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;

    // Repulsion between all node pairs.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx += fx;
        nodes[i].vy += fy;
        nodes[j].vx -= fx;
        nodes[j].vy -= fy;
      }
    }

    // Edge attraction.
    for (const edge of edges) {
      const a = nodes[edge.source];
      const b = nodes[edge.target];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const restLength = 80;
      const force = ATTRACTION * (dist - restLength) * edge.weight;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity + damping + speed cap + bounds.
    for (const node of nodes) {
      node.vx += (cx - node.x) * CENTER_GRAVITY;
      node.vy += (cy - node.y) * CENTER_GRAVITY;
      node.vx *= DAMPING;
      node.vy *= DAMPING;

      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > MAX_SPEED) {
        node.vx = (node.vx / speed) * MAX_SPEED;
        node.vy = (node.vy / speed) * MAX_SPEED;
      }

      node.x += node.vx;
      node.y += node.vy;
      node.x = clamp(node.x, node.radius + 4, w - node.radius - 4);
      node.y = clamp(node.y, node.radius + 4, h - node.radius - 4);

      // Persist stable positions.
      stablePositions.current.set(node.id, { x: node.x, y: node.y });
    }
  }, [canvasRef, dpr]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const hovered = hoveredNodeRef.current;
      const pinned = pinnedNodeRef.current;
      const now = performance.now();

      ctx.clearRect(0, 0, width, height);

      // Draw edges.
      for (const edge of edges) {
        const a = nodes[edge.source];
        const b = nodes[edge.target];
        if (!a || !b) continue;

        const isHighlighted =
          (hovered && (a.id === hovered.id || b.id === hovered.id)) ||
          (pinned && (a.id === pinned.id || b.id === pinned.id));

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isHighlighted
          ? SECTION_COLORS[a.section] + '80'
          : SECTION_COLORS[a.section] + '18';
        ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
        ctx.stroke();
      }

      // Draw nodes.
      for (const node of nodes) {
        const rgb = SECTION_RGB[node.section] ?? [200, 200, 200];
        const staleDays = daysSince(node.lastTouched);
        const staleAlpha = clamp(1 - staleDays / 60, 0.25, 1);
        const isHovered = hovered?.id === node.id;
        const isPinned = pinned?.id === node.id;
        const scale = isHovered || isPinned ? 1.6 : 1;
        const r = node.radius * scale;

        // Flash effect.
        const isFlashing = node.flashUntil > now;
        const flashBoost = isFlashing
          ? 0.5 * Math.sin(((node.flashUntil - now) / 1500) * Math.PI)
          : 0;

        // Multi-layer glow.
        const glowAlpha = (0.12 + flashBoost) * staleAlpha;
        const gradient = ctx.createRadialGradient(node.x, node.y, r * 0.2, node.x, node.y, r * 3);
        gradient.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${glowAlpha})`);
        gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Tentative entries: pulse animation.
        if (node.confidence === 'tentative') {
          const pulse = 1 + 0.15 * Math.sin(now * 0.003);
          const pulseR = r * pulse;
          ctx.beginPath();
          ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.4 * staleAlpha})`;
          ctx.fill();
        } else {
          // Firm entries: solid fill + ring.
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.6 * staleAlpha})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 1, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.8 * staleAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Core dot.
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${staleAlpha})`;
        ctx.fill();
      }
    },
    [hoveredNodeRef, pinnedNodeRef],
  );

  // Animation loop.
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        ctx.save();
        ctx.scale(dpr, dpr);
        simulate();
        draw(ctx, w, h);
        ctx.restore();
      }
      animIdRef.current = requestAnimationFrame(loop);
    };

    animIdRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animIdRef.current);
    };
  }, [canvasRef, dpr, simulate, draw]);

  // Rebuild graph when brain data or time-travel changes.
  useEffect(() => {
    if (brain) {
      buildGraph(brain);
    }
  }, [brain, buildGraph, rebuildTrigger]);

  const getNodeAt = useCallback((x: number, y: number): GNode | null => {
    const nodes = nodesRef.current;
    // Iterate in reverse so top-drawn nodes are picked first.
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = x - node.x;
      const dy = y - node.y;
      const hitRadius = Math.max(node.radius * 1.5, 8);
      if (dx * dx + dy * dy <= hitRadius * hitRadius) return node;
    }
    return null;
  }, []);

  const flashNode = useCallback((text: string) => {
    const nodes = nodesRef.current;
    for (const node of nodes) {
      if (node.text === text) {
        node.flashUntil = performance.now() + 1500;
        break;
      }
    }
  }, []);

  return {
    nodesRef,
    edgesRef,
    getNodeAt,
    flashNode,
    buildGraph,
  };
}
