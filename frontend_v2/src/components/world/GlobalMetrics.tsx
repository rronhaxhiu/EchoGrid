"use client";

import { cn, getVariableMeta, formatValue } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulationStore";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRef } from "react";

export function GlobalMetrics() {
  const { worldState, activeRun, status } = useSimulationStore();
  const prevState = useRef<Record<string, number>>({});

  if (!worldState || !activeRun) return null;

  const global = worldState.global_state;
  const variables = activeRun.variables;

  const metrics = variables.map((name) => {
    const val = global[name] ?? 0;
    const prev = prevState.current[name];
    const trend = prev === undefined ? 0 : val - prev;
    return { name, val, trend };
  });

  // Update prev after render
  Object.entries(global).forEach(([k, v]) => {
    prevState.current[k] = v;
  });

  return (
    <div className="flex items-center gap-3">
      {/* Tick badge */}
      <div className="flex items-center gap-1.5 bg-card/90 backdrop-blur-xl border border-border rounded-2xl px-4 py-2 shadow-md">
        <div className={cn(
          "w-2 h-2 rounded-full",
          status === "running" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
        )} />
        <span className="text-xs text-muted-foreground">Tick</span>
        <span className="text-sm font-bold font-mono">{worldState.tick}</span>
      </div>

      {/* Variable pills */}
      {metrics.map(({ name, val, trend }) => {
        const meta = getVariableMeta(name);
        return (
          <div
            key={name}
            className="flex items-center gap-2 bg-card/90 backdrop-blur-xl border border-border rounded-2xl px-4 py-2 shadow-md"
          >
            <span className="text-base">{meta.icon}</span>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold font-mono">{formatValue(val)}</span>
                {Math.abs(trend) > 0.05 ? (
                  trend > 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )
                ) : (
                  <Minus className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">{meta.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
