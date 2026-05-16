"use client";

import { useState } from "react";
import { X, CalendarClock, Check, AlertCircle } from "lucide-react";
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

const QUICK_DELTAS = [-10, -5, -1, +1, +5, +10];

export function TileEditor({ q, r, variables, onClose }: TileEditorProps) {
  const { activeRun, status } = useSimulationStore();
  const isActive = status === "running" || status === "paused";

  const varNames = Object.keys(variables);
  const currentTick = activeRun?.current_tick ?? 0;

  const [selectedVar, setSelectedVar] = useState(varNames[0] ?? "");
  const [eventName, setEventName] = useState("");
  const [scheduledTick, setScheduledTick] = useState(currentTick + 1);
  const [deltaMap, setDeltaMap] = useState<Record<string, number>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastScheduledTick, setLastScheduledTick] = useState<number | null>(null);

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

  function clearVar(variable: string) {
    setDeltaMap((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [variable]: _removed, ...rest } = prev;
      return rest;
    });
  }

  const activeDelta = deltaMap[selectedVar] ?? 0;
  const canSchedule =
    isActive &&
    eventName.trim().length > 0 &&
    Object.keys(deltaMap).length > 0;
  const isBusy = submitState === "loading";

  async function scheduleEvent() {
    if (!activeRun || !canSchedule) return;
    setSubmitState("loading");
    setErrorMsg("");

    try {
      await api.events.add(activeRun.id, {
        tick: scheduledTick,
        name: eventName.trim(),
        delta_map: deltaMap,
        target_tiles: [[q, r]],
        source: "user",
      });
      setLastScheduledTick(scheduledTick);
      setSubmitState("success");
      setEventName("");
      setDeltaMap({});
      setScheduledTick(currentTick + 1);
      setTimeout(() => setSubmitState("idle"), 3000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to schedule");
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

      {/* Current variable values */}
      <div className="px-4 py-3 space-y-2">
        {varNames.map((name) => {
          const meta = getVariableMeta(name);
          const val = variables[name] ?? 0;
          const barWidth = Math.min(100, Math.max(0, val));
          const isSelected = name === selectedVar;
          const pendingDelta = deltaMap[name] ?? 0;

          return (
            <button
              key={name}
              onClick={() => isActive && setSelectedVar(name)}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-150 text-left",
                isActive ? "cursor-pointer" : "cursor-default",
                isSelected && isActive
                  ? "bg-violet-50 dark:bg-violet-900/20 ring-1 ring-violet-300 dark:ring-violet-700"
                  : "hover:bg-muted/60"
              )}
            >
              <span className="text-base w-5 text-center">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{meta.label}</span>
                  <div className="flex items-center gap-1.5">
                    {pendingDelta !== 0 && (
                      <span
                        className={cn(
                          "text-xs font-mono font-bold tabular-nums",
                          pendingDelta > 0 ? "text-emerald-500" : "text-red-400"
                        )}
                      >
                        {pendingDelta > 0 ? "+" : ""}
                        {pendingDelta}
                      </span>
                    )}
                    <span
                      className="text-xs font-mono font-bold tabular-nums"
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
            </button>
          );
        })}
      </div>

      {/* Event injection — only when simulation is active */}
      {isActive && selectedVar && (
        <>
          <div className="h-px bg-border mx-4" />
          <div className="px-4 py-3 space-y-3">

            {/* Section label */}
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Inject Event
              </span>
            </div>

            {/* Event name */}
            <input
              type="text"
              placeholder="Event name (e.g. Flood, Tax reform…)"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              disabled={isBusy}
              className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
            />

            {/* Tick */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Schedule at tick
              </span>
              <input
                type="number"
                min={currentTick + 1}
                value={scheduledTick}
                onChange={(e) =>
                  setScheduledTick(
                    Math.max(currentTick + 1, parseInt(e.target.value) || currentTick + 1)
                  )
                }
                disabled={isBusy}
                className="w-20 h-8 rounded-lg border border-input bg-background px-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
              />
            </div>

            {/* Delta nudge for selected variable */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  Δ{" "}
                  <span
                    className="font-medium"
                    style={{ color: getVariableMeta(selectedVar).color }}
                  >
                    {getVariableMeta(selectedVar).label}
                  </span>
                </span>
                {activeDelta !== 0 && (
                  <button
                    onClick={() => clearVar(selectedVar)}
                    disabled={isBusy}
                    className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                  >
                    clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-6 gap-1">
                {QUICK_DELTAS.map((d) => (
                  <button
                    key={d}
                    onClick={() => nudgeDelta(selectedVar, d)}
                    disabled={isBusy}
                    className={cn(
                      "h-8 rounded-lg text-xs font-mono font-bold transition-all duration-150",
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

              {activeDelta !== 0 && (
                <p
                  className={cn(
                    "mt-1.5 text-center text-xs font-mono font-bold",
                    activeDelta > 0 ? "text-emerald-500" : "text-red-400"
                  )}
                >
                  {activeDelta > 0 ? "+" : ""}
                  {activeDelta}
                </p>
              )}
            </div>

            {/* Accumulated delta summary */}
            {Object.keys(deltaMap).length > 0 && (
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Event changes
                  </span>
                  <button
                    onClick={() => setDeltaMap({})}
                    disabled={isBusy}
                    className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                  >
                    clear all
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
                      <span
                        className={cn(
                          "font-mono font-bold",
                          d > 0 ? "text-emerald-500" : "text-red-400"
                        )}
                      >
                        {d > 0 ? "+" : ""}
                        {d}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Schedule button */}
            <Button
              size="sm"
              onClick={scheduleEvent}
              disabled={!canSchedule || isBusy}
              className="w-full h-8 text-xs gap-1.5"
            >
              {isBusy ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Scheduling…
                </>
              ) : (
                <>
                  <CalendarClock className="w-3.5 h-3.5" />
                  Schedule Event
                </>
              )}
            </Button>

            {/* Feedback */}
            {submitState === "success" && lastScheduledTick !== null && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Event scheduled for tick {lastScheduledTick}</span>
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

      {/* Read-only hint */}
      {!isActive && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground text-center">
            Start a simulation to inject events
          </p>
        </div>
      )}
    </div>
  );
}
