# Hex World Simulation API — curl Reference

All examples target `http://localhost:8000`. Replace `RUN_ID` with an actual run UUID.

---

## Health

```bash
# Check server status and database mode
curl -s http://localhost:8000/health | jq
```

---

## Runs

### Create a run (minimal — uses defaults)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "seed": 42,
    "hex_radius": 5
  }' | jq
```

### Create a run (fully configured)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "seed": 1337,
    "hex_radius": 8,
    "variables": [
      {"name": "health",   "initial_value": 100.0},
      {"name": "economy",  "initial_value": 50.0},
      {"name": "green",    "initial_value": 60.0},
      {"name": "mobility", "initial_value": 40.0}
    ],
    "spatial_decay": 0.3,
    "diff_snapshots": true
  }' | jq
```

### Create a run with some variables disabled (null = excluded from run)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "seed": 42,
    "hex_radius": 5,
    "variables": [
      {"name": "health",   "initial_value": 100.0},
      {"name": "economy",  "initial_value": 50.0},
      {"name": "green",    "initial_value": null},
      {"name": "mobility", "initial_value": null}
    ],
    "spatial_decay": 0.3
  }' | jq
```

### List all runs (paginated)
```bash
curl -s "http://localhost:8000/api/v1/runs?limit=20&offset=0" | jq
```

### Get a specific run
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID | jq
```

### Delete a run
```bash
curl -s -X DELETE http://localhost:8000/api/v1/runs/RUN_ID
```

---

## Simulation Ticks

### Advance one tick
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/tick | jq
```

### Advance N ticks (e.g., 10)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/ticks \
  -H "Content-Type: application/json" \
  -d '{"n": 10}' | jq
```

### Advance 100 ticks (stress test)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/ticks \
  -H "Content-Type: application/json" \
  -d '{"n": 100}' | jq
```

---

## World State

### Get full world state (all tiles + global averages)
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/state | jq
```

### Get global averages only
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/state | jq '.global_state'
```

### Get specific tile state (e.g., tile at q=0, r=0)
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/tiles/0/0 | jq
```

### Get tile at negative coordinates
```bash
curl -s "http://localhost:8000/api/v1/runs/RUN_ID/tiles/-2/1" | jq
```

### Alter a tile variable (queued for next tick)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/tiles/0/0/alter \
  -H "Content-Type: application/json" \
  -d '{"variable": "health", "delta": -25.0}' | jq
```

### Boost a tile's economy
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/tiles/1/0/alter \
  -H "Content-Type: application/json" \
  -d '{"variable": "economy", "delta": 30.0}' | jq
```

---

## Events

### Schedule a single-tile event
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/events \
  -H "Content-Type: application/json" \
  -d '{
    "tick": 5,
    "name": "pollution_crisis",
    "delta_map": {"economy": -20.0, "green": -15.0},
    "target_tiles": [[0, 0]],
    "source": "AI"
  }' | jq
```

### Schedule a multi-tile disaster event
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/events \
  -H "Content-Type: application/json" \
  -d '{
    "tick": 10,
    "name": "earthquake",
    "delta_map": {"health": -40.0, "mobility": -30.0},
    "target_tiles": [[0,0],[1,0],[0,1],[1,-1],[-1,0],[0,-1],[-1,1]],
    "source": "system"
  }' | jq
```

### Schedule an AI-generated recovery event
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/events \
  -H "Content-Type: application/json" \
  -d '{
    "tick": 15,
    "name": "green_initiative",
    "delta_map": {"green": 20.0, "economy": 5.0},
    "target_tiles": [[0,0],[1,0],[0,1]],
    "source": "AI"
  }' | jq
```

### List all events for a run
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/events | jq
```

---

## Snapshots

### List all snapshots (metadata only)
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/snapshots | jq
```

### Get snapshot at tick 5 (full state or diff)
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/snapshots/5 | jq
```

### Get initial state (tick 0)
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/snapshots/0 | jq
```

---

## Influence Matrix

### Set a runtime influence coefficient
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/influence \
  -H "Content-Type: application/json" \
  -d '{"v1": "economy", "v2": "health", "coefficient": 0.15}' | jq
```

### Add green → mobility influence
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/influence \
  -H "Content-Type: application/json" \
  -d '{"v1": "green", "v2": "mobility", "coefficient": 0.08}' | jq
```

### Remove influence (set coefficient to 0)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/influence \
  -H "Content-Type: application/json" \
  -d '{"v1": "economy", "v2": "health", "coefficient": 0.0}' | jq
```

---

## Export & Replay

### Export full run as JSON
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/export | jq
```

### Export and save to file
```bash
curl -s http://localhost:8000/api/v1/runs/RUN_ID/export > run_export.json
```

### Replay run from seed (determinism verification)
```bash
curl -s -X POST http://localhost:8000/api/v1/runs/RUN_ID/replay | jq
```

---

## Interactive Workflow Example

Complete workflow: create → inject event → run → inspect.

```bash
# 1. Create run, capture the ID
RUN_ID=$(curl -s -X POST http://localhost:8000/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "seed": 99,
    "hex_radius": 4,
    "variables": [
      {"name": "health",   "initial_value": 100},
      {"name": "economy",  "initial_value": 50},
      {"name": "green",    "initial_value": 60},
      {"name": "mobility", "initial_value": 40}
    ],
    "spatial_decay": 0.3
  }' | jq -r '.id')

echo "Run ID: $RUN_ID"

# 2. Run 3 ticks
curl -s -X POST http://localhost:8000/api/v1/runs/$RUN_ID/ticks \
  -H "Content-Type: application/json" \
  -d '{"n": 3}' | jq '.current_tick, .global_state'

# 3. Directly alter a tile (queued)
curl -s -X POST http://localhost:8000/api/v1/runs/$RUN_ID/tiles/0/0/alter \
  -H "Content-Type: application/json" \
  -d '{"variable": "economy", "delta": 50.0}' | jq

# 4. Schedule a future event
curl -s -X POST http://localhost:8000/api/v1/runs/$RUN_ID/events \
  -H "Content-Type: application/json" \
  -d '{
    "tick": 6,
    "name": "tax_reform",
    "delta_map": {"economy": -10.0},
    "target_tiles": [[0,0],[1,0],[-1,0]],
    "source": "user"
  }' | jq '.id, .tick'

# 5. Run 5 more ticks (alter fires at tick 4, event fires at tick 6)
curl -s -X POST http://localhost:8000/api/v1/runs/$RUN_ID/ticks \
  -H "Content-Type: application/json" \
  -d '{"n": 5}' | jq '.global_state'

# 6. Check world state
curl -s http://localhost:8000/api/v1/runs/$RUN_ID/state | jq '.global_state, .tick'

# 7. Verify determinism via replay
curl -s -X POST http://localhost:8000/api/v1/runs/$RUN_ID/replay | jq

# 8. Export everything
curl -s http://localhost:8000/api/v1/runs/$RUN_ID/export | jq '.meta'
```

---

---

## Variables (Catalog)

Variables are a **global registry** — they exist independently of any run.
Runs consume variables from this catalog by name.

### Create a variable
```bash
curl -s -X POST http://localhost:8000/api/v1/variables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "education",
    "display_name": "Education Level",
    "description": "Average education score across the tile population.",
    "default_initial_value": 70.0,
    "min_value": 0.0,
    "max_value": 100.0,
    "unit": "index"
  }' | jq
```

### Create a minimal variable (only name + display_name required)
```bash
curl -s -X POST http://localhost:8000/api/v1/variables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "safety",
    "display_name": "Public Safety"
  }' | jq
```

### List all variables
```bash
curl -s http://localhost:8000/api/v1/variables | jq
```

### Get a variable by ID
```bash
curl -s http://localhost:8000/api/v1/variables/VAR_ID | jq
```

### Get a variable by name slug
```bash
curl -s http://localhost:8000/api/v1/variables/by-name/education | jq
```

### Update a variable (PATCH — send only fields you want to change)
```bash
curl -s -X PATCH http://localhost:8000/api/v1/variables/VAR_ID \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Education & Literacy",
    "default_initial_value": 75.0,
    "unit": "score"
  }' | jq
```

### Update only the description
```bash
curl -s -X PATCH http://localhost:8000/api/v1/variables/VAR_ID \
  -H "Content-Type: application/json" \
  -d '{"description": "Composite score of literacy and school enrollment."}' | jq
```

### Delete a variable
```bash
curl -s -X DELETE http://localhost:8000/api/v1/variables/VAR_ID
```

---

## OpenAPI Docs

```bash
# Interactive Swagger UI
open http://localhost:8000/docs

# ReDoc
open http://localhost:8000/redoc

# Raw OpenAPI schema
curl -s http://localhost:8000/openapi.json | jq '.paths | keys'
```
