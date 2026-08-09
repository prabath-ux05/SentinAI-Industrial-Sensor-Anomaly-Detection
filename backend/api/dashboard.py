from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.database import get_db
from backend.models import domain as models

router = APIRouter()

@router.get("/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_sensors = db.query(func.count(models.Sensor.id)).scalar() or 0
    anomalous_sensors = db.query(func.count(models.Sensor.id)).filter(models.Sensor.status != "Healthy").scalar() or 0
    healthy_sensors = total_sensors - anomalous_sensors
    
    # Calculate overall system health (average of all sensors)
    avg_health = db.query(func.avg(models.Sensor.health_score)).scalar()
    system_health = round(avg_health, 2) if avg_health is not None else 100.0

    # Critical alerts = sensors currently in a critical health state (health_score < 50).
    # This reflects live system status and naturally rises/falls as the health engine
    # processes telemetry. It does NOT accumulate historical anomaly event records.
    critical_alerts = db.query(func.count(models.Sensor.id)).filter(
        models.Sensor.health_score < 50
    ).scalar() or 0

    healthy_dist = db.query(func.count(models.Sensor.id)).filter(models.Sensor.health_score >= 90).scalar() or 0
    stable_dist = db.query(func.count(models.Sensor.id)).filter(models.Sensor.health_score >= 70, models.Sensor.health_score < 90).scalar() or 0
    attention_dist = db.query(func.count(models.Sensor.id)).filter(models.Sensor.health_score >= 50, models.Sensor.health_score < 70).scalar() or 0
    critical_dist = db.query(func.count(models.Sensor.id)).filter(models.Sensor.health_score < 50).scalar() or 0

    return {
        "system_health": system_health,
        "total_sensors": total_sensors,
        "healthy_sensors": healthy_sensors,
        "anomalous_sensors": anomalous_sensors,
        "critical_alerts": critical_alerts,
        "health_distribution": {
            "Healthy": healthy_dist,
            "Stable / Monitor": stable_dist,
            "Attention Required": attention_dist,
            "Critical": critical_dist
        }
    }

@router.get("/dashboard/alerts")
def get_dashboard_alerts(limit: int = 10, db: Session = Depends(get_db)):
    alerts = db.query(models.AnomalyEvent, models.Sensor.sensor_code, models.Equipment.name).join(
        models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id
    ).outerjoin(
        models.Equipment, models.Sensor.equipment_id == models.Equipment.id
    ).order_by(models.AnomalyEvent.detected_at.desc()).limit(limit).all()
    
    result = []
    for alert, sensor_code, equipment_name in alerts:
        result.append({
            "id": alert.id,
            "sensor_id": alert.sensor_id,
            "sensor_code": sensor_code,
            "equipment_name": equipment_name or "Unknown Equipment",
            "anomaly_score": alert.anomaly_score,
            "severity": alert.severity,
            "anomaly_type": alert.anomaly_type,
            "detected_at": alert.detected_at.isoformat() if alert.detected_at else None,
            "recommended_action": alert.recommended_action
        })
    return result

@router.get("/dashboard/telemetry")
def get_dashboard_telemetry(limit: int = 50, db: Session = Depends(get_db)):
    records = db.query(models.SensorTelemetry).order_by(models.SensorTelemetry.created_at.desc()).limit(limit).all()
    records.reverse()
    
    result = []
    for r in records:
        result.append({
            "timestamp": r.created_at.isoformat() if r.created_at else None,
            "temperature": r.temperature,
            "pressure": r.pressure,
            "flow": r.flow
        })
    return result
