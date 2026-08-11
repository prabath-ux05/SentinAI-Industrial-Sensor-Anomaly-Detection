from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import domain as models

def get_system_summary(db: Session) -> dict:
    """Return system-wide health and anomalies."""
    total_sensors = db.query(models.Sensor).count()
    healthy_sensors = db.query(models.Sensor).filter(models.Sensor.status == "Healthy").count()
    critical_sensors = db.query(models.Sensor).filter(models.Sensor.status == "Critical").count()
    active_alerts = db.query(models.AnomalyEvent).filter(models.AnomalyEvent.resolved == False).count()
    avg_health = db.query(func.avg(models.Sensor.health_score)).scalar() or 100.0

    recent_anomalies = db.query(models.AnomalyEvent).order_by(models.AnomalyEvent.detected_at.desc()).limit(5).all()

    return {
        "system_health": round(avg_health, 2),
        "healthy_sensors": healthy_sensors,
        "critical_sensors": critical_sensors,
        "active_alerts": active_alerts,
        "recent_anomalies": [{"id": a.id, "type": a.anomaly_type, "severity": a.severity} for a in recent_anomalies]
    }

def get_sensor_status(db: Session, identifier: str) -> dict:
    """Return latest reading and status for a specific sensor."""
    sensor = db.query(models.Sensor).filter(models.Sensor.sensor_code == identifier).first()
    if not sensor:
        return {}
        
    latest_reading = db.query(models.SensorTelemetry).filter(
        models.SensorTelemetry.sensor_id == sensor.id
    ).order_by(models.SensorTelemetry.created_at.desc()).first()
    
    latest_anomaly = db.query(models.AnomalyEvent).filter(
        models.AnomalyEvent.sensor_id == sensor.id
    ).order_by(models.AnomalyEvent.detected_at.desc()).first()

    return {
        "sensor_code": sensor.sensor_code,
        "health": sensor.health_score,
        "status": sensor.status,
        "latest_reading": {
            "temperature": latest_reading.temperature if latest_reading else None,
            "pressure": latest_reading.pressure if latest_reading else None,
            "flow": latest_reading.flow if latest_reading else None,
            "time": latest_reading.created_at.isoformat() if latest_reading else None
        } if latest_reading else None,
        "pattern": latest_anomaly.anomaly_type if latest_anomaly else "Normal",
        "severity": latest_anomaly.severity if latest_anomaly else "None",
        "recommendation": latest_anomaly.recommended_action if latest_anomaly else "Monitor normally"
    }

def get_sensor_history(db: Session, identifier: str) -> dict:
    """Return recent telemetry and previous anomalies for a sensor."""
    sensor = db.query(models.Sensor).filter(models.Sensor.sensor_code == identifier).first()
    if not sensor:
        return {}
        
    readings = db.query(models.SensorTelemetry).filter(
        models.SensorTelemetry.sensor_id == sensor.id
    ).order_by(models.SensorTelemetry.created_at.desc()).limit(10).all()
    
    anomalies = db.query(models.AnomalyEvent).filter(
        models.AnomalyEvent.sensor_id == sensor.id
    ).order_by(models.AnomalyEvent.detected_at.desc()).limit(5).all()

    return {
        "sensor_code": sensor.sensor_code,
        "recent_telemetry": [{"time": r.created_at.isoformat(), "temp": r.temperature, "pressure": r.pressure} for r in readings],
        "previous_anomalies": [{"type": a.anomaly_type, "severity": a.severity, "time": a.detected_at.isoformat()} for a in anomalies]
    }

def get_equipment_details(db: Session, identifier: str) -> dict:
    """Return equipment information, linked sensors, and maintenance history."""
    eq = db.query(models.Equipment).filter(models.Equipment.equipment_code == identifier).first()
    if not eq:
        return {}
        
    sensors = db.query(models.Sensor).filter(models.Sensor.equipment_id == eq.id).all()
    
    return {
        "equipment_name": eq.name,
        "equipment_code": eq.equipment_code,
        "health": eq.health_score,
        "maintenance_history": eq.last_maintenance.isoformat() if eq.last_maintenance else "Unknown",
        "sensors": [{"code": s.sensor_code, "health": s.health_score, "status": s.status} for s in sensors]
    }

def get_recent_anomalies(db: Session) -> list:
    """Return the most recent anomalies across all sensors."""
    events = db.query(models.AnomalyEvent).order_by(models.AnomalyEvent.detected_at.desc()).limit(10).all()
    res = []
    for e in events:
        s = db.query(models.Sensor).filter(models.Sensor.id == e.sensor_id).first()
        res.append({
            "sensor": s.sensor_code if s else "Unknown",
            "type": e.anomaly_type,
            "severity": e.severity,
            "score": e.anomaly_score,
            "action": e.recommended_action,
            "detected_at": e.detected_at.isoformat()
        })
    return res

def generate_fault_summary(db: Session) -> dict:
    """Return an operational summary of current faults."""
    active = db.query(models.AnomalyEvent).filter(models.AnomalyEvent.resolved == False).all()
    critical = [a for a in active if a.severity == "CRITICAL"]
    high = [a for a in active if a.severity == "HIGH"]
    
    return {
        "total_active_faults": len(active),
        "critical_faults": len(critical),
        "high_faults": len(high),
        "summary_message": f"System currently has {len(active)} active faults, including {len(critical)} critical issues.",
        "critical_details": [
            {
                "type": c.anomaly_type,
                "action": c.recommended_action
            } for c in critical
        ]
    }
