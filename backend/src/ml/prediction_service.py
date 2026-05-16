"""
Pest-risk prediction: local bundle, HTTP container, or Vertex AI endpoint.
"""
from __future__ import annotations

import json
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

import httpx

from ..config import settings
from . import pest_predictor

ModelChoice = Literal["xgb", "nn", "both"]


class PredictionBackend(str, Enum):
    LOCAL = "local"
    HTTP = "http"
    VERTEX = "vertex"


class PredictionService:
    def get_schema(self) -> Dict[str, Any]:
        err = pest_predictor.check_ml_dependencies()
        if err and settings.prediction_backend == PredictionBackend.LOCAL.value:
            return {
                "available": False,
                "error": err,
                "feature_columns": [],
                "target": "pest_risk",
                "class_names": [],
            }
        try:
            meta = pest_predictor.get_meta()
            return {
                "available": True,
                "feature_columns": meta["feature_columns"],
                "target": meta.get("target", "pest_risk"),
                "class_names": meta.get("class_names", []),
                "label_encoding": meta.get("label_encoding", {}),
                "backend": settings.prediction_backend,
            }
        except Exception as exc:
            return {
                "available": False,
                "error": str(exc),
                "feature_columns": [],
                "target": "pest_risk",
                "class_names": [],
            }

    def health(self) -> Dict[str, Any]:
        if settings.prediction_backend == PredictionBackend.HTTP.value:
            url = f"{settings.prediction_http_url.rstrip('/')}/health"
            try:
                r = httpx.get(url, timeout=10.0)
                return {"status": "ok" if r.status_code == 200 else "degraded", "backend": "http", "detail": r.json()}
            except Exception as exc:
                return {"status": "unhealthy", "backend": "http", "detail": str(exc)}

        if settings.prediction_backend == PredictionBackend.VERTEX.value:
            return {
                "status": "configured",
                "backend": "vertex",
                "endpoint": settings.vertex_endpoint_id,
            }

        err = pest_predictor.check_ml_dependencies()
        if err:
            return {"status": "unhealthy", "backend": "local", "detail": err}
        try:
            pest_predictor.get_meta()
            return {"status": "healthy", "backend": "local"}
        except Exception as exc:
            return {"status": "unhealthy", "backend": "local", "detail": str(exc)}

    def predict_instances(
        self,
        instances: List[Dict[str, float]],
        *,
        strict: bool = True,
    ) -> Dict[str, Any]:
        meta = pest_predictor.get_meta()
        cols: List[str] = meta["feature_columns"]
        errors: List[Dict[str, Any]] = []

        cleaned: List[Dict[str, float]] = []
        for idx, row in enumerate(instances):
            missing = sorted(set(cols) - set(row.keys()))
            if missing:
                errors.append({"index": idx, "missing_keys": missing})
                if strict:
                    continue
            cleaned.append({c: float(row.get(c, 0.0)) for c in cols})

        if strict and errors:
            return {"predictions": [], "errors": errors}

        if not cleaned:
            return {"predictions": [], "errors": errors}

        raw = self._invoke_predict(cleaned)
        return {"predictions": raw, "errors": errors}

    def predict_tiles(
        self,
        tiles: Dict[str, Dict[str, float]],
        *,
        model: ModelChoice = "nn",
        write_to_tiles: bool = False,
        strict: bool = False,
        fill_missing: float = 0.0,
        variable_specs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        meta = pest_predictor.get_meta()
        cols: List[str] = meta["feature_columns"]
        tile_keys = list(tiles.keys())

        instances: List[Dict[str, float]] = []
        tile_errors: Dict[str, List[str]] = {}

        for key in tile_keys:
            inst, missing = pest_predictor.tile_to_instance(
                tiles[key], cols, fill_missing=fill_missing
            )
            if missing and strict:
                tile_errors[key] = missing
                continue
            if variable_specs:
                inst = self._sanitize_instance(inst, variable_specs)
            instances.append(inst)

        if strict and tile_errors:
            return {
                "predictions": {},
                "tile_errors": tile_errors,
                "tiles_predicted": 0,
                "tiles_skipped": len(tile_errors),
            }

        if not instances:
            return {
                "predictions": {},
                "tile_errors": tile_errors,
                "tiles_predicted": 0,
                "tiles_skipped": len(tile_keys),
            }

        raw_preds = self._invoke_predict(instances)
        # Map back to tiles that were included (non-strict skips removed from instances)
        pred_keys = [k for k in tile_keys if k not in tile_errors]
        predictions: Dict[str, Any] = {}
        for key, pred in zip(pred_keys, raw_preds):
            predictions[key] = self._format_prediction(pred, model)
            if write_to_tiles:
                self._apply_prediction_to_tile(tiles[key], pred, model)

        return {
            "predictions": predictions,
            "tile_errors": tile_errors,
            "tiles_predicted": len(predictions),
            "tiles_skipped": len(tile_errors),
        }

    def _invoke_predict(self, instances: List[Dict[str, float]]) -> List[Dict[str, Any]]:
        backend = settings.prediction_backend

        if backend == PredictionBackend.HTTP.value:
            url = f"{settings.prediction_http_url.rstrip('/')}/predict"
            body = {"instances": instances, "parameters": {}}
            r = httpx.post(url, json=body, timeout=120.0)
            r.raise_for_status()
            data = r.json()
            preds = data.get("predictions", [])
            if len(preds) != len(instances):
                raise RuntimeError("prediction_length_mismatch from HTTP backend")
            return preds

        if backend == PredictionBackend.VERTEX.value:
            return self._predict_vertex(instances)

        err = pest_predictor.check_ml_dependencies()
        if err:
            raise RuntimeError(err)
        return pest_predictor.predict_batch(instances)

    def _predict_vertex(self, instances: List[Dict[str, float]]) -> List[Dict[str, Any]]:
        try:
            from google.cloud import aiplatform
        except ImportError as exc:
            raise RuntimeError(
                "google-cloud-aiplatform required for vertex backend. "
                "pip install google-cloud-aiplatform"
            ) from exc

        aiplatform.init(
            project=settings.vertex_project,
            location=settings.vertex_location,
        )
        endpoint = aiplatform.Endpoint(settings.vertex_endpoint_id)
        response = endpoint.predict(instances=instances)
        preds = response.predictions
        # Vertex may return list of dicts or nested structures
        out: List[Dict[str, Any]] = []
        for p in preds:
            if isinstance(p, dict):
                out.append(p)
            elif isinstance(p, str):
                out.append(json.loads(p))
            else:
                out.append(dict(p))
        return out

    @staticmethod
    def _sanitize_instance(
        inst: Dict[str, float],
        variable_specs: Dict[str, Any],
    ) -> Dict[str, float]:
        """Clamp and round feature values according to variable_specs before inference."""
        result = dict(inst)
        for col, val in result.items():
            spec = variable_specs.get(col)
            if not spec:
                continue
            # spec may be a dict (from JSON/DB) or a VariableSpec model instance
            if hasattr(spec, "min_value"):
                min_v, max_v, is_int = spec.min_value, spec.max_value, spec.is_integer
            else:
                min_v = spec.get("min_value")
                max_v = spec.get("max_value")
                is_int = spec.get("is_integer", False)
            if min_v is not None:
                val = max(float(min_v), val)
            if max_v is not None:
                val = min(float(max_v), val)
            if is_int:
                val = float(round(val))
            result[col] = val
        return result

    @staticmethod
    def _format_prediction(raw: Dict[str, Any], model: ModelChoice) -> Dict[str, Any]:
        if model == "both":
            return raw
        branch = raw.get(model, raw)
        return {
            "label": branch.get("label"),
            "probability_medium": branch.get("probability_medium"),
            "model": model,
        }

    @staticmethod
    def _apply_prediction_to_tile(
        tile_vars: Dict[str, float],
        raw: Dict[str, Any],
        model: ModelChoice,
    ) -> None:
        if "xgb" in raw:
            tile_vars["pest_risk_label_xgb"] = (
                1.0 if raw["xgb"].get("label") == "Medium" else 0.0
            )


prediction_service = PredictionService()
