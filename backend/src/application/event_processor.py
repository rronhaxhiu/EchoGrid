from collections import defaultdict
from typing import Dict, List, Tuple

from ..domain.event import SimEvent
from ..domain.world import World
from .propagation_engine import TileDeltas

Coords = Tuple[int, int]


class EventProcessor:
    """
    Resolves SimEvents into base TileDeltas without mutating world state.

    Keeps event processing pure and testable; the simulation engine owns
    all world mutations.
    """

    def __init__(self, world: World) -> None:
        self.world = world

    def resolve_events(self, events: List[SimEvent]) -> TileDeltas:
        """
        Accumulate all event deltas for the given tick into a single TileDeltas.

        Events are sorted by (tick, id) to ensure deterministic ordering.
        """
        sorted_events = sorted(events, key=lambda e: (e.tick, e.id))
        base_deltas: TileDeltas = defaultdict(lambda: defaultdict(float))

        for event in sorted_events:
            for coords in event.target_tiles:
                tile = self.world.tiles.get(coords)
                if tile is None:
                    continue
                for var, delta in event.delta_map.items():
                    if var in tile.variables:
                        base_deltas[coords][var] += delta  # type: ignore[index]

        return dict(base_deltas)

    def resolve_direct_updates(
        self,
        pending: Dict[str, Dict[str, float]],
    ) -> TileDeltas:
        """
        Convert pending direct API updates (keyed by 'q,r' strings) to TileDeltas.
        """
        base_deltas: TileDeltas = defaultdict(lambda: defaultdict(float))

        for key, var_deltas in pending.items():
            q_str, r_str = key.split(",")
            coords: Coords = (int(q_str), int(r_str))
            tile = self.world.tiles.get(coords)
            if tile is None:
                continue
            for var, delta in var_deltas.items():
                if var in tile.variables:
                    base_deltas[coords][var] += delta  # type: ignore[index]

        return dict(base_deltas)
