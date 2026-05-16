@echo off
set RUN_ID=57418687-8a2f-4a62-b693-94371ae0524c

:: ============================================================
:: Hex World Simulation API — Windows curl Reference
:: All commands target http://localhost:8000
:: ============================================================


:: ------------------------------------------------------------
:: Health
:: ------------------------------------------------------------

:: Check server status and database mode
echo.
echo [%TIME%] Check server status and database mode
curl -s http://localhost:8000/health


:: ------------------------------------------------------------
:: Runs
:: ------------------------------------------------------------

:: Create a run (minimal — uses defaults)
echo.
echo [%TIME%] Create a run (minimal — uses defaults)
curl -s -X POST http://localhost:8000/api/v1/runs ^
  -H "Content-Type: application/json" ^
  -d "{\"seed\": 42, \"hex_radius\": 5}" | jq

:: Create a run (fully configured)
echo.
echo [%TIME%] Create a run (fully configured)
curl -s -X POST http://localhost:8000/api/v1/runs ^
  -H "Content-Type: application/json" ^
  -d "{\"seed\": 1337, \"hex_radius\": 8, \"variables\": [{\"name\": \"health\", \"initial_value\": 100.0}, {\"name\": \"economy\", \"initial_value\": 50.0}, {\"name\": \"green\", \"initial_value\": 60.0}, {\"name\": \"mobility\", \"initial_value\": 40.0}], \"spatial_decay\": 0.3, \"diff_snapshots\": true}"

:: Create a run with some variables disabled (null = excluded from run)
echo.
echo [%TIME%] Create a run with some variables disabled (null = excluded from run)
curl -s -X POST http://localhost:8000/api/v1/runs ^
  -H "Content-Type: application/json" ^
  -d "{\"seed\": 42, \"hex_radius\": 5, \"variables\": [{\"name\": \"health\", \"initial_value\": 100.0}, {\"name\": \"economy\", \"initial_value\": 50.0}, {\"name\": \"green\", \"initial_value\": null}, {\"name\": \"mobility\", \"initial_value\": null}], \"spatial_decay\": 0.3}"

:: List all runs (paginated)
echo.
echo [%TIME%] List all runs (paginated)
curl -s "http://localhost:8000/api/v1/runs?limit=20&offset=0"

:: Get a specific run
echo.
echo [%TIME%] Get a specific run
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%

:: Delete a run
:: echo.
:: echo [%TIME%] Delete a run
:: curl -s -X DELETE http://localhost:8000/api/v1/runs/%RUN_ID%


:: ------------------------------------------------------------
:: Simulation Ticks
:: ------------------------------------------------------------

:: Advance one tick
echo.
echo [%TIME%] Advance one tick
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/tick

:: Advance N ticks (e.g., 10)
echo.
echo [%TIME%] Advance N ticks (e.g., 10)
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/ticks ^
  -H "Content-Type: application/json" ^
  -d "{\"n\": 10}"

:: Advance 100 ticks (stress test)
echo.
echo [%TIME%] Advance 100 ticks (stress test)
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/ticks ^
  -H "Content-Type: application/json" ^
  -d "{\"n\": 100}"


:: ------------------------------------------------------------
:: World State
:: ------------------------------------------------------------

:: Get full world state (all tiles + global averages)
echo.
echo [%TIME%] Get full world state (all tiles + global averages)
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/state

:: Get global averages only (requires jq – if installed)
:: curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/state | jq ".global_state"

:: Get specific tile state (e.g., tile at q=0, r=0)
echo.
echo [%TIME%] Get specific tile state (e.g., tile at q=0, r=0)
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/tiles/0/0

:: Get tile at negative coordinates
echo.
echo [%TIME%] Get tile at negative coordinates
curl -s "http://localhost:8000/api/v1/runs/%RUN_ID%/tiles/-2/1"

:: Alter a tile variable (queued for next tick)
echo.
echo [%TIME%] Alter a tile variable (queued for next tick)
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/tiles/0/0/alter ^
  -H "Content-Type: application/json" ^
  -d "{\"variable\": \"health\", \"delta\": -25.0}"

:: Boost a tile's economy
echo.
echo [%TIME%] Boost a tile's economy
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/tiles/1/0/alter ^
  -H "Content-Type: application/json" ^
  -d "{\"variable\": \"economy\", \"delta\": 30.0}"


:: ------------------------------------------------------------
:: Events
:: ------------------------------------------------------------

:: Schedule a single-tile event
echo.
echo [%TIME%] Schedule a single-tile event
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/events ^
  -H "Content-Type: application/json" ^
  -d "{\"tick\": 5, \"name\": \"pollution_crisis\", \"delta_map\": {\"economy\": -20.0, \"green\": -15.0}, \"target_tiles\": [[0, 0]], \"source\": \"AI\"}"

:: Schedule a multi-tile disaster event
echo.
echo [%TIME%] Schedule a multi-tile disaster event
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/events ^
  -H "Content-Type: application/json" ^
  -d "{\"tick\": 10, \"name\": \"earthquake\", \"delta_map\": {\"health\": -40.0, \"mobility\": -30.0}, \"target_tiles\": [[0,0],[1,0],[0,1],[1,-1],[-1,0],[0,-1],[-1,1]], \"source\": \"system\"}"

:: Schedule an AI-generated recovery event
echo.
echo [%TIME%] Schedule an AI-generated recovery event
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/events ^
  -H "Content-Type: application/json" ^
  -d "{\"tick\": 15, \"name\": \"green_initiative\", \"delta_map\": {\"green\": 20.0, \"economy\": 5.0}, \"target_tiles\": [[0,0],[1,0],[0,1]], \"source\": \"AI\"}"

:: List all events for a run
echo.
echo [%TIME%] List all events for a run
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/events


:: ------------------------------------------------------------
:: Snapshots
:: ------------------------------------------------------------

:: List all snapshots (metadata only)
echo.
echo [%TIME%] List all snapshots (metadata only)
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/snapshots

:: Get snapshot at tick 5 (full state or diff)
echo.
echo [%TIME%] Get snapshot at tick 5 (full state or diff)
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/snapshots/5

:: Get initial state (tick 0)
echo.
echo [%TIME%] Get initial state (tick 0)
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/snapshots/0


:: ------------------------------------------------------------
:: Influence Matrix
:: ------------------------------------------------------------

:: Set a runtime influence coefficient
echo.
echo [%TIME%] Set a runtime influence coefficient
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/influence ^
  -H "Content-Type: application/json" ^
  -d "{\"v1\": \"economy\", \"v2\": \"health\", \"coefficient\": 0.15}"

:: Add green → mobility influence
echo.
echo [%TIME%] Add green → mobility influence
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/influence ^
  -H "Content-Type: application/json" ^
  -d "{\"v1\": \"green\", \"v2\": \"mobility\", \"coefficient\": 0.08}"

:: Remove influence (set coefficient to 0)
echo.
echo [%TIME%] Remove influence (set coefficient to 0)
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/influence ^
  -H "Content-Type: application/json" ^
  -d "{\"v1\": \"economy\", \"v2\": \"health\", \"coefficient\": 0.0}"


:: ------------------------------------------------------------
:: Export & Replay
:: ------------------------------------------------------------

:: Export full run as JSON
echo.
echo [%TIME%] Export full run as JSON
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/export

:: Export and save to file
echo.
echo [%TIME%] Export and save to file
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/export > run_export.json

:: Replay run from seed (determinism verification)
echo.
echo [%TIME%] Replay run from seed (determinism verification)
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/replay


:: ------------------------------------------------------------
:: Interactive Workflow Example
:: (assumes a run already exists with RUN_ID set above)
:: ------------------------------------------------------------

:: 1. Run 3 ticks
echo.
echo [%TIME%] 1. Run 3 ticks
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/ticks ^
  -H "Content-Type: application/json" ^
  -d "{\"n\": 3}"

:: 2. Directly alter a tile (queued)
echo.
echo [%TIME%] 2. Directly alter a tile (queued)
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/tiles/0/0/alter ^
  -H "Content-Type: application/json" ^
  -d "{\"variable\": \"economy\", \"delta\": 50.0}"

:: 3. Schedule a future event
echo.
echo [%TIME%] 3. Schedule a future event
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/events ^
  -H "Content-Type: application/json" ^
  -d "{\"tick\": 6, \"name\": \"tax_reform\", \"delta_map\": {\"economy\": -10.0}, \"target_tiles\": [[0,0],[1,0],[-1,0]], \"source\": \"user\"}"

:: 4. Run 5 more ticks (alter fires at tick 4, event fires at tick 6)
echo.
echo [%TIME%] 4. Run 5 more ticks (alter fires at tick 4, event fires at tick 6)
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/ticks ^
  -H "Content-Type: application/json" ^
  -d "{\"n\": 5}"

:: 5. Check world state
echo.
echo [%TIME%] 5. Check world state
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/state

:: 6. Verify determinism via replay
echo.
echo [%TIME%] 6. Verify determinism via replay
curl -s -X POST http://localhost:8000/api/v1/runs/%RUN_ID%/replay

:: 7. Export everything
echo.
echo [%TIME%] 7. Export everything
curl -s http://localhost:8000/api/v1/runs/%RUN_ID%/export


:: ------------------------------------------------------------
:: Variables (Catalog)
:: ------------------------------------------------------------
set VAR_ID=6897a179-9706-4468-ab77-8b3c372551c6

:: Create a variable (fully configured)
echo.
echo [%TIME%] Create a variable (fully configured)
curl -s -X POST http://localhost:8000/api/v1/variables ^
  -H "Content-Type: application/json" ^
  -d "{\"name\": \"education\", \"display_name\": \"Education Level\", \"description\": \"Average education score across the tile population.\", \"default_initial_value\": 70.0, \"min_value\": 0.0, \"max_value\": 100.0, \"unit\": \"index\"}"

:: Create a minimal variable (only name + display_name required)
echo.
echo [%TIME%] Create a minimal variable (only name + display_name required)
curl -s -X POST http://localhost:8000/api/v1/variables ^
  -H "Content-Type: application/json" ^
  -d "{\"name\": \"safety\", \"display_name\": \"Public Safety\"}"

:: List all variables
echo.
echo [%TIME%] List all variables
curl -s http://localhost:8000/api/v1/variables

:: Get a variable by ID
echo.
echo [%TIME%] Get a variable by ID
curl -s http://localhost:8000/api/v1/variables/%VAR_ID%

:: Get a variable by name slug
echo.
echo [%TIME%] Get a variable by name slug
curl -s http://localhost:8000/api/v1/variables/by-name/education

:: Update a variable (PATCH — send only fields you want to change)
echo.
echo [%TIME%] Update a variable (PATCH — send only fields you want to change)
curl -s -X PATCH http://localhost:8000/api/v1/variables/%VAR_ID% ^
  -H "Content-Type: application/json" ^
  -d "{\"display_name\": \"Education ^& Literacy\", \"default_initial_value\": 75.0, \"unit\": \"score\"}"

:: Update only the description
echo.
echo [%TIME%] Update only the description
curl -s -X PATCH http://localhost:8000/api/v1/variables/%VAR_ID% ^
  -H "Content-Type: application/json" ^
  -d "{\"description\": \"Composite score of literacy and school enrollment.\"}"

:: Delete a variable
:: echo.
:: echo [%TIME%] Delete a variable
:: curl -s -X DELETE http://localhost:8000/api/v1/variables/%VAR_ID%


:: ------------------------------------------------------------
:: OpenAPI Docs
:: ------------------------------------------------------------

:: Raw OpenAPI schema
echo.
echo [%TIME%] Raw OpenAPI schema
curl -s http://localhost:8000/openapi.json

:: Open Swagger UI in browser
start http://localhost:8000/docs

:: Open ReDoc in browser
start http://localhost:8000/redoc
