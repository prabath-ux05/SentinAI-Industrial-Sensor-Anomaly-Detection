"""
Reports API Router
==================
Endpoints:
  GET /api/reports/stats                       – Dashboard summary statistics
  GET /api/reports/sensor-performance          – Sensor performance report data (JSON)
  GET /api/reports/sensor-performance/csv      – Sensor performance CSV download
  GET /api/reports/faults/csv                  – Fault & anomaly CSV download
"""
import csv
import io
import math
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models import domain as models

router = APIRouter()


# ─── Pydantic models ──────────────────────────────────────────────────────────

class ReportStats(BaseModel):
    total_sensors: int
    total_telemetry_records: int
    total_anomalies: int
    avg_system_health: float
    active_anomalies: int
    resolved_anomalies: int
    total_equipment: int


class SensorPerformanceRow(BaseModel):
    sensor_id: int
    sensor_code: str
    sensor_type: str
    equipment_name: str
    location: Optional[str]
    health_score: float
    status: Optional[str]
    # Operating period
    first_reading: Optional[str]
    last_reading: Optional[str]
    total_readings: int
    # Temperature
    avg_temperature: Optional[float]
    min_temperature: Optional[float]
    max_temperature: Optional[float]
    # Pressure
    avg_pressure: Optional[float]
    min_pressure: Optional[float]
    max_pressure: Optional[float]
    # Flow
    avg_flow: Optional[float]
    min_flow: Optional[float]
    max_flow: Optional[float]
    # Anomalies
    anomaly_count: int


class SensorPerformanceReport(BaseModel):
    generated_at: str
    total_sensors: int
    filters_applied: dict
    rows: List[SensorPerformanceRow]


class FaultRow(BaseModel):
    event_id: int
    sensor_code: str
    equipment_name: str
    anomaly_type: str
    severity: str
    anomaly_score: float
    detected_at: str
    recommended_action: Optional[str]
    resolved: bool
    resolved_at: Optional[str]


class FaultReport(BaseModel):
    generated_at: str
    total_faults: int
    filters_applied: dict
    rows: List[FaultRow]


# ─── Helper: build sensor performance subqueries ──────────────────────────────

def _telemetry_stats_subq(db: Session, date_from: Optional[datetime], date_to: Optional[datetime]):
    """Aggregate telemetry per sensor: date range, avg/min/max for all three metrics."""
    q = db.query(
        models.SensorTelemetry.sensor_id,
        func.min(models.SensorTelemetry.created_at).label("first_reading"),
        func.max(models.SensorTelemetry.created_at).label("last_reading"),
        func.count(models.SensorTelemetry.id).label("total_readings"),
        # Temperature
        func.avg(models.SensorTelemetry.temperature).label("avg_temperature"),
        func.min(models.SensorTelemetry.temperature).label("min_temperature"),
        func.max(models.SensorTelemetry.temperature).label("max_temperature"),
        # Pressure
        func.avg(models.SensorTelemetry.pressure).label("avg_pressure"),
        func.min(models.SensorTelemetry.pressure).label("min_pressure"),
        func.max(models.SensorTelemetry.pressure).label("max_pressure"),
        # Flow
        func.avg(models.SensorTelemetry.flow).label("avg_flow"),
        func.min(models.SensorTelemetry.flow).label("min_flow"),
        func.max(models.SensorTelemetry.flow).label("max_flow"),
    )
    if date_from:
        q = q.filter(models.SensorTelemetry.created_at >= date_from)
    if date_to:
        q = q.filter(models.SensorTelemetry.created_at <= date_to)
    return q.group_by(models.SensorTelemetry.sensor_id).subquery()


def _anomaly_stats_subq(db: Session, date_from: Optional[datetime], date_to: Optional[datetime]):
    """Count anomaly events per sensor."""
    q = db.query(
        models.AnomalyEvent.sensor_id,
        func.count(models.AnomalyEvent.id).label("anomaly_count"),
    )
    if date_from:
        q = q.filter(models.AnomalyEvent.detected_at >= date_from)
    if date_to:
        q = q.filter(models.AnomalyEvent.detected_at <= date_to)
    return q.group_by(models.AnomalyEvent.sensor_id).subquery()


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _round(v, digits=2):
    return round(float(v), digits) if v is not None else None


def _iso(v) -> Optional[str]:
    return v.isoformat() if v is not None else None


def _build_sensor_rows(db: Session, equipment_id: Optional[int], sensor_id: Optional[int],
                       date_from: Optional[datetime], date_to: Optional[datetime]) -> list:
    """
    Execute the full sensor-performance query and return a list of raw result tuples.
    Uses two subqueries (telemetry stats + anomaly counts) joined against Sensor and Equipment.
    """
    tel = _telemetry_stats_subq(db, date_from, date_to)
    anom = _anomaly_stats_subq(db, date_from, date_to)

    q = (
        db.query(
            models.Sensor,
            models.Equipment.name.label("equipment_name"),
            tel.c.first_reading,
            tel.c.last_reading,
            tel.c.total_readings,
            tel.c.avg_temperature,
            tel.c.min_temperature,
            tel.c.max_temperature,
            tel.c.avg_pressure,
            tel.c.min_pressure,
            tel.c.max_pressure,
            tel.c.avg_flow,
            tel.c.min_flow,
            tel.c.max_flow,
            anom.c.anomaly_count,
        )
        .outerjoin(models.Equipment, models.Sensor.equipment_id == models.Equipment.id)
        .outerjoin(tel, models.Sensor.id == tel.c.sensor_id)
        .outerjoin(anom, models.Sensor.id == anom.c.sensor_id)
    )

    if equipment_id:
        q = q.filter(models.Sensor.equipment_id == equipment_id)
    if sensor_id:
        q = q.filter(models.Sensor.id == sensor_id)

    return q.order_by(models.Sensor.sensor_code).all()


# ─── GET /stats ───────────────────────────────────────────────────────────────

@router.get("/stats", response_model=ReportStats)
def get_report_stats(db: Session = Depends(get_db)):
    """Aggregated KPIs for the Reports dashboard summary tiles."""
    return ReportStats(
        total_sensors=db.query(func.count(models.Sensor.id)).scalar() or 0,
        total_telemetry_records=db.query(func.count(models.SensorTelemetry.id)).scalar() or 0,
        total_anomalies=db.query(func.count(models.AnomalyEvent.id)).scalar() or 0,
        active_anomalies=db.query(func.count(models.AnomalyEvent.id)).filter(
            models.AnomalyEvent.resolved == False  # noqa: E712
        ).scalar() or 0,
        resolved_anomalies=db.query(func.count(models.AnomalyEvent.id)).filter(
            models.AnomalyEvent.resolved == True  # noqa: E712
        ).scalar() or 0,
        avg_system_health=round(float(db.query(func.avg(models.Sensor.health_score)).scalar() or 100.0), 2),
        total_equipment=db.query(func.count(models.Equipment.id)).scalar() or 0,
    )


# ─── GET /sensor-performance ─────────────────────────────────────────────────

@router.get("/sensor-performance", response_model=SensorPerformanceReport)
def get_sensor_performance(
    equipment_id: Optional[int] = Query(None, description="Filter by equipment ID"),
    sensor_id: Optional[int] = Query(None, description="Filter by sensor ID"),
    date_from: Optional[str] = Query(None, description="ISO 8601 start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="ISO 8601 end date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """
    Returns full sensor performance report as JSON for frontend rendering.

    Each row contains: sensor metadata, operating period (first & last reading),
    avg/min/max for temperature, pressure and flow, anomaly count, and current health.
    """
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    rows = _build_sensor_rows(db, equipment_id, sensor_id, dt_from, dt_to)

    result_rows = [
        SensorPerformanceRow(
            sensor_id=sensor.id,
            sensor_code=sensor.sensor_code,
            sensor_type=sensor.sensor_type,
            equipment_name=equipment_name or "Unassigned",
            location=sensor.location,
            health_score=round(sensor.health_score or 0.0, 2),
            status=sensor.status,
            first_reading=_iso(first_reading),
            last_reading=_iso(last_reading),
            total_readings=int(total_readings or 0),
            avg_temperature=_round(avg_temperature),
            min_temperature=_round(min_temperature),
            max_temperature=_round(max_temperature),
            avg_pressure=_round(avg_pressure),
            min_pressure=_round(min_pressure),
            max_pressure=_round(max_pressure),
            avg_flow=_round(avg_flow),
            min_flow=_round(min_flow),
            max_flow=_round(max_flow),
            anomaly_count=int(anomaly_count or 0),
        )
        for (
            sensor, equipment_name,
            first_reading, last_reading, total_readings,
            avg_temperature, min_temperature, max_temperature,
            avg_pressure, min_pressure, max_pressure,
            avg_flow, min_flow, max_flow,
            anomaly_count,
        ) in rows
    ]

    filters_applied = {}
    if equipment_id:
        filters_applied["equipment_id"] = equipment_id
    if sensor_id:
        filters_applied["sensor_id"] = sensor_id
    if date_from:
        filters_applied["date_from"] = date_from
    if date_to:
        filters_applied["date_to"] = date_to

    return SensorPerformanceReport(
        generated_at=datetime.utcnow().isoformat() + "Z",
        total_sensors=len(result_rows),
        filters_applied=filters_applied,
        rows=result_rows,
    )


# ─── GET /sensor-performance/csv ─────────────────────────────────────────────

@router.get("/sensor-performance/csv")
def download_sensor_performance_csv(
    equipment_id: Optional[int] = Query(None),
    sensor_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Downloads a fully-aggregated sensor performance CSV.
    Includes operating period, avg/min/max for all three metrics, anomaly count, and health.
    All values computed dynamically — no static files.
    """
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    rows = _build_sensor_rows(db, equipment_id, sensor_id, dt_from, dt_to)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Sensor ID", "Sensor Code", "Type", "Equipment", "Location",
        "Health Score (%)", "Status",
        "First Reading", "Last Reading", "Total Readings",
        "Avg Temp (°C)", "Min Temp (°C)", "Max Temp (°C)",
        "Avg Pressure (bar)", "Min Pressure (bar)", "Max Pressure (bar)",
        "Avg Flow (L/min)", "Min Flow (L/min)", "Max Flow (L/min)",
        "Anomaly Count",
    ])

    for (
        sensor, equipment_name,
        first_reading, last_reading, total_readings,
        avg_temperature, min_temperature, max_temperature,
        avg_pressure, min_pressure, max_pressure,
        avg_flow, min_flow, max_flow,
        anomaly_count,
    ) in rows:
        writer.writerow([
            sensor.id,
            sensor.sensor_code,
            sensor.sensor_type,
            equipment_name or "Unassigned",
            sensor.location or "",
            round(sensor.health_score or 0.0, 2),
            sensor.status or "",
            _iso(first_reading) or "",
            _iso(last_reading) or "",
            int(total_readings or 0),
            _round(avg_temperature) or "",
            _round(min_temperature) or "",
            _round(max_temperature) or "",
            _round(avg_pressure) or "",
            _round(min_pressure) or "",
            _round(max_pressure) or "",
            _round(avg_flow) or "",
            _round(min_flow) or "",
            _round(max_flow) or "",
            int(anomaly_count or 0),
        ])

    output.seek(0)

    parts = ["sensor_performance_report"]
    if date_from:
        parts.append(f"from_{date_from}")
    if date_to:
        parts.append(f"to_{date_to}")
    filename = "_".join(parts) + ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── GET /faults ─────────────────────────────────────────────────────────────

@router.get("/faults", response_model=FaultReport)
def get_faults_report(
    equipment_id: Optional[int] = Query(None, description="Filter by equipment ID"),
    sensor_id: Optional[int] = Query(None, description="Filter by sensor ID"),
    severity: Optional[str] = Query(None, description="CRITICAL | HIGH | MEDIUM | LOW"),
    pattern: Optional[str] = Query(None, description="DRIFT | SPIKE | FLATLINE | NOISE | GENERAL_ANOMALY"),
    date_from: Optional[str] = Query(None, description="ISO 8601 start date"),
    date_to: Optional[str] = Query(None, description="ISO 8601 end date"),
    resolved: Optional[bool] = Query(None, description="true = resolved only, false = active only"),
    db: Session = Depends(get_db),
):
    """
    Returns full fault & anomaly report as JSON for frontend rendering.
    """
    query = (
        db.query(
            models.AnomalyEvent,
            models.Sensor.sensor_code,
            models.Equipment.name.label("equipment_name"),
        )
        .join(models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id)
        .outerjoin(models.Equipment, models.AnomalyEvent.equipment_id == models.Equipment.id)
    )

    if equipment_id:
        query = query.filter(models.AnomalyEvent.equipment_id == equipment_id)
    if sensor_id:
        query = query.filter(models.AnomalyEvent.sensor_id == sensor_id)
    if severity and severity.upper() != "ALL":
        query = query.filter(models.AnomalyEvent.severity == severity.upper())
    if pattern and pattern.upper() != "ALL":
        query = query.filter(models.AnomalyEvent.anomaly_type == pattern.upper())
    if resolved is not None:
        query = query.filter(models.AnomalyEvent.resolved == resolved)
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)
    if dt_from:
        query = query.filter(models.AnomalyEvent.detected_at >= dt_from)
    if dt_to:
        query = query.filter(models.AnomalyEvent.detected_at <= dt_to)

    rows = query.order_by(models.AnomalyEvent.detected_at.desc()).all()

    result_rows = [
        FaultRow(
            event_id=event.id,
            sensor_code=sensor_code,
            equipment_name=equipment_name or "Unassigned",
            anomaly_type=event.anomaly_type,
            severity=event.severity,
            anomaly_score=round(event.anomaly_score or 0.0, 4),
            detected_at=_iso(event.detected_at) or "",
            recommended_action=event.recommended_action,
            resolved=event.resolved,
            resolved_at=_iso(event.resolved_at),
        )
        for event, sensor_code, equipment_name in rows
    ]

    filters_applied = {}
    if equipment_id: filters_applied["equipment_id"] = equipment_id
    if sensor_id: filters_applied["sensor_id"] = sensor_id
    if severity and severity.upper() != "ALL": filters_applied["severity"] = severity
    if pattern and pattern.upper() != "ALL": filters_applied["pattern"] = pattern
    if date_from: filters_applied["date_from"] = date_from
    if date_to: filters_applied["date_to"] = date_to
    if resolved is not None: filters_applied["resolved"] = resolved

    return FaultReport(
        generated_at=datetime.utcnow().isoformat() + "Z",
        total_faults=len(result_rows),
        filters_applied=filters_applied,
        rows=result_rows,
    )


# ─── GET /faults/csv ─────────────────────────────────────────────────────────

@router.get("/faults/csv")
def download_faults_csv(
    equipment_id: Optional[int] = Query(None, description="Filter by equipment ID"),
    sensor_id: Optional[int] = Query(None, description="Filter by sensor ID"),
    severity: Optional[str] = Query(None, description="CRITICAL | HIGH | MEDIUM | LOW"),
    pattern: Optional[str] = Query(None, description="DRIFT | SPIKE | FLATLINE | NOISE | GENERAL_ANOMALY"),
    date_from: Optional[str] = Query(None, description="ISO 8601 start date"),
    date_to: Optional[str] = Query(None, description="ISO 8601 end date"),
    resolved: Optional[bool] = Query(None, description="true = resolved only, false = active only"),
    db: Session = Depends(get_db),
):
    """Downloads filtered fault & anomaly events as CSV."""
    query = (
        db.query(
            models.AnomalyEvent,
            models.Sensor.sensor_code,
            models.Equipment.name.label("equipment_name"),
        )
        .join(models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id)
        .outerjoin(models.Equipment, models.AnomalyEvent.equipment_id == models.Equipment.id)
    )

    if equipment_id:
        query = query.filter(models.AnomalyEvent.equipment_id == equipment_id)
    if sensor_id:
        query = query.filter(models.AnomalyEvent.sensor_id == sensor_id)
    if severity and severity.upper() != "ALL":
        query = query.filter(models.AnomalyEvent.severity == severity.upper())
    if pattern and pattern.upper() != "ALL":
        query = query.filter(models.AnomalyEvent.anomaly_type == pattern.upper())
    if resolved is not None:
        query = query.filter(models.AnomalyEvent.resolved == resolved)
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)
    if dt_from:
        query = query.filter(models.AnomalyEvent.detected_at >= dt_from)
    if dt_to:
        query = query.filter(models.AnomalyEvent.detected_at <= dt_to)

    rows = query.order_by(models.AnomalyEvent.detected_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", "Sensor Code", "Equipment Name", "Anomaly Type",
        "Severity", "Anomaly Score", "Detected At",
        "Recommended Action", "Resolved", "Resolved At",
    ])

    for event, sensor_code, equipment_name in rows:
        writer.writerow([
            event.id, sensor_code, equipment_name or "Unassigned",
            event.anomaly_type, event.severity,
            round(event.anomaly_score or 0.0, 4),
            _iso(event.detected_at) or "",
            event.recommended_action or "",
            "Yes" if event.resolved else "No",
            _iso(event.resolved_at) or "",
        ])

    output.seek(0)

    parts = ["faults_anomalies"]
    if severity and severity.upper() != "ALL":
        parts.append(severity.lower())
    if pattern and pattern.upper() != "ALL":
        parts.append(pattern.lower())
    if date_from:
        parts.append(f"from_{date_from}")
    if date_to:
        parts.append(f"to_{date_to}")
    filename = "_".join(parts) + ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
