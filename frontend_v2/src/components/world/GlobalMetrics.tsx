"use client";

import { useRef, useState, useEffect } from "react";
import { cn, getVariableMeta, formatValue } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulationStore";
import { TrendingUp, TrendingDown, Minus, BarChart3, ChevronDown } from "lucide-react";

export function GlobalMetrics() {
  const { worldState, activeRun, status, variableConfigs } = useSimulationStore();
  const prevState = useRef<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!worldState || !activeRun) return null;

  const global = worldState.global_state;
  const variables = activeRun.variables;

  const metrics = variables.map((name) => {
    const val = global[name] ?? 0;
    const prev = prevState.current[name];
    const trend = prev === undefined ? 0 : val - prev;
    return { name, val, trend };
  });

  Object.entries(global).forEach(([k, v]) => {
    prevState.current[k] = v;
  });

  return (
    <div ref={panelRef} className="relative flex items-center gap-2">
      {/* Tick badge — always visible */}
      <div className="flex items-center gap-1.5 bg-[#0b0914] border border-border rounded-full px-4 py-2 shadow-lg">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            status === "running" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          )}
        />
        <span className="text-xs text-muted-foreground">Tick</span>
        <span className="text-sm font-bold font-mono">{worldState.tick}</span>
      </div>

      {/* Variables toggle bubble */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg transition-all border",
          open
            ? "bg-violet-600 text-white border-violet-500"
            : "bg-[#0b0914] text-foreground border-border hover:border-violet-400/50 hover:bg-violet-950/40"
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BarChart3 className="w-4 h-4" />
        Variables
        <span className="text-xs opacity-70 font-mono">({variables.length})</span>
        <ChevronDown
          className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Expanded metrics panel */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 animate-fade-in">
          <div className="bg-[#0b0914] border border-border rounded-2xl shadow-2xl p-3 min-w-[280px] max-w-[min(90vw,520px)]">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-2">
              Global averages
            </p>
            <div className="flex flex-wrap gap-2 max-h-[min(40vh,280px)] overflow-y-auto">
              {metrics.map(({ name, val, trend }) => {
                const config = variableConfigs.find((c) => c.name === name);
                const meta = getVariableMeta(name, config);
                return (
                  <div
                    key={name}
                    className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-3 py-2 min-w-[120px]"
                  >
                    <span className="text-base">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold font-mono">{formatValue(val)}</span>
                        {Math.abs(trend) > 0.05 ? (
                          trend > 0 ? (
                            <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
                          )
                        ) : (
                          <Minus className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {meta.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
