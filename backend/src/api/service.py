"""
Framework-agnostic simulation service.

All business logic lives here. FastAPI routes are thin wrappers that
call these methods and map results to HTTP responses.

Design:
  - In-memory run store keyed by run_id.
  - Optional async persistence via the repository layer.
  - SimulationEngine is created once per run and kept alive.
"""

from typing import Any, Dict, List, Optional, Tuple

from ..application.simulation_engine import SimulationEngine
from ..application.world_initializer import WorldInitializer
from ..domain.event import SimEvent
from ..domain.influence import InfluenceMatrix
from ..domain.run import SimulationRun
from ..domain.variable import Variable
from ..infrastructure.repositories import AbstractRunRepository, AbstractVariableRepository
from ..infrastructure.serialization import RunSerializer

# Default influence relationships applied when no explicit config is provided.
# These give the simulation meaningful cross-variable dynamics out of the box.
_DEFAULT_INFLUENCE: Dict[str, Dict[str, float]] = {
    "health":   {"economy": 0.10, "green":    0.05},
    "economy":  {"health":  0.20, "green":   -0.10, "mobility": 0.15},
    "green":    {"health":  0.15, "mobility": 0.05},
    "mobility": {"economy": 0.20, "health":   0.05, "green":   -0.05},
}


class SimulationService:
    def __init__(self, repository: AbstractRunRepository) -> None:
        self._repo = repository
        # Live engines keyed by run_id
        self._engines: Dict[str, SimulationEngine] = {}

    # ---------------------------------------------------------------------------
    # Run lifecycle
    # ---------------------------------------------------------------------------

    async def create_run(
        self,
        seed: int,
        hex_radius: int,
        variables: List[str],
        global_initial_values: Dict[str, float],
        spatial_decay: float = 0.3,
        diff_snapshots: bool = True,
        influence_config: Optional[Dict[str, Dict[str, float]]] = None,
        csv_rows: Optional[List[List[float]]] = None,
    ) -> Dict[str, Any]:
        run = SimulationRun.new(
            seed=seed,
            variables=variables,
            global_initial_values=global_initial_values,
            hex_radius=hex_radius,
            spatial_decay=spatial_decay,
        )

        run.world = WorldInitializer.create(
            seed=seed,
            hex_radius=hex_radius,
            variables=variables,
            global_initial_values=global_initial_values,
            csv_rows=csv_rows,
        )

        # Build influence config: use supplied config, or fall back to defaults
        # filtered to variables that are actually in this run.
        run_vars = set(variables)
        if influence_config:
            cfg = {
                v1: {v2: c for v2, c in effects.items() if v2 in run_vars}
                for v1, effects in influence_config.items()
                if v1 in run_vars
            }
        else:
            cfg = {
                v1: {v2: c for v2, c in effects.items() if v2 in run_vars}
                for v1, effects in _DEFAULT_INFLUENCE.items()
                if v1 in run_vars
            }

        run.influence = InfluenceMatrix.from_dict(cfg)
        run.influence_config = cfg

        engine = SimulationEngine(run=run, diff_snapshots=diff_snapshots)
        # Capture tick-0 full snapshot
        tick0_snapshot = engine.take_full_snapshot()
        run.snapshots.append(tick0_snapshot)

        self._engines[run.id] = engine
        await self._repo.save_run(run)
        await self._repo.save_snapshot(tick0_snapshot)

        return run.meta_dict()

    async def list_runs(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        return await self._repo.list_runs(limit=limit, offset=offset)

    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        return run.meta_dict()

    async def delete_run(self, run_id: str) -> bool:
        self._engines.pop(run_id, None)
        return await self._repo.delete_run(run_id)

    # ---------------------------------------------------------------------------
    # Tick execution
    # ---------------------------------------------------------------------------

    async def run_tick(self, run_id: str) -> Optional[Dict[str, Any]]:
        engine = await self._get_engine(run_id)
        if engine is None:
            return None

        snapshot = engine.tick()
        await self._repo.save_run(engine.run)
        await self._repo.save_snapshot(snapshot)

        return {
            "run_id": run_id,
            "tick": engine.run.current_tick,
            "global_state": engine.run.world.get_global_state(),
            "snapshot_id": snapshot.id,
            "is_diff": snapshot.is_diff,
        }

    async def run_n_ticks(self, run_id: str, n: int) -> Optional[Dict[str, Any]]:
        engine = await self._get_engine(run_id)
        if engine is None:
            return None

        snapshots = engine.run_ticks(n)
        await self._repo.save_run(engine.run)
        for snap in snapshots:
            await self._repo.save_snapshot(snap)

        return {
            "run_id": run_id,
            "ticks_run": n,
            "current_tick": engine.run.current_tick,
            "global_state": engine.run.world.get_global_state(),
            "last_snapshot_id": snapshots[-1].id if snapshots else None,
        }

    # ---------------------------------------------------------------------------
    # World / tile state
    # ---------------------------------------------------------------------------

    async def get_world_state(self, run_id: str) -> Optional[Dict[str, Any]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        return {
            "run_id": run_id,
            "tick": run.current_tick,
            "global_state": run.world.get_global_state(),
            "tile_count": len(run.world.tiles),
            "tiles": run.world.snapshot(),
        }

    async def get_tile_state(self, run_id: str, q: int, r: int) -> Optional[Dict[str, Any]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        tile = run.world.tiles.get((q, r))
        if tile is None:
            return None
        neighbors = run.world.get_neighbors(q, r)
        return {
            "q": q,
            "r": r,
            "variables": dict(tile.variables),
            "neighbor_count": len(neighbors),
        }

    async def alter_tile(
        self, run_id: str, q: int, r: int, variable: str, delta: float
    ) -> Optional[Dict[str, Any]]:
        engine = await self._get_engine(run_id)
        if engine is None:
            return None

        tile = engine.run.world.tiles.get((q, r))
        if tile is None or variable not in tile.variables:
            return None

        engine.alter_tile(q, r, variable, delta)
        return {
            "run_id": run_id,
            "q": q,
            "r": r,
            "variable": variable,
            "delta": delta,
            "queued": True,
        }

    # ---------------------------------------------------------------------------
    # Events
    # ---------------------------------------------------------------------------

    async def add_event(
        self,
        run_id: str,
        tick: int,
        name: str,
        delta_map: Dict[str, float],
        target_tiles: List[List[int]],
        source: str = "user",
    ) -> Optional[Dict[str, Any]]:
        engine = await self._get_engine(run_id)
        if engine is None:
            return None

        coords = [tuple(t) for t in target_tiles]

        # Guard against stale frontend ticks: if the requested tick has already
        # been processed (or is being processed right now), bump to current + 1
        # so the event always fires on the very next tick instead of being
        # silently dropped.
        effective_tick = max(tick, engine.run.current_tick + 1)

        event = SimEvent(
            tick=effective_tick,
            name=name,
            delta_map=delta_map,
            target_tiles=coords,  # type: ignore[arg-type]
            source=source,  # type: ignore[arg-type]
        )
        engine.add_event(event)
        await self._repo.save_event(run_id, event)

        return {
            "id": event.id,
            "run_id": run_id,
            "tick": effective_tick,
            "name": event.name,
            "delta_map": event.delta_map,
            "target_tiles": [list(c) for c in event.target_tiles],
            "source": event.source,
        }

    async def list_events(self, run_id: str) -> Optional[List[Dict[str, Any]]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        return await self._repo.list_events(run_id)

    async def generate_event(self, run_id: str, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Use Groq LLM to translate a plain-English scenario into a valid event.
        Returns None if the run is not found.
        Raises ValueError if Groq API key is not configured or LLM fails.
        """
        from ..config import settings
        from ..application.llm_service import GroqEventGenerator

        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not configured.")

        run = await self._load_run(run_id)
        if run is None:
            return None

        generator = GroqEventGenerator(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        )

        result = await generator.generate_event(
            prompt=prompt,
            variables=run.variables,
            hex_radius=run.hex_radius,
            current_tick=run.current_tick,
            global_state=run.world.get_global_state(),
        )

        return result

    async def interpret_run(
        self,
        run_id: str,
        compare_from_tick: Optional[int] = None,
        include_suggestions: bool = True,
        max_anomalies: int = 5,
        max_suggestions: int = 3,
    ) -> Optional[Dict[str, Any]]:
        """
        Use Groq LLM to interpret the current world state.
        Optionally compare against a previous tick's snapshot.
        Returns None if the run is not found.
        Raises ValueError if Groq API key is not configured or LLM fails.
        """
        from ..config import settings
        from ..application.llm_service import GroqRunInterpreter

        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not configured.")

        run = await self._load_run(run_id)
        if run is None:
            return None

        interpreter = GroqRunInterpreter(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        )

        # Assemble current context
        global_state = run.world.get_global_state()
        tile_snapshot = run.world.snapshot()
        recent_events = [e.to_dict() for e in run.event_log[-10:]]

        # Comparison snapshot (if requested)
        compare_global_state = None
        compare_tile_snapshot = None
        if compare_from_tick is not None and compare_from_tick < run.current_tick:
            snap_data = await self._repo.get_snapshot(run_id, compare_from_tick)
            if snap_data and isinstance(snap_data, dict) and "state" in snap_data:
                compare_tile_snapshot = snap_data["state"]
                # Compute global state from the comparison snapshot
                n = len(compare_tile_snapshot) if compare_tile_snapshot else 1
                compare_global_state = {}
                for tile_vars in compare_tile_snapshot.values():
                    for var, val in tile_vars.items():
                        compare_global_state[var] = compare_global_state.get(var, 0) + val
                compare_global_state = {v: t / n for v, t in compare_global_state.items()}

        result = await interpreter.interpret(
            variables=run.variables,
            hex_radius=run.hex_radius,
            current_tick=run.current_tick,
            global_state=global_state,
            tile_snapshot=tile_snapshot,
            recent_events=recent_events,
            influence_config=run.influence_config,
            include_suggestions=include_suggestions,
            max_anomalies=max_anomalies,
            max_suggestions=max_suggestions,
            compare_from_tick=compare_from_tick,
            compare_global_state=compare_global_state,
            compare_tile_snapshot=compare_tile_snapshot,
        )

        result["run_id"] = run_id
        result["tick"] = run.current_tick
        return result

    # ---------------------------------------------------------------------------
    # Snapshots
    # ---------------------------------------------------------------------------

    async def list_snapshots(self, run_id: str) -> Optional[List[Dict[str, Any]]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        return await self._repo.list_snapshots(run_id)

    async def get_snapshot(self, run_id: str, tick: int) -> Optional[Dict[str, Any]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        return await self._repo.get_snapshot(run_id, tick)

    # ---------------------------------------------------------------------------
    # Influence
    # ---------------------------------------------------------------------------

    async def set_influence(
        self, run_id: str, v1: str, v2: str, coefficient: float
    ) -> Optional[Dict[str, Any]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        run.influence.set(v1, v2, coefficient)
        run.influence_config = run.influence.to_dict()
        await self._repo.save_run(run)
        return {"run_id": run_id, "v1": v1, "v2": v2, "coefficient": coefficient}

    # ---------------------------------------------------------------------------
    # Export / replay
    # ---------------------------------------------------------------------------

    async def export_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        run = await self._load_run(run_id)
        if run is None:
            return None
        return RunSerializer.export_run(run)

    async def replay_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """
        Reconstruct the run from seed + events (full deterministic replay).
        Returns final global state.
        """
        run = await self._load_run(run_id)
        if run is None:
            return None

        total_ticks = run.current_tick
        event_log = list(run.event_log)

        # Rebuild world from scratch
        fresh_world = WorldInitializer.create(
            seed=run.seed,
            hex_radius=run.hex_radius,
            variables=run.variables,
            global_initial_values=run.global_initial_values,
        )
        fresh_run = SimulationRun.new(
            seed=run.seed,
            variables=run.variables,
            global_initial_values=run.global_initial_values,
            hex_radius=run.hex_radius,
            spatial_decay=run.spatial_decay,
            influence_config=run.influence_config,
        )
        fresh_run.world = fresh_world
        fresh_run.influence = InfluenceMatrix.from_dict(run.influence_config)
        fresh_run.event_log = event_log
        fresh_run.pending_events = list(event_log)

        engine = SimulationEngine(run=fresh_run, diff_snapshots=False)
        engine.run_ticks(total_ticks)

        return {
            "run_id": run_id,
            "replayed_ticks": total_ticks,
            "final_global_state": fresh_run.world.get_global_state(),
            "determinism_check": {
                "original_tick": run.current_tick,
                "replayed_tick": fresh_run.current_tick,
            },
        }

    # ---------------------------------------------------------------------------
    # Internal helpers
    # ---------------------------------------------------------------------------

    async def _load_run(self, run_id: str) -> Optional[SimulationRun]:
        """Load run from engine cache or repository."""
        engine = self._engines.get(run_id)
        if engine is not None:
            return engine.run
        run = await self._repo.load_run(run_id)
        if run is None:
            return None
        # Recreate engine for this run
        engine = SimulationEngine(run=run, diff_snapshots=True)
        self._engines[run_id] = engine
        return run

    async def _get_engine(self, run_id: str) -> Optional[SimulationEngine]:
        if run_id not in self._engines:
            run = await self._repo.load_run(run_id)
            if run is None:
                return None
            self._engines[run_id] = SimulationEngine(run=run, diff_snapshots=True)
        return self._engines[run_id]


# ---------------------------------------------------------------------------
# Variable catalog service
# ---------------------------------------------------------------------------


class VariableService:
    def __init__(self, repository: AbstractVariableRepository) -> None:
        self._repo = repository

    async def create(
        self,
        name: str,
        display_name: str,
        description: str = "",
        default_initial_value: float = 0.0,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        unit: str = "",
    ) -> Dict[str, Any]:
        existing = await self._repo.get_by_name(name)
        if existing:
            raise ValueError(f"Variable '{name}' already exists.")
        variable = Variable(
            name=name,
            display_name=display_name,
            description=description,
            default_initial_value=default_initial_value,
            min_value=min_value,
            max_value=max_value,
            unit=unit,
        )
        created = await self._repo.create(variable)
        return created.to_dict()

    async def list_all(self) -> List[Dict[str, Any]]:
        variables = await self._repo.list_all()
        return [v.to_dict() for v in variables]

    async def get(self, variable_id: str) -> Optional[Dict[str, Any]]:
        variable = await self._repo.get_by_id(variable_id)
        return variable.to_dict() if variable else None

    async def get_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        variable = await self._repo.get_by_name(name)
        return variable.to_dict() if variable else None

    async def update(self, variable_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        variable = await self._repo.get_by_id(variable_id)
        if variable is None:
            return None
        for field, value in updates.items():
            if value is not None:
                setattr(variable, field, value)
        updated = await self._repo.update(variable)
        return updated.to_dict()

    async def delete(self, variable_id: str) -> bool:
        return await self._repo.delete(variable_id)
