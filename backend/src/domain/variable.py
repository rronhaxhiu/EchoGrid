from dataclasses import dataclass, field
from typing import Optional
import uuid


@dataclass
class Variable:
    """
    Global variable definition — exists independently of any simulation run.

    Acts as a catalog entry. Runs reference variables by name.
    The definition carries metadata and sensible defaults; actual per-tile
    values are owned entirely by the run's world state.
    """

    name: str
    display_name: str
    description: str = ""
    default_initial_value: float = 0.0
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit: str = ""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "default_initial_value": self.default_initial_value,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "unit": self.unit,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Variable":
        return cls(
            id=data["id"],
            name=data["name"],
            display_name=data.get("display_name", data["name"]),
            description=data.get("description", ""),
            default_initial_value=data.get("default_initial_value", 0.0),
            min_value=data.get("min_value"),
            max_value=data.get("max_value"),
            unit=data.get("unit", ""),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )
