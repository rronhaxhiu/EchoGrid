"use client";

import { useEffect, useState } from "react";

import { GlobeView } from "@/components/globe-view";
import { createDemoRun, listRuns, loadRunSnapshots } from "@/lib/api";
import { buildLandGlobeSlice } from "@/lib/land-globe-data";
import { rebuildTimeline } from "@/lib/snapshots";

const DEFAULT_VARIABLE = "health";
/** Land lattice spacing in degrees — lower = denser bars on land only. */
const LAND_STEP_DEG = 1.1;

export function EchoGridDashboard() {
  const [globeSlices, setGlobeSlices] = useState<number[][]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let runs = await listRuns();
        if (runs.length === 0) {
          await createDemoRun();
          runs = await listRuns();
        }
        if (runs.length === 0) {
          throw new Error("No simulation runs available.");
        }

        const runId = runs[0].id;
        const { meta, snapshots } = await loadRunSnapshots(runId);
        const frames = rebuildTimeline(snapshots);
        if (frames.length === 0) {
          throw new Error("Run has no snapshots to visualize.");
        }

        const latest = frames[frames.length - 1];
        const slice = await buildLandGlobeSlice(
          latest,
          DEFAULT_VARIABLE,
          meta.hex_radius,
          LAND_STEP_DEG,
        );

        if (!cancelled) {
          setGlobeSlices([slice]);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setGlobeSlices([]);
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-0 flex-1 bg-black">
      <GlobeView className="absolute inset-0" slices={globeSlices} time={0} />
      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <p className="text-sm text-white/70">Building land mesh…</p>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
          <p className="max-w-sm px-4 text-center text-sm text-white/80">
            Could not load simulation data. Start the API on port 8000 and
            refresh.
          </p>
        </div>
      ) : null}
    </div>
  );
}
