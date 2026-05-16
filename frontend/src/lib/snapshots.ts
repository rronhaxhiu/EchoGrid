const TILE_KEY = /^-?\d+,-?\d+$/;

function isTileKey(key: string): boolean {
  return TILE_KEY.test(key);
}

/** Backend stores snapshots as either the tile map itself or `{ tiles: {...} }`. */
function tileMapFromSnapshotState(state: unknown): Record<string, Record<string, number>> {
  if (!state || typeof state !== "object") return {};
  const raw = state as Record<string, unknown>;
  const source = (raw.tiles ?? raw) as Record<string, unknown>;
  const out: Record<string, Record<string, number>> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!isTileKey(key) || typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    out[key] = { ...(value as Record<string, number>) };
  }
  return out;
}

export function rebuildTimeline(snapshots: any[]) {
  if (snapshots.length === 0) return [];

  const frames: { tiles: Record<string, Record<string, number>> }[] = [];
  let tiles: Record<string, Record<string, number>> = {};

  const sorted = [...snapshots].sort((a, b) => a.tick - b.tick);

  for (const snapshot of sorted) {
    if (snapshot.is_diff && frames.length > 0) {
      tiles = Object.fromEntries(
        Object.entries(tiles).map(([k, v]) => [k, { ...v }]),
      );
      for (const [key, variables] of Object.entries(
        tileMapFromSnapshotState(snapshot.state),
      )) {
        if (!tiles[key]) tiles[key] = {};
        Object.assign(tiles[key], variables);
      }
    } else {
      tiles = tileMapFromSnapshotState(snapshot.state);
    }

    frames.push({ tiles });
  }

  return frames;
}
