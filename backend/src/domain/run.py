from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import uuid

from .event import SimEvent
from .influence import InfluenceMatrix
from .world import World


@dataclass
class Snapshot:
    """Represents world state at a single tick (full or diff)."""

    run_id: str
    tick: int
    state: Dict[str, Any]
    is_diff: bool = False
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "run_id": self.run_id,
            "tick": self.tick,
            "state": self.state,
            "is_diff": self.is_diff,
        }


@dataclass
class SimulationRun:
    """
    Complete, replayable simulation run.

    Stores all inputs (seed, config, events) and all outputs (snapshots).
    Carries live simulation state (world, engine) in memory.
    Can be fully serialized to/from PostgreSQL for persistence.
    """

    id: str
    seed: int
    variables: List[str]
    global_initial_values: Dict[str, float]
    hex_radius: int
    spatial_decay: float
    influence_config: Dict[str, Dict[str, float]]

    world: World = field(default_factory=World)
    influence: InfluenceMatrix = field(default_factory=InfluenceMatrix)
    current_tick: int = 0
    event_log: List[SimEvent] = field(default_factory=list)
    snapshots: List[Snapshot] = field(default_factory=list)
    pending_events: List[SimEvent] = field(default_factory=list)
    pending_direct_updates: Dict[str, Dict[str, float]] = field(default_factory=dict)

    created_at: Optional[str] = None

    @classmethod
    def new(
        cls,
        seed: int,
        variables: List[str],
        global_initial_values: Dict[str, float],
        hex_radius: int,
        spatial_decay: float = 0.3,
        influence_config: Optional[Dict[str, Dict[str, float]]] = None,
    ) -> "SimulationRun":
        run_id = str(uuid.uuid4())
        return cls(
            id=run_id,
            seed=seed,
            variables=variables,
            global_initial_values=global_initial_values,
            hex_radius=hex_radius,
            spatial_decay=spatial_decay,
            influence_config=influence_config or {},  # kept for persistence/replay
        )

    def meta_dict(self) -> dict:
        """Serializable metadata (no live objects)."""
        return {
            "id": self.id,
            "seed": self.seed,
            "variables": self.variables,
            "global_initial_values": self.global_initial_values,
            "hex_radius": self.hex_radius,
            "spatial_decay": self.spatial_decay,
            "influence_config": self.influence_config,
            "current_tick": self.current_tick,
            "created_at": self.created_at,
            "tile_count": len(self.world.tiles),
            "event_count": len(self.event_log),
            "snapshot_count": len(self.snapshots),
        }
