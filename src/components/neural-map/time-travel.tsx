import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { Brain } from '@/lib/types';

interface TimeTravelControlsProps {
  brain: Brain | undefined;
  timeTravelDate: React.RefObject<Date | null>;
  onDateChange: () => void;
}

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export function TimeTravelControls({ brain, timeTravelDate, onDateChange }: TimeTravelControlsProps) {
  const [label, setLabel] = useState('now');
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  // Compute actual timestamp range from brain entries.
  const rangeRef = useRef({ min: 0, max: Date.now() });

  useEffect(() => {
    if (!brain) return;
    const timestamps: number[] = [];
    const sections = ['workingStyle', 'architecture', 'agentRules', 'decisions'] as const;
    for (const section of sections) {
      for (const entry of brain[section]) {
        if (entry.createdAt) timestamps.push(new Date(entry.createdAt).getTime());
      }
    }
    if (timestamps.length > 0) {
      rangeRef.current = {
        min: Math.min(...timestamps),
        max: Math.max(...timestamps, Date.now()),
      };
    }
    // Init slider to max.
    if (sliderRef.current) {
      sliderRef.current.min = String(rangeRef.current.min);
      sliderRef.current.max = String(rangeRef.current.max);
      sliderRef.current.value = String(rangeRef.current.max);
    }
    setLabel('now');
  }, [brain]);

  const applySliderValue = useCallback((val: number) => {
    const { max } = rangeRef.current;
    if (val >= max - 60000) {
      // Within 1 minute of max = "now", no filter.
      timeTravelDate.current = null;
      setLabel('now');
    } else {
      timeTravelDate.current = new Date(val);
      setLabel(formatDateLabel(val));
    }
    onDateChange();
  }, [timeTravelDate, onDateChange]);

  const handleSliderInput = useCallback(() => {
    if (!sliderRef.current) return;
    const val = parseInt(sliderRef.current.value);
    applySliderValue(val);
  }, [applySliderValue]);

  // Play: 5 seconds total, 50ms intervals.
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const { min, max } = rangeRef.current;
    const totalRange = max - min;
    const stepMs = totalRange / (5000 / 50);

    // Start from beginning.
    let currentVal = min;
    if (sliderRef.current) {
      sliderRef.current.value = String(min);
    }
    applySliderValue(min);

    playIntervalRef.current = setInterval(() => {
      currentVal += stepMs;
      if (currentVal >= max) {
        currentVal = max;
        if (sliderRef.current) sliderRef.current.value = String(max);
        applySliderValue(max);
        if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
        setIsPlaying(false);
        return;
      }
      if (sliderRef.current) sliderRef.current.value = String(currentVal);
      applySliderValue(currentVal);
    }, 50);
  }, [isPlaying, applySliderValue]);

  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-lg border border-white/5 bg-brain-raised/80 px-3 py-2 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
      >
        {isPlaying ? '⏸' : '▶'}
      </Button>
      <input
        ref={sliderRef}
        type="range"
        className="w-32 accent-brain-accent"
        defaultValue={String(rangeRef.current.max)}
        onInput={handleSliderInput}
      />
      <span className="min-w-[80px] text-right text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
