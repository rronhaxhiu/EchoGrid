# Deploy pest-risk models on Vertex AI (custom container)

This folder packages **XGBoost + PyTorch** inference from `/app/models/` (copied into the image at build time).

You can alternatively upload artifacts to Cloud Storage only and omit `COPY models`; in that case set **Model artifactUri** when importing the Vertex **Model**, and Vertex will set **`AIP_STORAGE_URI`** so the container downloads blobs at startup via **Application Default Credentials**.

## Prerequisites

- Google Cloud project, billing enabled, Vertex AI API enabled.
- Artifact Registry Docker repository **in the same region** where you deploy the endpoint ([docs](https://docs.cloud.google.com/vertex-ai/docs/predictions/custom-container-requirements#container_image)).
- `gcloud` + `docker` configured for your workstation.

Recommended Python deps mirror `requirements_inference.txt` + server extras (handled in Dockerfile).

## 1) Recommended Vertex route configuration

When you **upload/import the Model** in Vertex, set **`health_route`** = `/health` and **`predict_route`** = `/predict`, and **`ports`** = `[8080]`. Vertex will set `AIP_HEALTH_ROUTE`, `AIP_PREDICT_ROUTE`, and `AIP_HTTP_PORT` accordingly.

Avoid default paths that end with `:predict` if you rely on Flask’s URL dispatcher; this server exposes `/predict` and `/health` by default for local debugging and exposes an **extra alias** `/predict` when Vertex uses a longer path—but you should prefer explicit `/predict` in the Model spec.

## 2) Build and push image

Replace placeholders (`PROJECT`, `REGION`, `REPO`, `IMAGE`).

```bash
cd /path/to/deployment_bundle

REGION=us-central1
PROJECT=YOUR_PROJECT_ID
REPO=vertex-docker
IMAGE=pest-risk-models

IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT/$REPO/$IMAGE:latest"

gcloud auth configure-docker "$REGION-docker.pkg.dev"

docker build -t "$IMAGE_URI" -f vertex_serving/Dockerfile .
docker push "$IMAGE_URI"
```

## 3) Create Vertex Model resource

Use **`gcloud ai models upload`** or the Cloud Console:

- Container image URI: your pushed image digest or tag (prefer digest for production).
- **Artifact URI** optional if models are baked into the image (`/app/models`). If provided, Vertex copies files to managed GCS and sets **`AIP_STORAGE_URI`**; the server pulls them unless you also baked static weights (choose one workflow to avoid confusion).
- Ports: **`8080`**
- **predict_route**: `/predict`
- **health_route**: `/health`

## 4) Deploy to Endpoint (online predictions)

Provision an **endpoint** (if needed), then **deployModel** with your machine type (`n1-standard-4` CPU is often enough).

Set **minimum replica count ≥ 1** if you require low cold-start latency for “real-time” workloads.

Example (structure only—adjust IDs and quota):

```bash
ENDPOINT_ID=YOUR_ENDPOINT_NUMBER
MODEL_ID=YOUR_MODEL_NUMBER

gcloud ai endpoints deploy-model "$ENDPOINT_ID" \
  --region="$REGION" \
  --project="$PROJECT" \
  --model="$MODEL_ID" \
  --display-name=pest-risk-prod \
  --machine-type=n1-standard-4 \
  --min-replica-count=1 \
  --max-replica-count=3 \
  --traffic-percentage=100
```

## 5) Request format (Vertex Predict API)

Clients call Vertex **projects.locations.endpoints.predict**. The JSON body forwarded to your container follows:

```json
{
  "instances": [
    {
      "temperature": 23.16,
      "humidity": 59.08,
      "rainfall": 0.0,
      "... each key in model_meta.json feature_columns ...": null
    }
  ],
  "parameters": {}
}
```

Each row must include **every** raw feature column name listed in **`models/model_meta.json` → `feature_columns`**.

Response envelope from the container:

```json
{
  "predictions": [
    {
      "xgb": { "label": "Low", "probability_medium": 0.12 },
      "nn": { "label": "Low", "probability_medium": 0.08 }
    }
  ]
}
```

## 6) Local smoke test (Docker)

```bash
docker run --rm -p 8080:8080 IMAGE_URI

curl -s -X POST localhost:8080/predict \
  -H 'Content-Type: application/json' \
  -d '{"instances":[{"temperature":23.16,...}]}'
```

(Fill full feature dictionary from `model_meta.json`.)

## 7) Operational notes

- **GPU**: optional; this MLP is small and usually runs well on CPU.
- **Concurrency**: Tune `gunicorn` `--workers` / `--threads` via env `GUNICORN_WORKERS`, `GUNICORN_THREADS`, `GUNICORN_TIMEOUT_SEC`.
- **`USER nobody`**: If your environment cannot read bundled files as `nobody`, remove the `USER` line in Dockerfile (less ideal for prod hardening).

## Files

| File | Role |
|------|------|
| `Dockerfile` | Builds serving image (`server:application` via gunicorn) |
| `server.py` | Flask app; reads `AIP_*`, implements `/predict`-style Vertex contract |
| `entrypoint.sh` | Runs gunicorn on `AIP_HTTP_PORT` |
| `requirements_vertex_server.txt` | Flask, gunicorn, `google-cloud-storage` |
