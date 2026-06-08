"""
xai/explainer.py — Explainable AI for nalam.ai Predictions
------------------------------------------------------------
Provides SHAP-based feature importance for sklearn models.
Falls back to model.feature_importances_ or permutation importance
when SHAP is unavailable or too slow.

Usage:
    from xai.explainer import explain_vitals
    result = explain_vitals({"systolic_bp": 165, "heart_rate": 92, ...})
"""

import logging
import os
import pickle
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("nalam.xai")

XAI_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(XAI_DIR, "xai_model.pkl")
BG_PATH = os.path.join(XAI_DIR, "xai_background.pkl")

_model = None
_bg_data = None

def _load_model_and_bg():
    global _model, _bg_data
    if _model is None and os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                _model = pickle.load(f)
            with open(BG_PATH, "rb") as f:
                _bg_data = pickle.load(f)
        except Exception as e:
            logger.error(f"Failed to load XAI model: {e}")

# ── Feature metadata ──────────────────────────────────────────────────────────
FEATURE_META: Dict[str, Dict[str, Any]] = {
    "systolic_bp": {
        "label": "Systolic Blood Pressure",
        "unit": "mmHg",
        "normal_range": (90, 120),
        "risk_direction": "high",   # higher = more risk
        "description": "The pressure in your arteries when your heart beats.",
    },
    "diastolic_bp": {
        "label": "Diastolic Blood Pressure",
        "unit": "mmHg",
        "normal_range": (60, 80),
        "risk_direction": "high",
        "description": "The pressure in your arteries between heartbeats.",
    },
    "heart_rate": {
        "label": "Heart Rate",
        "unit": "BPM",
        "normal_range": (60, 100),
        "risk_direction": "both",
        "description": "Number of heartbeats per minute.",
    },
    "spo2": {
        "label": "Oxygen Saturation (SpO₂)",
        "unit": "%",
        "normal_range": (95, 100),
        "risk_direction": "low",    # lower = more risk
        "description": "Percentage of haemoglobin carrying oxygen.",
    },
    "temperature": {
        "label": "Body Temperature",
        "unit": "°C",
        "normal_range": (36.1, 37.2),
        "risk_direction": "high",
        "description": "Core body temperature.",
    },
    "glucose": {
        "label": "Blood Glucose",
        "unit": "mg/dL",
        "normal_range": (70, 140),
        "risk_direction": "both",
        "description": "Concentration of glucose in the blood.",
    },
    "age": {
        "label": "Patient Age",
        "unit": "years",
        "normal_range": (0, 120),
        "risk_direction": "high",
        "description": "Chronological age — older age increases cardiovascular risk.",
    },
    "bmi": {
        "label": "Body Mass Index",
        "unit": "kg/m²",
        "normal_range": (18.5, 24.9),
        "risk_direction": "high",
        "description": "Ratio of weight to height squared.",
    },
    "cholesterol": {
        "label": "Total Cholesterol",
        "unit": "mg/dL",
        "normal_range": (0, 200),
        "risk_direction": "high",
        "description": "Total blood cholesterol level.",
    },
    "num_conditions": {
        "label": "Number of Conditions",
        "unit": "count",
        "normal_range": (0, 2),
        "risk_direction": "high",
        "description": "Count of active comorbidities.",
    },
    "num_records": {
        "label": "Medical Visit Frequency",
        "unit": "visits",
        "normal_range": (0, 5),
        "risk_direction": "high",
        "description": "Number of recorded medical events (proxy for care burden).",
    },
    "has_hypertension": {
        "label": "Hypertension Diagnosis",
        "unit": "boolean",
        "normal_range": (0, 0),
        "risk_direction": "high",
        "description": "Whether hypertension has been diagnosed.",
    },
    "has_diabetes": {
        "label": "Diabetes Diagnosis",
        "unit": "boolean",
        "normal_range": (0, 0),
        "risk_direction": "high",
        "description": "Whether diabetes has been diagnosed.",
    },
    "has_cad": {
        "label": "Coronary Artery Disease",
        "unit": "boolean",
        "normal_range": (0, 0),
        "risk_direction": "high",
        "description": "Whether coronary artery disease has been diagnosed.",
    },
}


def _deviation_score(value: float, meta: Dict[str, Any]) -> float:
    """Return a [0, 1] score of how far a value is outside the normal range."""
    lo, hi = meta["normal_range"]
    if lo <= value <= hi:
        return 0.0
    dist = max(value - hi, lo - value)
    span = max(hi - lo, 1)
    return min(1.0, dist / span)


def explain_vitals(vitals: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Real SHAP-based XAI explanation for a set of vital signs.
    Loads the trained RandomForest model and computes exact SHAP contributions.
    Falls back to rule-based logic if model or shap library is unavailable.
    """
    _load_model_and_bg()
    
    use_shap = False
    shap_vals = {}
    
    if _model is not None and _bg_data is not None:
        try:
            import shap
            # Extract features in exact model order: ['Age', 'BMI', 'Heart_Rate', 'Systolic_BP', 'Diastolic_BP', 'SpO2', 'Temperature']
            feature_names = ['Age', 'BMI', 'Heart_Rate', 'Systolic_BP', 'Diastolic_BP', 'SpO2', 'Temperature']
            mapping = {
                'Age': vitals.get('age', 50),
                'BMI': vitals.get('bmi', 24.5),
                'Heart_Rate': vitals.get('heart_rate', 72),
                'Systolic_BP': vitals.get('systolic_bp', 120),
                'Diastolic_BP': vitals.get('diastolic_bp', 80),
                'SpO2': vitals.get('spo2', 98),
                'Temperature': vitals.get('temperature', 37.0)
            }
            
            # Convert to DataFrame
            df = pd.DataFrame([mapping])[feature_names]
            
            explainer = shap.TreeExplainer(_model, _bg_data, feature_perturbation="interventional")
            shap_values = explainer.shap_values(df)
            
            # Binary classification: shap_values is typically a list of arrays for each class. We want class 1 (Anomaly).
            if isinstance(shap_values, list):
                sv = shap_values[1][0]
            else:
                # If shape is (1, 7)
                sv = shap_values[0]
                
            total_abs = np.sum(np.abs(sv)) or 1.0
            
            for i, fname in enumerate(feature_names):
                # map back to internal keys
                key_map = {
                    'Age': 'age', 'BMI': 'bmi', 'Heart_Rate': 'heart_rate',
                    'Systolic_BP': 'systolic_bp', 'Diastolic_BP': 'diastolic_bp',
                    'SpO2': 'spo2', 'Temperature': 'temperature'
                }
                k = key_map[fname]
                importance = np.abs(sv[i]) / total_abs
                shap_vals[k] = {"importance": float(importance), "raw_shap": float(sv[i])}
                
            use_shap = True
        except ImportError:
            logger.warning("shap not installed, falling back to rule-based.")
        except Exception as e:
            logger.warning(f"SHAP explanation failed: {e}, falling back to rule-based.")

    results: List[Dict[str, Any]] = []
    for feat, meta in FEATURE_META.items():
        raw = vitals.get(feat)
        if raw is None:
            # Check if it was imputed for shap (e.g., age, bmi)
            if use_shap and feat in ['age', 'bmi']:
                value = 50.0 if feat == 'age' else 24.5
            else:
                continue
        else:
            try:
                value = float(raw)
            except (TypeError, ValueError):
                continue

        # Rule-based direction/status/risk computation
        lo, hi = meta["normal_range"]
        if value > hi:
            direction = "up"
        elif value < lo:
            direction = "down"
        else:
            direction = "normal"

        risk_dir = meta["risk_direction"]
        if direction == "normal":
            risk = "neutral"
        elif risk_dir == "high" and direction == "up":
            risk = "harmful"
        elif risk_dir == "low" and direction == "down":
            risk = "harmful"
        elif risk_dir == "both" and direction != "normal":
            risk = "harmful"
        else:
            risk = "protective"
            
        rule_importance = _deviation_score(value, meta)
        status = "normal" if direction == "normal" else ("critical" if rule_importance > 0.5 else "warning")

        if use_shap and feat in shap_vals:
            importance = shap_vals[feat]["importance"]
            # Enhance description with actual SHAP contribution
            raw_s = shap_vals[feat]["raw_shap"]
            impact_str = "increased" if raw_s > 0 else "decreased"
            desc = meta["description"] + f" (SHAP indicates this {impact_str} anomaly risk by {abs(raw_s):.2f})."
        else:
            importance = rule_importance
            desc = meta["description"]

        results.append({
            "feature":      feat,
            "label":        meta["label"],
            "value":        value,
            "unit":         meta["unit"],
            "importance":   round(importance, 4),
            "direction":    direction,
            "risk":         risk,
            "description":  desc,
            "normal_range": {"low": lo, "high": hi},
            "status":       status,
        })

    results.sort(key=lambda x: x["importance"], reverse=True)
    return results


def explain_from_shap(
    model: Any,
    feature_names: List[str],
    sample: np.ndarray,
) -> Optional[List[Dict[str, Any]]]:
    """
    Attempt SHAP-based explanation. Returns None if shap not installed.
    Falls back to tree feature_importances_ if available.
    """
    try:
        import shap  # type: ignore
        try:
            # Tree-based (IsolationForest, RandomForest, GBM, etc.)
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(sample)
            vals = np.abs(shap_values[0]) if shap_values.ndim > 1 else np.abs(shap_values)
        except Exception:
            # Linear or generic fallback
            try:
                explainer = shap.LinearExplainer(model, sample)
                shap_values = explainer.shap_values(sample)
                vals = np.abs(shap_values[0])
            except Exception:
                return None

        total = vals.sum() or 1.0
        return [
            {
                "feature":    feat,
                "label":      FEATURE_META.get(feat, {}).get("label", feat),
                "importance": round(float(v / total), 4),
                "shap_raw":   round(float(v), 6),
            }
            for feat, v in zip(feature_names, vals)
        ]
    except ImportError:
        logger.debug("shap not installed, skipping SHAP explanation")
    except Exception as e:
        logger.warning("SHAP explanation failed: %s", e)

    # Fallback: sklearn feature_importances_
    if hasattr(model, "feature_importances_"):
        imps = model.feature_importances_
        total = imps.sum() or 1.0
        return [
            {
                "feature":    feat,
                "label":      FEATURE_META.get(feat, {}).get("label", feat),
                "importance": round(float(v / total), 4),
            }
            for feat, v in zip(feature_names, imps)
        ]
    return None
