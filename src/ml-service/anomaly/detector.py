"""
anomaly/detector.py — Real-Time Vital Signs Anomaly Detection
-------------------------------------------------------------
Combines an IsolationForest model (unsupervised) with a clinical
rule engine to flag out-of-range vitals.

Usage:
    from anomaly.detector import AnomalyDetector
    detector = AnomalyDetector()
    result = detector.detect({"heart_rate": 155, "systolic_bp": 185, "spo2": 90})
"""

import os
import pickle
import logging
import numpy as np
from pathlib import Path
from typing import Any, Dict, List, Optional

from sklearn.ensemble import IsolationForest

logger = logging.getLogger("nalam.anomaly")

# ── Paths ────────────────────────────────────────────────────────────────────
_MODEL_PATH = Path(__file__).parent / "anomaly_model.pkl"

# ── Clinical Threshold Rules ─────────────────────────────────────────────────
# Each rule: (feature, operator, threshold, severity, label)
_RULES: List[Dict[str, Any]] = [
    {"feature": "sys",          "op": ">", "threshold": 180, "severity": "critical",  "label": "Hypertensive Crisis"},
    {"feature": "sys",          "op": ">", "threshold": 140, "severity": "warning",   "label": "Elevated Systolic BP"},
    {"feature": "dia",          "op": ">", "threshold": 110, "severity": "critical",  "label": "Hypertensive Crisis (Diastolic)"},
    {"feature": "dia",          "op": ">", "threshold": 90,  "severity": "warning",   "label": "Elevated Diastolic BP"},
    {"feature": "heart_rate",   "op": ">", "threshold": 120, "severity": "critical",  "label": "Tachycardia"},
    {"feature": "heart_rate",   "op": ">", "threshold": 100, "severity": "warning",   "label": "Elevated Heart Rate"},
    {"feature": "heart_rate",   "op": "<", "threshold": 45,  "severity": "critical",  "label": "Bradycardia"},
    {"feature": "heart_rate",   "op": "<", "threshold": 60,  "severity": "warning",   "label": "Low Heart Rate"},
    {"feature": "spo2",         "op": "<", "threshold": 92,  "severity": "critical",  "label": "Severe Hypoxemia"},
    {"feature": "spo2",         "op": "<", "threshold": 95,  "severity": "warning",   "label": "Low Oxygen Saturation"},
    {"feature": "temp",         "op": ">", "threshold": 39.0,"severity": "critical",  "label": "High Fever"},
    {"feature": "temp",         "op": ">", "threshold": 37.5,"severity": "warning",   "label": "Low-Grade Fever"},
    {"feature": "temp",         "op": "<", "threshold": 35.0,"severity": "critical",  "label": "Hypothermia"},
    {"feature": "resp",         "op": ">", "threshold": 30,  "severity": "critical",  "label": "Severe Tachypnea"},
    {"feature": "resp",         "op": ">", "threshold": 25,  "severity": "warning",   "label": "Elevated Respiratory Rate"},
    {"feature": "resp",         "op": "<", "threshold": 8,   "severity": "critical",  "label": "Severe Bradypnea"},
    {"feature": "resp",         "op": "<", "threshold": 10,  "severity": "warning",   "label": "Low Respiratory Rate"},
]

# ── Feature ordering for IsolationForest ─────────────────────────────────────
_FEATURE_NAMES = ["heart_rate", "sys", "dia", "spo2", "temp", "resp"]

# ── Normal ranges for synthetic training data ─────────────────────────────────
_NORMAL_RANGES = {
    "heart_rate":   (60, 100),
    "sys":          (90, 130),
    "dia":          (60, 85),
    "spo2":         (96, 100),
    "temp":         (36.0, 37.5),
    "resp":         (12, 20),
}


def _check_rule(value: float, op: str, threshold: float) -> bool:
    if op == ">":  return value > threshold
    if op == "<":  return value < threshold
    if op == ">=": return value >= threshold
    if op == "<=": return value <= threshold
    return False


class AnomalyDetector:
    """Thread-safe singleton-friendly anomaly detector."""

    def __init__(self, contamination: float = 0.05, n_estimators: int = 100):
        self._model: Optional[IsolationForest] = None
        self._contamination = contamination
        self._n_estimators = n_estimators
        self._load_or_train()

    # ── Model lifecycle ───────────────────────────────────────────────────────

    def _load_or_train(self) -> None:
        if _MODEL_PATH.exists():
            try:
                with open(_MODEL_PATH, "rb") as f:
                    self._model = pickle.load(f)
                logger.info("Loaded anomaly model from %s", _MODEL_PATH)
                return
            except Exception as e:
                logger.warning("Failed to load model, retraining: %s", e)
        self._train_and_save()

    def _train_and_save(self) -> None:
        """Fit IsolationForest on synthetic normal vital-signs distribution."""
        logger.info("Training IsolationForest on synthetic normal vitals…")
        rng = np.random.default_rng(42)
        n_samples = 2000
        data = np.column_stack([
            rng.normal(75, 10, n_samples).clip(*_NORMAL_RANGES["heart_rate"]),
            rng.normal(115, 12, n_samples).clip(*_NORMAL_RANGES["sys"]),
            rng.normal(75, 8, n_samples).clip(*_NORMAL_RANGES["dia"]),
            rng.normal(98, 1, n_samples).clip(*_NORMAL_RANGES["spo2"]),
            rng.normal(36.8, 0.4, n_samples).clip(*_NORMAL_RANGES["temp"]),
            rng.normal(16, 2, n_samples).clip(*_NORMAL_RANGES["resp"]),
        ])
        self._model = IsolationForest(
            n_estimators=self._n_estimators,
            contamination=self._contamination,
            random_state=42,
        )
        self._model.fit(data)
        _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_MODEL_PATH, "wb") as f:
            pickle.dump(self._model, f)
        logger.info("Anomaly model trained and saved to %s", _MODEL_PATH)

    # ── Detection ─────────────────────────────────────────────────────────────

    def detect(self, vitals: Dict[str, Any]) -> Dict[str, Any]:
        """
        Args:
            vitals: dict with optional keys from _FEATURE_NAMES

        Returns:
            {
              is_anomaly: bool,
              score: float,          # [0,1] — higher = more anomalous
              severity: str,         # "normal" | "warning" | "critical"
              flags: [...],          # rule violations
              ml_flagged: bool,      # IsolationForest verdict
            }
        """
        # 1. Rule engine
        flags: List[Dict[str, Any]] = []
        for rule in _RULES:
            feat = rule["feature"]
            val = vitals.get(feat)
            if val is None:
                continue
            try:
                val = float(val)
            except (TypeError, ValueError):
                continue
            if _check_rule(val, rule["op"], rule["threshold"]):
                op_sym = {">": "above", "<": "below", ">=": "at or above", "<=": "at or below"}.get(rule["op"], rule["op"])
                flags.append({
                    "vital":     feat,
                    "value":     val,
                    "threshold": rule["threshold"],
                    "operator":  rule["op"],
                    "severity":  rule["severity"],
                    "label":     rule["label"],
                    "message":   f"{rule['label']}: {feat.replace('_', ' ').title()} is {val} ({op_sym} threshold of {rule['threshold']})",
                })

        # Deduplicate: keep highest severity per vital
        seen: Dict[str, Dict] = {}
        for flag in flags:
            vital = flag["vital"]
            if vital not in seen or (flag["severity"] == "critical" and seen[vital]["severity"] != "critical"):
                seen[vital] = flag
        flags = list(seen.values())

        # 2. IsolationForest
        ml_flagged = False
        raw_score = 0.0
        if self._model is not None:
            row = np.array([[
                float(vitals.get("heart_rate",   75)),
                float(vitals.get("sys",          115)),
                float(vitals.get("dia",          75)),
                float(vitals.get("spo2",         98)),
                float(vitals.get("temp",         36.8)),
                float(vitals.get("resp",         16)),
            ]])
            pred = self._model.predict(row)[0]         # 1=normal, -1=anomaly
            raw_score = -self._model.score_samples(row)[0]  # higher = more anomalous
            ml_flagged = (pred == -1)

        # Normalise score to [0,1]
        score = min(1.0, max(0.0, raw_score / 0.5))

        # 3. Combined verdict
        is_anomaly = ml_flagged or len(flags) > 0
        has_critical = any(f["severity"] == "critical" for f in flags)
        severity = "normal"
        if is_anomaly:
            severity = "critical" if has_critical else "warning"

        return {
            "is_anomaly": bool(is_anomaly),
            "score":      float(round(score, 4)),
            "severity":   str(severity),
            "flags":      flags,
            "ml_flagged": bool(ml_flagged),
        }


# Module-level singleton
_detector: Optional[AnomalyDetector] = None


def get_detector() -> AnomalyDetector:
    global _detector
    if _detector is None:
        _detector = AnomalyDetector()
    return _detector
