"""
Bridge to deployment_bundle/predict.py (XGBoost + PyTorch MLP).

Resolves artifacts from PEST_MODEL_DIR or <repo>/deployment_bundle/models.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

def _resolve_bundle_root() -> Path:
    """Monorepo dev (repo root) or Docker (/app/deployment_bundle)."""
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "deployment_bundle",
        here.parents[2] / "deployment_bundle",
        Path("/app/deployment_bundle"),
    ]
    for path in candidates:
        if (path / "predict.py").is_file() or (path / "models" / "model_meta.json").is_file():
            return path.resolve()
    return (here.parents[3] / "deployment_bundle").resolve()


_BUNDLE_ROOT = _resolve_bundle_root()
_DEFAULT_MODEL_DIR = _BUNDLE_ROOT / "models"


def bundle_model_dir() -> Path:
    try:
        from ..config import settings

        if settings.pest_model_dir:
            return Path(settings.pest_model_dir).resolve()
    except Exception:
        pass
    env = os.environ.get("PEST_MODEL_DIR")
    if env:
        return Path(env).resolve()
    for candidate in (_DEFAULT_MODEL_DIR, _BUNDLE_ROOT / "models"):
        if (candidate / "model_meta.json").is_file():
            return candidate.resolve()
    return _DEFAULT_MODEL_DIR.resolve()


def _ensure_predict_importable() -> None:
    bundle = _BUNDLE_ROOT
    if not bundle.is_dir():
        raise FileNotFoundError(
            f"deployment_bundle not found at {bundle}. "
            "Add deployment_bundle/ to the repo root or set PEST_MODEL_DIR."
        )
    bundle_str = str(bundle)
    if bundle_str not in sys.path:
        sys.path.insert(0, bundle_str)


def get_meta() -> Dict[str, Any]:
    import json

    meta_path = bundle_model_dir() / "model_meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"model_meta.json not found at {meta_path}")
    with open(meta_path, encoding="utf-8") as f:
        return json.load(f)


def predict_batch(
    instances: List[Dict[str, float]],
    model_dir: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """Run pest risk models on a list of feature dicts."""
    _ensure_predict_importable()
    import predict as pest_predict  # type: ignore[import-not-found]

    root = model_dir or bundle_model_dir()
    os.environ["PEST_MODEL_DIR"] = str(root)
    pest_predict._ARTIFACT_CACHE.clear()

    if not instances:
        return []

    result = pest_predict.predict(instances, model_dir=root)
    if isinstance(result, dict):
        return [result]
    return list(result)


def tile_to_instance(
    tile_variables: Dict[str, float],
    feature_columns: List[str],
    *,
    fill_missing: float = 0.0,
) -> tuple[Dict[str, float], List[str]]:
    """Build model input from tile variables; return (instance, missing_keys)."""
    missing = [c for c in feature_columns if c not in tile_variables]
    instance = {
        c: float(tile_variables[c]) if c in tile_variables else fill_missing
        for c in feature_columns
    }
    return instance, missing


def check_ml_dependencies() -> Optional[str]:
    """Return error message if ML stack cannot be imported."""
    try:
        import joblib  # noqa: F401
        import pandas  # noqa: F401
        import torch  # noqa: F401
        import xgboost  # noqa: F401
    except ImportError as exc:
        return (
            f"ML dependencies not installed ({exc}). "
            "Run: pip install -r requirements-ml.txt"
        )
    model_dir = bundle_model_dir()
    if not (model_dir / "model_meta.json").is_file():
        return f"Model artifacts missing at {model_dir}"
    return None
