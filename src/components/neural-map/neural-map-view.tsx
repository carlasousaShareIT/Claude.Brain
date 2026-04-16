import { useRef, useState, useCallback } from 'react';
import { useBrain } from '@/hooks/use-brain';
import { useUIStore } from '@/stores/ui-store';
import { QueryError } from '@/components/ui/query-error';
import { NeuralCanvas } from './neural-canvas';
import { GraphControls } from './graph-controls';
import { GraphLegend } from './graph-legend';
import { TimeTravelControls } from './time-travel';

export function NeuralMapView() {
  const graphProjectFilterId = useUIStore((s) => s.graphProjectFilterId);
  const sessionFilterId = useUIStore((s) => s.sessionFilterId);
  const { data: brain, isLoading: brainLoading, isError: brainError, refetch: refetchBrain } = useBrain();

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

  if (brainLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading brain data...</p>
      </div>
    )
  }

  if (brainError) {
    return <QueryError message="Failed to load brain data." onRetry={refetchBrain} />
  }

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
