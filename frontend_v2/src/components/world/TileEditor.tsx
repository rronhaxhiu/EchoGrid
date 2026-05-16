"use client";

import { useState } from "react";
import { X, Zap, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getVariableMeta, formatValue } from "@/lib/utils";
import { api } from "@/lib/api";
import { useSimulationStore } from "@/store/simulationStore";

interface TileEditorProps {
  q: number;
  r: number;
  variables: Record<string, number>;
  onClose: () => void;
}

type SubmitState = "idle" | "loading" | "success" | "error";

const QUICK_DELTAS = [-20, -10, -5, +5, +10, +20];

export function TileEditor({ q, r, variables, onClose }: TileEditorProps) {
  const { activeRun, status, runTick } = useSimulationStore();
  const isActive = status === "running" || status === "paused";

  const varNames = Object.keys(variables);
  const currentTick = activeRun?.current_tick ?? 0;

  const [deltaMap, setDeltaMap] = useState<Record<string, number>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hasDelta = Object.values(deltaMap).some((d) => d !== 0);
  const canApply = isActive && hasDelta;
  const isBusy = submitState === "loading";

  function nudgeDelta(variable: string, delta: number) {
    setDeltaMap((prev) => {
      const next = Math.round(((prev[variable] ?? 0) + delta) * 100) / 100;
      if (next === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [variable]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variable]: next };
    });
  }

  function clearAll() {
    setDeltaMap({});
  }

  // Build a human-readable event name from the delta map
  function buildEventName(): string {
    const parts = Object.entries(deltaMap)
      .filter(([, d]) => d !== 0)
      .map(([v, d]) => `${v} ${d > 0 ? "+" : ""}${d}`);
    return parts.join(", ");
  }

  async function applyNow() {
    if (!activeRun || !canApply) return;
    setSubmitState("loading");
    setErrorMsg("");

    try {
      await api.events.add(activeRun.id, {
        // Always target the very next tick; backend bumps if already passed
        tick: currentTick + 1,
        name: buildEventName(),
        delta_map: deltaMap,
        target_tiles: [[q, r]],
        source: "user",
      });

      // Force the event to be processed immediately by running one tick now.
      // Without this, a paused simulation would never process the event.
      await runTick();

      setDeltaMap({});
      setSubmitState("success");
      setTimeout(() => setSubmitState("idle"), 2500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to apply");
      setSubmitState("error");
      setTimeout(() => setSubmitState("idle"), 3000);
    }
  }

  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl w-80 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <span className="text-xs">🎯</span>
          </div>
          <span className="text-sm font-semibold">
            Tile ({q}, {r})
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Variable rows */}
      <div className="px-4 py-3 space-y-2">
        {varNames.map((name) => {
          const meta = getVariableMeta(name);
          const val = variables[name] ?? 0;
          const barWidth = Math.min(100, Math.max(0, val));
          const pendingDelta = deltaMap[name] ?? 0;

          return (
            <div key={name} className="space-y-1.5">
              {/* Value row */}
              <div className="flex items-center gap-3 px-2">
                <span className="text-base w-5 text-center">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{meta.label}</span>
                    <div className="flex items-center gap-1.5">
                      {pendingDelta !== 0 && (
                        <span
                          className={cn(
                            "text-xs font-mono font-bold",
                            pendingDelta > 0 ? "text-emerald-500" : "text-red-400"
                          )}
                        >
                          {pendingDelta > 0 ? "+" : ""}
                          {pendingDelta}
                        </span>
                      )}
                      <span
                        className="text-xs font-mono font-bold"
                        style={{ color: meta.color }}
                      >
                        {formatValue(val)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              </div>

              {/* Delta buttons — always visible when simulation active */}
              {isActive && (
                <div className="grid grid-cols-6 gap-1 px-2">
                  {QUICK_DELTAS.map((d) => (
                    <button
                      key={d}
                      onClick={() => nudgeDelta(name, d)}
                      disabled={isBusy}
                      className={cn(
                        "h-7 rounded-lg text-xs font-mono font-bold transition-all duration-150",
                        "border disabled:opacity-40 disabled:cursor-not-allowed",
                        d < 0
                          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
                      )}
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Apply section */}
      {isActive && (
        <>
          <div className="h-px bg-border mx-4" />
          <div className="px-4 py-3 space-y-2">
            {/* Pending summary */}
            {hasDelta && (
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Pending changes</span>
                  <button
                    onClick={clearAll}
                    disabled={isBusy}
                    className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                  >
                    clear
                  </button>
                </div>
                {Object.entries(deltaMap).map(([v, d]) => {
                  const meta = getVariableMeta(v);
                  return (
                    <div key={v} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                      <span className={cn("font-mono font-bold", d > 0 ? "text-emerald-500" : "text-red-400")}>
                        {d > 0 ? "+" : ""}{d}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              size="sm"
              onClick={applyNow}
              disabled={!canApply || isBusy}
              className="w-full h-8 text-xs gap-1.5"
            >
              {isBusy ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Apply Now
                </>
              )}
            </Button>

            {submitState === "success" && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Applied — effects visible on next tick</span>
              </div>
            )}
            {submitState === "error" && (
              <div className="flex items-center gap-2 text-xs text-red-500 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </>
      )}

      {!isActive && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground text-center">
            Start a simulation to inject changes
          </p>
        </div>
      )}
    </div>
  );
}
