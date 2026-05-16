# EchoGrid integration

EchoGrid calls pest-risk inference via:

- `GET /api/v1/prediction/schema` — required feature columns
- `POST /api/v1/runs/{run_id}/predict-tiles` — batch predict all tiles

Backends (`PREDICTION_BACKEND` in backend `.env`):

| Value | Description |
|-------|-------------|
| `local` | Loads `deployment_bundle/models` via `predict.py` (default) |
| `http` | POST to `PREDICTION_HTTP_URL/predict` (this container) |
| `vertex` | Google Cloud Vertex AI endpoint |

Install ML deps locally: `pip install -r backend/requirements-ml.txt`.

**Docker:** `backend/Dockerfile` installs `requirements-ml.txt` and copies `deployment_bundle/models`.
Build from repo root: `docker compose -f backend/docker-compose.yml build backend`.
