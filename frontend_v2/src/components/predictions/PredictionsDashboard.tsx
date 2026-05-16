"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bug,
  Droplets,
  Layers3,
  Map,
  MoveUpRight,
  PauseCircle,
  PlayCircle,
  Sprout,
  ThermometerSun,
  Waves,
} from "lucide-react";
import { cn, formatDate, formatValue } from "@/lib/utils";
import type {
  PredictionDashboardData,
  PredictionLocationSnapshot,
  PredictionLocationTrendPoint,
  PredictionTimelinePoint,
} from "@/types/predictions";

type ViewMode = "flat" | "elevated";

const RISK_STYLES = {
  Low: {
    badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25",
    glow: "rgba(16, 185, 129, 0.45)",
    line: "#34d399",
    solid: "#10b981",
  },
  Medium: {
    badge: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/25",
    glow: "rgba(251, 191, 36, 0.55)",
    line: "#fbbf24",
    solid: "#f59e0b",
  },
  High: {
    badge: "bg-red-500/15 text-red-200 ring-1 ring-red-300/30",
    glow: "rgba(248, 113, 113, 0.6)",
    line: "#f87171",
    solid: "#ef4444",
  },
} as const;

export function PredictionsDashboard({ data }: { data: PredictionDashboardData }) {
  const [selectedIndex, setSelectedIndex] = useState(Math.max(data.timestamps.length - 1, 0));
  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    if (!autoplay || data.timestamps.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % data.timestamps.length);
    }, 1800);

    return () => window.clearInterval(interval);
  }, [autoplay, data.timestamps.length]);

  const timestamp = data.timestamps[selectedIndex] ?? "";
  const snapshots = data.snapshotsByTimestamp[timestamp] ?? [];
  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => b.pestRiskScore - a.pestRiskScore),
    [snapshots]
  );
  const leadLocation = sortedSnapshots[0];
  const mediumRiskCount = sortedSnapshots.filter(
    (snapshot) => snapshot.pestRiskLabel !== "Low"
  ).length;
  const avgRisk =
    sortedSnapshots.reduce((sum, snapshot) => sum + snapshot.pestRiskScore, 0) /
    Math.max(sortedSnapshots.length, 1);
  const anomalyCount = sortedSnapshots.reduce((sum, snapshot) => sum + snapshot.anomalyCount, 0);
  const latestTimelinePoint = data.timeline[selectedIndex];
  const hottestLocation = [...sortedSnapshots].sort(
    (a, b) => b.avgTemperature - a.avgTemperature
  )[0];

  return (
    <div className="min-h-screen bg-[#04111f] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_32%),radial-gradient(circle_at_85%_15%,_rgba(251,191,36,0.12),_transparent_28%),radial-gradient(circle_at_50%_100%,_rgba(244,63,94,0.12),_transparent_30%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />

        <div className="relative max-w-7xl mx-auto px-6 py-10 space-y-8">
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-end">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200 ring-1 ring-cyan-300/20">
                <Bug className="w-3.5 h-3.5" />
                Pest Forecast Intelligence
              </span>
              <div className="space-y-3">
                <h1 className="max-w-3xl font-semibold tracking-tight text-5xl sm:text-6xl [font-family:ui-rounded,Georgia,serif]">
                  Time-aware crop risk, flattened into a map you can read in seconds.
                </h1>
                <p className="max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed">
                  Hourly device observations from Bangladesh are aggregated into district-level pest
                  signals, then surfaced as either a flat tactical map or an elevated 3D pressure field.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <HeroMetric
                icon={AlertTriangle}
                label="Active watch zones"
                value={`${mediumRiskCount}/${sortedSnapshots.length}`}
                detail="districts at medium pest pressure"
              />
              <HeroMetric
                icon={Sprout}
                label="Lead crop under pressure"
                value={leadLocation?.dominantCrop ?? "Unknown"}
                detail={leadLocation ? `${leadLocation.location} currently leads` : "Awaiting data"}
              />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              icon={Bug}
              label="Average pest score"
              value={`${Math.round(avgRisk * 100)}%`}
              accent="from-amber-400 via-orange-400 to-rose-400"
              detail="Mean predicted pressure across all districts"
            />
            <MetricCard
              icon={Waves}
              label="Anomaly events"
              value={String(anomalyCount)}
              accent="from-cyan-400 via-sky-400 to-violet-400"
              detail="Rows flagged as abnormal during this hour"
            />
            <MetricCard
              icon={Droplets}
              label="Irrigation demand"
              value={`${Math.round((leadLocation?.irrigationRate ?? 0) * 100)}%`}
              accent="from-emerald-400 via-teal-400 to-cyan-400"
              detail={leadLocation ? `${leadLocation.location} highest current pressure` : "Awaiting data"}
            />
            <MetricCard
              icon={ThermometerSun}
              label="Hottest district"
              value={hottestLocation?.location ?? "Unknown"}
              accent="from-fuchsia-400 via-rose-400 to-orange-400"
              detail={hottestLocation ? "By average field temperature" : "Awaiting data"}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 shadow-[0_40px_120px_rgba(3,7,18,0.45)] backdrop-blur-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Regional view</p>
                  <h2 className="mt-1 text-2xl font-semibold [font-family:ui-rounded,Georgia,serif]">
                    {viewMode === "flat" ? "2D flattened forecast map" : "Elevated pressure field"}
                  </h2>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-slate-950/40 p-1 ring-1 ring-white/10">
                  <ViewButton active={viewMode === "flat"} icon={Map} label="Flat map" onClick={() => setViewMode("flat")} />
                  <ViewButton active={viewMode === "elevated"} icon={Layers3} label="3D pressure" onClick={() => setViewMode("elevated")} />
                </div>
              </div>

              <div className="p-6">
                {viewMode === "flat" ? (
                  <FlattenedForecastMap data={data} snapshots={sortedSnapshots} />
                ) : (
                  <ElevatedForecastView data={data} snapshots={sortedSnapshots} />
                )}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Time explorer</p>
                    <h3 className="mt-1 text-xl font-semibold">Hourly forecast scrubber</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoplay((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-slate-100 ring-1 ring-white/10 transition hover:bg-white/15"
                  >
                    {autoplay ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    {autoplay ? "Pause" : "Play"}
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>{formatDate(timestamp)}</span>
                      <span>{selectedIndex + 1}/{data.timestamps.length}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(data.timestamps.length - 1, 0)}
                      value={selectedIndex}
                      onChange={(event) => setSelectedIndex(Number(event.target.value))}
                      className="mt-3 w-full accent-cyan-400"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <QuickStat label="Hotspots" value={String(latestTimelinePoint?.hotspotCount ?? 0)} />
                    <QuickStat label="Avg risk" value={`${Math.round((latestTimelinePoint?.avgRisk ?? 0) * 100)}%`} />
                    <QuickStat label="Anomalies" value={String(latestTimelinePoint?.anomalyCount ?? 0)} />
                  </div>

                  <TimelineSparkline timeline={data.timeline} selectedIndex={selectedIndex} />
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Priority districts</p>
                    <h3 className="mt-1 text-xl font-semibold">Where scouts should look next</h3>
                  </div>
                  <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                    ranked by pest pressure
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {sortedSnapshots.map((snapshot, index) => (
                    <LocationCard
                      key={snapshot.location}
                      index={index}
                      snapshot={snapshot}
                      trend={data.locationTrends[snapshot.location] ?? []}
                    />
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  detail: string;
  icon: typeof AlertTriangle;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <div className="mt-2 text-3xl font-semibold">{value}</div>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
          <Icon className="w-5 h-5 text-cyan-200" />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-300">{detail}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
  detail,
}: {
  accent: string;
  detail: string;
  icon: typeof Bug;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <div className="mt-2 text-3xl font-semibold">{value}</div>
        </div>
        <div className={cn("rounded-2xl p-3 text-slate-950 bg-gradient-to-br", accent)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function ViewButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Map;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
        active ? "bg-cyan-400 text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)]" : "text-slate-300 hover:bg-white/5"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-950/45 px-4 py-3 ring-1 ring-white/10">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function FlattenedForecastMap({
  data,
  snapshots,
}: {
  data: PredictionDashboardData;
  snapshots: PredictionLocationSnapshot[];
}) {
  return (
    <div className="relative h-[620px] overflow-hidden rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,26,43,0.9),rgba(3,10,20,0.94))]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_10%_80%,rgba(52,211,153,0.16),transparent_28%),radial-gradient(circle_at_90%_86%,rgba(248,113,113,0.14),transparent_24%)]" />
      <div className="absolute inset-[8%] rounded-[30%_40%_28%_34%/16%_24%_30%_24%] border border-cyan-200/10 bg-gradient-to-b from-white/[0.07] via-white/[0.03] to-transparent shadow-[inset_0_0_80px_rgba(56,189,248,0.06)]" />

      <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M24,8 L56,10 L70,22 L78,42 L72,64 L82,88 L58,92 L44,83 L31,86 L20,72 L24,54 L16,35 L22,20 Z"
          fill="rgba(34, 211, 238, 0.08)"
          stroke="rgba(125, 211, 252, 0.45)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>

      <div className="absolute left-6 top-6 rounded-2xl bg-slate-950/45 px-4 py-3 ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Flat map mode</p>
        <p className="mt-1 max-w-xs text-sm text-slate-300">
          District markers are pinned to a flattened operational view so agronomists can scan pest pressure,
          irrigation demand, and anomalies without rotating a globe.
        </p>
      </div>

      {snapshots.map((snapshot) => {
        const layout = data.locationLayouts[snapshot.location];
        if (!layout) {
          return null;
        }

        const riskStyle = getRiskStyle(snapshot.pestRiskLabel);
        const scale = 0.92 + snapshot.pestRiskScore * 0.35;
        const isHot = snapshot.pestRiskScore >= 0.55;

        return (
          <div
            key={snapshot.location}
            className="absolute"
            style={{
              left: `${layout.x}%`,
              top: `${layout.y}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
          >
            <div
              className={cn(
                "relative min-w-[190px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_22px_50px_rgba(2,8,23,0.45)] backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1",
                isHot && "animate-pulse-glow"
              )}
              style={{ boxShadow: `0 28px 60px ${riskStyle.glow}` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">{snapshot.location}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                    {snapshot.dominantCrop} • {snapshot.season}
                  </div>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", riskStyle.badge)}>
                  {snapshot.pestRiskLabel}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.max(10, snapshot.pestRiskScore * 100)}%`,
                      background: `linear-gradient(90deg, ${layout.accent}, ${riskStyle.line})`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Yield</div>
                    <div className="mt-1 font-semibold">{formatValue(snapshot.avgYield, 1)} t/ha</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Soil moisture</div>
                    <div className="mt-1 font-semibold">{formatValue(snapshot.avgSoilMoisture, 1)}%</div>
                  </div>
                </div>
              </div>

              <div
                className="pointer-events-none absolute -bottom-4 left-1/2 h-8 w-24 -translate-x-1/2 rounded-full blur-2xl"
                style={{ backgroundColor: riskStyle.glow }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ElevatedForecastView({
  data,
  snapshots,
}: {
  data: PredictionDashboardData;
  snapshots: PredictionLocationSnapshot[];
}) {
  return (
    <div className="relative h-[620px] overflow-hidden rounded-[1.8rem] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_26%),linear-gradient(180deg,rgba(7,16,31,0.96),rgba(3,8,18,1))]">
      <div className="absolute inset-x-8 bottom-10 top-24 [perspective:1600px]">
        <div className="absolute inset-0 rounded-[2rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] shadow-[inset_0_0_80px_rgba(56,189,248,0.06)] [transform:rotateX(66deg)]" />
        <div className="absolute inset-6 opacity-30 [background-image:linear-gradient(rgba(56,189,248,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.25)_1px,transparent_1px)] [background-size:11%_14%] [transform:rotateX(66deg)]" />

        {snapshots.map((snapshot) => {
          const layout = data.locationLayouts[snapshot.location];
          if (!layout) {
            return null;
          }

          const riskStyle = getRiskStyle(snapshot.pestRiskLabel);
          const barHeight = 90 + snapshot.pestRiskScore * 220 + snapshot.anomalyRate * 80;
          const glowHeight = Math.max(barHeight + 24, 120);

          return (
            <div
              key={snapshot.location}
              className="absolute -translate-x-1/2 [transform-style:preserve-3d]"
              style={{
                left: `${layout.x}%`,
                top: `${layout.y}%`,
              }}
            >
              <div className="relative [transform:translateZ(0)]">
                <div
                  className="absolute left-1/2 top-full h-12 w-12 -translate-x-1/2 -translate-y-2 rounded-full blur-2xl"
                  style={{ backgroundColor: riskStyle.glow }}
                />
                <div
                  className="relative w-20 rounded-t-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.05))] shadow-[0_22px_40px_rgba(0,0,0,0.35)]"
                  style={{
                    height: `${barHeight}px`,
                    transform: "rotateX(-14deg) rotateY(-18deg)",
                    transformOrigin: "bottom center",
                  }}
                >
                  <div
                    className="absolute inset-[3px] rounded-t-[1rem] bg-gradient-to-t"
                    style={{
                      backgroundImage: `linear-gradient(180deg, ${layout.accent}, ${riskStyle.line})`,
                    }}
                  />
                  <div
                    className="absolute left-1/2 top-3 h-3 w-3 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: riskStyle.solid, boxShadow: `0 0 18px ${riskStyle.glow}` }}
                  />
                </div>
                <div
                  className="absolute left-1/2 top-[-3.25rem] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-center shadow-[0_16px_34px_rgba(2,6,23,0.45)] backdrop-blur-xl"
                  style={{ minWidth: "10rem" }}
                >
                  <div className="text-sm font-semibold">{snapshot.location}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {Math.round(snapshot.pestRiskScore * 100)}% pest pressure
                  </div>
                </div>
                <div
                  className="absolute left-1/2 top-0 w-24 -translate-x-1/2 blur-3xl opacity-60"
                  style={{ backgroundColor: riskStyle.glow, height: `${glowHeight}px` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute left-6 top-6 rounded-2xl bg-slate-950/45 px-4 py-3 ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Elevated mode</p>
        <p className="mt-1 max-w-xs text-sm text-slate-300">
          The same district data is extruded into a depth field so medium-risk pockets pop instantly during time playback.
        </p>
      </div>
    </div>
  );
}

function TimelineSparkline({
  timeline,
  selectedIndex,
}: {
  selectedIndex: number;
  timeline: PredictionTimelinePoint[];
}) {
  const width = 420;
  const height = 130;
  const padding = 14;
  const maxRisk = Math.max(...timeline.map((point) => point.avgRisk), 1);
  const points = timeline.map((point, index) => {
    const x = padding + (index / Math.max(timeline.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.avgRisk / maxRisk) * (height - padding * 2);
    return `${x},${y}`;
  });
  const currentPoint = timeline[selectedIndex];
  const currentX = padding + (selectedIndex / Math.max(timeline.length - 1, 1)) * (width - padding * 2);
  const currentY = currentPoint
    ? height - padding - (currentPoint.avgRisk / maxRisk) * (height - padding * 2)
    : height / 2;

  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pressure trend</p>
          <p className="mt-1 text-sm text-slate-300">Average pest score over time</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <MoveUpRight className="w-3.5 h-3.5" />
          scroll through the day
        </div>
      </div>

      <svg className="mt-4 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pest pressure over time">
        <defs>
          <linearGradient id="risk-line" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="20" fill="rgba(255,255,255,0.02)" />
        <polyline
          fill="none"
          stroke="url(#risk-line)"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(" ")}
        />
        <circle cx={currentX} cy={currentY} r="7" fill="#f8fafc" />
        <circle cx={currentX} cy={currentY} r="14" fill="rgba(255,255,255,0.12)" />
      </svg>
    </div>
  );
}

function LocationCard({
  index,
  snapshot,
  trend,
}: {
  index: number;
  snapshot: PredictionLocationSnapshot;
  trend: PredictionLocationTrendPoint[];
}) {
  const riskStyle = getRiskStyle(snapshot.pestRiskLabel);

  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-slate-950/45 p-4 transition hover:border-cyan-300/20 hover:bg-slate-950/55">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-sm font-semibold text-slate-100 ring-1 ring-white/10">
              {index + 1}
            </span>
            <div>
              <div className="font-semibold text-white">{snapshot.location}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                {snapshot.dominantCrop} • {snapshot.deviceCount} devices
              </div>
            </div>
          </div>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", riskStyle.badge)}>
          {snapshot.pestRiskLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px] sm:items-center">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <DataPoint label="Yield" value={`${formatValue(snapshot.avgYield, 1)} t/ha`} />
          <DataPoint label="Moisture" value={`${formatValue(snapshot.avgSoilMoisture, 1)}%`} />
          <DataPoint label="Humidity" value={`${formatValue(snapshot.avgHumidity, 1)}%`} />
        </div>
        <MiniTrend trend={trend} lineColor={riskStyle.line} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 ring-1 ring-white/8">
          <ArrowUpRight className="w-3 h-3" />
          {Math.round(snapshot.pestRiskScore * 100)}% pressure
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 ring-1 ring-white/8">
          <Droplets className="w-3 h-3" />
          {Math.round(snapshot.irrigationRate * 100)}% need irrigation
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 ring-1 ring-white/8">
          <AlertTriangle className="w-3 h-3" />
          {snapshot.anomalyCount} anomalies
        </span>
      </div>
    </div>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-100">{value}</div>
    </div>
  );
}

function MiniTrend({
  trend,
  lineColor,
}: {
  lineColor: string;
  trend: PredictionLocationTrendPoint[];
}) {
  const recent = trend.slice(-10);
  const width = 120;
  const height = 48;
  const points = recent.map((point, index) => {
    const x = (index / Math.max(recent.length - 1, 1)) * width;
    const y = height - point.pestRiskScore * height;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full">
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    </svg>
  );
}

function getRiskStyle(label: string) {
  return RISK_STYLES[label as keyof typeof RISK_STYLES] ?? RISK_STYLES.Low;
}
