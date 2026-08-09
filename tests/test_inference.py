import pytest
import pandas as pd
import numpy as np
import os
import joblib

from engine.feature_engineering import load_feature_config, create_features
from engine.anomaly_detector import LoadedIsolationForestModel, AnomalyDetector
from engine.pattern_detector import detect_pattern

def test_model_loading():
    model_path = os.path.join(os.path.dirname(__file__), "..", "engine", "models", "sentinai_isolation_forest.joblib")
    model = joblib.load(model_path)
    assert model is not None, "Failed to load model."
    assert hasattr(model, "predict"), "Loaded artifact does not have a predict method."

def test_feature_config_loading():
    config = load_feature_config()
    assert "features" in config
    assert "window_size" in config
    assert len(config["features"]) == 33
    
def test_feature_engineering():
    # Create a small synthetic dataframe with required columns
    data = {
        "temperature": [60.0] * 15,
        "pressure": [5.0] * 15,
        "flow": [50.0] * 15
    }
    df = pd.DataFrame(data)
    
    features_df = create_features(df)
    config = load_feature_config()
    
    # Verify exact column order
    assert list(features_df.columns) == config["features"]
    assert len(features_df) == 15
    
def test_model_prediction():
    model = LoadedIsolationForestModel()
    # 33 features
    X = np.random.rand(1, 33)
    prediction, score = model.predict(X)
    assert prediction in [1, -1]
    assert isinstance(score, float)

def test_anomaly_pipeline():
    detector = AnomalyDetector(window_size=10)
    
    # Feed enough data to get past the initial empty checks
    for _ in range(3):
        detector.process_reading("test_sensor_id", "temperature", 60.0)
        detector.process_reading("test_sensor_id", "pressure", 5.0)
        res = detector.process_reading("test_sensor_id", "flow", 50.0)
        
    assert "is_anomaly" in res
    assert "anomaly_score" in res
    assert "pattern" in res
    assert "severity" in res
    assert "recommended_action" in res

def test_flatline_pattern():
    # Create features indicative of a flatline for temperature
    config = load_feature_config()
    # Initialize with zeros
    features = {f: 0.0 for f in config["features"]}
    
    # Flatline indicators
    features["temperature_zero_change_count"] = 10.0
    features["temperature_unique_count"] = 1.0
    
    df = pd.DataFrame([features])
    
    pattern, action = detect_pattern(df, "temperature", is_anomaly=True)
    assert pattern == "FLATLINE"
    assert "Check sensor connection" in action

def test_spike_pattern():
    config = load_feature_config()
    features = {f: 0.0 for f in config["features"]}
    features["temperature_unique_count"] = 10.0
    features["temperature_abs_rate"] = 15.0
    features["temperature_rolling_std"] = 1.0
    
    df = pd.DataFrame([features])
    pattern, action = detect_pattern(df, "temperature", is_anomaly=True)
    assert pattern == "SPIKE"
    assert "sudden operating changes" in action

def test_drift_pattern():
    config = load_feature_config()
    features = {f: 0.0 for f in config["features"]}
    features["temperature_unique_count"] = 10.0
    features["temperature_deviation"] = 5.0
    features["temperature_rolling_std"] = 1.0
    features["temperature_abs_rate"] = 1.0
    
    df = pd.DataFrame([features])
    pattern, action = detect_pattern(df, "temperature", is_anomaly=True)
    assert pattern == "DRIFT"
    assert "reference measurement" in action

def test_noise_pattern():
    config = load_feature_config()
    features = {f: 0.0 for f in config["features"]}
    features["temperature_rolling_std"] = 6.0
    features["temperature_unique_count"] = 6.0
    features["temperature_abs_rate"] = 1.0
    
    df = pd.DataFrame([features])
    pattern, action = detect_pattern(df, "temperature", is_anomaly=True)
    assert pattern == "NOISE"
    assert "stability, wiring, shielding" in action

def test_general_anomaly_pattern():
    config = load_feature_config()
    features = {f: 0.0 for f in config["features"]}
    features["temperature_unique_count"] = 10.0
    features["temperature_abs_rate"] = 1.0
    features["temperature_rolling_std"] = 1.0
    features["temperature_deviation"] = 1.0
    
    df = pd.DataFrame([features])
    pattern, action = detect_pattern(df, "temperature", is_anomaly=True)
    assert pattern == "GENERAL_ANOMALY"
    assert "recent telemetry" in action

def test_severity_generation():
    detector = AnomalyDetector(window_size=10)
    assert detector._calculate_severity(False, 0.0) == "NORMAL"
    assert detector._calculate_severity(True, 0.95) == "CRITICAL"
    assert detector._calculate_severity(True, 0.8) == "HIGH"
    assert detector._calculate_severity(True, 0.6) == "MEDIUM"
    assert detector._calculate_severity(True, 0.4) == "LOW"
