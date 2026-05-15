from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from ..domain.event import SimEvent
from ..domain.run import SimulationRun, Snapshot
from ..domain.world import World
from .event_processor import EventProcessor
from .propagation_engine import PropagationEngine, TileDeltas

Coords = Tuple[int, int]


class SimulationEngine:
    """
    Orchestrates one simulation run: tick-by-tick state advancement.

    Tick pipeline (deterministic, O(N)):
      1. Collect base deltas from queued events + direct API updates.
      2. Apply base deltas to world tiles.
      3. Compute and apply influence propagation (intra-tile, cross-variable).
      4. Compute and apply spatial propagation (inter-tile, same variable).
      5. Snapshot world state (full or diff).

    All randomness comes from the seeded initializer; the engine is
    fully deterministic given the same event sequence.
    """

    def __init__(
        self,
        run: SimulationRun,
        diff_snapshots: bool = True,
    ) -> None:
        self.run = run
        self.diff_snapshots = diff_snapshots

        self._propagation = PropagationEngine(
            world=run.world,
            influence=run.influence,
            spatial_decay=run.spatial_decay,
        )
        self._event_processor = EventProcessor(world=run.world)

        # Keep last full snapshot for diff computation
        self._last_full_snapshot: Optional[Dict] = None

    # ---------------------------------------------------------------------------
    # Public interface
    # ---------------------------------------------------------------------------

    def tick(self) -> Snapshot:
        """Advance simulation by one tick. Returns the snapshot for this tick."""
        self.run.current_tick += 1
        current_tick = self.run.current_tick

        # --- Step 1: Collect base deltas ---
        events_this_tick = [
            e for e in self.run.pending_events if e.tick == current_tick
        ]
        self.run.pending_events = [
            e for e in self.run.pending_events if e.tick != current_tick
        ]

        event_deltas = self._event_processor.resolve_events(events_this_tick)
        direct_deltas = self._event_processor.resolve_direct_updates(
            self.run.pending_direct_updates
        )
        self.run.pending_direct_updates.clear()

        base_deltas = _merge_deltas(event_deltas, direct_deltas)

        # --- Step 2: Apply base deltas ---
        PropagationEngine.apply_deltas(self.run.world, base_deltas)

        # --- Step 3: Influence propagation (computed from base, not cascading) ---
        influence_deltas = self._propagation.compute_influence_deltas(base_deltas)
        PropagationEngine.apply_deltas(self.run.world, influence_deltas)

        # --- Step 4: Spatial propagation (computed from base, not cascading) ---
        spatial_deltas = self._propagation.compute_spatial_deltas(base_deltas)
        PropagationEngine.apply_deltas(self.run.world, spatial_deltas)

        # --- Step 5: Snapshot ---
        snapshot = self._capture_snapshot()
        self.run.snapshots.append(snapshot)

        return snapshot

    def run_ticks(self, n: int) -> List[Snapshot]:
        """Run N ticks in sequence. Returns list of snapshots."""
        return [self.tick() for _ in range(n)]

    def alter_tile(self, q: int, r: int, variable: str, delta: float) -> None:
        """
        Queue a direct tile update to be applied at the start of the next tick.
        This is the 'user interaction' path; does not mutate world immediately.
        """
        key = f"{q},{r}"
        if key not in self.run.pending_direct_updates:
            self.run.pending_direct_updates[key] = {}
        current = self.run.pending_direct_updates[key].get(variable, 0.0)
        self.run.pending_direct_updates[key][variable] = current + delta

    def add_event(self, event: SimEvent) -> None:
        """Add an event to the run's log and pending queue."""
        self.run.event_log.append(event)
        self.run.pending_events.append(event)

    # ---------------------------------------------------------------------------
    # Snapshot helpers
    # ---------------------------------------------------------------------------

    def _capture_snapshot(self) -> Snapshot:
        current_full = self.run.world.snapshot()

        if self.diff_snapshots and self._last_full_snapshot is not None:
            state = self.run.world.diff_from(self._last_full_snapshot)
            is_diff = True
        else:
            state = current_full
            is_diff = False

        self._last_full_snapshot = current_full

        return Snapshot(
            run_id=self.run.id,
            tick=self.run.current_tick,
            state=state,
            is_diff=is_diff,
        )

    def take_full_snapshot(self) -> Snapshot:
        """Force a full (non-diff) snapshot at the current tick."""
        state = self.run.world.snapshot()
        self._last_full_snapshot = state
        snapshot = Snapshot(
            run_id=self.run.id,
            tick=self.run.current_tick,
            state=state,
            is_diff=False,
        )
        return snapshot


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def _merge_deltas(a: TileDeltas, b: TileDeltas) -> TileDeltas:
    """Merge two TileDeltas maps, summing overlapping entries."""
    merged: TileDeltas = defaultdict(lambda: defaultdict(float))
    for coords, var_deltas in a.items():
        for var, delta in var_deltas.items():
            merged[coords][var] += delta  # type: ignore[index]
    for coords, var_deltas in b.items():
        for var, delta in var_deltas.items():
            merged[coords][var] += delta  # type: ignore[index]
    return dict(merged)
