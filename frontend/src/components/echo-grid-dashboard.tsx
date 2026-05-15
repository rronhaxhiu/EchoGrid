"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { GlobeView } from "@/components/globe-view";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  createDemoRun,
  getApiBase,
  listRuns,
  loadRunSnapshots,
  type RunMeta,
} from "@/lib/api";
import { tilesToGlobeData } from "@/lib/hex-to-globe";
import { rebuildTimeline } from "@/lib/snapshots";

export function EchoGridDashboard() {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [runId, setRunId] = useState<string>("");
  const [variable, setVariable] = useState<string>("health");
  const [globeTime, setGlobeTime] = useState(0);
  const [hexRadius, setHexRadius] = useState(5);
  const [sliceCount, setSliceCount] = useState(0);
  const [globeSlices, setGlobeSlices] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variables = useMemo(() => {
    const run = runs.find((r) => r.id === runId);
    return run?.variables ?? ["health", "economy", "green", "mobility"];
  }, [runs, runId]);

  const loadRuns = useCallback(async () => {
    setError(null);
    try {
      const data = await listRuns();
      setRuns(data);
      if (data.length > 0) {
        setRunId((current) => current || data[0].id);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Cannot reach API at ${getApiBase()}. Start the backend on port 8000.`,
      );
    }
  }, []);

  const loadRunGlobe = useCallback(
    async (id: string, varName: string) => {
      setBusy(true);
      setError(null);
      try {
        const { meta, snapshots } = await loadRunSnapshots(id);
        const frames = rebuildTimeline(snapshots);
        const radius = meta.hex_radius;
        setHexRadius(radius);
        setSliceCount(frames.length);

        const slices = frames.map((frame) =>
          tilesToGlobeData(frame, varName, radius),
        );
        setGlobeSlices(slices);
        setGlobeTime(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load run data.");
        setGlobeSlices([]);
        setSliceCount(0);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadRuns();
      setLoading(false);
    })();
  }, [loadRuns]);

  useEffect(() => {
    if (!runId) return;
    void loadRunGlobe(runId, variable);
  }, [runId, variable, loadRunGlobe]);

  useEffect(() => {
    if (!variables.includes(variable) && variables.length > 0) {
      setVariable(variables[0]);
    }
  }, [variables, variable]);

  const tickLabel =
    sliceCount > 1
      ? `Tick ${Math.round(globeTime * (sliceCount - 1))} / ${sliceCount - 1}`
      : sliceCount === 1
        ? "Tick 0"
        : "—";

  async function handleCreateDemo() {
    setBusy(true);
    setError(null);
    try {
      const run = await createDemoRun();
      await loadRuns();
      setRunId(run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create demo run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-0 flex-1">
      <GlobeView
        className="absolute inset-0 bg-black"
        slices={globeSlices}
        time={globeTime}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-4">
        <Card className="pointer-events-auto w-full max-w-xl border-border/60 bg-card/90 shadow-lg backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg tracking-tight">EchoGrid</CardTitle>
            <CardDescription>
              Hex simulation on a WebGL globe — scrub time to morph between
              snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1 space-y-2">
                <Label htmlFor="run-select">Run</Label>
                <Select
                  value={runId || undefined}
                  onValueChange={(v) => setRunId(v ?? "")}
                  disabled={loading || busy || runs.length === 0}
                >
                  <SelectTrigger id="run-select" className="w-full">
                    <SelectValue placeholder="Select a run" />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.map((run) => (
                      <SelectItem key={run.id} value={run.id}>
                        {run.id.slice(0, 8)}… · tick {run.current_tick}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[10rem] flex-1 space-y-2">
                <Label htmlFor="var-select">Variable</Label>
                <Select
                  value={variable}
                  onValueChange={(v) => setVariable(v ?? "health")}
                  disabled={loading || busy || !runId}
                >
                  <SelectTrigger id="var-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {variables.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void handleCreateDemo()}
              >
                {busy ? "Working…" : "Demo run +12 ticks"}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label>Simulation time</Label>
                <span className="tabular-nums text-muted-foreground">
                  {tickLabel}
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={sliceCount > 1 ? 1 / (sliceCount - 1) : 1}
                value={[globeTime]}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v;
                  setGlobeTime(typeof next === "number" ? next : 0);
                }}
                disabled={sliceCount < 2 || busy}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              API: {getApiBase()} · hex radius {hexRadius} · drag to rotate, scroll
              to zoom
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
