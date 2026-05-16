"""
Serialization utilities for converting between domain objects and
storable/exportable representations (dicts, JSON).
"""

import json
from typing import Any, Dict, List

from ..domain.event import SimEvent
from ..domain.influence import InfluenceMatrix
from ..domain.run import SimulationRun, Snapshot
from ..domain.tile import Tile
from ..domain.world import World
from ..application.world_initializer import WorldInitializer


class RunSerializer:
    """Converts SimulationRun ↔ plain dicts / JSON strings."""

    @staticmethod
    def reconstruct_run(model: Any, events: List[SimEvent]) -> SimulationRun:
        """
        Rebuild a SimulationRun from a DB model + event list.
        Uses stored current_world_state for fast resumption (no replay needed).
        """
        current_tick = model.current_tick
        # Re-queue any event whose tick is strictly in the future so it fires
        # correctly when this reconstructed engine runs its next tick.  Without
        # this, Postgres-backed services (new instance per request) would load
        # an empty pending_events list and silently drop user-injected events.
        pending = [e for e in events if e.tick > current_tick]

        run = SimulationRun(
            id=model.id,
            seed=model.seed,
            variables=list(model.variables),
            global_initial_values=dict(model.global_initial_values),
            hex_radius=model.hex_radius,
            spatial_decay=float(model.spatial_decay),
            influence_config=dict(model.influence_config),
            current_tick=current_tick,
            event_log=list(events),
            pending_events=pending,
            created_at=model.created_at.isoformat() if model.created_at else None,
        )

        influence = InfluenceMatrix.from_dict(model.influence_config)
        run.influence = influence

        if model.current_world_state:
            world = _world_from_snapshot(model.current_world_state)
        else:
            world = WorldInitializer.create(
                seed=model.seed,
                hex_radius=model.hex_radius,
                variables=list(model.variables),
                global_initial_values=dict(model.global_initial_values),
            )

        run.world = world
        return run

    @staticmethod
    def export_run(run: SimulationRun) -> Dict[str, Any]:
        """Export a full run to a JSON-serializable dict."""
        return {
            "meta": run.meta_dict(),
            "world_state": run.world.snapshot(),
            "global_state": run.world.get_global_state(),
            "event_log": [e.to_dict() for e in run.event_log],
            "snapshots": [s.to_dict() for s in run.snapshots],
        }

    @staticmethod
    def export_run_json(run: SimulationRun) -> str:
        return json.dumps(RunSerializer.export_run(run), indent=2)


def _world_from_snapshot(snapshot: Dict[str, Any]) -> World:
    """Reconstruct a World object from a snapshot dict."""
    tiles: Dict[tuple, Tile] = {}
    for key, variables in snapshot.items():
        q_str, r_str = key.split(",")
        q, r = int(q_str), int(r_str)
        tiles[(q, r)] = Tile(q=q, r=r, variables=dict(variables))

    world = World(tiles=tiles)
    world.build_neighbor_cache()
    return world
