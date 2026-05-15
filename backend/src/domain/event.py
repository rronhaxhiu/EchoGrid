from dataclasses import dataclass, field
from typing import Dict, List, Literal, Tuple
import uuid

Coords = Tuple[int, int]
EventSource = Literal["user", "system", "AI"]


@dataclass
class SimEvent:
    """
    An immutable simulation event scheduled for a specific tick.
    Events are the primary mutation mechanism; they are fully replayable.
    """

    tick: int
    name: str
    delta_map: Dict[str, float]
    target_tiles: List[Coords] = field(default_factory=list)
    source: EventSource = "user"
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tick": self.tick,
            "name": self.name,
            "delta_map": self.delta_map,
            "target_tiles": [list(c) for c in self.target_tiles],
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SimEvent":
        return cls(
            id=data["id"],
            tick=data["tick"],
            name=data["name"],
            delta_map=data["delta_map"],
            target_tiles=[tuple(c) for c in data["target_tiles"]],  # type: ignore[misc]
            source=data.get("source", "user"),
        )
