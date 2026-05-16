"use client";

import { useState } from "react";
import {
  Play, Square, Pause, RotateCcw,
  ChevronRight, Settings2, Globe2, Zap, Timer, CheckSquare, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSimulationStore } from "@/store/simulationStore";
import { cn, formatValue, getVariableMeta, getTileCount } from "@/lib/utils";
import type { VariableConfig } from "@/types/simulation";

const TICK_SPEEDS = [
  { label: "Slow", value: 2500 },
  { label: "Normal", value: 1200 },
  { label: "Fast", value: 600 },
  { label: "Turbo", value: 200 },
];

export function WorldControlPanel() {
  const {
    status,
    activeRun,
    worldState,
    hexRadius,
    seed,
    spatialDecay,
    variableConfigs,
    selectedVariable,
    tickSpeed,
    error,
    setHexRadius,
    setSeed,
    setSpatialDecay,
    setVariableConfigs,
    setSelectedVariable,
    setTickSpeed,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
  } = useSimulationStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isIdle = status === "idle" || status === "stopped";
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isActive = isRunning || isPaused;

  const tileCount = getTileCount(hexRadius);

  async function handleStart() {
    setIsLoading(true);
    try {
      await startSimulation();
    } finally {
      setIsLoading(false);
    }
  }

  function toggleVariable(name: string) {
    setVariableConfigs(
      variableConfigs.map((v) =>
        v.name === name ? { ...v, enabled: !v.enabled } : v
      )
    );
  }

  function updateInitialValue(name: string, value: number) {
    setVariableConfigs(
      variableConfigs.map((v) =>
        v.name === name ? { ...v, initial_value: value } : v
      )
    );
  }

  return (
    <div
      className={cn(
        "relative transition-all duration-300",
        isCollapsed ? "w-14" : "w-80"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 hover:bg-violet-700 transition-colors"
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform duration-300",
            isCollapsed ? "rotate-0" : "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "h-full rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden transition-all duration-300",
          isCollapsed && "overflow-hidden opacity-0 pointer-events-none"
        )}
      >
        <div className="p-5 overflow-y-auto max-h-[calc(100vh-140px)]">
          {isIdle ? (
            <ConfigPanel
              hexRadius={hexRadius}
              seed={seed}
              spatialDecay={spatialDecay}
              variableConfigs={variableConfigs}
              tileCount={tileCount}
              isLoading={isLoading}
              error={error}
              isStopped={status === "stopped"}
              lastRunTick={worldState?.tick}
              lastRunId={activeRun?.id}
              onHexRadiusChange={setHexRadius}
              onSeedChange={setSeed}
              onSpatialDecayChange={setSpatialDecay}
              onToggleVariable={toggleVariable}
              onUpdateInitialValue={updateInitialValue}
              onStart={handleStart}
            />
          ) : (
            <RunningPanel
              activeRun={activeRun}
              worldState={worldState}
              status={status}
              selectedVariable={selectedVariable}
              tickSpeed={tickSpeed}
              variableConfigs={variableConfigs.filter((v) => v.enabled)}
              isRunning={isRunning}
              isPaused={isPaused}
              onPause={pauseSimulation}
              onResume={resumeSimulation}
              onStop={stopSimulation}
              onSelectVariable={setSelectedVariable}
              onSpeedChange={setTickSpeed}
            />
          )}
        </div>
      </div>

      {/* Collapsed icon strip */}
      {isCollapsed && (
        <div className="w-14 h-full rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col items-center gap-3 py-5">
          <Globe2 className="w-5 h-5 text-violet-500" />
          {isActive && (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
          {status === "stopped" && (
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </div>
      )}
    </div>
  );
}

// Config Panel (before simulation starts / after it ends)
function ConfigPanel({
  hexRadius, seed, spatialDecay, variableConfigs, tileCount,
  isLoading, error, isStopped, lastRunTick, lastRunId,
  onHexRadiusChange, onSeedChange, onSpatialDecayChange,
  onToggleVariable, onUpdateInitialValue, onStart,
}: {
  hexRadius: number; seed: number; spatialDecay: number;
  variableConfigs: VariableConfig[]; tileCount: number;
  isLoading: boolean; error: string | null;
  isStopped?: boolean; lastRunTick?: number; lastRunId?: string;
  onHexRadiusChange: (v: number) => void;
  onSeedChange: (v: number) => void;
  onSpatialDecayChange: (v: number) => void;
  onToggleVariable: (name: string) => void;
  onUpdateInitialValue: (name: string, value: number) => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Run ended summary card */}
      {isStopped && (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/10 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  Simulation Complete
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-500/80 font-mono">
                  Ended at tick {lastRunTick ?? 0}
                  {lastRunId && (
                    <span className="text-amber-500/60 dark:text-amber-600/60">
                      {" "}· {lastRunId.slice(0, 8)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <a
              href="/runs"
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline w-fit"
            >
              <ExternalLink className="w-3 h-3" />
              View in Runs history
            </a>
          </div>
          <Separator />
        </>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <Settings2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">
            {isStopped ? "New Run Config" : "World Config"}
          </h2>
          <p className="text-xs text-muted-foreground">{tileCount} tiles</p>
        </div>
      </div>

      <Separator />

      {/* Hex Radius */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Hex Radius
          </Label>
          <Badge variant="default" className="font-mono text-xs">
            {hexRadius}
          </Badge>
        </div>
        <Slider
          min={1} max={20} step={1}
          value={[hexRadius]}
          onValueChange={([v]) => onHexRadiusChange(v)}
        />
        <p className="text-xs text-muted-foreground">
          {tileCount} hexagonal tiles
        </p>
      </div>

      {/* Seed */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Seed
        </Label>
        <Input
          type="number"
          value={seed}
          onChange={(e) => onSeedChange(parseInt(e.target.value) || 0)}
          className="text-sm h-9"
        />
      </div>

      {/* Spatial Decay */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Spatial Decay
          </Label>
          <Badge variant="secondary" className="font-mono text-xs">
            {formatValue(spatialDecay, 2)}
          </Badge>
        </div>
        <Slider
          min={0} max={1} step={0.05}
          value={[spatialDecay]}
          onValueChange={([v]) => onSpatialDecayChange(v)}
        />
        <p className="text-xs text-muted-foreground">
          How much effects spread to neighbors
        </p>
      </div>

      <Separator />

      {/* Variables */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Variables
        </Label>

        <div className="space-y-2">
          {variableConfigs.map((config) => {
            const meta = getVariableMeta(config.name);
            return (
              <div
                key={config.name}
                className={cn(
                  "rounded-xl border p-3 transition-all duration-200",
                  config.enabled
                    ? "border-violet-200 bg-violet-50 dark:border-violet-800/50 dark:bg-violet-900/10"
                    : "border-border bg-muted/30 opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <span className="text-sm font-medium">{meta.label}</span>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={() => onToggleVariable(config.name)}
                  />
                </div>
                {config.enabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">Initial avg</span>
                    <Input
                      type="number"
                      value={config.initial_value}
                      onChange={(e) =>
                        onUpdateInitialValue(
                          config.name,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/50 p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* CTA */}
      <Button
        onClick={onStart}
        disabled={isLoading || variableConfigs.every((v) => !v.enabled)}
        size="lg"
        className="w-full gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Initializing...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            {isStopped ? "Start New Simulation" : "Start Simulation"}
          </>
        )}
      </Button>
    </div>
  );
}

// Running Panel (after simulation starts)
function RunningPanel({
  activeRun, worldState, status, selectedVariable, tickSpeed, variableConfigs,
  isRunning, isPaused,
  onPause, onResume, onStop, onSelectVariable, onSpeedChange,
}: {
  activeRun: import("@/types/simulation").RunMeta | null;
  worldState: import("@/types/simulation").WorldStateResponse | null;
  status: string;
  selectedVariable: string;
  tickSpeed: number;
  variableConfigs: VariableConfig[];
  isRunning: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSelectVariable: (v: string) => void;
  onSpeedChange: (ms: number) => void;
}) {
  const global = worldState?.global_state ?? {};
  const currentSpeed = TICK_SPEEDS.find((s) => s.value === tickSpeed) ?? TICK_SPEEDS[1];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Globe2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          {isRunning && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-background animate-pulse" />
          )}
        </div>
        <div>
          <h2 className="font-semibold text-sm">
            {isPaused ? "Paused" : "Running"}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            Tick {worldState?.tick ?? 0}
          </p>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onPause}
            className="flex-1 gap-1.5"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </Button>
        ) : (
          <Button
            variant="success"
            size="sm"
            onClick={onResume}
            className="flex-1 gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            Resume
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
        >
          <Square className="w-3.5 h-3.5" />
          Stop
        </Button>
      </div>

      <Separator />

      {/* Speed control */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Speed
          </Label>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {TICK_SPEEDS.map((s) => (
            <button
              key={s.value}
              onClick={() => onSpeedChange(s.value)}
              className={cn(
                "py-1.5 rounded-lg text-xs font-medium transition-colors",
                s.value === tickSpeed
                  ? "bg-violet-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-900/20"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Variable selector */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Color by
        </Label>
        <Select value={selectedVariable} onValueChange={onSelectVariable}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {variableConfigs.map((v) => {
              const meta = getVariableMeta(v.name);
              return (
                <SelectItem key={v.name} value={v.name}>
                  <span className="flex items-center gap-2">
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Global state metrics */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Global State
        </Label>
        <div className="space-y-2">
          {variableConfigs.map((v) => {
            const meta = getVariableMeta(v.name);
            const val = global[v.name] ?? 0;
            const isSelected = v.name === selectedVariable;
            return (
              <button
                key={v.name}
                onClick={() => onSelectVariable(v.name)}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left",
                  isSelected
                    ? "bg-violet-100 dark:bg-violet-900/20 ring-1 ring-violet-300 dark:ring-violet-700"
                    : "hover:bg-muted"
                )}
              >
                <span className="text-lg">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{meta.label}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: meta.color }}>
                      {formatValue(val)}
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(0, val))}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Run info */}
      {activeRun && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Run ID</span>
              <span className="text-xs font-mono text-foreground truncate max-w-28">
                {activeRun.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tiles</span>
              <span className="text-xs font-mono">{activeRun.tile_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Radius</span>
              <span className="text-xs font-mono">{activeRun.hex_radius}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
