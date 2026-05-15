from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from .tile import Tile

HEX_DIRS: List[Tuple[int, int]] = [
    (1, 0),
    (-1, 0),
    (0, 1),
    (0, -1),
    (1, -1),
    (-1, 1),
]

Coords = Tuple[int, int]


@dataclass
class World:
    """
    Single source of truth for tile storage and spatial relationships.
    Global state is always derived (never stored independently).
    Neighbor lookups are O(1) after first access via cache.
    """

    tiles: Dict[Coords, Tile] = field(default_factory=dict)
    _neighbor_cache: Dict[Coords, List[Tile]] = field(default_factory=dict)

    # ---------------------------------------------------------------------------
    # Spatial
    # ---------------------------------------------------------------------------

    def get_neighbors(self, q: int, r: int) -> List[Tile]:
        """Return cached neighbor tiles for (q, r). Computed once per tile."""
        key: Coords = (q, r)
        if key not in self._neighbor_cache:
            neighbors: List[Tile] = []
            for dq, dr in HEX_DIRS:
                neighbor_key: Coords = (q + dq, r + dr)
                if neighbor_key in self.tiles:
                    neighbors.append(self.tiles[neighbor_key])
            self._neighbor_cache[key] = neighbors
        return self._neighbor_cache[key]

    def invalidate_neighbor_cache(self) -> None:
        """Call when tiles are added or removed (not during normal simulation)."""
        self._neighbor_cache.clear()

    def build_neighbor_cache(self) -> None:
        """Pre-warm neighbor cache for all tiles (call after initialization)."""
        for q, r in self.tiles:
            self.get_neighbors(q, r)

    # ---------------------------------------------------------------------------
    # Global state — always derived, never stored
    # ---------------------------------------------------------------------------

    def get_global_state(self) -> Dict[str, float]:
        """Compute global variable averages across all tiles."""
        if not self.tiles:
            return {}
        n = len(self.tiles)
        totals: Dict[str, float] = {}
        for tile in self.tiles.values():
            for var, val in tile.variables.items():
                totals[var] = totals.get(var, 0.0) + val
        return {var: total / n for var, total in totals.items()}

    def get_global_sums(self) -> Dict[str, float]:
        """Compute per-variable totals (sum, not average)."""
        totals: Dict[str, float] = {}
        for tile in self.tiles.values():
            for var, val in tile.variables.items():
                totals[var] = totals.get(var, 0.0) + val
        return totals

    # ---------------------------------------------------------------------------
    # Snapshot helpers
    # ---------------------------------------------------------------------------

    def snapshot(self) -> Dict[str, Dict[str, float]]:
        """Full snapshot: {'{q},{r}': {var: value}}."""
        return {
            f"{q},{r}": dict(tile.variables)
            for (q, r), tile in self.tiles.items()
        }

    def diff_from(self, previous: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
        """Return only tiles/variables that changed since previous snapshot."""
        diff: Dict[str, Dict[str, float]] = {}
        for (q, r), tile in self.tiles.items():
            key = f"{q},{r}"
            prev_vars = previous.get(key, {})
            changed: Dict[str, float] = {}
            for var, val in tile.variables.items():
                if prev_vars.get(var) != val:
                    changed[var] = val
            if changed:
                diff[key] = changed
        return diff

    def restore_snapshot(self, snapshot: Dict[str, Dict[str, float]]) -> None:
        """Overwrite tile variables from a full snapshot dict."""
        for key, variables in snapshot.items():
            q_str, r_str = key.split(",")
            coords: Coords = (int(q_str), int(r_str))
            if coords in self.tiles:
                self.tiles[coords].variables = dict(variables)
