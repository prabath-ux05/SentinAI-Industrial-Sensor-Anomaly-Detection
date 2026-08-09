import pytest
from fastapi.testclient import TestClient
import time
from backend.main import app
from unittest.mock import patch
from backend.api import telemetry

client = TestClient(app)

def test_api_normal_telemetry():
    payload = {
        "sensor_id": "test_sensor_1",
        "sensor_type": "temperature",
        "value": 50.0,
        "timestamp": time.time()
    }
    response = client.post("/api/telemetry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "sensor_id" in data
    assert "is_anomaly" in data
    assert "anomaly_score" in data
    assert "pattern" in data
    assert "severity" in data
    assert "health_score" in data
    assert "recommended_action" in data

def test_api_anomalous_telemetry():
    # To force an anomaly quickly in this test, we can mock the ML output
    # or rely on the pipeline. Let's mock it to ensure it's treated correctly
    # as an anomaly by the API layer and DB.
    payload = {
        "sensor_id": "test_sensor_2",
        "sensor_type": "pressure",
        "value": 999.0,
        "timestamp": time.time()
    }
    
    mock_result = {
        "value": 999.0,
        "anomaly_score": 0.95,
        "is_anomaly": True,
        "severity": "CRITICAL",
        "pattern": "SPIKE",
        "recommended_action": "Inspect sensor and associated equipment for sudden operating changes.",
        "features_extracted": []
    }
    
    with patch.object(telemetry.anomaly_detector, 'process_reading', return_value=mock_result):
        response = client.post("/api/telemetry", json=payload)
        
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["is_anomaly"] == True
    assert data["pattern"] == "SPIKE"
    assert data["severity"] == "CRITICAL"
    assert data["anomaly_score"] == 0.95
    assert data["recommended_action"] == "Inspect sensor and associated equipment for sudden operating changes."

def test_api_invalid_telemetry():
    # Missing sensor_type
    payload = {
        "sensor_id": "test_sensor_3",
        "value": 50.0,
        "timestamp": time.time()
    }
    response = client.post("/api/telemetry", json=payload)
    assert response.status_code == 422 # FastAPI Validation Error

def test_api_inference_failure():
    payload = {
        "sensor_id": "test_sensor_4",
        "sensor_type": "flow",
        "value": 50.0,
        "timestamp": time.time()
    }
    
    with patch.object(telemetry.anomaly_detector, 'process_reading', side_effect=Exception("Model failure mock")):
        response = client.post("/api/telemetry", json=payload)
        
    # Expect graceful error handling returning 500
    assert response.status_code == 500
    data = response.json()
    assert data["detail"] == "Internal server error"
