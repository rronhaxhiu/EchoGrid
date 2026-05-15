from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SimulationRunModel(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    variables: Mapped[dict] = mapped_column(JSONB, nullable=False)
    global_initial_values: Mapped[dict] = mapped_column(JSONB, nullable=False)
    hex_radius: Mapped[int] = mapped_column(Integer, nullable=False)
    spatial_decay: Mapped[float] = mapped_column(nullable=False, default=0.3)
    influence_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    current_tick: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Full current world state for fast resumption (avoids full replay)
    current_world_state: Mapped[dict] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    events: Mapped[list["SimEventModel"]] = relationship(
        "SimEventModel", back_populates="run", cascade="all, delete-orphan"
    )
    snapshots: Mapped[list["SnapshotModel"]] = relationship(
        "SnapshotModel", back_populates="run", cascade="all, delete-orphan"
    )


class SimEventModel(Base):
    __tablename__ = "sim_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    run_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False
    )
    tick: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_tiles: Mapped[list] = mapped_column(JSONB, nullable=False)
    delta_map: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="user")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    run: Mapped["SimulationRunModel"] = relationship("SimulationRunModel", back_populates="events")


class SnapshotModel(Base):
    __tablename__ = "snapshots"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    run_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("simulation_runs.id", ondelete="CASCADE"), nullable=False
    )
    tick: Mapped[int] = mapped_column(Integer, nullable=False)
    state: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_diff: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    run: Mapped["SimulationRunModel"] = relationship("SimulationRunModel", back_populates="snapshots")


class VariableModel(Base):
    __tablename__ = "variables"
    __table_args__ = (UniqueConstraint("name", name="uq_variables_name"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    default_initial_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    min_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
