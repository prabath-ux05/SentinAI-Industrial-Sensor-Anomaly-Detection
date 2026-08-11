"""
Equipment API Router
====================
Endpoints:
  GET  /api/equipment                        – Paginated list with search/filter/sort
  POST /api/equipment                        – Create equipment
  GET  /api/sensors                          – Flat sensor list

  GET  /api/equipment/{id}                   – Full equipment profile
  GET  /api/equipment/{id}/sensors           – Sensors with latest reading (no N+1)
  GET  /api/equipment/{id}/telemetry         – Recent telemetry across all sensors
  GET  /api/equipment/{id}/alerts            – Active (unresolved) anomaly alerts
  GET  /api/equipment/{id}/maintenance       – Paginated maintenance history
"""
import math
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models import domain as models
from backend.schemas import domain as schemas

router = APIRouter()

# ─── Column lookup for list-sort ─────────────────────────────────────────────

_SORT_COLUMNS = {
    "health_score":      models.Equipment.health_score,
    "name":              models.Equipment.name,
    "installation_date": models.Equipment.installation_date,
}

# ─── Helper: scalar subquery for sensor count ────────────────────────────────

def _sensor_count_subq():
    """Returns a select statement that counts sensors per equipment id."""
    return (
        select(func.count(models.Sensor.id))
        .where(models.Sensor.equipment_id == models.Equipment.id)
    )


def _alert_count_subq():
    """Returns a select statement that counts active (unresolved) alerts per equipment id."""
    return (
        select(func.count(models.AnomalyEvent.id))
        .where(
            models.AnomalyEvent.equipment_id == models.Equipment.id,
            models.AnomalyEvent.resolved == False,  # noqa: E712
        )
    )


# ─── GET /equipment ───────────────────────────────────────────────────────────

@router.get("/equipment", response_model=schemas.PaginatedEquipment)
def get_equipment(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(12, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, equipment_code, or manufacturer"),
    status: Optional[str] = Query(None, description="Filter by status (case-insensitive)"),
    health: Optional[str] = Query(None, description="Filter by health bucket: HEALTHY | MONITOR | ATTENTION | CRITICAL"),
    manufacturer: Optional[str] = Query(None, description="Filter by manufacturer (case-insensitive)"),
    sort_by: str = Query("health_score", description="Column to sort by: health_score | name | installation_date"),
    order: Literal["asc", "desc"] = Query("asc", description="Sort direction"),
    db: Session = Depends(get_db),
):
    """
    Returns a paginated list of equipment assets.

    Supports full-text search across name, equipment_code, and manufacturer.
    Filtering is available for status, health bucket, and manufacturer.
    Sorting is available for health_score, name, and installation_date.
    Each item includes a pre-computed sensor_count.
    """
    # Use scalar subqueries to avoid N+1 and GROUP BY complications
    sensor_count_sq = _sensor_count_subq().correlate(models.Equipment).scalar_subquery().label("sensor_count")

    query = db.query(models.Equipment, sensor_count_sq)

    # ── Search ────────────────────────────────────────────────────────────────
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Equipment.name.ilike(term),
                models.Equipment.equipment_code.ilike(term),
                models.Equipment.manufacturer.ilike(term),
            )
        )

    # ── Status ────────────────────────────────────────────────────────────────
    if status and status.upper() != "ALL":
        query = query.filter(models.Equipment.status.ilike(status))

    # ── Manufacturer ──────────────────────────────────────────────────────────
    if manufacturer and manufacturer.upper() != "ALL":
        query = query.filter(models.Equipment.manufacturer.ilike(manufacturer))

    # ── Health bucket ─────────────────────────────────────────────────────────
    if health and health.upper() != "ALL":
        h = health.upper()
        if h == "HEALTHY":
            query = query.filter(models.Equipment.health_score >= 80)
        elif h == "MONITOR":
            query = query.filter(models.Equipment.health_score >= 50, models.Equipment.health_score < 80)
        elif h == "ATTENTION":
            query = query.filter(models.Equipment.health_score >= 25, models.Equipment.health_score < 50)
        elif h == "CRITICAL":
            query = query.filter(models.Equipment.health_score < 25)

    # ── Sorting ───────────────────────────────────────────────────────────────
    sort_col = _SORT_COLUMNS.get(sort_by, models.Equipment.health_score)
    query = query.order_by(asc(sort_col) if order == "asc" else desc(sort_col))

    # ── Pagination ────────────────────────────────────────────────────────────
    total_records = query.count()
    total_pages = max(1, math.ceil(total_records / page_size)) if total_records > 0 else 1
    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all() if total_records > 0 else []

    items = [
        schemas.EquipmentListItem(
            id=equip.id,
            equipment_code=equip.equipment_code,
            name=equip.name,
            model=equip.model,
            manufacturer=equip.manufacturer,
            description=equip.description,
            status=equip.status,
            health_score=equip.health_score or 0.0,
            created_at=equip.created_at,
            image_url=equip.image_url,
            installation_date=equip.installation_date,
            sensor_count=sensor_count or 0,
        )
        for equip, sensor_count in rows
    ]

    return schemas.PaginatedEquipment(
        page=page,
        page_size=page_size,
        total_records=total_records,
        total_pages=total_pages,
        items=items,
    )


# ─── POST /equipment ──────────────────────────────────────────────────────────

@router.post("/equipment", response_model=schemas.EquipmentResponse)
def create_equipment(equipment: schemas.EquipmentCreate, db: Session = Depends(get_db)):
    # Check for duplicate equipment code
    existing = db.query(models.Equipment).filter(models.Equipment.equipment_code == equipment.equipment_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Equipment with this code already exists.")
        
    db_equip = models.Equipment(**equipment.dict())
    db.add(db_equip)
    db.commit()
    db.refresh(db_equip)
    return db_equip


# ─── GET /sensors ─────────────────────────────────────────────────────────────

@router.get("/sensors", response_model=List[schemas.SensorResponse])
def get_sensors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sensors = db.query(models.Sensor).offset(skip).limit(limit).all()
    return sensors


# ─── GET /equipment/{id} ──────────────────────────────────────────────────────

@router.get("/equipment/{id}", response_model=schemas.EquipmentDetail)
def get_equipment_detail(id: int, db: Session = Depends(get_db)):
    """
    Returns a full equipment profile with pre-computed sensor_count and
    active_alert_count — fetched in a single query using correlated subqueries.
    """
    sensor_count_sq = _sensor_count_subq().correlate(models.Equipment).scalar_subquery().label("sensor_count")
    alert_count_sq = _alert_count_subq().correlate(models.Equipment).scalar_subquery().label("active_alert_count")

    row = (
        db.query(models.Equipment, sensor_count_sq, alert_count_sq)
        .filter(models.Equipment.id == id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Equipment not found")

    equip, sensor_count, alert_count = row
    return schemas.EquipmentDetail(
        id=equip.id,
        equipment_code=equip.equipment_code,
        name=equip.name,
        model=equip.model,
        manufacturer=equip.manufacturer,
        description=equip.description,
        status=equip.status,
        health_score=equip.health_score or 0.0,
        created_at=equip.created_at,
        image_url=equip.image_url,
        installation_date=equip.installation_date,
        sensor_count=sensor_count or 0,
        active_alert_count=alert_count or 0,
    )


# ─── GET /equipment/{id}/sensors ─────────────────────────────────────────────

@router.get("/equipment/{id}/sensors", response_model=List[schemas.EquipmentSensorItem])
def get_equipment_sensors(id: int, db: Session = Depends(get_db)):
    """
    Returns all sensors linked to this equipment.

    Latest telemetry reading is resolved per-sensor using a correlated
    subquery so the entire endpoint executes in ONE database round-trip,
    avoiding the previous N+1 query pattern.
    """
    # Correlated subquery: newest SensorTelemetry.id for each sensor
    latest_tel_id_sq = (
        db.query(func.max(models.SensorTelemetry.id))
        .filter(models.SensorTelemetry.sensor_id == models.Sensor.id)
        .correlate(models.Sensor)
        .scalar_subquery()
    )

    sensors = (
        db.query(models.Sensor)
        .filter(models.Sensor.equipment_id == id)
        .all()
    )

    if not sensors:
        return []

    # Bulk-fetch the latest telemetry row per sensor using a single GROUP BY subquery.
    # This replaces the previous N+1 pattern (one query per sensor).
    sensor_ids = [s.id for s in sensors]

    # Subquery: max(id) per sensor_id acts as a proxy for the latest row
    latest_id_by_sensor = (
        db.query(func.max(models.SensorTelemetry.id).label("latest_id"))
        .filter(models.SensorTelemetry.sensor_id.in_(sensor_ids))
        .group_by(models.SensorTelemetry.sensor_id)
        .subquery()
    )

    latest_tels = (
        db.query(models.SensorTelemetry)
        .filter(models.SensorTelemetry.id.in_(latest_id_by_sensor))
        .all()
    )

    # Build a map: sensor_id → latest telemetry row
    tel_map: dict[int, models.SensorTelemetry] = {t.sensor_id: t for t in latest_tels}

    result = []
    for s in sensors:
        latest = tel_map.get(s.id)
        latest_val = None
        if latest:
            if s.sensor_type == "temperature":
                latest_val = latest.temperature
            elif s.sensor_type == "pressure":
                latest_val = latest.pressure
            elif s.sensor_type == "flow":
                latest_val = latest.flow

        result.append(
            schemas.EquipmentSensorItem(
                id=s.id,
                sensor_code=s.sensor_code,
                sensor_type=s.sensor_type,
                equipment_id=s.equipment_id,
                location=s.location,
                status=s.status,
                health_score=s.health_score or 0.0,
                created_at=s.created_at,
                latest_reading=latest_val,
                latest_reading_time=latest.created_at if latest else None,
            )
        )
    return result


# ─── GET /equipment/{id}/telemetry ───────────────────────────────────────────

@router.get("/equipment/{id}/telemetry", response_model=List[schemas.TelemetryPoint])
def get_equipment_telemetry(
    id: int,
    limit: int = Query(150, ge=1, le=1000, description="Max readings to return (chronological order)"),
    db: Session = Depends(get_db),
):
    """
    Returns the most recent `limit` telemetry records across ALL sensors
    linked to this equipment, sorted chronologically for charting.

    Each point includes sensor_code and sensor_type so the frontend can
    render per-sensor series on multi-sensor equipment.
    """
    rows = (
        db.query(models.SensorTelemetry, models.Sensor.sensor_code, models.Sensor.sensor_type)
        .join(models.Sensor, models.SensorTelemetry.sensor_id == models.Sensor.id)
        .filter(models.Sensor.equipment_id == id)
        .order_by(models.SensorTelemetry.created_at.desc())
        .limit(limit)
        .all()
    )
    # Reverse to chronological order for chart consumption
    rows.reverse()

    return [
        schemas.TelemetryPoint(
            timestamp=r.created_at,
            sensor_code=sensor_code,
            sensor_type=sensor_type,
            temperature=r.temperature,
            pressure=r.pressure,
            flow=r.flow,
            anomaly_score=r.anomaly_score,
            is_anomaly=r.is_anomaly,
            severity=r.severity,
        )
        for r, sensor_code, sensor_type in rows
    ]


# ─── GET /equipment/{id}/alerts ───────────────────────────────────────────────

@router.get("/equipment/{id}/alerts", response_model=List[schemas.AnomalyListItem])
def get_equipment_alerts(
    id: int,
    severity: Optional[str] = Query(None, description="Filter by severity: CRITICAL | HIGH | MEDIUM | LOW"),
    limit: int = Query(50, ge=1, le=200, description="Max alerts to return"),
    db: Session = Depends(get_db),
):
    """
    Returns active (unresolved) anomaly alerts for this equipment.

    Optionally filter by severity. Ordered newest-first.
    """
    query = (
        db.query(models.AnomalyEvent, models.Sensor, models.Equipment)
        .join(models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id)
        .join(models.Equipment, models.Sensor.equipment_id == models.Equipment.id)
        .filter(
            models.AnomalyEvent.equipment_id == id,
            models.AnomalyEvent.resolved == False,  # noqa: E712
        )
    )

    if severity and severity.upper() != "ALL":
        query = query.filter(models.AnomalyEvent.severity == severity.upper())

    rows = query.order_by(models.AnomalyEvent.detected_at.desc()).limit(limit).all()

    return [
        schemas.AnomalyListItem(
            id=anomaly.id,
            sensor_id=sensor.id,
            sensor_code=sensor.sensor_code,
            equipment_name=equipment.name,
            anomaly_score=anomaly.anomaly_score,
            anomaly_type=anomaly.anomaly_type,
            severity=anomaly.severity,
            health_score=sensor.health_score or 0.0,
            detected_at=anomaly.detected_at,
            recommended_action=anomaly.recommended_action,
            resolved=anomaly.resolved,
            resolved_at=anomaly.resolved_at,
        )
        for anomaly, sensor, equipment in rows
    ]


# ─── GET /equipment/{id}/maintenance ─────────────────────────────────────────

@router.get("/equipment/{id}/maintenance", response_model=schemas.PaginatedMaintenance)
def get_equipment_maintenance(
    id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status: Optional[str] = Query(None, description="Filter by status: Resolved | Open | In Progress"),
    db: Session = Depends(get_db),
):
    """
    Returns paginated maintenance history for this equipment, newest first.
    Optionally filter by record status.
    """
    query = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.equipment_id == id
    )

    if status and status.upper() != "ALL":
        query = query.filter(models.MaintenanceRecord.status.ilike(status))

    total_records = query.count()
    total_pages = max(1, math.ceil(total_records / page_size))
    offset = (page - 1) * page_size

    rows = (
        query
        .order_by(models.MaintenanceRecord.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return schemas.PaginatedMaintenance(
        page=page,
        page_size=page_size,
        total_records=total_records,
        total_pages=total_pages,
        items=[
            schemas.MaintenanceItem(
                id=r.id,
                issue=r.issue,
                action_taken=r.action_taken,
                status=r.status,
                created_at=r.created_at,
                resolved_at=r.resolved_at,
            )
            for r in rows
        ],
    )
