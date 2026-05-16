"""
FastAPI route definitions.

Thin wrappers around SimulationService — no business logic here.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..infrastructure.database import get_db
from ..infrastructure.repositories import (
    InMemoryRunRepository,
    InMemoryVariableRepository,
    PostgresRunRepository,
    PostgresVariableRepository,
)
from .schemas import (
    AddEventRequest,
    AlterTileRequest,
    AlterTileResponse,
    CreateRunRequest,
    CreateVariableRequest,
    ErrorResponse,
    EventResponse,
    ExportResponse,
    GenerateEventRequest,
    GenerateEventResponse,
    InterpretRunRequest,
    InterpretRunResponse,
    RunListItem,
    RunMetaResponse,
    RunTicksRequest,
    SetInfluenceRequest,
    SnapshotDetailResponse,
    SnapshotListItem,
    TickResponse,
    TileStateResponse,
    UpdateVariableRequest,
    VariableResponse,
    WorldStateResponse,
)
from .service import SimulationService, VariableService

router = APIRouter(prefix="/api/v1")

# ---------------------------------------------------------------------------
# Dependency injection
# ---------------------------------------------------------------------------

# In-memory fallbacks (used when DB is not configured)
_in_memory_repo = InMemoryRunRepository()
_in_memory_service = SimulationService(_in_memory_repo)

_in_memory_var_repo = InMemoryVariableRepository()
_in_memory_var_service = VariableService(_in_memory_var_repo)


async def get_service(db: Optional[AsyncSession] = Depends(get_db)) -> SimulationService:
    """
    Inject the appropriate service:
    - PostgresRunRepository when DATABASE_URL is configured and a session exists.
    - Shared InMemoryRunRepository as fallback (no DB needed).
    """
    if db is not None:
        repo = PostgresRunRepository(db)
        return SimulationService(repo)
    return _in_memory_service


async def get_variable_service(db: Optional[AsyncSession] = Depends(get_db)) -> VariableService:
    if db is not None:
        return VariableService(PostgresVariableRepository(db))
    return _in_memory_var_service


def _not_found(run_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")


def _tile_not_found(q: int, r: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Tile ({q}, {r}) not found.")


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------


@router.post("/runs", response_model=RunMetaResponse, status_code=201, tags=["Runs"])
async def create_run(body: CreateRunRequest, svc: SimulationService = Depends(get_service)):
    """Create and initialize a new simulation run."""
    active_variables = [v for v in body.variables if v.initial_value is not None]
    if not active_variables:
        raise HTTPException(status_code=422, detail="At least one variable must have a non-null initial_value.")
    result = await svc.create_run(
        seed=body.seed,
        hex_radius=body.hex_radius,
        variables=[v.name for v in active_variables],
        global_initial_values={v.name: v.initial_value for v in active_variables},  # type: ignore[misc]
        spatial_decay=body.spatial_decay,
        diff_snapshots=body.diff_snapshots,
        influence_config=body.influence_config,
    )
    return result


@router.get("/runs", response_model=List[RunListItem], tags=["Runs"])
async def list_runs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    svc: SimulationService = Depends(get_service),
):
    """List all simulation runs (paginated)."""
    return await svc.list_runs(limit=limit, offset=offset)


@router.get("/runs/{run_id}", response_model=RunMetaResponse, tags=["Runs"])
async def get_run(run_id: str, svc: SimulationService = Depends(get_service)):
    """Get metadata for a specific run."""
    result = await svc.get_run(run_id)
    if result is None:
        raise _not_found(run_id)
    return result


@router.delete("/runs/{run_id}", status_code=204, tags=["Runs"])
async def delete_run(run_id: str, svc: SimulationService = Depends(get_service)):
    """Delete a run and all its data."""
    deleted = await svc.delete_run(run_id)
    if not deleted:
        raise _not_found(run_id)


# ---------------------------------------------------------------------------
# Tick control
# ---------------------------------------------------------------------------


@router.post("/runs/{run_id}/tick", response_model=TickResponse, tags=["Simulation"])
async def run_one_tick(run_id: str, svc: SimulationService = Depends(get_service)):
    """Advance simulation by exactly one tick."""
    result = await svc.run_tick(run_id)
    if result is None:
        raise _not_found(run_id)
    return result


@router.post("/runs/{run_id}/ticks", tags=["Simulation"])
async def run_n_ticks(
    run_id: str, body: RunTicksRequest, svc: SimulationService = Depends(get_service)
):
    """Advance simulation by N ticks."""
    result = await svc.run_n_ticks(run_id, body.n)
    if result is None:
        raise _not_found(run_id)
    return result


# ---------------------------------------------------------------------------
# World / tile state
# ---------------------------------------------------------------------------


@router.get("/runs/{run_id}/state", response_model=WorldStateResponse, tags=["World"])
async def get_world_state(run_id: str, svc: SimulationService = Depends(get_service)):
    """Get full world state (all tiles + global averages)."""
    result = await svc.get_world_state(run_id)
    if result is None:
        raise _not_found(run_id)
    return result


@router.get(
    "/runs/{run_id}/tiles/{q}/{r}", response_model=TileStateResponse, tags=["World"]
)
async def get_tile_state(
    run_id: str, q: int, r: int, svc: SimulationService = Depends(get_service)
):
    """Get state for a specific tile."""
    run = await svc.get_run(run_id)
    if run is None:
        raise _not_found(run_id)
    result = await svc.get_tile_state(run_id, q, r)
    if result is None:
        raise _tile_not_found(q, r)
    return result


@router.post(
    "/runs/{run_id}/tiles/{q}/{r}/alter",
    response_model=AlterTileResponse,
    tags=["World"],
)
async def alter_tile(
    run_id: str,
    q: int,
    r: int,
    body: AlterTileRequest,
    svc: SimulationService = Depends(get_service),
):
    """Queue a direct delta update to a tile variable (applied on next tick)."""
    result = await svc.alter_tile(run_id, q, r, body.variable, body.delta)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Run '{run_id}' not found or tile ({q},{r}) / variable '{body.variable}' does not exist.",
        )
    return result


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


@router.post(
    "/runs/{run_id}/events", response_model=EventResponse, status_code=201, tags=["Events"]
)
async def add_event(
    run_id: str, body: AddEventRequest, svc: SimulationService = Depends(get_service)
):
    """Schedule a simulation event to fire at a specific tick."""
    result = await svc.add_event(
        run_id=run_id,
        tick=body.tick,
        name=body.name,
        delta_map=body.delta_map,
        target_tiles=body.target_tiles,
        source=body.source,
    )
    if result is None:
        raise _not_found(run_id)
    return result


@router.get("/runs/{run_id}/events", tags=["Events"])
async def list_events(run_id: str, svc: SimulationService = Depends(get_service)):
    """List all events for a run."""
    result = await svc.list_events(run_id)
    if result is None:
        raise _not_found(run_id)
    return result


@router.post(
    "/runs/{run_id}/events/generate",
    response_model=GenerateEventResponse,
    status_code=201,
    tags=["Events"],
)
async def generate_event(
    run_id: str,
    body: GenerateEventRequest,
    svc: SimulationService = Depends(get_service),
):
    """
    Translate a plain-English scenario into a simulation event using an LLM.

    The generated event is returned for review — it is NOT automatically
    scheduled. POST the returned event to /events to schedule it.
    """
    try:
        result = await svc.generate_event(run_id=run_id, prompt=body.prompt)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if result is None:
        raise _not_found(run_id)
    return GenerateEventResponse(
        event=AddEventRequest(**result["event"]),
        llm_raw=result["llm_raw"],
    )


# ---------------------------------------------------------------------------
# Interpretation
# ---------------------------------------------------------------------------


@router.post(
    "/runs/{run_id}/interpret",
    response_model=InterpretRunResponse,
    tags=["Interpretation"],
)
async def interpret_run(
    run_id: str,
    body: InterpretRunRequest = InterpretRunRequest(),
    svc: SimulationService = Depends(get_service),
):
    """
    Analyze the current world state using an LLM.

    Returns a narrative summary, anomaly flags, and optional corrective
    event suggestions. Set `compare_from_tick` to get a delta-based
    analysis of what changed since that tick.
    """
    try:
        result = await svc.interpret_run(
            run_id=run_id,
            compare_from_tick=body.compare_from_tick,
            include_suggestions=body.include_suggestions,
            max_anomalies=body.max_anomalies,
            max_suggestions=body.max_suggestions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if result is None:
        raise _not_found(run_id)
    return result


# ---------------------------------------------------------------------------
# Snapshots
# ---------------------------------------------------------------------------


@router.get("/runs/{run_id}/snapshots", response_model=List[SnapshotListItem], tags=["Snapshots"])
async def list_snapshots(run_id: str, svc: SimulationService = Depends(get_service)):
    """List snapshot metadata for a run."""
    result = await svc.list_snapshots(run_id)
    if result is None:
        raise _not_found(run_id)
    return result


@router.get(
    "/runs/{run_id}/snapshots/{tick}", response_model=SnapshotDetailResponse, tags=["Snapshots"]
)
async def get_snapshot(run_id: str, tick: int, svc: SimulationService = Depends(get_service)):
    """Get snapshot state at a specific tick."""
    result = await svc.get_snapshot(run_id, tick)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No snapshot found for tick {tick}.")
    return result


# ---------------------------------------------------------------------------
# Influence
# ---------------------------------------------------------------------------


@router.post("/runs/{run_id}/influence", tags=["Influence"])
async def set_influence(
    run_id: str, body: SetInfluenceRequest, svc: SimulationService = Depends(get_service)
):
    """Set or update a cross-variable influence coefficient at runtime."""
    result = await svc.set_influence(run_id, body.v1, body.v2, body.coefficient)
    if result is None:
        raise _not_found(run_id)
    return result


# ---------------------------------------------------------------------------
# Export / replay
# ---------------------------------------------------------------------------


@router.get("/runs/{run_id}/export", tags=["Export"])
async def export_run(run_id: str, svc: SimulationService = Depends(get_service)):
    """Export full run (world state + events + snapshots) as JSON."""
    result = await svc.export_run(run_id)
    if result is None:
        raise _not_found(run_id)
    return result


@router.post("/runs/{run_id}/replay", tags=["Export"])
async def replay_run(run_id: str, svc: SimulationService = Depends(get_service)):
    """
    Replay the run from seed + event log and verify determinism.
    Returns final global state of the replay.
    """
    result = await svc.replay_run(run_id)
    if result is None:
        raise _not_found(run_id)
    return result


# ---------------------------------------------------------------------------
# Variable catalog
# ---------------------------------------------------------------------------


def _var_not_found(variable_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Variable '{variable_id}' not found.")


@router.post("/variables", response_model=VariableResponse, status_code=201, tags=["Variables"])
async def create_variable(
    body: CreateVariableRequest,
    svc: VariableService = Depends(get_variable_service),
):
    """Create a new variable in the global catalog."""
    try:
        return await svc.create(
            name=body.name,
            display_name=body.display_name,
            description=body.description,
            default_initial_value=body.default_initial_value,
            min_value=body.min_value,
            max_value=body.max_value,
            unit=body.unit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/variables", response_model=List[VariableResponse], tags=["Variables"])
async def list_variables(svc: VariableService = Depends(get_variable_service)):
    """List all variables in the catalog."""
    return await svc.list_all()


@router.get("/variables/{variable_id}", response_model=VariableResponse, tags=["Variables"])
async def get_variable(
    variable_id: str,
    svc: VariableService = Depends(get_variable_service),
):
    """Get a variable by ID."""
    result = await svc.get(variable_id)
    if result is None:
        raise _var_not_found(variable_id)
    return result


@router.get("/variables/by-name/{name}", response_model=VariableResponse, tags=["Variables"])
async def get_variable_by_name(
    name: str,
    svc: VariableService = Depends(get_variable_service),
):
    """Get a variable by its unique name slug."""
    result = await svc.get_by_name(name)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Variable '{name}' not found.")
    return result


@router.patch("/variables/{variable_id}", response_model=VariableResponse, tags=["Variables"])
async def update_variable(
    variable_id: str,
    body: UpdateVariableRequest,
    svc: VariableService = Depends(get_variable_service),
):
    """Update one or more fields of an existing variable."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields provided to update.")
    try:
        result = await svc.update(variable_id, updates)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if result is None:
        raise _var_not_found(variable_id)
    return result


@router.delete("/variables/{variable_id}", status_code=204, tags=["Variables"])
async def delete_variable(
    variable_id: str,
    svc: VariableService = Depends(get_variable_service),
):
    """Delete a variable from the catalog."""
    deleted = await svc.delete(variable_id)
    if not deleted:
        raise _var_not_found(variable_id)
