"""
Pydantic v2 request / response schemas for the simulation API.
Kept intentionally thin — they just validate and shape data.
"""

from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Run schemas
# ---------------------------------------------------------------------------


class CreateRunRequest(BaseModel):
    seed: int = Field(42, description="RNG seed for deterministic initialization.")
    hex_radius: int = Field(5, ge=1, le=50, description="Axial hex grid radius.")
    variables: List[str] = Field(
        default=["health", "economy", "green", "mobility"],
        min_length=1,
        description="Variable names to track per tile.",
    )
    global_initial_values: Dict[str, float] = Field(
        default={"health": 100.0, "economy": 50.0, "green": 60.0, "mobility": 40.0},
        description="Target global average per variable at tick 0.",
    )
    spatial_decay: float = Field(
        0.3, ge=0.0, le=1.0, description="Fraction of delta propagated to hex neighbors."
    )
    influence_config: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Cross-variable influence matrix. influence[v1][v2] = coefficient.",
    )
    diff_snapshots: bool = Field(
        True, description="Store diff snapshots (smaller) instead of full per tick."
    )

    @field_validator("global_initial_values")
    @classmethod
    def check_initial_values_match_variables(
        cls, v: Dict[str, float], info: Any
    ) -> Dict[str, float]:
        variables = info.data.get("variables", [])
        for var in variables:
            if var not in v:
                v[var] = 0.0
        return v


class RunMetaResponse(BaseModel):
    id: str
    seed: int
    hex_radius: int
    variables: List[str]
    global_initial_values: Dict[str, float]
    spatial_decay: float
    influence_config: Dict[str, Dict[str, float]]
    current_tick: int
    tile_count: int
    event_count: int
    snapshot_count: int
    created_at: Optional[str] = None


class RunListItem(BaseModel):
    id: str
    seed: int
    hex_radius: int
    variables: List[str]
    current_tick: int
    created_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Tick schemas
# ---------------------------------------------------------------------------


class RunTicksRequest(BaseModel):
    n: int = Field(1, ge=1, le=10_000, description="Number of ticks to advance.")


class TickResponse(BaseModel):
    run_id: str
    tick: int
    global_state: Dict[str, float]
    snapshot_id: str
    is_diff: bool


# ---------------------------------------------------------------------------
# Tile schemas
# ---------------------------------------------------------------------------


class TileStateResponse(BaseModel):
    q: int
    r: int
    variables: Dict[str, float]
    neighbor_count: int


class AlterTileRequest(BaseModel):
    variable: str
    delta: float = Field(..., description="Value to add to the variable (can be negative).")


class AlterTileResponse(BaseModel):
    run_id: str
    q: int
    r: int
    variable: str
    delta: float
    queued: bool = True


# ---------------------------------------------------------------------------
# World state schemas
# ---------------------------------------------------------------------------


class WorldStateResponse(BaseModel):
    run_id: str
    tick: int
    global_state: Dict[str, float]
    tile_count: int
    tiles: Dict[str, Dict[str, float]]


# ---------------------------------------------------------------------------
# Event schemas
# ---------------------------------------------------------------------------


class AddEventRequest(BaseModel):
    tick: int = Field(..., ge=1, description="Tick at which the event fires.")
    name: str = Field(..., min_length=1, max_length=255)
    delta_map: Dict[str, float] = Field(
        ..., description="Variable → delta mapping applied to target tiles."
    )
    target_tiles: List[List[int]] = Field(
        ..., description="List of [q, r] coordinate pairs."
    )
    source: Literal["user", "system", "AI"] = "user"

    @field_validator("target_tiles")
    @classmethod
    def validate_coords(cls, v: List[List[int]]) -> List[List[int]]:
        for pair in v:
            if len(pair) != 2:
                raise ValueError("Each target tile must be [q, r].")
        return v


class EventResponse(BaseModel):
    id: str
    run_id: str
    tick: int
    name: str
    delta_map: Dict[str, float]
    target_tiles: List[List[int]]
    source: str


# ---------------------------------------------------------------------------
# Snapshot schemas
# ---------------------------------------------------------------------------


class SnapshotListItem(BaseModel):
    id: str
    run_id: str
    tick: int
    is_diff: bool
    created_at: Optional[str] = None


class SnapshotDetailResponse(BaseModel):
    id: str
    run_id: str
    tick: int
    is_diff: bool
    state: Dict[str, Any]


# ---------------------------------------------------------------------------
# Influence schemas
# ---------------------------------------------------------------------------


class SetInfluenceRequest(BaseModel):
    v1: str = Field(..., description="Source variable.")
    v2: str = Field(..., description="Downstream variable.")
    coefficient: float = Field(..., description="Influence coefficient.")


# ---------------------------------------------------------------------------
# Export / replay schemas
# ---------------------------------------------------------------------------


class ExportResponse(BaseModel):
    meta: Dict[str, Any]
    world_state: Dict[str, Dict[str, float]]
    global_state: Dict[str, float]
    event_log: List[Dict[str, Any]]
    snapshots: List[Dict[str, Any]]


class ErrorResponse(BaseModel):
    detail: str


# ---------------------------------------------------------------------------
# Variable catalog schemas
# ---------------------------------------------------------------------------


class CreateVariableRequest(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z][a-z0-9_]*$",
        description="Unique slug identifier (lowercase, underscores allowed, e.g. 'education').",
    )
    display_name: str = Field(..., min_length=1, max_length=255, description="Human-readable label.")
    description: str = Field("", description="Optional description of what this variable represents.")
    default_initial_value: float = Field(0.0, description="Default global average when used in a run.")
    min_value: Optional[float] = Field(None, description="Optional lower bound (informational).")
    max_value: Optional[float] = Field(None, description="Optional upper bound (informational).")
    unit: str = Field("", max_length=50, description="Unit label, e.g. 'index', '%', 'score'.")


class UpdateVariableRequest(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    default_initial_value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)


class VariableResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: str
    default_initial_value: float
    min_value: Optional[float]
    max_value: Optional[float]
    unit: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
