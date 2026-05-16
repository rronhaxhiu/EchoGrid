"""Vertex AI-compatible HTTP serving (Flask). See README in this folder."""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pest_vertex_server")


def parse_gcs_uri(uri: str) -> tuple[str, str]:
    """Return (bucket_name, object_prefix_without_leading_but_with_trailing_slash)."""
    if not uri.startswith("gs://"):
        raise ValueError("Not a gs:// URI")
    rest = uri[5:]
    slash = rest.find("/")
    if slash < 0:
        bucket, prefix = rest, ""
    else:
        bucket, prefix = rest[:slash], rest[slash + 1 :]
    bucket = bucket.strip()
    prefix = prefix.strip("/")
    if prefix:
        prefix_norm = prefix + "/"
    else:
        prefix_norm = ""
    return bucket, prefix_norm


def _download_gs_directory(gs_uri: str, dst: Path) -> None:
    from google.cloud import storage

    bucket_name, prefix = parse_gcs_uri(gs_uri)

    if not prefix:
        raise ValueError(
            "GCS artifact URI must include an object prefix (e.g. gs://bucket/dir/), "
            "not only a bucket."
        )

    dst.mkdir(parents=True, exist_ok=True)
    client = storage.Client()
    blobs = list(client.list_blobs(bucket_name, prefix=prefix))

    if not blobs:
        raise RuntimeError(f"No objects under gs://{bucket_name}/{prefix}")

    for blob in blobs:
        if blob.name.endswith("/"):
            continue
        assert blob.name.startswith(prefix), blob.name
        rel = blob.name[len(prefix) :].lstrip("/")
        out_file = dst / rel
        out_file.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(out_file))


def _prepare_models_dir() -> Path:
    if os.environ.get("PEST_MODEL_DIR"):
        return Path(os.environ["PEST_MODEL_DIR"]).resolve()

    aip_uri = (os.environ.get("AIP_STORAGE_URI") or "").strip()
    if aip_uri.startswith("gs://"):
        dest_env = os.environ.get("VERTEX_MODEL_DOWNLOAD_DIR")
        force = os.environ.get("VERTEX_FORCE_DOWNLOAD", "") == "1"

        dest = Path(dest_env).resolve() if dest_env else Path(tempfile.mkdtemp(prefix="vertex_models_"))
        marker = dest / "model_meta.json"

        if marker.exists() and not force:
            log.info("Reusing artifact directory %s", dest)
            return dest

        if dest.exists() and force:
            shutil.rmtree(dest)
        dest.mkdir(parents=True, exist_ok=True)
        log.info("Downloading artifacts from %s -> %s", aip_uri, dest)
        _download_gs_directory(aip_uri, dest)
        return dest

    bundled = Path("/app/models").resolve()
    if (bundled / "model_meta.json").exists():
        return bundled

    raise FileNotFoundError(
        "Artifacts not found. Bake into /app/models, use Vertex artifactUri (+ "
        "AIP_STORAGE_URI), or set PEST_MODEL_DIR."
    )


# Resolve artifacts before importing predict (uses PEST_MODEL_DIR)
_ARTIFACT_ROOT = _prepare_models_dir()
os.environ["PEST_MODEL_DIR"] = str(_ARTIFACT_ROOT.resolve())

import predict as predict_module  # noqa: E402

predict_module._ARTIFACT_CACHE.clear()

_application = Flask(__name__)

_PREDICT_ROUTE = os.environ.get("AIP_PREDICT_ROUTE") or "/predict"
_HEALTH_ROUTE = os.environ.get("AIP_HEALTH_ROUTE") or "/health"

if ":" in _PREDICT_ROUTE.split("/")[-1]:
    log.warning(
        "AIP_PREDICT_ROUTE contains ':' (%s); set Model container routes to "
        "/predict and /health in Vertex to avoid Flask routing quirks.",
        _PREDICT_ROUTE,
    )


@_application.route(_HEALTH_ROUTE, methods=["GET"])
def health():
    try:
        predict_module._load_pack(_ARTIFACT_ROOT.resolve())
        return jsonify({"status": "healthy"}), 200
    except Exception as exc:
        log.warning("health check failed: %s", exc)
        return jsonify({"status": "unhealthy", "detail": str(exc)}), 503


@_application.route(_PREDICT_ROUTE, methods=["POST"])
def predict_vertex():
    try:
        meta = predict_module._load_pack(_ARTIFACT_ROOT.resolve())["meta"]
        cols = list(meta["feature_columns"])
    except Exception as exc:
        return jsonify({"error": "model_not_loaded", "detail": str(exc)}), 503

    body = request.get_json(force=True, silent=False)
    instances = None
    if isinstance(body, dict):
        instances = body.get("instances")

    if not isinstance(instances, list) or len(instances) == 0:
        return jsonify({"error": "Expected non-empty JSON 'instances' array"}), 400

    errs = []
    for idx, row in enumerate(instances):
        if not isinstance(row, dict):
            errs.append({"index": idx, "error": "instance must be a JSON object"})
            continue
        missing = sorted(set(cols) - set(row.keys()))
        if missing:
            errs.append({"index": idx, "missing_keys": missing})

    if errs:
        return jsonify({"error": "invalid_instances", "details": errs}), 400

    preds = predict_module.predict(instances, model_dir=_ARTIFACT_ROOT.resolve())
    if not isinstance(preds, list):
        preds = [preds]

    if len(preds) != len(instances):
        return jsonify({"error": "prediction_length_mismatch"}), 500

    return jsonify({"predictions": preds}), 200


if _PREDICT_ROUTE.rstrip("/") != "/predict":
    _application.add_url_rule(
        "/predict",
        endpoint="predict_local_compat",
        view_func=predict_vertex,
        methods=["POST"],
    )

if _HEALTH_ROUTE.rstrip("/") != "/health":
    _application.add_url_rule(
        "/health",
        endpoint="health_local_compat",
        view_func=health,
        methods=["GET"],
    )


application = _application

if __name__ == "__main__":
    application.run(
        host="0.0.0.0",
        port=int(os.environ.get("AIP_HTTP_PORT", "8080")),
        threaded=True,
    )
