"""
Production inference for pest_risk models (XGBoost + PyTorch MLP).

After training, `models/` contains scaler.joblib, xgb_model.json, nn_model.pt, model_meta.json.

Set `PEST_MODEL_DIR` to override the default directory (`./models/` next to this file).

Usage:
    from predict import predict
    predict({"temperature": 23.16, ...})  # dict with all keys from model_meta.feature_columns
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Sequence, Union

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import xgboost as xgb

ModelInput = Union[Dict[str, float], Sequence[Dict[str, float]], np.ndarray]

_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _artifacts_dir() -> Path:
    env = os.environ.get("PEST_MODEL_DIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve().parent
    if (here / "model_meta.json").exists():
        return here
    return here / "models"


_ARTIFACT_CACHE: Dict[str, Any] = {}


class MLP(nn.Module):
    """Architecture must match training notebook (+ saved state_dict keys `net.*`)."""

    def __init__(
        self,
        input_dim: int,
        hidden: tuple[int, ...] | list[int],
        dropout: float = 0.3,
    ):
        super().__init__()
        layers = []
        prev = input_dim
        for h in hidden:
            h = int(h)
            layers.extend(
                [
                    nn.Linear(prev, h),
                    nn.BatchNorm1d(h),
                    nn.ReLU(inplace=True),
                    nn.Dropout(p=dropout),
                ]
            )
            prev = h
        layers.append(nn.Linear(prev, 1))
        self.net = nn.Sequential(*layers)

    def forward(self, x):  # noqa: D102
        return self.net(x).squeeze(-1)


def _load_pack(root: Path) -> Dict[str, Any]:
    if str(root) in _ARTIFACT_CACHE:
        return _ARTIFACT_CACHE[str(root)]

    with open(root / "model_meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)

    scaler = joblib.load(root / "scaler.joblib")
    booster = xgb.XGBClassifier()
    booster.load_model(str(root / "xgb_model.json"))

    nn_bundle = torch.load(root / "nn_model.pt", map_location=_DEVICE)
    cfg = nn_bundle["nn_config"]

    nn_model = MLP(
        input_dim=int(cfg["input_dim"]),
        hidden=list(cfg["hidden_sizes"]),
        dropout=float(cfg.get("dropout", 0.3)),
    ).to(_DEVICE)
    nn_model.load_state_dict(nn_bundle["model_state_dict"])
    nn_model.eval()

    pack = {
        "meta": meta,
        "scaler": scaler,
        "xgb": booster,
        "nn": nn_model,
        "nn_thresh": float(nn_bundle.get("threshold", 0.5)),
    }
    _ARTIFACT_CACHE[str(root)] = pack
    return pack


def predict(
    input_batch: ModelInput,
    model_dir: Path | None = None,
) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Run both models.

    Dict: one row. List of dicts or ndarray: multiple rows.

    Probability field is `probability_medium` (P(pestrisk=Medium)).
    """
    root = model_dir if model_dir is not None else _artifacts_dir()
    pack = _load_pack(root.resolve())
    meta = pack["meta"]
    names: List[str] = meta["feature_columns"]
    class_names: List[str] = meta["class_names"]

    thresh_xgb = float(meta.get("threshold_xgb", 0.5))
    thresh_nn = float(pack["nn_thresh"])
    single = False

    if isinstance(input_batch, dict):
        X = np.array([[float(input_batch[k]) for k in names]], dtype=np.float32)
        single = True
    elif isinstance(input_batch, np.ndarray):
        X = np.asarray(input_batch, dtype=np.float32)
        if X.ndim == 1:
            X = X.reshape(1, -1)
            single = True
    else:
        rows = list(input_batch)
        if not rows:
            return []
        X = np.array([[float(r[k]) for k in names] for r in rows], dtype=np.float32)

    Xs = pack["scaler"].transform(pd.DataFrame(X, columns=names))

    proba_xgb = pack["xgb"].predict_proba(Xs)[:, 1]
    labels_xgb = (proba_xgb >= thresh_xgb).astype(int)

    with torch.no_grad():
        t = torch.from_numpy(Xs).to(_DEVICE)
        logits = pack["nn"](t)
        proba_nn = torch.sigmoid(logits).detach().cpu().numpy().reshape(-1)
    labels_nn = (proba_nn >= thresh_nn).astype(int)

    def row_out(px: float, lx: int, pn: float, ln: int) -> Dict[str, Any]:
        return {
            "xgb": {
                "label": class_names[int(lx)],
                "probability_medium": round(float(px), 6),
            },
            "nn": {
                "label": class_names[int(ln)],
                "probability_medium": round(float(pn), 6),
            },
        }

    out = [
        row_out(proba_xgb[i], labels_xgb[i], proba_nn[i], labels_nn[i])
        for i in range(len(X))
    ]
    return out[0] if single else out


def main():
    predict_root = _artifacts_dir()
    if not predict_root.joinpath("model_meta.json").exists():
        print("Missing artifacts; train the notebook first. Expected:", predict_root)
        return
    _load_pack(predict_root)
    print("OK — artifacts readable from:", predict_root.resolve())


if __name__ == "__main__":
    main()
