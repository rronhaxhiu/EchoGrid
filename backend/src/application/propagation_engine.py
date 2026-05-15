from collections import defaultdict
from typing import Dict, Tuple

from ..domain.influence import InfluenceMatrix
from ..domain.world import World

Coords = Tuple[int, int]
DeltaMap = Dict[str, float]
TileDeltas = Dict[Coords, DeltaMap]


class PropagationEngine:
    """
    Computes and applies influence and spatial propagation effects.

    Design principles:
    - All propagation is computed from a base delta snapshot (not cascading).
      This makes each tick O(N * 6) = O(N) and fully deterministic.
    - Influence: intra-tile cross-variable effect.
    - Spatial: neighbor spread with configurable decay.
    """

    def __init__(
        self,
        world: World,
        influence: InfluenceMatrix,
        spatial_decay: float = 0.3,
    ) -> None:
        self.world = world
        self.influence = influence
        self.spatial_decay = spatial_decay

    # ---------------------------------------------------------------------------
    # Phase 1: Influence propagation (same tile, cross-variable)
    # ---------------------------------------------------------------------------

    def compute_influence_deltas(self, base_deltas: TileDeltas) -> TileDeltas:
        """
        Given base deltas {(q,r): {var: delta}}, compute secondary influence
        deltas for every downstream variable in the same tile.

        Returns a fresh TileDeltas (does not mutate base_deltas).
        """
        influence_deltas: TileDeltas = defaultdict(lambda: defaultdict(float))

        for coords, var_deltas in base_deltas.items():
            for variable, delta in var_deltas.items():
                effects = self.influence.get_effects(variable)
                for downstream_var, coeff in effects.items():
                    influence_deltas[coords][downstream_var] += delta * coeff  # type: ignore[index]

        return dict(influence_deltas)

    # ---------------------------------------------------------------------------
    # Phase 2: Spatial propagation (neighbor tiles, same variable)
    # ---------------------------------------------------------------------------

    def compute_spatial_deltas(self, base_deltas: TileDeltas) -> TileDeltas:
        """
        Given base deltas, spread them to hex neighbors with decay.

        Only propagates variables that already exist in the neighbor tile.
        Returns a fresh TileDeltas (does not mutate base_deltas).
        """
        spatial_deltas: TileDeltas = defaultdict(lambda: defaultdict(float))

        for (q, r), var_deltas in base_deltas.items():
            neighbors = self.world.get_neighbors(q, r)
            for variable, delta in var_deltas.items():
                neighbor_effect = delta * self.spatial_decay
                for neighbor in neighbors:
                    if variable in neighbor.variables:
                        spatial_deltas[(neighbor.q, neighbor.r)][variable] += neighbor_effect  # type: ignore[index]

        return dict(spatial_deltas)

    # ---------------------------------------------------------------------------
    # Apply helpers
    # ---------------------------------------------------------------------------

    @staticmethod
    def apply_deltas(world: World, deltas: TileDeltas) -> None:
        """Apply a TileDeltas map to the world in-place."""
        for (q, r), var_deltas in deltas.items():
            tile = world.tiles.get((q, r))
            if tile is None:
                continue
            for var, delta in var_deltas.items():
                if var in tile.variables:
                    tile.variables[var] += delta
