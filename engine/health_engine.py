import time
from collections import deque

class HealthEngine:
    def __init__(self, history_window=20):
        self.history_window = history_window
        self.sensor_history = {} # sensor_id -> list of recent anomaly results

    def process_anomaly_result(self, sensor_id, anomaly_result):
        if sensor_id not in self.sensor_history:
            self.sensor_history[sensor_id] = deque(maxlen=self.history_window)
        
        self.sensor_history[sensor_id].append({
            "timestamp": time.time(),
            "is_anomaly": anomaly_result["is_anomaly"],
            "severity": anomaly_result["severity"],
            "score": anomaly_result["anomaly_score"]
        })
        
        return self.calculate_health(sensor_id)

    def calculate_health(self, sensor_id):
        if sensor_id not in self.sensor_history:
            return 100.0 # Default healthy
            
        history = list(self.sensor_history[sensor_id])
        if not history:
            return 100.0
            
        total_records = len(history)
        anomaly_count = sum(1 for r in history if r["is_anomaly"])
        
        # Base health starts at 100
        health = 100.0
        
        # 1. Penalize for anomaly frequency
        frequency_penalty = (anomaly_count / total_records) * 30.0 # Up to 30% drop for frequency
        health -= frequency_penalty
        
        # 2. Penalize for recent severity
        severity_weights = {
            "NORMAL": 0.0,
            "LOW": 2.0,
            "MEDIUM": 5.0,
            "HIGH": 10.0,
            "CRITICAL": 20.0
        }
        
        # Look at the most recent events more heavily
        recent_events = history[-5:]
        severity_penalty = sum(severity_weights.get(r["severity"], 0) for r in recent_events)
        
        # Cap severity penalty to avoid dropping below 0 too fast, say max 50 points
        severity_penalty = min(severity_penalty, 50.0)
        health -= severity_penalty
        
        # 3. Penalize for average anomaly score (telemetry stability)
        avg_score = sum(r["score"] for r in history) / total_records
        stability_penalty = avg_score * 20.0 # Up to 20% drop for instability
        health -= stability_penalty
        
        # Ensure health is between 0 and 100
        health = max(0.0, min(100.0, health))
        
        status = self._get_status_label(health)
        
        return {
            "health_score": round(health, 2),
            "status": status
        }

    def _get_status_label(self, health):
        if health >= 90:
            return "Healthy"
        elif health >= 70:
            return "Stable / Monitor"
        elif health >= 50:
            return "Attention Required"
        else:
            return "Critical"
