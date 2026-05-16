# Deployment bundle (Vertex AI)

This folder contains everything you need to **copy into another repo** or **zip and ship**:

```
deployment_bundle/
  predict.py                     # Inference (loads models/)
  requirements_inference.txt     # Python deps for predict + image base
  models/                        # Trained artifacts (see checklist below)
  vertex_serving/                # Dockerfile, Flask server, gunicorn entrypoint
```

## Build Docker image

Run from **`deployment_bundle`** (this directory is the build context):

```bash
docker build -t YOUR_IMAGE:TAG -f vertex_serving/Dockerfile .
docker push YOUR_IMAGE:TAG
```

Vertex import / deploy steps: see **`vertex_serving/README.md`**.

## Required files under `models/`

Serving will fail unless these exist:

| File | Purpose |
|------|---------|
| `model_meta.json` | Feature column order, thresholds, labels |
| `scaler.joblib` | Training `StandardScaler` |
| `xgb_model.json` | XGBoost booster |
| `nn_model.pt` | PyTorch MLP weights + architecture |

Optional: `models/predict.py` (duplicate of root `predict.py` for humans only; runtime uses **`/app/predict.py`** from image root.)

If anything is missing, re-run **`pest_risk_models.ipynb`** in your training project so it writes into `models/` again, then refresh this bundle (copy/update `models/*`).

## After moving to another machine

Keep the folder layout unchanged, or edit **`vertex_serving/Dockerfile`** `COPY` paths if your project uses different names.
