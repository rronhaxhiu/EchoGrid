from collections import defaultdict
from typing import Dict, Optional, Tuple

from ..domain.influence import InfluenceMatrix
from ..domain.world import World

Coords = Tuple[int, int]
DeltaMap = Dict[str, float]
TileDeltas = Dict[Coords, DeltaMap]


class PropagationEngine:
    """
    Computes and applies influence and spatial propagation effects.

    Design principles:
    - Event-based propagation: computed from a base delta snapshot (not cascading).
    - Ambient dynamics: run every tick regardless of events, giving the simulation
      natural autonomous behaviour (decay, cross-variable coupling, diffusion).

    Ambient dynamics parameters (all per-tick rates):
      auto_decay         - how fast each variable returns to its equilibrium value.
      influence_rate     - scaling applied to continuous cross-variable influence.
      spatial_diffusion  - how fast variables diffuse toward their neighbor average.
    """

    def __init__(
        self,
        world: World,
        influence: InfluenceMatrix,
        spatial_decay: float = 0.3,
        equilibrium: Optional[Dict[str, float]] = None,
        auto_decay: float = 0.03,
        influence_rate: float = 0.15,
        spatial_diffusion: float = 0.05,
    ) -> None:
        self.world = world
        self.influence = influence
        self.spatial_decay = spatial_decay
        # Equilibrium values — variables are pulled toward these each tick
        self.equilibrium: Dict[str, float] = equilibrium or {}
        self.auto_decay = auto_decay
        self.influence_rate = influence_rate
        self.spatial_diffusion = spatial_diffusion

    # ---------------------------------------------------------------------------
    # Phase 1 & 2: Multi-hop cascade (event → influence → spatial → repeat)
    # ---------------------------------------------------------------------------

    def compute_cascade_deltas(
        self,
        base_deltas: TileDeltas,
        max_hops: int = 8,
        threshold: float = 0.001,
    ) -> TileDeltas:
        """
        Compute the full ripple from a set of base deltas:

          1. Apply influence matrix within each affected tile (same-tile cross-variable).
          2. Spread the resulting deltas (both the original and the influence-derived ones)
             to hex neighbours, attenuated by `spatial_decay`.
          3. For each neighbour's incoming signal, apply influence matrix again (step 1).
          4. Repeat until the signal magnitude falls below `threshold` or `max_hops`
             is exhausted.

        All computation is done on the *delta* level — the world state is never read
        during cascade computation, so the result can be applied atomically after the
        base deltas have already been written.

        With spatial_decay = 0.3 and threshold = 0.001:
          hop 0 (origin):  1.0 × D
          hop 1 (1 ring):  0.3 × D
          hop 2 (2 rings): 0.09 × D
          hop 3 (3 rings): 0.027 × D
          hop 4 (4 rings): 0.0081 × D  (≈ 0 for D < ~0.1)
        """
        accumulated: TileDeltas = defaultdict(lambda: defaultdict(float))

        # Step 1: influence on the origin tiles
        origin_influence = self._apply_influence_to_deltas(base_deltas)
        _merge_into(accumulated, origin_influence)

        # The full origin signal that spreads spatially = base + influence
        current_level = _merge_two(base_deltas, origin_influence)

        for _ in range(max_hops):
            # Spread current level to neighbours
            spatial = self._spread_one_hop(current_level)

            # Prune tiny signals early
            spatial = {
                coords: {v: d for v, d in vd.items() if abs(d) >= threshold}
                for coords, vd in spatial.items()
                if any(abs(d) >= threshold for d in vd.values())
            }
            if not spatial:
                break

            # Influence within each receiving tile
            hop_influence = self._apply_influence_to_deltas(spatial)

            # Accumulate spatial + influence for this hop
            _merge_into(accumulated, spatial)
            _merge_into(accumulated, hop_influence)

            # Full signal for next hop = this hop's spatial + its influence effects
            current_level = _merge_two(spatial, hop_influence)

        return dict(accumulated)

    def _apply_influence_to_deltas(self, deltas: TileDeltas) -> TileDeltas:
        """For each tile delta, compute cross-variable downstream effects (same tile)."""
        result: TileDeltas = defaultdict(lambda: defaultdict(float))
        for coords, var_deltas in deltas.items():
            for variable, delta in var_deltas.items():
                for downstream, coeff in self.influence.get_effects(variable).items():
                    result[coords][downstream] += delta * coeff  # type: ignore[index]
        return dict(result)

    def _spread_one_hop(self, deltas: TileDeltas) -> TileDeltas:
        """
        Spread each tile's deltas to its hex neighbours, attenuated by spatial_decay.

        Conservation rule: the total signal flowing OUT of a tile equals
        delta × spatial_decay, divided equally among all neighbours.
        This ensures signal decays at every hop and cannot amplify even when
        it bounces back through the origin tile in subsequent hops.
        """
        result: TileDeltas = defaultdict(lambda: defaultdict(float))
        for (q, r), var_deltas in deltas.items():
            neighbors = self.world.get_neighbors(q, r)
            n_count = len(neighbors)
            if n_count == 0:
                continue
            for variable, delta in var_deltas.items():
                # Split the decay budget equally so total outflow = delta × decay
                per_neighbor = delta * self.spatial_decay / n_count
                for neighbor in neighbors:
                    if variable in neighbor.variables:
                        result[(neighbor.q, neighbor.r)][variable] += per_neighbor  # type: ignore[index]
        return dict(result)

    # ---------------------------------------------------------------------------
    # Phase 3: Ambient autonomous dynamics (runs every tick)
    # ---------------------------------------------------------------------------

    def compute_ambient_deltas(self) -> TileDeltas:
        """
        Compute per-tick deltas that run regardless of events, giving the world
        natural evolving behaviour:

        1. Natural decay — each variable drifts back toward its global equilibrium
           value at rate `auto_decay`.  Keeps the system from drifting to infinity
           while ensuring that injected perturbations eventually relax.

        2. Continuous cross-variable influence — for each (v1, v2) pair in the
           influence matrix, the current *deviation* of v1 from equilibrium drives
           a proportional change in v2 every tick (scaled by `influence_rate`).
           This makes high/low values actually affect other variables continuously,
           not only on the tick an event fires.

        3. Spatial diffusion — each variable diffuses slightly toward the average
           of its hex neighbours (scaled by `spatial_diffusion`).  This ensures
           localised changes spread across the map over time.
        """
        ambient: TileDeltas = defaultdict(lambda: defaultdict(float))

        for (q, r), tile in self.world.tiles.items():
            # ── 1 & 2: decay + continuous influence ───────────────────────────
            for var, current in tile.variables.items():
                eq_val = self.equilibrium.get(var, current)
                deviation = current - eq_val

                # Pull variable back toward equilibrium
                if abs(deviation) > 1e-9:
                    ambient[(q, r)][var] -= deviation * self.auto_decay  # type: ignore[index]

                # Drive downstream variables based on this variable's deviation
                if abs(deviation) > 1e-9 and self.influence_rate > 0:
                    for downstream, coeff in self.influence.get_effects(var).items():
                        if downstream in tile.variables:
                            ambient[(q, r)][downstream] += deviation * coeff * self.influence_rate  # type: ignore[index]

            # ── 3: Spatial diffusion ──────────────────────────────────────────
            if self.spatial_diffusion > 0:
                neighbors = self.world.get_neighbors(q, r)
                n_count = len(neighbors)
                if n_count > 0:
                    for var, current in tile.variables.items():
                        neighbor_avg = (
                            sum(n.variables.get(var, current) for n in neighbors)
                            / n_count
                        )
                        diff = neighbor_avg - current
                        if abs(diff) > 1e-9:
                            ambient[(q, r)][var] += diff * self.spatial_diffusion  # type: ignore[index]

        return dict(ambient)

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


# ---------------------------------------------------------------------------
# Module-level delta helpers
# ---------------------------------------------------------------------------


def _merge_into(target: TileDeltas, source: TileDeltas) -> None:
    """Add all entries from *source* into *target* in-place."""
    for coords, var_deltas in source.items():
        t = target.setdefault(coords, defaultdict(float))  # type: ignore[arg-type]
        for v, d in var_deltas.items():
            t[v] += d  # type: ignore[index]


def _merge_two(a: TileDeltas, b: TileDeltas) -> TileDeltas:
    """Return a new TileDeltas that is the sum of *a* and *b*."""
    result: TileDeltas = defaultdict(lambda: defaultdict(float))
    _merge_into(result, a)
    _merge_into(result, b)
    return dict(result)
