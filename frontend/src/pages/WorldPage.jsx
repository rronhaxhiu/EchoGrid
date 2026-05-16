"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CesiumHexGlobe } from "@/components/ecogrid/CesiumHexGlobe";
import { TileInfoPanel } from "@/components/ecogrid/TileInfoPanel";
import { Button } from "@/components/ui/button";
import { useWorldRun } from "@/hooks/useWorldRun";
import { getTileState } from "@/services/simulationsApi";

export function WorldPage() {
  const { run, worldState, layer, status, error, reload } = useWorldRun();
  const [selectedTile, setSelectedTile] = useState(null);
  const [tileDetails, setTileDetails] = useState(null);
  const [detailStatus, setDetailStatus] = useState("idle");

  const handleTileSelect = useCallback((tile) => {
    setSelectedTile(tile);
    setTileDetails(null);
    setDetailStatus(tile ? "loading" : "idle");
  }, []);

  useEffect(() => {
    if (!run?.id || !selectedTile) {
      return undefined;
    }

    let cancelled = false;

    getTileState(
      run.id,
      selectedTile.backendTile.q,
      selectedTile.backendTile.r,
    )
      .then((details) => {
        if (!cancelled) {
          setTileDetails(details);
          setDetailStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTileDetails(null);
          setDetailStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [run?.id, selectedTile]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02050c] text-white">
      <div className="absolute inset-0">
        {layer ? (
          <CesiumHexGlobe
            cells={layer.cells}
            max={layer.max}
            min={layer.min}
            onTileSelect={handleTileSelect}
            variableLabel={layer.variableLabel}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_50%_28%,rgba(8,145,178,0.2),transparent_34%),#02050c]" />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,5,12,0.62)_0%,transparent_32%,rgba(2,5,12,0.56)_100%)]" />

      <header className="absolute left-4 right-4 top-4 z-20 flex justify-end">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/38 p-2 shadow-xl shadow-black/18 backdrop-blur-xl">
          <Button
            asChild
            className="rounded-lg border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.10]"
            variant="outline"
          >
            <a href="/">
              <ArrowLeft className="size-4" />
              Landing
            </a>
          </Button>
          <Button
            className="rounded-lg bg-cyan-200/72 text-slate-950 hover:bg-cyan-100/86"
            onClick={reload}
            type="button"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </header>

      <TileInfoPanel
        className="absolute bottom-4 right-4 top-28 z-20 w-[min(23rem,calc(100vw-2rem))] overflow-auto"
        detailStatus={detailStatus}
        globalState={worldState?.global_state}
        layer={layer}
        selectedTile={selectedTile}
        tileDetails={tileDetails}
      />

      {status === "loading" ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#02050c]/72 text-sm text-cyan-100/78 backdrop-blur-sm">
          Loading simulation data
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#02050c]/86 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-rose-300/20 bg-slate-950/80 p-5 text-center shadow-2xl shadow-black/35">
            <p className="text-sm text-rose-100">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                className="rounded-lg bg-cyan-200 text-slate-950 hover:bg-cyan-100"
                onClick={reload}
                type="button"
              >
                Retry
              </Button>
              <Button
                asChild
                className="rounded-lg border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                variant="outline"
              >
                <a href="/">Landing</a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
