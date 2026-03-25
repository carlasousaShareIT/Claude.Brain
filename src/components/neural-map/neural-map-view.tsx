import { useRef, useState, useCallback } from 'react';
import { useBrain } from '@/hooks/use-brain';
import { useUIStore } from '@/stores/ui-store';
import { NeuralCanvas } from './neural-canvas';
import { GraphControls } from './graph-controls';
import { GraphLegend } from './graph-legend';
import { TimeTravelControls } from './time-travel';

export function NeuralMapView() {
  const graphProjectFilterId = useUIStore((s) => s.graphProjectFilterId);
  const sessionFilterId = useUIStore((s) => s.sessionFilterId);
  const { data: brain } = useBrain();

  const timeTravelDate = useRef<Date | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [rebuildTrigger, setRebuildTrigger] = useState(0);

  const handleStatsChange = useCallback((nodes: number, edges: number) => {
    setNodeCount(nodes);
    setEdgeCount(edges);
  }, []);

  const handleTimeTravelChange = useCallback(() => {
    setRebuildTrigger((n) => n + 1);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-brain-base">
      <NeuralCanvas
        brain={brain}
        sessionFilterId={sessionFilterId}
        graphProjectFilterId={graphProjectFilterId}
        timeTravelDate={timeTravelDate}
        rebuildTrigger={rebuildTrigger}
        onStatsChange={handleStatsChange}
      />

      <GraphControls
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        brain={brain}
      />

      <GraphLegend />

      <TimeTravelControls
        brain={brain}
        timeTravelDate={timeTravelDate}
        onDateChange={handleTimeTravelChange}
      />
    </div>
  );
}
