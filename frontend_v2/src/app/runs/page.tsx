"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, Download, Trash2, ChevronRight,
  RefreshCw, Plus, Calendar, Cpu, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { formatDate, getTileCount, getVariableMeta, cn } from "@/lib/utils";
import type { RunListItem } from "@/types/simulation";

const PAGE_SIZE = 12;

export default function RunsPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load(p: number, reset = false) {
    setLoading(true);
    try {
      const data = await api.runs.list(PAGE_SIZE, p * PAGE_SIZE);
      if (reset) {
        setRuns(data);
      } else {
        setRuns((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0, true);
  }, []);

  async function handleExport(runId: string) {
    setExporting(runId);
    try {
      // Export is wired to API but download is unhooked per spec
      await api.export.run(runId);
      // Placeholder: would trigger download in real implementation
    } catch {
      // silently fail — export is a placeholder
    } finally {
      setExporting(null);
    }
  }

  async function handleDelete(runId: string) {
    setDeleting(runId);
    try {
      await api.runs.delete(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete run");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Simulation Runs</h1>
          <p className="text-muted-foreground mt-1">
            {runs.length} run{runs.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(0, true)}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button asChild size="sm">
            <Link href="/world">
              <Plus className="w-4 h-4" />
              New Run
            </Link>
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/50 p-4 animate-fade-in">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && runs.length === 0 && (
        <div className="text-center py-24 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No runs yet</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Start your first simulation from the World page.
          </p>
          <Button asChild>
            <Link href="/world">
              <Plus className="w-4 h-4" />
              Start Simulation
            </Link>
          </Button>
        </div>
      )}

      {/* Run grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
        {runs.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            isExporting={exporting === run.id}
            isDeleting={deleting === run.id}
            onExport={() => handleExport(run.id)}
            onDelete={() => handleDelete(run.id)}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            onClick={() => load(page + 1)}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && runs.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-border animate-shimmer"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  isExporting,
  isDeleting,
  onExport,
  onDelete,
}: {
  run: RunListItem;
  isExporting: boolean;
  isDeleting: boolean;
  onExport: () => void;
  onDelete: () => void;
}) {
  const tileCount = getTileCount(run.hex_radius);

  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:border-violet-200 dark:hover:border-violet-800">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-xs font-mono text-muted-foreground">
                {run.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">
                Tick {run.current_tick}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                r={run.hex_radius}
              </Badge>
            </div>
          </div>

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={isExporting}
            className="gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity"
            title="Export run data (integration pending)"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export
          </Button>
        </div>

        <Separator className="mb-4" />

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Seed</div>
              <div className="text-sm font-mono font-medium">{run.seed}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Tiles</div>
              <div className="text-sm font-mono font-medium">{tileCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="text-sm font-medium">{formatDate(run.created_at)}</div>
            </div>
          </div>
        </div>

        {/* Variables */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {run.variables.map((name) => {
            const meta = getVariableMeta(name);
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted"
              >
                <span>{meta.icon}</span>
                <span className="text-muted-foreground">{meta.label}</span>
              </span>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 gap-1.5 h-7 px-2"
          >
            {isDeleting ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Delete
          </Button>

          <Link
            href={`/world`}
            className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium"
          >
            View in World
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
