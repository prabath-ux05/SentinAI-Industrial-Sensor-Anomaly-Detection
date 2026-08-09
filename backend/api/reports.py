from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
import io
from backend.core.database import get_db
from backend.models import domain as models

router = APIRouter()

@router.get("/sensor-performance/csv")
def download_sensor_performance(db: Session = Depends(get_db)):
    sensors = db.query(models.Sensor).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Sensor ID', 'Equipment ID', 'Type', 'Location', 'Status', 'Health Score', 'Created At'])
    
    for s in sensors:
        writer.writerow([s.sensor_code, s.equipment_id, s.sensor_type, s.location, s.status, s.health_score, s.created_at])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sensor_performance.csv"}
    )

@router.get("/faults/csv")
def download_faults(db: Session = Depends(get_db)):
    events = db.query(models.AnomalyEvent, models.Sensor.sensor_code).join(
        models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id
    ).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Event ID', 'Sensor Code', 'Anomaly Type', 'Severity', 'Anomaly Score', 'Detected At', 'Recommended Action', 'Resolved'])
    
    for event, code in events:
        writer.writerow([
            event.id, code, event.anomaly_type, event.severity, 
            event.anomaly_score, event.detected_at, event.recommended_action, event.resolved
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=faults_report.csv"}
    )
