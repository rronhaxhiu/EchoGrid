"""
Minimal runnable example — no server, no database.

Demonstrates:
  1. Creating a hex world (radius 3, 37 tiles).
  2. Running 10 ticks.
  3. Injecting an event mid-simulation.
  4. Printing global state after each tick.
  5. Verifying conservation (sum / N == global average).

Run from the backend/ directory:
    python -m examples.minimal_example
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.application.simulation_engine import SimulationEngine
from src.application.world_initializer import WorldInitializer
from src.domain.event import SimEvent
from src.domain.influence import InfluenceMatrix
from src.domain.run import SimulationRun


def main() -> None:
    print("=" * 60)
    print("  Hex World Simulation — Minimal Example")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 1. Configure
    # -----------------------------------------------------------------------
    SEED = 42
    HEX_RADIUS = 3
    VARIABLES = ["health", "economy", "green", "mobility"]
    GLOBAL_INIT = {"health": 100.0, "economy": 50.0, "green": 60.0, "mobility": 40.0}
    SPATIAL_DECAY = 0.25

    # -----------------------------------------------------------------------
    # 2. Build world
    # -----------------------------------------------------------------------
    world = WorldInitializer.create(
        seed=SEED,
        hex_radius=HEX_RADIUS,
        variables=VARIABLES,
        global_initial_values=GLOBAL_INIT,
    )

    tile_count = len(world.tiles)
    print(f"\nWorld created: radius={HEX_RADIUS}, tiles={tile_count}")

    # Verify conservation constraint: avg(tile[v]) == global[v]
    global_at_init = world.get_global_state()
    print("\nTick 0 — Global averages (should match GLOBAL_INIT):")
    for var, avg in global_at_init.items():
        target = GLOBAL_INIT[var]
        ok = abs(avg - target) < 1e-6
        print(f"  {var:10s}: {avg:8.4f}  (target={target:.1f})  {'✓' if ok else '✗'}")

    # -----------------------------------------------------------------------
    # 3. Set up influence matrix
    #    economy ↑ → health ↑ (coefficient 0.1)
    #    green   ↑ → health ↑ (coefficient 0.05)
    # -----------------------------------------------------------------------
    influence = InfluenceMatrix()
    influence.set("economy", "health", 0.10)
    influence.set("green", "health", 0.05)

    # -----------------------------------------------------------------------
    # 4. Create run + engine
    # -----------------------------------------------------------------------
    run = SimulationRun.new(
        seed=SEED,
        variables=VARIABLES,
        global_initial_values=GLOBAL_INIT,
        hex_radius=HEX_RADIUS,
        spatial_decay=SPATIAL_DECAY,
    )
    run.world = world
    run.influence = influence

    engine = SimulationEngine(run=run, diff_snapshots=True)

    # -----------------------------------------------------------------------
    # 5. Schedule an event at tick 5
    #    "pollution_crisis" hits 3 central tiles: economy -20, green -15
    # -----------------------------------------------------------------------
    crisis_tiles = [(0, 0), (1, 0), (0, 1)]
    event = SimEvent(
        tick=5,
        name="pollution_crisis",
        delta_map={"economy": -20.0, "green": -15.0},
        target_tiles=crisis_tiles,
        source="AI",
    )
    engine.add_event(event)
    print(f"\nEvent scheduled: '{event.name}' at tick 5 → tiles {crisis_tiles}")

    # -----------------------------------------------------------------------
    # 6. Run 10 ticks, print global state each tick
    # -----------------------------------------------------------------------
    print("\n" + "─" * 60)
    print(f"  {'Tick':>4}  {'health':>8}  {'economy':>8}  {'green':>8}  {'mobility':>8}")
    print("─" * 60)

    for _ in range(10):
        snapshot = engine.tick()
        g = run.world.get_global_state()
        marker = " ← event fired" if run.current_tick == 5 else ""
        print(
            f"  {run.current_tick:>4}  {g['health']:>8.3f}  {g['economy']:>8.3f}"
            f"  {g['green']:>8.3f}  {g['mobility']:>8.3f}{marker}"
        )

    print("─" * 60)

    # -----------------------------------------------------------------------
    # 7. Inspect a specific tile
    # -----------------------------------------------------------------------
    sample_tile = run.world.tiles.get((0, 0))
    if sample_tile:
        neighbors = run.world.get_neighbors(0, 0)
        print(f"\nTile (0,0) after 10 ticks:")
        for var, val in sample_tile.variables.items():
            print(f"  {var:10s}: {val:.4f}")
        print(f"  neighbors  : {len(neighbors)}")

    # -----------------------------------------------------------------------
    # 8. Snapshot summary
    # -----------------------------------------------------------------------
    print(f"\nSnapshots captured: {len(run.snapshots)}")
    print(f"Events in log     : {len(run.event_log)}")
    print(f"Final tick        : {run.current_tick}")

    # -----------------------------------------------------------------------
    # 9. Quick replay verification
    # -----------------------------------------------------------------------
    print("\nRunning replay to verify determinism...")
    world2 = WorldInitializer.create(
        seed=SEED,
        hex_radius=HEX_RADIUS,
        variables=VARIABLES,
        global_initial_values=GLOBAL_INIT,
    )
    run2 = SimulationRun.new(
        seed=SEED,
        variables=VARIABLES,
        global_initial_values=GLOBAL_INIT,
        hex_radius=HEX_RADIUS,
        spatial_decay=SPATIAL_DECAY,
    )
    run2.world = world2
    run2.influence = InfluenceMatrix()
    run2.influence.set("economy", "health", 0.10)
    run2.influence.set("green", "health", 0.05)

    replay_event = SimEvent(
        id=event.id,  # same UUID
        tick=5,
        name="pollution_crisis",
        delta_map={"economy": -20.0, "green": -15.0},
        target_tiles=crisis_tiles,
        source="AI",
    )
    engine2 = SimulationEngine(run=run2, diff_snapshots=True)
    engine2.add_event(replay_event)
    engine2.run_ticks(10)

    g1 = run.world.get_global_state()
    g2 = run2.world.get_global_state()
    all_match = all(abs(g1[v] - g2[v]) < 1e-10 for v in VARIABLES)
    print(f"  Replay match (all variables within 1e-10): {'✓ PASS' if all_match else '✗ FAIL'}")

    print("\nDone.\n")


if __name__ == "__main__":
    main()
