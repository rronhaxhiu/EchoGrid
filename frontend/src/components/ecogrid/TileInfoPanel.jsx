import { Activity, Compass, Hexagon } from "lucide-react";

import { formatVariableLabel } from "@/components/ecogrid/globeTileLayer";
import { cn } from "@/lib/utils";

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.0";
  }

  return number.toFixed(1);
}

export function TileInfoPanel({
  className,
  layer,
  selectedTile,
  tileDetails,
  detailStatus,
  globalState,
}) {
  const variables =
    tileDetails?.variables || selectedTile?.backendTile?.variables || globalState || {};
  const entries = Object.entries(variables).sort(([first], [second]) =>
    first.localeCompare(second),
  );

  return (
    <aside
      className={cn(
        "rounded-xl border border-white/12 bg-slate-950/72 p-4 text-white shadow-2xl shadow-black/35 backdrop-blur-2xl",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/58">
            Tile data
          </p>
          <h2 className="mt-1 text-2xl font-light">
            {selectedTile
              ? `Sector ${selectedTile.backendTile.q}, ${selectedTile.backendTile.r}`
              : "Global state"}
          </h2>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/12 text-cyan-100">
          <Hexagon className="size-5" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/62">
        <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
          <span className="flex items-center gap-2 text-white/50">
            <Activity className="size-3.5" />
            Backend tiles
          </span>
          <strong className="mt-2 block text-lg font-medium text-white">
            {layer?.backendTileCount || 0}
          </strong>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
          <span className="flex items-center gap-2 text-white/50">
            <Compass className="size-3.5" />
            Neighbors
          </span>
          <strong className="mt-2 block text-lg font-medium text-white">
            {tileDetails?.neighbor_count ?? "--"}
          </strong>
        </div>
      </div>

      {selectedTile ? (
        <div className="mt-4 rounded-lg border border-emerald-300/18 bg-emerald-300/10 p-3">
          <p className="text-xs text-emerald-100/62">{selectedTile.variableLabel}</p>
          <p className="mt-1 text-3xl font-light text-white">
            {formatNumber(selectedTile.value)}
          </p>
          <p className="mt-2 break-all text-xs text-emerald-50/52">
            H3 {selectedTile.h3Index}
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {entries.map(([name, value]) => (
          <div
            className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2"
            key={name}
          >
            <span className="text-sm text-white/66">{formatVariableLabel(name)}</span>
            <strong className="text-sm font-medium text-white">
              {formatNumber(value)}
            </strong>
          </div>
        ))}
      </div>

      {detailStatus === "loading" ? (
        <p className="mt-3 text-xs text-cyan-100/58">Loading tile state</p>
      ) : null}
    </aside>
  );
}
