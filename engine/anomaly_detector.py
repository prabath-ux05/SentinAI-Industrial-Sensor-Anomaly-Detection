import numpy as np
import pandas as pd
import joblib
import os
from collections import deque
from abc import ABC, abstractmethod
from engine.feature_engineering import create_features
from engine.pattern_detector import detect_pattern

class BaseAnomalyModel(ABC):
    """Abstract base class for anomaly detection models."""
    
    @abstractmethod
    def predict(self, X: np.ndarray) -> tuple[int, float]:
        """
        Predict if the input is an anomaly.
        Returns:
            tuple: (prediction_label, raw_score)
            prediction_label: -1 for anomaly, 1 for normal.
            raw_score: Raw model score.
        """
        pass

class LoadedIsolationForestModel(BaseAnomalyModel):
    """Isolation Forest model loaded from a pre-trained .joblib artifact."""
    
    def __init__(self, model_path: str = None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "models", "sentinai_isolation_forest.joblib")
            
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}")
            
        self.model = joblib.load(model_path)

    def predict(self, X: np.ndarray) -> tuple[int, float]:
        prediction = self.model.predict(X)[0]
        raw_score = self.model.score_samples(X)[0]
        return int(prediction), float(raw_score)

class AnomalyDetector:
    def __init__(self, window_size=10, model=None):
        self.window_size = window_size
        
        # history maintains recent values for all sensors: temperature, pressure, flow
        # In MVP we assume a single machine sending telemetry. We maintain synchronized queues.
        self.history = {
            "temperature": deque(maxlen=self.window_size),
            "pressure": deque(maxlen=self.window_size),
            "flow": deque(maxlen=self.window_size)
        }
        
        # Load the unified ML model
        self.model = model if model else LoadedIsolationForestModel()

    def process_reading(self, sensor_id, sensor_type, value):
        if sensor_type not in self.history:
            # For unrecognized sensors, just append and ignore ML for now, or raise
            return self._default_result(value)
            
        # Update the history for the incoming sensor
        self.history[sensor_type].append(value)
        
        # Check if we have at least one reading for all required sensors to form a DataFrame row
        if any(len(v) == 0 for v in self.history.values()):
            return self._default_result(value)
            
        # To align histories of different lengths (since readings arrive sequentially), 
        # we can build a dataframe of the current state.
        # For a robust MVP, we take the latest available values up to max length.
        max_len = max(len(v) for v in self.history.values())
        
        # Pad shorter histories with their latest value to align them for feature engineering
        # (Assuming the system operates in real-time, the latest value is the current physical state)
        df_data = {}
        for s_type, deq in self.history.items():
            lst = list(deq)
            if len(lst) < max_len:
                # pad front with first value or back with last value? 
                # pad front so the latest values align at the end of the lists.
                lst = [lst[0]] * (max_len - len(lst)) + lst
            df_data[s_type] = lst
            
        history_df = pd.DataFrame(df_data)
        
        # 1. Feature Engineering
        try:
            features_df = create_features(history_df)
        except Exception as e:
            # If feature engineering fails (e.g. missing columns), return default
            print(f"Feature engineering failed: {e}")
            return self._default_result(value)
            
        # We only want to predict for the LATEST row (the current state)
        latest_features = features_df.iloc[[-1]]
        X = latest_features.to_numpy()
        
        # 2. Model Prediction
        prediction, raw_score = self.model.predict(X)
        
        # Normalize score to 0.0 - 1.0 (where 1.0 is highly anomalous)
        normalized_score = min(max((0.5 - raw_score) / 0.5, 0.0), 1.0)
        if prediction == 1:
             normalized_score = normalized_score * 0.4 # Cap normal scores
        
        is_anomaly = bool(prediction == -1)
        severity = self._calculate_severity(is_anomaly, normalized_score)
        
        # 3. Pattern Detection
        pattern, recommended_action = detect_pattern(features_df, sensor_type, is_anomaly)
        
        return {
            "value": value,
            "anomaly_score": round(normalized_score, 4),
            "is_anomaly": is_anomaly,
            "severity": severity,
            "pattern": pattern,
            "recommended_action": recommended_action,
            "features_extracted": list(features_df.columns)
        }

    def _default_result(self, value):
        return {
            "value": value,
            "anomaly_score": 0.0,
            "is_anomaly": False,
            "severity": "NORMAL",
            "pattern": "NORMAL",
            "recommended_action": "System operating normally.",
            "features_extracted": []
        }

    def _calculate_severity(self, is_anomaly, score):
        if not is_anomaly:
            return "NORMAL"
        if score > 0.9:
            return "CRITICAL"
        elif score > 0.7:
            return "HIGH"
        elif score > 0.5:
            return "MEDIUM"
        else:
            return "LOW"
