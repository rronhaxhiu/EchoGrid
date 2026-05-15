from dataclasses import dataclass, field
from typing import Dict


@dataclass
class Tile:
    """
    Pure state container for a single hexagonal tile.
    Coordinates use the axial (q, r) system.
    Tiles never store neighbor references — world manages topology.
    """

    q: int
    r: int
    variables: Dict[str, float] = field(default_factory=dict)

    @property
    def coords(self) -> tuple[int, int]:
        return (self.q, self.r)

    def get(self, variable: str, default: float = 0.0) -> float:
        return self.variables.get(variable, default)

    def set(self, variable: str, value: float) -> None:
        self.variables[variable] = value

    def apply_delta(self, variable: str, delta: float) -> float:
        """Apply a delta to a variable and return the new value."""
        current = self.variables.get(variable, 0.0)
        new_val = current + delta
        self.variables[variable] = new_val
        return new_val

    def copy_variables(self) -> Dict[str, float]:
        return dict(self.variables)
