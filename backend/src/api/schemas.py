"""
Pydantic v2 request / response schemas for the simulation API.
Kept intentionally thin — they just validate and shape data.
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Run schemas
# ---------------------------------------------------------------------------


class VariableInput(BaseModel):
    name: str = Field(..., description="Variable name slug.")
    initial_value: Optional[float] = Field(
        None, description="Target global average at tick 0. Null means this variable is not used in the run."
    )


class VariableSpec(BaseModel):
    """Type and range constraints for a simulation variable, used to sanitize tile values before ML inference."""
    min_value: Optional[float] = Field(None, description="Minimum allowed value (clamp lower bound).")
    max_value: Optional[float] = Field(None, description="Maximum allowed value (clamp upper bound).")
    is_integer: bool = Field(False, description="If true, round value to nearest integer before inference.")


class CreateRunRequest(BaseModel):
    seed: int = Field(42, description="RNG seed for deterministic initialization.")
    hex_radius: int = Field(5, ge=1, le=50, description="Axial hex grid radius.")
    variables: List[VariableInput] = Field(
        default=[
            VariableInput(name="health", initial_value=100.0),
            VariableInput(name="economy", initial_value=50.0),
            VariableInput(name="green", initial_value=60.0),
            VariableInput(name="mobility", initial_value=40.0),
        ],
        min_length=1,
        description="Variables to track per tile. Items with null initial_value are excluded from the run.",
    )
    spatial_decay: float = Field(
        0.3, ge=0.0, le=1.0, description="Fraction of delta propagated to hex neighbors."
    )
    diff_snapshots: bool = Field(
        True, description="Store diff snapshots (smaller) instead of full per tick."
    )
    influence_config: Optional[Dict[str, Dict[str, float]]] = Field(
        None,
        description="Influence matrix to apply from tick 0. Falls back to built-in defaults if omitted.",
    )
    csv_rows: Optional[List[List[float]]] = Field(
        None,
        description=(
            "Optional CSV data: each inner list is one row of numeric values, columns map to "
            "variables in order. Rows are randomly assigned to tiles (seeded); extra rows are "
            "sampled, missing tiles use global initial_value defaults."
        ),
    )
    variable_specs: Optional[Dict[str, VariableSpec]] = Field(
        None,
        description=(
            "Per-variable type and range constraints. Used to sanitize tile values "
            "before ML inference (clamp to [min_value, max_value], round if is_integer)."
        ),
    )


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


class GenerateEventRequest(BaseModel):
    """User's plain-English scenario description."""

    prompt: str = Field(
        ..., min_length=3, max_length=2000, description="Natural-language scenario description."
    )


class GenerateEventResponse(BaseModel):
    """LLM-generated event ready for user review."""

    event: AddEventRequest
    llm_raw: str = Field(..., description="Raw LLM output for transparency.")


# ---------------------------------------------------------------------------
# Interpretation schemas
# ---------------------------------------------------------------------------


class InterpretRunRequest(BaseModel):
    """Optional configuration for run interpretation."""

    compare_from_tick: Optional[int] = Field(
        None, ge=0, description="If set, narrate changes since this tick instead of just current state."
    )
    include_suggestions: bool = Field(
        True, description="Whether to include corrective event suggestions."
    )
    max_anomalies: int = Field(5, ge=0, le=20, description="Max anomalies to report.")
    max_suggestions: int = Field(3, ge=0, le=10, description="Max corrective events to suggest.")


class AnomalyDetail(BaseModel):
    variable: str
    description: str
    severity: str = Field(..., description="low, medium, or high")
    affected_tiles: List[List[int]]


class SuggestedEvent(BaseModel):
    name: str
    description: str
    delta_map: Dict[str, float]
    target_tiles: List[List[int]]
    tick: int


class InterpretRunResponse(BaseModel):
    run_id: str
    tick: int
    narrative: str
    anomalies: List[AnomalyDetail]
    suggestions: List[SuggestedEvent]
    llm_raw: str = Field(..., description="Raw LLM output for transparency.")


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


# ---------------------------------------------------------------------------
# ML prediction (pest risk)
# ---------------------------------------------------------------------------


class PredictionSchemaResponse(BaseModel):
    available: bool
    feature_columns: List[str]
    target: str
    class_names: List[str]
    backend: Optional[str] = None
    label_encoding: Optional[Dict[str, int]] = None
    error: Optional[str] = None


class PredictionHealthResponse(BaseModel):
    status: str
    backend: str
    detail: Optional[Any] = None
    endpoint: Optional[str] = None


class PredictInstancesRequest(BaseModel):
    instances: List[Dict[str, float]] = Field(
        ..., min_length=1, description="Rows with model feature_columns keys."
    )
    strict: bool = Field(
        True, description="If true, reject rows missing required feature keys."
    )


class PredictInstancesResponse(BaseModel):
    predictions: List[Dict[str, Any]]
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class PredictRunTilesRequest(BaseModel):
    model: Literal["xgb", "nn", "both"] = Field(
        "nn", description="Which model output to emphasize on tiles."
    )
    write_to_tiles: bool = Field(
        True, description="Write pest_risk_prob_* fields onto each tile."
    )
    strict: bool = Field(
        False,
        description="If true, skip tiles missing required feature columns.",
    )
    fill_missing: float = Field(
        0.0, description="Default value for missing features when not strict."
    )


class PredictRunTilesResponse(BaseModel):
    run_id: str
    predictions: Dict[str, Any]
    tile_errors: Dict[str, List[str]] = Field(default_factory=dict)
    tiles_predicted: int
    tiles_skipped: int
