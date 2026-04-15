import { useRef, useEffect } from 'react';
import type { Brain } from '@/lib/types';
import { SECTION_COLORS } from '@/lib/constants';

interface NeuralPreviewCanvasProps {
  brain: Brain | undefined;
}

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return hash >>> 0;
}

const SECTION_ANCHORS: Record<string, { x: number; y: number }> = {
  workingStyle: { x: 0.25, y: 0.35 },
  architecture: { x: 0.75, y: 0.35 },
  agentRules: { x: 0.25, y: 0.70 },
  decisions: { x: 0.75, y: 0.70 },
};

export function NeuralPreviewCanvas({ brain }: NeuralPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const brainRef = useRef(brain);
  brainRef.current = brain;

  // ResizeObserver: runs once, handles sizing + redraw via ref.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const currentDpr = window.devicePixelRatio || 1;
        canvas.width = width * currentDpr;
        canvas.height = height * currentDpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        drawFrame(canvas, brainRef.current);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Redraw when brain data changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawFrame(canvas, brain);
  }, [brain]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

function drawFrame(canvas: HTMLCanvasElement, brain: Brain | undefined) {
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  if (!brain) return;

  const dpr = window.devicePixelRatio || 1;
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const spreadX = w * 0.18;
  const spreadY = h * 0.35;

  const sections: Array<{ key: keyof typeof SECTION_ANCHORS; entries: Array<{ text: string; lastTouched: string }> }> = [
    { key: 'workingStyle', entries: brain.workingStyle },
    { key: 'architecture', entries: brain.architecture },
    { key: 'agentRules', entries: brain.agentRules },
    { key: 'decisions', entries: brain.decisions.map((d) => ({ text: d.decision, lastTouched: d.lastTouched })) },
  ];

  for (const { key, entries } of sections) {
    const anchor = SECTION_ANCHORS[key];
    const color = SECTION_COLORS[key];

    for (const entry of entries) {
      const text = entry.text;
      const hash = djb2(text);
      const ox = (((hash & 0xFFFF) / 0xFFFF) - 0.5) * spreadX;
      const oy = ((((hash >> 16) & 0xFFFF) / 0xFFFF) - 0.5) * spreadY;
      const nx = anchor.x * w + ox;
      const ny = anchor.y * h + oy;

      const recentlyTouched = entry.lastTouched
        ? now - new Date(entry.lastTouched).getTime() < oneDayMs
        : false;

      const radius = (recentlyTouched ? 8 : 5) * dpr;
      const alpha = recentlyTouched ? 1.0 : 0.7;

      ctx.beginPath();
      ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.fill();
    }
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
