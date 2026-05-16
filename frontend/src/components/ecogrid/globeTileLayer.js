import {
  cellToBoundary,
  cellToChildren,
  cellToLatLng,
  getRes0Cells,
} from "h3-js";

export const DEFAULT_GLOBE_VARIABLE = "health";
export const DEFAULT_H3_RESOLUTION = 2;

export const variableLabels = {
  health: "Ecosystem health",
  economy: "Economy",
  green: "Green cover",
  mobility: "Mobility",
};

const h3Cache = new Map();

export function formatVariableLabel(name) {
  return (
    variableLabels[name] ||
    name
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function parseBackendTiles(tiles = {}) {
  return Object.entries(tiles)
    .map(([key, variables]) => {
      const [q, r] = key.split(",").map(Number);

      return {
        key,
        q,
        r,
        s: -q - r,
        variables,
      };
    })
    .filter((tile) => Number.isFinite(tile.q) && Number.isFinite(tile.r));
}

function getBackendRadius(tiles) {
  return Math.max(
    1,
    ...tiles.map((tile) =>
      Math.max(Math.abs(tile.q), Math.abs(tile.r), Math.abs(tile.s)),
    ),
  );
}

function getGlobalH3Cells(resolution) {
  if (!h3Cache.has(resolution)) {
    const cells = getRes0Cells()
      .flatMap((cell) => cellToChildren(cell, resolution))
      .map((h3Index) => {
        const [lat, lng] = cellToLatLng(h3Index);

        return {
          h3Index,
          center: { lat, lng },
          boundary: cellToBoundary(h3Index),
        };
      });

    h3Cache.set(resolution, cells);
  }

  return h3Cache.get(resolution);
}

function findNearestBackendTile(center, backendTiles, radius) {
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

function getTileValue(tile, variableName) {
  const directValue = Number(tile.variables[variableName]);

  if (Number.isFinite(directValue)) {
    return directValue;
  }

  const firstValue = Object.values(tile.variables).find((value) =>
    Number.isFinite(Number(value)),
  );

  return Number(firstValue || 0);
}

export function buildGlobalHexLayer(
  worldState,
  variableName = DEFAULT_GLOBE_VARIABLE,
  resolution = DEFAULT_H3_RESOLUTION,
) {
  const backendTiles = parseBackendTiles(worldState?.tiles);

  if (backendTiles.length === 0) {
    return {
      cells: [],
      min: 0,
      max: 0,
      variableName,
      variableLabel: formatVariableLabel(variableName),
      backendTileCount: 0,
      hexCount: 0,
    };
  }

  const backendRadius = getBackendRadius(backendTiles);
  const h3Cells = getGlobalH3Cells(resolution);
  let min = Infinity;
  let max = -Infinity;

  const cells = h3Cells.map((cell) => {
    const backendTile = findNearestBackendTile(
      cell.center,
      backendTiles,
      backendRadius,
    );
    const value = getTileValue(backendTile, variableName);

    min = Math.min(min, value);
    max = Math.max(max, value);

    return {
      ...cell,
      backendTile,
      value,
      variableName,
      variableLabel: formatVariableLabel(variableName),
    };
  });

  return {
    cells,
    min,
    max,
    variableName,
    variableLabel: formatVariableLabel(variableName),
    backendTileCount: backendTiles.length,
    hexCount: cells.length,
  };
}
