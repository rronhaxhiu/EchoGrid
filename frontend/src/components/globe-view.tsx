"use client";

import { useEffect, useRef, useState } from "react";

import { loadGlobeScripts } from "@/lib/load-globe-scripts";
import { cn } from "@/lib/utils";
import type { GlobeInstance } from "@/types/globe";

export interface GlobeViewProps {
  slices: number[][];
  className?: string;
  time?: number;
  onReady?: (globe: GlobeInstance) => void;
}

export function GlobeView({
  slices,
  className,
  time = 0,
  onReady,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const sliceSignature = slices.map((s) => s.length).join(",");

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container || slices.length === 0) return;

    setError(null);
    setReady(false);

    (async () => {
      try {
        await loadGlobeScripts();
        if (cancelled) return;

        container.innerHTML = "";
        const globe = new window.DAT.Globe(container, { imgDir: "/globe/" });
        globeRef.current = globe;

        for (let i = 0; i < slices.length; i++) {
          globe.addData(slices[i], {
            name: `tick_${i}`,
            animated: true,
          });
        }

        globe.createPoints();
        globe.animate();

        if (!cancelled) {
          globe.time = time;
          setReady(true);
          onReady?.(globe);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to initialize globe.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      globeRef.current = null;
      container.innerHTML = "";
    };
  }, [slices.length, sliceSignature, onReady]);

  useEffect(() => {
    if (globeRef.current && ready) {
      globeRef.current.time = time;
    }
  }, [time, ready]);

  if (slices.length === 0) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">
          No simulation slices to display.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        ref={containerRef}
        className="h-full w-full cursor-grab active:cursor-grabbing [&_canvas]:block"
      />
      {error ? (
        <p className="absolute inset-0 flex items-center justify-center bg-background/80 p-4 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
