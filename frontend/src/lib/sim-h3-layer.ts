import {
  cellToBoundary,
  cellToLatLng,
  latLngToCell,
} from "h3-js";

function parseBackendTiles(tiles: any = {}) {
  return Object.entries(tiles)
    .map(([key, variables]: [string, any]) => {
      const [q, r] = key.split(",").map(Number);
      return { key, q, r, s: -q - r, variables };
    })
    .filter((tile) => Number.isFinite(tile.q) && Number.isFinite(tile.r));
}

function findNearestBackendTile(
  center: { lat: number; lng: number },
  backendTiles: any[],
  radius: number
) {
  const targetQ = (center.lng / 180) * radius;
  const targetR = (-center.lat / 85) * radius;
  const targetS = -targetQ - targetR;

  let bestTile = backendTiles[0];
  let bestScore = Infinity;

  for (const tile of backendTiles) {
    const score =
      Math.abs(tile.q - targetQ) +
      Math.abs(tile.r - targetR) +
      Math.abs(tile.s - targetS);

    if (score < bestScore) {
      bestScore = score;
      bestTile = tile;
    }
  }

  return bestTile;
}

/**
 * Sparse global coverage: sample a lat/lng lattice, map to H3, dedupe, and
 * relax grid step until we're under maxCells. Full res-5 children (~2M cells)
 * would freeze the main thread — the dashboard's caps exist for this reason.
 */
function collectCappedH3Indices(
  h3Resolution: number,
  landSampleStepDeg: number,
  maxLandCells: number
): string[] {
  let step = Math.max(landSampleStepDeg, 0.05);

  for (let attempt = 0; attempt < 24; attempt++) {
    const set = new Set<string>();
    for (let lat = -85; lat <= 85; lat += step) {
      for (let lng = -180; lng < 180; lng += step) {
        set.add(latLngToCell(lat, lng, h3Resolution));
      }
    }

    if (set.size <= maxLandCells) {
      return [...set];
    }

    step *= Math.sqrt(set.size / maxLandCells) * 1.05;
  }

  const set = new Set<string>();
  for (let lat = -85; lat <= 85; lat += 8) {
    for (let lng = -180; lng < 180; lng += 8) {
      set.add(latLngToCell(lat, lng, h3Resolution));
    }
  }
  const all = [...set];
  if (all.length <= maxLandCells) {
    return all;
  }
  const stride = Math.ceil(all.length / maxLandCells);
  return all.filter((_, i) => i % stride === 0).slice(0, maxLandCells);
}

export interface H3HexCell {
  h3Index: string;
  value: number;
  boundary: [number, number][];
  center: { lat: number; lng: number };
}

export async function buildGlobalLandH3Layer(
  worldState: any,
  variableName: string,
  hexRadius: number,
  h3Resolution: number,
  options: { landSampleStepDeg: number; maxLandCells: number }
) {
  const backendTiles = parseBackendTiles(worldState?.tiles);

  if (backendTiles.length === 0) {
    return {
      cells: [] as H3HexCell[],
      min: 0,
      max: 0,
    };
  }

  const h3Indices = collectCappedH3Indices(
    h3Resolution,
    options.landSampleStepDeg,
    options.maxLandCells
  );

  let min = Infinity;
  let max = -Infinity;

  const cells: H3HexCell[] = h3Indices.map((h3Index) => {
    const [lat, lng] = cellToLatLng(h3Index);
    const center = { lat, lng };
    const backendTile = findNearestBackendTile(
      center,
      backendTiles,
      hexRadius
    );
    const value = Number(backendTile.variables[variableName] || 0);

    min = Math.min(min, value);
    max = Math.max(max, value);

    return {
      h3Index,
      value,
      boundary: cellToBoundary(h3Index),
      center,
    };
  });

  return {
    cells,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 100 : max,
  };
}
