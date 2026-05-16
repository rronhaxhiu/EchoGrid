"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Pause, Play, CheckSquare, Globe2, Bug, Trees, Layers3 } from "lucide-react";
import { WorldControlPanel } from "@/components/world/WorldControlPanel";
import { GlobalMetrics } from "@/components/world/GlobalMetrics";
import { TileEditor } from "@/components/world/TileEditor";
import { useSimulationStore } from "@/store/simulationStore";
import { cn } from "@/lib/utils";
import type {
  GlobeSurfaceMode,
  GlobeVisualizationMode,
} from "@/components/globe/HexGlobe";

const HexGlobe = dynamic(
  () => import("@/components/globe/HexGlobe").then((m) => ({ default: m.HexGlobe })),
  { ssr: false, loading: () => <GlobePlaceholder /> }
);

function GlobePlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="w-24 h-24 rounded-full bg-violet-500/20 mx-auto animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading globe...</p>
      </div>
    </div>
  );
}

interface TileInfo {
  q: number;
  r: number;
  variables: Record<string, number>;
}

export default function WorldPage() {
  const { worldState, selectedVariable, hexRadius, status } = useSimulationStore();

  const [tileInfo, setTileInfo] = useState<TileInfo | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [surfaceMode, setSurfaceMode] = useState<GlobeSurfaceMode>("globe");
  const [visualizationMode, setVisualizationMode] =
    useState<GlobeVisualizationMode>("parameter");
  const isActive = status === "running" || status === "paused";
  const isStopped = status === "stopped";

  const tiles = worldState?.tiles ?? {};
  const liveTileVariables =
    tileInfo ? (tiles[`${tileInfo.q},${tileInfo.r}`] ?? tileInfo.variables) : null;

  return (
    <div className="fixed inset-0 pt-16 overflow-hidden bg-[#050410] dark:bg-[#050410]">
      <div className="absolute inset-0 pt-16">
        <HexGlobe
          tiles={tiles}
          selectedVariable={selectedVariable}
          hexRadius={hexRadius}
          isAnimating={status === "running"}
          autoRotate={autoRotate}
          surfaceMode={surfaceMode}
          visualizationMode={visualizationMode}
          selectedTileKey={tileInfo ? `${tileInfo.q},${tileInfo.r}` : null}
          onTileClick={(q, r, variables) => setTileInfo({ q, r, variables })}
        />
      </div>

      {(isActive || Object.keys(tiles).length > 0) && (
        <div className="absolute top-20 left-6 z-20 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-xl shadow-xl">
            <div className="mb-2 px-2 text-[11px] uppercase tracking-[0.24em] text-white/45">
              Surface
            </div>
            <div className="flex items-center gap-2">
              <ToggleChip
                active={surfaceMode === "globe"}
                icon={Globe2}
                label="Globe view"
                onClick={() => setSurfaceMode("globe")}
              />
              <ToggleChip
                active={surfaceMode === "field"}
                icon={Layers3}
                label="Field view"
                onClick={() => setSurfaceMode("field")}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-xl shadow-xl">
            <div className="mb-2 px-2 text-[11px] uppercase tracking-[0.24em] text-white/45">
              Visualization
            </div>
            <div className="flex items-center gap-2">
              <ToggleChip
                active={visualizationMode === "parameter"}
                icon={Layers3}
                label="Parameter lift"
                onClick={() => setVisualizationMode("parameter")}
              />
              <ToggleChip
                active={visualizationMode === "pest"}
                icon={visualizationMode === "pest" ? Trees : Bug}
                label="Pest risk + grass"
                onClick={() => setVisualizationMode("pest")}
              />
            </div>
          </div>
        </div>
      )}

      {isActive && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <GlobalMetrics />
        </div>
      )}

      {isStopped && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
          <div className="flex items-center gap-3 bg-black/70 backdrop-blur-xl border border-amber-400/30 rounded-2xl px-5 py-2.5 shadow-2xl">
            <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-200">
                Simulation Complete
              </span>
              <span className="text-xs text-white/40">·</span>
              <span className="text-xs text-white/60 font-mono">
                {worldState?.tick ?? 0} ticks
              </span>
            </div>
            <span className="text-xs text-white/35 hidden sm:block">
              Configure a new run in the panel →
            </span>
          </div>
        </div>
      )}

      {status === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-16">
          <div className="text-center space-y-3 animate-fade-in">
            <div className="text-5xl animate-float">🌍</div>
            <p className="text-white/70 text-lg font-medium">
              Configure and start your simulation
            </p>
            <p className="text-white/40 text-sm">
              Use the panel on the right →
            </p>
          </div>
        </div>
      )}

      {tileInfo && liveTileVariables && (
        <div className="absolute bottom-8 left-8 z-20">
          <TileEditor
            q={tileInfo.q}
            r={tileInfo.r}
            variables={liveTileVariables}
            onClose={() => setTileInfo(null)}
          />
        </div>
      )}

      {(isActive || isStopped) && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            className={cn(
              "flex items-center gap-3 backdrop-blur-xl border rounded-xl px-4 py-2 shadow-md transition-all duration-500",
              isStopped
                ? "bg-black/40 border-white/5 opacity-60"
                : "bg-black/50 border-white/10"
            )}
          >
            <span className="text-xs text-white/60">Low</span>
            <div
              className={cn(
                "w-28 h-1.5 rounded-full",
                visualizationMode === "pest"
                  ? "bg-gradient-to-r from-[#22C55E] via-[#FACC15] to-[#EF4444]"
                  : "bg-gradient-to-r from-[#EF4444] via-[#FBBF24] to-[#34D399]"
              )}
            />
            <span className="text-xs text-white/60">High</span>
            <span className="text-xs text-white/50 capitalize font-medium ml-1">
              {visualizationMode === "pest" ? "pest risk" : selectedVariable}
            </span>
            <span className="text-xs text-cyan-300/60 font-medium">
              {surfaceMode === "globe" ? "globe" : "field"}
            </span>
            {isStopped && (
              <span className="text-xs text-amber-400/60 font-medium ml-1">
                final
              </span>
            )}
          </div>
        </div>
      )}

      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex items-center">
        <WorldControlPanel />
      </div>

      <div className="absolute bottom-8 right-6 z-20">
        <button
          onClick={() => setAutoRotate((v) => !v)}
          title={autoRotate ? "Pause rotation" : "Resume rotation"}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl border shadow-md transition-all",
            autoRotate
              ? "bg-black/50 border-white/10 text-white/60 hover:text-white/90 hover:border-white/20"
              : "bg-violet-500/20 border-violet-400/30 text-violet-300 hover:bg-violet-500/30"
          )}
        >
          {autoRotate ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {autoRotate ? "Pause rotation" : "Resume rotation"}
        </button>
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Globe2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium border transition-all",
        active
          ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100 shadow-lg shadow-cyan-950/30"
          : "border-white/10 bg-white/5 text-white/65 hover:text-white hover:border-white/20"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
