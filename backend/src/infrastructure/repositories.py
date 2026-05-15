"""
Repository layer: abstract persistence behind a clean interface.

Two implementations:
  - InMemoryRunRepository / InMemoryVariableRepository: no DB required.
  - PostgresRunRepository / PostgresVariableRepository: full async PostgreSQL.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.event import SimEvent
from ..domain.variable import Variable
from ..domain.run import SimulationRun, Snapshot
from .models import SimEventModel, SimulationRunModel, SnapshotModel, VariableModel
from .serialization import RunSerializer


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------


class AbstractRunRepository(ABC):
    @abstractmethod
    async def save_run(self, run: SimulationRun) -> None: ...

    @abstractmethod
    async def load_run(self, run_id: str) -> Optional[SimulationRun]: ...

    @abstractmethod
    async def list_runs(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]: ...

    @abstractmethod
    async def delete_run(self, run_id: str) -> bool: ...

    @abstractmethod
    async def save_snapshot(self, snapshot: Snapshot) -> None: ...

    @abstractmethod
    async def list_snapshots(self, run_id: str) -> List[Dict[str, Any]]: ...

    @abstractmethod
    async def get_snapshot(self, run_id: str, tick: int) -> Optional[Dict[str, Any]]: ...

    @abstractmethod
    async def save_event(self, run_id: str, event: SimEvent) -> None: ...

    @abstractmethod
    async def list_events(self, run_id: str) -> List[Dict[str, Any]]: ...


# ---------------------------------------------------------------------------
# In-memory implementation (no DB)
# ---------------------------------------------------------------------------


class InMemoryRunRepository(AbstractRunRepository):
    """Thread-unsafe in-memory store. Suitable for single-process local dev."""

    def __init__(self) -> None:
        self._runs: Dict[str, SimulationRun] = {}
        self._snapshots: Dict[str, List[Snapshot]] = {}

    async def save_run(self, run: SimulationRun) -> None:
        self._runs[run.id] = run

    async def load_run(self, run_id: str) -> Optional[SimulationRun]:
        return self._runs.get(run_id)

    async def list_runs(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        runs = list(self._runs.values())
        return [r.meta_dict() for r in runs[offset : offset + limit]]

    async def delete_run(self, run_id: str) -> bool:
        if run_id in self._runs:
            del self._runs[run_id]
            self._snapshots.pop(run_id, None)
            return True
        return False

    async def save_snapshot(self, snapshot: Snapshot) -> None:
        if snapshot.run_id not in self._snapshots:
            self._snapshots[snapshot.run_id] = []
        self._snapshots[snapshot.run_id].append(snapshot)

    async def list_snapshots(self, run_id: str) -> List[Dict[str, Any]]:
        return [s.to_dict() for s in self._snapshots.get(run_id, [])]

    async def get_snapshot(self, run_id: str, tick: int) -> Optional[Dict[str, Any]]:
        for s in self._snapshots.get(run_id, []):
            if s.tick == tick:
                return s.to_dict()
        return None

    async def save_event(self, run_id: str, event: SimEvent) -> None:
        # Events are already stored on the run object in memory
        pass

    async def list_events(self, run_id: str) -> List[Dict[str, Any]]:
        run = self._runs.get(run_id)
        if not run:
            return []
        return [e.to_dict() for e in run.event_log]


# ---------------------------------------------------------------------------
# PostgreSQL implementation
# ---------------------------------------------------------------------------


class PostgresRunRepository(AbstractRunRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_run(self, run: SimulationRun) -> None:
        existing = await self._session.get(SimulationRunModel, run.id)
        world_state = run.world.snapshot()

        if existing is None:
            model = SimulationRunModel(
                id=run.id,
                seed=run.seed,
                variables=run.variables,
                global_initial_values=run.global_initial_values,
                hex_radius=run.hex_radius,
                spatial_decay=run.spatial_decay,
                influence_config=run.influence_config,
                current_tick=run.current_tick,
                current_world_state=world_state,
            )
            self._session.add(model)
        else:
            existing.current_tick = run.current_tick
            existing.influence_config = run.influence_config
            existing.current_world_state = world_state

        await self._session.flush()

    async def load_run(self, run_id: str) -> Optional[SimulationRun]:
        model = await self._session.get(SimulationRunModel, run_id)
        if model is None:
            return None

        # Load events
        result = await self._session.execute(
            select(SimEventModel)
            .where(SimEventModel.run_id == run_id)
            .order_by(SimEventModel.tick, SimEventModel.id)
        )
        event_models = result.scalars().all()
        events = [
            SimEvent(
                id=e.id,
                tick=e.tick,
                name=e.name,
                delta_map=e.delta_map,
                target_tiles=[tuple(c) for c in e.target_tiles],  # type: ignore[misc]
                source=e.source,
            )
            for e in event_models
        ]

        return RunSerializer.reconstruct_run(model, events)

    async def list_runs(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        result = await self._session.execute(
            select(SimulationRunModel).order_by(SimulationRunModel.created_at.desc()).offset(offset).limit(limit)
        )
        models = result.scalars().all()
        return [
            {
                "id": m.id,
                "seed": m.seed,
                "hex_radius": m.hex_radius,
                "variables": m.variables,
                "current_tick": m.current_tick,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in models
        ]

    async def delete_run(self, run_id: str) -> bool:
        model = await self._session.get(SimulationRunModel, run_id)
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def save_snapshot(self, snapshot: Snapshot) -> None:
        model = SnapshotModel(
            id=snapshot.id,
            run_id=snapshot.run_id,
            tick=snapshot.tick,
            state=snapshot.state,
            is_diff=snapshot.is_diff,
        )
        self._session.add(model)
        await self._session.flush()

    async def list_snapshots(self, run_id: str) -> List[Dict[str, Any]]:
        result = await self._session.execute(
            select(SnapshotModel)
            .where(SnapshotModel.run_id == run_id)
            .order_by(SnapshotModel.tick)
        )
        models = result.scalars().all()
        return [
            {
                "id": m.id,
                "run_id": m.run_id,
                "tick": m.tick,
                "is_diff": m.is_diff,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in models
        ]

    async def get_snapshot(self, run_id: str, tick: int) -> Optional[Dict[str, Any]]:
        result = await self._session.execute(
            select(SnapshotModel)
            .where(SnapshotModel.run_id == run_id, SnapshotModel.tick == tick)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return {
            "id": model.id,
            "run_id": model.run_id,
            "tick": model.tick,
            "state": model.state,
            "is_diff": model.is_diff,
        }

    async def save_event(self, run_id: str, event: SimEvent) -> None:
        model = SimEventModel(
            id=event.id,
            run_id=run_id,
            tick=event.tick,
            name=event.name,
            delta_map=event.delta_map,
            target_tiles=[list(c) for c in event.target_tiles],
            source=event.source,
        )
        self._session.add(model)
        await self._session.flush()

    async def list_events(self, run_id: str) -> List[Dict[str, Any]]:
        result = await self._session.execute(
            select(SimEventModel)
            .where(SimEventModel.run_id == run_id)
            .order_by(SimEventModel.tick, SimEventModel.id)
        )
        models = result.scalars().all()
        return [
            {
                "id": m.id,
                "run_id": m.run_id,
                "tick": m.tick,
                "name": m.name,
                "delta_map": m.delta_map,
                "target_tiles": m.target_tiles,
                "source": m.source,
            }
            for m in models
        ]


# ---------------------------------------------------------------------------
# Variable catalog — abstract interface
# ---------------------------------------------------------------------------


class AbstractVariableRepository(ABC):
    @abstractmethod
    async def create(self, variable: Variable) -> Variable: ...

    @abstractmethod
    async def get_by_id(self, variable_id: str) -> Optional[Variable]: ...

    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[Variable]: ...

    @abstractmethod
    async def list_all(self) -> List[Variable]: ...

    @abstractmethod
    async def update(self, variable: Variable) -> Variable: ...

    @abstractmethod
    async def delete(self, variable_id: str) -> bool: ...


# ---------------------------------------------------------------------------
# In-memory variable repository
# ---------------------------------------------------------------------------


class InMemoryVariableRepository(AbstractVariableRepository):
    def __init__(self) -> None:
        self._store: Dict[str, Variable] = {}

    async def create(self, variable: Variable) -> Variable:
        if any(v.name == variable.name for v in self._store.values()):
            raise ValueError(f"Variable '{variable.name}' already exists.")
        self._store[variable.id] = variable
        return variable

    async def get_by_id(self, variable_id: str) -> Optional[Variable]:
        return self._store.get(variable_id)

    async def get_by_name(self, name: str) -> Optional[Variable]:
        return next((v for v in self._store.values() if v.name == name), None)

    async def list_all(self) -> List[Variable]:
        return list(self._store.values())

    async def update(self, variable: Variable) -> Variable:
        if variable.id not in self._store:
            raise ValueError(f"Variable '{variable.id}' not found.")
        # Guard against name collision with a different variable
        existing = await self.get_by_name(variable.name)
        if existing and existing.id != variable.id:
            raise ValueError(f"Variable name '{variable.name}' is already taken.")
        self._store[variable.id] = variable
        return variable

    async def delete(self, variable_id: str) -> bool:
        if variable_id not in self._store:
            return False
        del self._store[variable_id]
        return True


# ---------------------------------------------------------------------------
# PostgreSQL variable repository
# ---------------------------------------------------------------------------


class PostgresVariableRepository(AbstractVariableRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, variable: Variable) -> Variable:
        model = VariableModel(
            id=variable.id,
            name=variable.name,
            display_name=variable.display_name,
            description=variable.description,
            default_initial_value=variable.default_initial_value,
            min_value=variable.min_value,
            max_value=variable.max_value,
            unit=variable.unit,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_domain(model)

    async def get_by_id(self, variable_id: str) -> Optional[Variable]:
        model = await self._session.get(VariableModel, variable_id)
        return self._model_to_domain(model) if model else None

    async def get_by_name(self, name: str) -> Optional[Variable]:
        result = await self._session.execute(
            select(VariableModel).where(VariableModel.name == name)
        )
        model = result.scalar_one_or_none()
        return self._model_to_domain(model) if model else None

    async def list_all(self) -> List[Variable]:
        result = await self._session.execute(
            select(VariableModel).order_by(VariableModel.name)
        )
        return [self._model_to_domain(m) for m in result.scalars().all()]

    async def update(self, variable: Variable) -> Variable:
        model = await self._session.get(VariableModel, variable.id)
        if model is None:
            raise ValueError(f"Variable '{variable.id}' not found.")
        model.name = variable.name
        model.display_name = variable.display_name
        model.description = variable.description
        model.default_initial_value = variable.default_initial_value
        model.min_value = variable.min_value
        model.max_value = variable.max_value
        model.unit = variable.unit
        await self._session.flush()
        return self._model_to_domain(model)

    async def delete(self, variable_id: str) -> bool:
        model = await self._session.get(VariableModel, variable_id)
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    @staticmethod
    def _model_to_domain(model: VariableModel) -> Variable:
        return Variable(
            id=model.id,
            name=model.name,
            display_name=model.display_name,
            description=model.description,
            default_initial_value=model.default_initial_value,
            min_value=model.min_value,
            max_value=model.max_value,
            unit=model.unit,
            created_at=model.created_at.isoformat() if model.created_at else None,
            updated_at=model.updated_at.isoformat() if model.updated_at else None,
        )
