"use client";

import { useEffect, useState } from "react";

import { CesiumH3Globe } from "@/components/cesium-h3-globe";
import { createDemoRun, listRuns, loadRunSnapshots } from "@/lib/api";
import { rebuildTimeline } from "@/lib/snapshots";
import { buildGlobalLandH3Layer } from "@/lib/sim-h3-layer";

const DEFAULT_VARIABLE = "health";
/** H3 resolution 3–6: higher = smaller hexes; more cells (capped in land-mask). */
const H3_RESOLUTION = 5;
/** Initial land lattice step (°); auto-relaxed if `maxLandCells` exceeded. */
const LAND_SAMPLE_STEP_DEG = 0.38;
const MAX_LAND_CELLS = 24_000;

export function EchoGridDashboard() {
  const [layer, setLayer] = useState<Awaited<
    ReturnType<typeof buildGlobalLandH3Layer>
  > | null>(null);
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
          throw new Error("No simulation runs.");
        }

        const runId = runs[0].id;
        const { meta, snapshots } = await loadRunSnapshots(runId);
        const frames = rebuildTimeline(snapshots);
        if (frames.length === 0) {
          throw new Error("No snapshots.");
        }

        const latest = frames[frames.length - 1];
        const built = await buildGlobalLandH3Layer(
          latest,
          DEFAULT_VARIABLE,
          meta.hex_radius,
          H3_RESOLUTION,
          {
            landSampleStepDeg: LAND_SAMPLE_STEP_DEG,
            maxLandCells: MAX_LAND_CELLS,
          },
        );

        if (!cancelled) {
          setLayer(built);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setLayer(null);
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
      {layer && layer.cells.length > 0 ? (
        <CesiumH3Globe
          cells={layer.cells}
          min={layer.min}
          max={layer.max}
          variableLabel={DEFAULT_VARIABLE}
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-950" />
      )}
      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="text-sm text-white/75">
            Loading land grid &amp; H3 coverage…
          </p>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="max-w-sm px-4 text-center text-sm text-white/85">
            Could not load data. Start the API on port 8000 and refresh.
          </p>
        </div>
      ) : null}
    </div>
  );
}
