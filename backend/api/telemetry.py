from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from backend.core.database import get_db
from backend.models import domain as models
from backend.schemas import domain as schemas
from engine.anomaly_detector import AnomalyDetector
from engine.health_engine import HealthEngine
import engine # assuming engine is in python path, we might need to fix pathing depending on how we run it

router = APIRouter()

# Instantiate globally or via dependency injection for MVP
anomaly_detector = AnomalyDetector(window_size=10)
health_engine = HealthEngine(history_window=20)

@router.post("/telemetry", response_model=dict)
def ingest_telemetry(payload: schemas.SensorTelemetryCreate, db: Session = Depends(get_db)):
    try:
        # 1. Process via ML Engine
        result = anomaly_detector.process_reading(
            sensor_id=payload.sensor_id,
            sensor_type=payload.sensor_type,
            value=payload.value
        )
        
        # 2. Update Health Engine
        health_result = health_engine.process_anomaly_result(payload.sensor_id, result)
        
        # 3. Store in DB
        sensor = db.query(models.Sensor).filter(models.Sensor.sensor_code == payload.sensor_id).first()
        if not sensor:
            sensor = models.Sensor(
                sensor_code=payload.sensor_id,
                sensor_type=payload.sensor_type,
                status=health_result["status"],
                health_score=health_result["health_score"]
            )
            db.add(sensor)
            db.commit()
            db.refresh(sensor)
        else:
            sensor.health_score = health_result["health_score"]
            sensor.status = health_result["status"]
            db.commit()

        # Store telemetry
        telemetry_record = models.SensorTelemetry(
            sensor_id=sensor.id,
            temperature=payload.value if payload.sensor_type == 'temperature' else None,
            pressure=payload.value if payload.sensor_type == 'pressure' else None,
            flow=payload.value if payload.sensor_type == 'flow' else None,
            anomaly_score=result.get("anomaly_score", 0.0),
            is_anomaly=result.get("is_anomaly", False),
            severity=result.get("severity", "NORMAL")
        )
        db.add(telemetry_record)
        
        # Store anomaly event if detected
        if result.get("is_anomaly", False):
            event = models.AnomalyEvent(
                sensor_id=sensor.id,
                equipment_id=sensor.equipment_id,
                anomaly_score=result.get("anomaly_score", 0.0),
                anomaly_type=result.get("pattern", "GENERAL_ANOMALY"),
                severity=result.get("severity", "LOW"),
                recommended_action=result.get("recommended_action", "Inspect system.")
            )
            db.add(event)

        db.commit()
        
        return {
            "status": "success",
            "sensor_id": payload.sensor_id,
            "is_anomaly": result.get("is_anomaly", False),
            "anomaly_score": result.get("anomaly_score", 0.0),
            "pattern": result.get("pattern", "NORMAL"),
            "severity": result.get("severity", "NORMAL"),
            "health_score": health_result["health_score"],
            "recommended_action": result.get("recommended_action", "System operating normally.")
        }
    except Exception as e:
        print(f"Error processing telemetry: {e}")
        # Return generic error instead of stack trace
        raise HTTPException(status_code=500, detail="Internal server error")
