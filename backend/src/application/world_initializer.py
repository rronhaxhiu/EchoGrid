import random
from typing import Dict, List, Tuple

from ..domain.tile import Tile
from ..domain.world import World


class WorldInitializer:
    """
    Deterministic hex world factory.

    Algorithm:
      1. Generate all axial coordinates for hex radius R.
      2. For each variable, seed a uniform value per tile.
      3. Apply seeded Gaussian noise.
      4. Renormalize so that sum(tile[v] for all tiles) == global[v] * N.

    Conservation guarantee: global[v] == average(tile[v]) is preserved exactly.
    """

    @staticmethod
    def generate_hex_coords(radius: int) -> List[Tuple[int, int]]:
        """Generate all (q, r) axial coordinates within `radius`."""
        coords: List[Tuple[int, int]] = []
        for q in range(-radius, radius + 1):
            r_min = max(-radius, -q - radius)
            r_max = min(radius, -q + radius)
            for r in range(r_min, r_max + 1):
                coords.append((q, r))
        return coords

    @staticmethod
    def create(
        seed: int,
        hex_radius: int,
        variables: List[str],
        global_initial_values: Dict[str, float],
        noise_scale: float = 0.15,
    ) -> World:
        """
        Create a fully initialized World with deterministic tile distribution.

        Args:
            seed: RNG seed (guarantees reproducibility).
            hex_radius: Axial hex radius.
            variables: List of variable names.
            global_initial_values: Target global average per variable.
            noise_scale: Relative noise amplitude (fraction of variable mean).
        """
        rng = random.Random(seed)
        coords = WorldInitializer.generate_hex_coords(hex_radius)
        n = len(coords)

        # Pre-build tiles with empty variables
        tiles: Dict[Tuple[int, int], Tile] = {
            (q, r): Tile(q=q, r=r, variables={}) for (q, r) in coords
        }

        for var in variables:
            global_val = global_initial_values.get(var, 0.0)
            target_sum = global_val * n

            # Step 1: uniform baseline
            # Step 2: apply seeded Gaussian noise around the baseline
            amplitude = noise_scale * (abs(global_val) + 1.0)
            raw_values = [
                global_val + rng.gauss(0.0, amplitude) for _ in range(n)
            ]

            # Step 3: renormalize to preserve target sum exactly
            current_sum = sum(raw_values)
            if abs(current_sum) > 1e-12:
                scale = target_sum / current_sum
                final_values = [v * scale for v in raw_values]
            else:
                final_values = [target_sum / n] * n

            for (q, r), val in zip(coords, final_values):
                tiles[(q, r)].variables[var] = val

        world = World(tiles=tiles)
        world.build_neighbor_cache()
        return world
