"use client";

import { useState } from "react";
import { Save, Info, Minus, Plus, RotateCcw, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getVariableMeta, cn, formatValue } from "@/lib/utils";
import { useSimulationStore, DEFAULT_INFLUENCE_MATRIX } from "@/store/simulationStore";

export default function SettingsPage() {
  const { activeRun, influenceMatrix, setInfluenceMatrix, variableConfigs } =
    useSimulationStore();

  const isLocked = !!activeRun;

  // Work on a local draft so edits don't immediately mutate the store
  const [draft, setDraft] = useState(() => structuredClone(influenceMatrix));
  const [saved, setSaved] = useState(false);

  // Derive variable list from active run (if running) or from configured vars
  const variables = activeRun
    ? activeRun.variables
    : variableConfigs.filter((v) => v.enabled).map((v) => v.name);

  function updateCell(from: string, to: string, value: number) {
    setDraft((prev) => ({
      ...prev,
      [from]: { ...(prev[from] ?? {}), [to]: value },
    }));
    setSaved(false);
  }

  function nudge(from: string, to: string, delta: number) {
    const current = draft[from]?.[to] ?? 0;
    updateCell(from, to, Math.round((current + delta) * 100) / 100);
  }

  function resetCell(from: string, to: string) {
    updateCell(from, to, 0);
  }

  function handleSave() {
    setInfluenceMatrix(structuredClone(draft));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function resetToDefaults() {
    const fresh = structuredClone(DEFAULT_INFLUENCE_MATRIX);
    setDraft(fresh);
    setSaved(false);
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure how simulation variables influence each other
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            disabled={isLocked}
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLocked}
            className={cn(
              "gap-1.5 transition-all",
              saved && "bg-emerald-500 hover:bg-emerald-600"
            )}
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {isLocked ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/50 p-4 flex items-center gap-3 animate-fade-in">
          <Lock className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            The influence matrix is <strong>locked</strong> while run{" "}
            <span className="font-mono font-bold">{activeRun!.id.slice(0, 8)}…</span>{" "}
            is active. Stop the simulation to make changes.
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-900/10 dark:border-violet-800/50 p-4 flex items-center gap-3 animate-fade-in">
          <Info className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
          <p className="text-sm text-violet-700 dark:text-violet-400">
            The influence matrix is a <strong>global config</strong> — edit it here and save.
            Changes apply the next time you start a simulation.
          </p>
        </div>
      )}

      {/* Influence Matrix */}
      <Card className={cn("animate-fade-in", isLocked && "opacity-60 pointer-events-none select-none")}>
        <CardHeader>
          <CardTitle>Influence Matrix</CardTitle>
          <CardDescription>
            Each cell defines how a change in the <strong>row variable</strong> affects the{" "}
            <strong>column variable</strong> within the same tile — and cascades to
            neighbouring tiles via the spatial decay factor.
            Positive values amplify, negative values dampen.
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="p-6">
          {/* Legend */}
          <div className="flex items-center gap-6 mb-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs">+</div>
              <span>Positive influence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-700 dark:text-red-400 font-mono font-bold text-xs">−</div>
              <span>Negative influence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded bg-muted border border-border" />
              <span>No influence / diagonal</span>
            </div>
          </div>

          {/* Matrix table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-32 pb-3">
                    <div className="text-xs text-muted-foreground text-left">
                      From ↓ / To →
                    </div>
                  </th>
                  {variables.map((col) => {
                    const meta = getVariableMeta(col);
                    return (
                      <th key={col} className="pb-3 px-2">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-3.5 h-3.5 rounded-full shadow-sm border border-border" style={{ backgroundColor: meta.color }} />
                          <span className="text-xs font-medium text-muted-foreground">
                            {meta.label}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {variables.map((row) => {
                  const rowMeta = getVariableMeta(row);
                  return (
                    <tr key={row} className="group">
                      <td className="pr-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full shadow-sm border border-border" style={{ backgroundColor: rowMeta.color }} />
                          <span className="text-sm font-medium">{rowMeta.label}</span>
                        </div>
                      </td>

                      {variables.map((col) => {
                        const isDiagonal = row === col;
                        const value = draft[row]?.[col] ?? 0;
                        const isPositive = value > 0.001;
                        const isNegative = value < -0.001;

                        if (isDiagonal) {
                          return (
                            <td key={col} className="px-2 py-2">
                              <div className="h-16 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center">
                                <Minus className="w-4 h-4 text-muted-foreground/40" />
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={col} className="px-2 py-2">
                            <div
                              className={cn(
                                "h-16 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1 p-2",
                                isPositive
                                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                                  : isNegative
                                  ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                                  : "bg-muted/30 border-border hover:border-violet-200 dark:hover:border-violet-800"
                              )}
                            >
                              <input
                                type="number"
                                step="0.05"
                                value={value}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateCell(row, col, parseFloat(e.target.value) || 0)
                                }
                                className={cn(
                                  "w-full text-center text-sm font-mono font-bold bg-transparent border-none outline-none focus:ring-0",
                                  isPositive
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : isNegative
                                    ? "text-red-700 dark:text-red-400"
                                    : "text-muted-foreground"
                                )}
                              />

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  disabled={isLocked}
                                  onClick={() => nudge(row, col, -0.05)}
                                  className="w-5 h-4 rounded flex items-center justify-center bg-background/80 border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  disabled={isLocked}
                                  onClick={() => resetCell(row, col)}
                                  className="w-5 h-4 rounded flex items-center justify-center bg-background/80 border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xs"
                                >
                                  0
                                </button>
                                <button
                                  disabled={isLocked}
                                  onClick={() => nudge(row, col, 0.05)}
                                  className="w-5 h-4 rounded flex items-center justify-center bg-background/80 border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Active influences summary */}
          <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
            <h4 className="text-sm font-medium mb-3">Active influences</h4>
            <div className="flex flex-wrap gap-2">
              {variables.flatMap((from) =>
                variables
                  .filter((to) => to !== from)
                  .map((to) => {
                    const coeff = draft[from]?.[to] ?? 0;
                    if (Math.abs(coeff) < 0.001) return null;
                    const fromMeta = getVariableMeta(from);
                    const toMeta = getVariableMeta(to);
                    return (
                      <Badge
                        key={`${from}-${to}`}
                        variant={coeff > 0 ? "success" : "destructive"}
                        className="gap-1 text-xs"
                      >
                        <div className="flex items-center gap-1 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full border border-border shadow-sm" style={{ backgroundColor: fromMeta.color }} />
                          <span>→</span>
                          <div className="w-2.5 h-2.5 rounded-full border border-border shadow-sm" style={{ backgroundColor: toMeta.color }} />
                        </div>
                        <span className="font-mono ml-1">
                          {coeff > 0 ? "+" : ""}{formatValue(coeff, 2)}
                        </span>
                      </Badge>
                    );
                  })
              ).filter(Boolean)}
              {!variables.some((from) =>
                variables.some((to) => to !== from && Math.abs(draft[from]?.[to] ?? 0) > 0.001)
              ) && (
                <span className="text-xs text-muted-foreground">
                  No active influences — all coefficients are zero.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explanation */}
      <Card className="mt-6 animate-fade-in">
        <CardContent className="p-5">
          <div className="flex gap-3">
            <Info className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                The influence matrix defines cross-variable effects <em>within a single tile</em>.
                When a variable changes by Δ on a tile, each downstream variable on that tile receives Δ × coefficient.
              </p>
              <p>
                Effects then cascade outward: changed tiles spread their deltas to hex neighbours
                (attenuated by the spatial decay factor), and each neighbour tile re-applies the influence
                matrix to those incoming deltas — repeating until the signal is too small to matter.
              </p>
              <p>
                Additionally, every tick the simulation applies <em>continuous ambient dynamics</em>:
                natural decay toward equilibrium, ongoing cross-variable coupling, and gradual spatial diffusion.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}