import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTick(tick: number): string {
  return `Tick ${tick.toLocaleString()}`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatValue(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeValue(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

/** Get the tile count for a given hex radius */
export function getTileCount(radius: number): number {
  return 3 * radius * radius + 3 * radius + 1;
}

/** Variable display metadata */
export const VARIABLE_META: Record<
  string,
  { label: string; icon: string; color: string; darkColor: string }
> = {
  health: {
    label: "Health",
    icon: "❤️",
    color: "#10b981",
    darkColor: "#34d399",
  },
  economy: {
    label: "Economy",
    icon: "💰",
    color: "#f59e0b",
    darkColor: "#fbbf24",
  },
  green: {
    label: "Environment",
    icon: "🌿",
    color: "#059669",
    darkColor: "#6ee7b7",
  },
  mobility: {
    label: "Mobility",
    icon: "🚀",
    color: "#6366f1",
    darkColor: "#818cf8",
  },
};

export function getVariableMeta(
  name: string,
  config?: { display_name?: string; color?: string }
) {
  const base =
    VARIABLE_META[name] ?? {
      label: name,
      icon: "📊",
      color: "#8b5cf6",
      darkColor: "#a78bfa",
    };
  const color = config?.color ?? base.color;
  return {
    ...base,
    label: config?.display_name?.trim() || base.label,
    color,
    darkColor: color,
  };
}

/** Map a normalized value (0-1) to a hex color for the globe */
export function valueToGlobeColor(t: number): string {
  // Low: warm coral → Mid: amber → High: mint green
  const r = Math.round(lerp(lerp(239, 251, t < 0.5 ? t * 2 : 1), lerp(251, 52, (t - 0.5) * 2), t < 0.5 ? 0 : (t - 0.5) * 2));
  const g = Math.round(lerp(lerp(68, 191, t < 0.5 ? t * 2 : 1), lerp(191, 211, (t - 0.5) * 2), t < 0.5 ? 0 : (t - 0.5) * 2));
  const b = Math.round(lerp(lerp(68, 36, t < 0.5 ? t * 2 : 1), lerp(36, 153, (t - 0.5) * 2), t < 0.5 ? 0 : (t - 0.5) * 2));
  return `rgb(${r},${g},${b})`;
}
