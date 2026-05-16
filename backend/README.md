# Hex World Simulation Backend

A production-grade, deterministic, tile-based world simulation system built with Python and FastAPI.

## 🌍 Overview

This system simulates a 2D hexagonal grid world where each tile contains a set of dynamic variables (e.g., health, economy, education). The simulation advances in discrete ticks, processing events, internal tile dynamics (influence matrix), and spatial propagation across neighbors.

### Key Features

- **Hexagonal Grid**: Uses an axial (q, r) coordinate system for efficient spatial operations.
- **Variable Catalog**: A global registry of variables (CRUD) that can be used across different simulation runs.
- **Full Determinism**: Given the same seed and event sequence, the simulation produces identical results every time.
- **Influence Matrix**: Defines how variables within a single tile affect each other (e.g., `economy` ↑ → `health` ↑).
- **Spatial Propagation**: Simulates the spread of effects to neighboring tiles with configurable decay.
- **Event System**: Schedule mutations at specific ticks for targeted regions.
- **Snapshots & Replay**: Supports diff-based snapshots for efficiency and full deterministic replay for verification.

---

## 🏗️ Architecture

The project follows **Clean Architecture** principles to ensure separation of concerns and testability:

- **Domain Layer (`src/domain/`)**: Pure state containers and business logic (Tile, World, Variable, Event, Influence). No dependencies on external frameworks.
- **Application Layer (`src/application/`)**: Orchestration logic (SimulationEngine, PropagationEngine, WorldInitializer).
- **Infrastructure Layer (`src/infrastructure/`)**: Persistence (PostgreSQL with SQLAlchemy), serialization, and external integrations.
- **API Layer (`src/api/`)**: Framework-specific entry points (FastAPI routes, Pydantic schemas).

---

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Python 3.12+ (if running locally)

### Running with Docker (Recommended)

The easiest way to get started is using Docker Compose, which sets up the FastAPI backend and a PostgreSQL 16 database.

```bash
cd backend
cp .env.example .env
docker compose up --build
```

The API will be available at `http://localhost:8000`.

The backend image installs `requirements-ml.txt` (PyTorch, XGBoost) and copies `deployment_bundle/models` for local pest-risk prediction. Dev compose also mounts `../deployment_bundle` read-only.

### Running Locally

You can run the backend locally while connecting to the PostgreSQL instance running in Docker.

1. **Start only the database**:
   ```bash
   docker compose up -d postgres
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # The default DATABASE_URL in .env.example points to localhost:5432
   ```

3. **Verify connection**:
   ```bash
   python scripts/check_db.py
   ```

4. **Run the server**:
   ```bash
   uvicorn main:app --reload
   ```

---

## 📖 API Documentation

- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **CURL Examples**: See [CURLS.md](./CURLS.md) for a comprehensive list of commands for every endpoint.

### Core Endpoints

- `GET /api/v1/variables`: Manage the global variable catalog.
- `POST /api/v1/runs`: Create a new simulation run.
- `POST /api/v1/runs/{id}/tick`: Advance the simulation.
- `GET /api/v1/runs/{id}/state`: Inspect the world state.
- `POST /api/v1/runs/{id}/events`: Schedule events.

---

## 🧪 Testing & Examples

A minimal runnable example is provided to demonstrate the core simulation engine without requiring a database or API:

```bash
python -m examples.minimal_example
```

---

## 🛠️ Tech Stack

- **FastAPI**: High-performance web framework.
- **SQLAlchemy 2.0**: Async ORM for PostgreSQL.
- **Alembic**: Database migrations.
- **Pydantic v2**: Data validation and settings management.
- **PostgreSQL 16**: Primary persistence layer.
- **Docker**: Containerization.
