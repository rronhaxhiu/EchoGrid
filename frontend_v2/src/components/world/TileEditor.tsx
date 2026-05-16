"use client";

import { useState } from "react";
import { X, Zap, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function ApplyEventModal({
  q,
  r,
  variables,
  onClose,
}: {
  q: number;
  r: number;
  variables: Record<string, number>;
  onClose: () => void;
}) {
  const { activeRun, status, runTick, variableConfigs } = useSimulationStore();
  const currentTick = activeRun?.current_tick ?? 0;
  const varNames = Object.keys(variables);

  const [eventName, setEventName] = useState("");
  const [deltaMap, setDeltaMap] = useState<Record<string, number>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hasDelta = Object.values(deltaMap).some((d) => d !== 0);
  const canSubmit =
    (status === "running" || status === "paused") &&
    eventName.trim().length > 0 &&
    hasDelta;
  const isBusy = submitState === "loading";

  function configFor(name: string) {
    return variableConfigs.find((c) => c.name === name);
  }

  function setDelta(variable: string, delta: number) {
    setDeltaMap((prev) => {
      const rounded = Math.round(delta * 100) / 100;
      if (rounded === 0) {
        const { [variable]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variable]: rounded };
    });
  }

  function nudgeDelta(variable: string, delta: number) {
    setDeltaMap((prev) => {
      const next = Math.round(((prev[variable] ?? 0) + delta) * 100) / 100;
      if (next === 0) {
        const { [variable]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variable]: next };
    });
  }

  async function handleSubmit() {
    if (!activeRun || !canSubmit) return;
    setSubmitState("loading");
    setErrorMsg("");

    try {
      await api.events.add(activeRun.id, {
        tick: currentTick + 1,
        name: eventName.trim(),
        delta_map: deltaMap,
        target_tiles: [[q, r]],
        source: "user",
      });
      await runTick();
      setSubmitState("success");
      setTimeout(() => onClose(), 800);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to apply event");
      setSubmitState("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-event-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 id="apply-event-title" className="text-base font-semibold">
              Apply Event
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Tile ({q}, {r})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[min(70vh,520px)] overflow-y-auto">
          <div className="space-y-2">
            <Label
              htmlFor="event-name"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Event name
            </Label>
            <Input
              id="event-name"
              placeholder="e.g. Economic stimulus"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              disabled={isBusy}
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Variable changes
            </Label>
            {varNames.map((name) => {
              const config = configFor(name);
              const meta = getVariableMeta(name, config);
              const current = variables[name] ?? 0;
              const delta = deltaMap[name] ?? 0;

              return (
                <div
                  key={name}
                  className="rounded-xl border border-border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span>{meta.icon}</span>
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      now {formatValue(current)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">
                      Delta
                    </span>
                    <Input
                      type="number"
                      step="0.1"
                      value={delta === 0 ? "" : delta}
                      placeholder="0"
                      disabled={isBusy}
                      onChange={(e) =>
                        setDelta(name, parseFloat(e.target.value) || 0)
                      }
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {QUICK_DELTAS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={isBusy}
                        onClick={() => nudgeDelta(name, d)}
                        className={cn(
                          "h-7 rounded-lg text-xs font-mono font-bold transition-all border disabled:opacity-40",
                          d < 0
                            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
                        )}
                      >
                        {d > 0 ? `+${d}` : d}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {submitState === "error" && (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {submitState === "success" && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Event applied</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleSubmit}
            disabled={!canSubmit || isBusy}
          >
            {isBusy ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Apply Event
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TileEditor({ q, r, variables, onClose }: TileEditorProps) {
  const { status, variableConfigs } = useSimulationStore();
  const isActive = status === "running" || status === "paused";
  const [showEventModal, setShowEventModal] = useState(false);

  const varNames = Object.keys(variables);

  function configFor(name: string) {
    return variableConfigs.find((c) => c.name === name);
  }

  return (
    <>
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl w-80 overflow-hidden animate-fade-in">
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
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 max-h-[min(50vh,360px)] overflow-y-auto">
          {varNames.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No variables on this tile
            </p>
          ) : (
            varNames.map((name) => {
              const config = configFor(name);
              const meta = getVariableMeta(name, config);
              const val = variables[name] ?? 0;
              const barWidth = Math.min(100, Math.max(0, val));

              return (
                <div key={name} className="flex items-center gap-3 px-2 py-1.5">
                  <span className="text-base w-5 text-center shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{meta.label}</span>
                      <span
                        className="text-xs font-mono font-bold"
                        style={{ color: meta.color }}
                      >
                        {formatValue(val)}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: meta.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 border-t border-border">
          {isActive ? (
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setShowEventModal(true)}
            >
              <Zap className="w-3.5 h-3.5" />
              Apply Event
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Start a simulation to apply events
            </p>
          )}
        </div>
      </div>

      {showEventModal && (
        <ApplyEventModal
          q={q}
          r={r}
          variables={variables}
          onClose={() => setShowEventModal(false)}
        />
      )}
    </>
  );
}
