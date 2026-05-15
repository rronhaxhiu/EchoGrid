from dataclasses import dataclass, field
from typing import Dict


@dataclass
class InfluenceMatrix:
    """
    Defines cross-variable influence coefficients within a tile.

    influence[v1][v2] = coefficient means:
        when v1 changes by delta → v2 += delta * coefficient (same tile)

    Supports runtime updates without restarting simulation.
    """

    matrix: Dict[str, Dict[str, float]] = field(default_factory=dict)

    def set(self, v1: str, v2: str, coefficient: float) -> None:
        if v1 not in self.matrix:
            self.matrix[v1] = {}
        self.matrix[v1][v2] = coefficient

    def get(self, v1: str, v2: str) -> float:
        return self.matrix.get(v1, {}).get(v2, 0.0)

    def get_effects(self, variable: str) -> Dict[str, float]:
        """Return all downstream effects triggered by a change in `variable`."""
        return dict(self.matrix.get(variable, {}))

    def remove(self, v1: str, v2: str) -> None:
        if v1 in self.matrix:
            self.matrix[v1].pop(v2, None)

    def to_dict(self) -> Dict[str, Dict[str, float]]:
        return {k: dict(v) for k, v in self.matrix.items()}

    @classmethod
    def from_dict(cls, data: Dict[str, Dict[str, float]]) -> "InfluenceMatrix":
        return cls(matrix={k: dict(v) for k, v in data.items()})
