import random
from typing import Dict, List, Optional, Tuple

from ..domain.tile import Tile
from ..domain.world import World


VALUE_MIN = 0.0
VALUE_MAX = 100.0


def normalize_csv_rows_to_0_100(rows: List[List[float]]) -> List[List[float]]:
    """
    Min–max scale each CSV column to [0, 100].
    Constant columns are clamped to [0, 100].
    """
    if not rows:
        return rows

    ncol = max(len(r) for r in rows)
    col_min = [float("inf")] * ncol
    col_max = [float("-inf")] * ncol

    for row in rows:
        for j, v in enumerate(row):
            col_min[j] = min(col_min[j], v)
            col_max[j] = max(col_max[j], v)

    normalized: List[List[float]] = []
    for row in rows:
        new_row: List[float] = []
        for j in range(ncol):
            v = float(row[j]) if j < len(row) else 0.0
            lo, hi = col_min[j], col_max[j]
            if hi - lo < 1e-12:
                new_row.append(max(VALUE_MIN, min(VALUE_MAX, v)))
            else:
                scaled = (v - lo) / (hi - lo) * VALUE_MAX
                new_row.append(max(VALUE_MIN, min(VALUE_MAX, scaled)))
        normalized.append(new_row)
    return normalized


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
    def _value_for_row(
        row: List[float],
        var_index: int,
        var: str,
        global_initial_values: Dict[str, float],
    ) -> float:
        if var_index < len(row):
            return float(row[var_index])
        return global_initial_values.get(var, 0.0)

    @staticmethod
    def _stratified_sample(
        csv_rows: List[List[float]],
        variables: List[str],
        n: int,
        rng: random.Random,
    ) -> List[List[float]]:
        """
        If a 'pest_risk' column exists, split rows into Low (0) and Medium (1) groups
        and sample roughly half from each so tiles represent a balanced distribution.
        Falls back to plain random sampling when the column is absent or only one class
        is present.
        """
        if "pest_risk" not in variables:
            return rng.sample(csv_rows, n) if len(csv_rows) >= n else list(csv_rows)

        idx = variables.index("pest_risk")
        group_0 = [r for r in csv_rows if r[idx] == 0.0]
        group_1 = [r for r in csv_rows if r[idx] == 1.0]

        if not group_0 or not group_1:
            # Only one class present — fall back to plain sampling
            return rng.sample(csv_rows, n) if len(csv_rows) >= n else list(csv_rows)

        half = n // 2
        pick_0 = rng.sample(group_0, min(half, len(group_0)))
        pick_1 = rng.sample(group_1, min(n - len(pick_0), len(group_1)))
        selected = pick_0 + pick_1

        # Pad up to n if either group was too small
        if len(selected) < n:
            remaining = n - len(selected)
            pool = [r for r in csv_rows if r not in selected]
            pad = rng.sample(pool, min(remaining, len(pool))) if pool else []
            selected = selected + pad

        rng.shuffle(selected)
        return selected

    @staticmethod
    def create_from_csv_rows(
        seed: int,
        hex_radius: int,
        variables: List[str],
        global_initial_values: Dict[str, float],
        csv_rows: List[List[float]],
    ) -> World:
        """
        Assign CSV rows to tiles at random (seeded).

        If a 'pest_risk' column is present the selection is stratified: roughly half
        the tiles receive Low-class rows and half receive Medium-class rows so that
        the prediction produces a visible mix after the simulation starts.

        If there are more rows than tiles, sample one row per tile without replacement.
        If there are fewer rows than tiles, assign all rows and fill the rest with defaults.
        """
        rng = random.Random(seed)
        coords = WorldInitializer.generate_hex_coords(hex_radius)
        n = len(coords)
        shuffled_coords = list(coords)
        rng.shuffle(shuffled_coords)

        # Stratify BEFORE normalization (raw pest_risk values are exactly 0 or 1)
        selected_raw = WorldInitializer._stratified_sample(csv_rows, variables, n, rng)

        # Normalize the selected rows to 0-100 for simulation storage
        selected = normalize_csv_rows_to_0_100(selected_raw)

        tiles: Dict[Tuple[int, int], Tile] = {
            (q, r): Tile(q=q, r=r, variables={}) for (q, r) in coords
        }

        for i, (q, r) in enumerate(shuffled_coords):
            if i < len(selected):
                row = selected[i]
                for var_index, var in enumerate(variables):
                    tiles[(q, r)].variables[var] = WorldInitializer._value_for_row(
                        row, var_index, var, global_initial_values
                    )
            else:
                for var in variables:
                    tiles[(q, r)].variables[var] = global_initial_values.get(var, 0.0)

        world = World(tiles=tiles)
        world.build_neighbor_cache()
        return world

    @staticmethod
    def create(
        seed: int,
        hex_radius: int,
        variables: List[str],
        global_initial_values: Dict[str, float],
        noise_scale: float = 0.15,
        csv_rows: Optional[List[List[float]]] = None,
    ) -> World:
        """
        Create a fully initialized World with deterministic tile distribution.

        Args:
            seed: RNG seed (guarantees reproducibility).
            hex_radius: Axial hex radius.
            variables: List of variable names.
            global_initial_values: Target global average per variable.
            noise_scale: Relative noise amplitude (fraction of variable mean).
            csv_rows: Optional CSV data rows (one list of floats per row). When provided,
                rows are randomly assigned to tiles; excess rows are sampled, shortfalls
                use global_initial_values for remaining tiles.
        """
        if csv_rows:
            return WorldInitializer.create_from_csv_rows(
                seed=seed,
                hex_radius=hex_radius,
                variables=variables,
                global_initial_values=global_initial_values,
                csv_rows=csv_rows,
            )

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
