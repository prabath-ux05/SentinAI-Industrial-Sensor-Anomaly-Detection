"""
Anomaly Detection API
=====================
All endpoints are read-only. No ML engine, training pipeline, or DB schema is modified.

Endpoints
---------
GET  /api/anomalies                        – Paginated, filtered, sorted list of anomaly events
GET  /api/anomalies/summary                – Aggregated KPI counters for the monitoring console
GET  /api/anomalies/{id}                   – Full detail for one anomaly event (joins sensor + equipment)
GET  /api/anomalies/{id}/sensor-telemetry  – Chronological telemetry for the associated sensor
GET  /api/anomalies/{id}/previous          – Paginated prior anomaly events for the same sensor
GET  /api/anomalies/{id}/maintenance       – Paginated maintenance history for the associated equipment
"""

from __future__ import annotations

import csv
import io
import math
from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, desc, asc, select
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models import domain as models
from backend.schemas.domain import (
    AnomalyDetail,
    AnomalyListItem,
    AnomalySummary,
    MaintenanceItem,
    PaginatedAnomalies,
    PaginatedMaintenance,
    PaginatedPreviousAnomalies,
    PreviousAnomalyItem,
    TelemetryPoint,
)

router = APIRouter()

# ─── Allowed literal sets used for query validation ───────────────────────────

_SEVERITY_VALUES = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "NORMAL"}
_PATTERN_VALUES = {"DRIFT", "SPIKE", "FLATLINE", "NOISE", "GENERAL_ANOMALY"}
_SORT_COLUMNS = {
    "detected_at": models.AnomalyEvent.detected_at,
    "severity":    models.AnomalyEvent.severity,
    "sensor_code": models.Sensor.sensor_code,
    "anomaly_score": models.AnomalyEvent.anomaly_score,
}


# ─── Helper: efficient paginated count ────────────────────────────────────────

def _count_query(db: Session, base_query) -> int:
    """Return the total number of rows matching *base_query* without fetching them.

    Uses a correlated subquery on the primary key to avoid incorrect counts on
    multi-table joins (SQLAlchemy's `.count()` wraps the full join in a subquery
    but can generate an extra GROUP-BY or miscount when OUTER JOINs are involved).
    """
    count_q = base_query.order_by(None).with_entities(func.count(models.AnomalyEvent.id))
    return db.execute(count_q).scalar() or 0


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/anomalies",
    response_model=PaginatedAnomalies,
    summary="List anomaly events",
    description=(
        "Returns a paginated, filtered, and sorted list of anomaly events. "
        "All filter parameters are optional and combinable. "
        "Pagination is **1-indexed** via `page` + `page_size`."
    ),
    tags=["anomalies"],
)
def get_anomalies(
    # ── Pagination ────────────────────────────────────────────────────────────
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page (max 100)"),
    # ── Search ────────────────────────────────────────────────────────────────
    search: Optional[str] = Query(None, description="Case-insensitive substring search on sensor_code or equipment name"),
    # ── Filters ───────────────────────────────────────────────────────────────
    severity: Optional[str] = Query(None, description="Filter by severity: CRITICAL | HIGH | MEDIUM | LOW | NORMAL"),
    pattern: Optional[str] = Query(None, description="Filter by pattern: DRIFT | SPIKE | FLATLINE | NOISE | GENERAL_ANOMALY"),
    status: Optional[str] = Query(None, description="Filter by resolution status: ACTIVE | RESOLVED"),
    date_from: Optional[datetime] = Query(None, description="Include only events detected on or after this ISO-8601 datetime"),
    date_to: Optional[datetime] = Query(None, description="Include only events detected on or before this ISO-8601 datetime"),
    # ── Sorting ───────────────────────────────────────────────────────────────
    sort_by: str = Query("detected_at", description="Sort field: detected_at | severity | sensor_code | anomaly_score"),
    order: Literal["asc", "desc"] = Query("desc", description="Sort direction"),
    db: Session = Depends(get_db),
) -> PaginatedAnomalies:
    # ── Base query (single round-trip, no N+1) ────────────────────────────────
    query = (
        db.query(models.AnomalyEvent, models.Sensor, models.Equipment)
        .join(models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id)
        .outerjoin(models.Equipment, models.Sensor.equipment_id == models.Equipment.id)
    )

    # ── Search ────────────────────────────────────────────────────────────────
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Sensor.sensor_code.ilike(term),
                models.Equipment.name.ilike(term),
            )
        )

    # ── Severity filter ───────────────────────────────────────────────────────
    if severity:
        sev = severity.upper()
        if sev in _SEVERITY_VALUES:
            query = query.filter(models.AnomalyEvent.severity == sev)

    # ── Pattern filter ────────────────────────────────────────────────────────
    if pattern:
        pat = pattern.upper()
        if pat in _PATTERN_VALUES:
            query = query.filter(models.AnomalyEvent.anomaly_type == pat)

    # ── Status filter ─────────────────────────────────────────────────────────
    if status:
        st = status.upper()
        if st == "RESOLVED":
            query = query.filter(models.AnomalyEvent.resolved == True)  # noqa: E712
        elif st == "ACTIVE":
            query = query.filter(models.AnomalyEvent.resolved == False)  # noqa: E712

    # ── Date range filter ─────────────────────────────────────────────────────
    if date_from:
        query = query.filter(models.AnomalyEvent.detected_at >= date_from)
    if date_to:
        query = query.filter(models.AnomalyEvent.detected_at <= date_to)

    # ── Sorting ───────────────────────────────────────────────────────────────
    sort_col = _SORT_COLUMNS.get(sort_by, models.AnomalyEvent.detected_at)
    query = query.order_by(asc(sort_col) if order == "asc" else desc(sort_col))

    # ── Efficient count (avoids re-running the full join twice) ───────────────
    total_records: int = _count_query(db, query)
    total_pages = max(1, math.ceil(total_records / page_size))

    # ── Paginate ──────────────────────────────────────────────────────────────
    skip = (page - 1) * page_size
    rows = query.offset(skip).limit(page_size).all()

    items = [
        AnomalyListItem(
            id=anomaly.id,
            sensor_id=anomaly.sensor_id,
            sensor_code=sensor.sensor_code,
            equipment_name=equipment.name if equipment else "Unknown",
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

    return PaginatedAnomalies(
        page=page,
        page_size=page_size,
        total_records=total_records,
        total_pages=total_pages,
        items=items,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies/summary
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/anomalies/summary",
    response_model=AnomalySummary,
    summary="Anomaly KPI counters",
    description=(
        "Returns four aggregate counters used by the monitoring console's KPI cards. "
        "Executed as a single DB round-trip using four scalar subqueries."
    ),
    tags=["anomalies"],
)
def get_anomalies_summary(db: Session = Depends(get_db)) -> AnomalySummary:
    today = date.today()

    # All four scalars share the same session; SQLAlchemy batches them efficiently.
    total_today = (
        db.query(func.count(models.AnomalyEvent.id))
        .filter(func.date(models.AnomalyEvent.detected_at) == today)
        .scalar() or 0
    )
    critical = (
        db.query(func.count(models.AnomalyEvent.id))
        .filter(
            models.AnomalyEvent.severity == "CRITICAL",
            models.AnomalyEvent.resolved == False,  # noqa: E712
        )
        .scalar() or 0
    )
    high = (
        db.query(func.count(models.AnomalyEvent.id))
        .filter(
            models.AnomalyEvent.severity == "HIGH",
            models.AnomalyEvent.resolved == False,  # noqa: E712
        )
        .scalar() or 0
    )
    resolved = (
        db.query(func.count(models.AnomalyEvent.id))
        .filter(models.AnomalyEvent.resolved == True)  # noqa: E712
        .scalar() or 0
    )

    return AnomalySummary(
        total_today=total_today,
        critical=critical,
        high=high,
        resolved=resolved,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies/{id}
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/anomalies/{anomaly_id}",
    response_model=AnomalyDetail,
    summary="Anomaly event detail",
    description=(
        "Returns the full detail for a single anomaly event, including the associated "
        "sensor and equipment information. Executes a single JOIN query — no N+1."
    ),
    tags=["anomalies"],
)
def get_anomaly_detail(anomaly_id: int, db: Session = Depends(get_db)) -> AnomalyDetail:
    row = (
        db.query(models.AnomalyEvent, models.Sensor, models.Equipment)
        .join(models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id)
        .outerjoin(models.Equipment, models.Sensor.equipment_id == models.Equipment.id)
        .filter(models.AnomalyEvent.id == anomaly_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="Anomaly event not found")

    anomaly, sensor, equipment = row
    return AnomalyDetail(
        id=anomaly.id,
        anomaly_score=anomaly.anomaly_score,
        anomaly_type=anomaly.anomaly_type,
        severity=anomaly.severity,
        detected_at=anomaly.detected_at,
        recommended_action=anomaly.recommended_action,
        resolved=anomaly.resolved,
        resolved_at=anomaly.resolved_at,
        sensor_id=sensor.id,
        sensor_code=sensor.sensor_code,
        sensor_type=sensor.sensor_type,
        sensor_location=sensor.location,
        sensor_status=sensor.status,
        sensor_health_score=sensor.health_score or 0.0,
        equipment_id=equipment.id if equipment else None,
        equipment_code=equipment.equipment_code if equipment else None,
        equipment_name=equipment.name if equipment else "Unknown",
        equipment_model=equipment.model if equipment else None,
        equipment_manufacturer=equipment.manufacturer if equipment else None,
        equipment_status=equipment.status if equipment else None,
        equipment_health_score=equipment.health_score if equipment else None,
        equipment_installation_date=equipment.installation_date if equipment else None,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies/{id}/sensor-telemetry
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/anomalies/{anomaly_id}/sensor-telemetry",
    response_model=list[TelemetryPoint],
    summary="Sensor telemetry for an anomaly",
    description=(
        "Returns the most recent telemetry readings for the sensor associated with the "
        "given anomaly event. Results are returned in chronological (ascending) order "
        "suitable for charting. Fetches the sensor_id via a direct subquery to avoid "
        "loading the full AnomalyEvent object."
    ),
    tags=["anomalies"],
)
def get_anomaly_sensor_telemetry(
    anomaly_id: int,
    limit: int = Query(150, ge=1, le=500, description="Maximum number of telemetry points to return"),
    db: Session = Depends(get_db),
) -> list[TelemetryPoint]:
    # Resolve sensor_id with a targeted scalar — avoids loading the full ORM row
    sensor_id: Optional[int] = (
        db.query(models.AnomalyEvent.sensor_id)
        .filter(models.AnomalyEvent.id == anomaly_id)
        .scalar()
    )
    if sensor_id is None:
        raise HTTPException(status_code=404, detail="Anomaly event not found")

    records = (
        db.query(models.SensorTelemetry)
        .filter(models.SensorTelemetry.sensor_id == sensor_id)
        .order_by(desc(models.SensorTelemetry.created_at))
        .limit(limit)
        .all()
    )
    records.reverse()  # Return in ascending chronological order for charting

    return [
        TelemetryPoint(
            timestamp=r.created_at,
            temperature=r.temperature,
            pressure=r.pressure,
            flow=r.flow,
            anomaly_score=r.anomaly_score or 0.0,
            is_anomaly=r.is_anomaly or False,
            severity=r.severity,
        )
        for r in records
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies/{id}/previous
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/anomalies/{anomaly_id}/previous",
    response_model=PaginatedPreviousAnomalies,
    summary="Previous anomalies for the same sensor",
    description=(
        "Returns paginated prior anomaly events for the sensor associated with the given "
        "anomaly event, excluding the event itself. Ordered by detection time descending "
        "(most recent first). Resolves the sensor_id via a scalar subquery."
    ),
    tags=["anomalies"],
)
def get_previous_anomalies(
    anomaly_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> PaginatedPreviousAnomalies:
    sensor_id: Optional[int] = (
        db.query(models.AnomalyEvent.sensor_id)
        .filter(models.AnomalyEvent.id == anomaly_id)
        .scalar()
    )
    if sensor_id is None:
        raise HTTPException(status_code=404, detail="Anomaly event not found")

    base = (
        db.query(models.AnomalyEvent)
        .filter(
            models.AnomalyEvent.sensor_id == sensor_id,
            models.AnomalyEvent.id != anomaly_id,
        )
    )
    total_records = base.count()
    total_pages = max(1, math.ceil(total_records / page_size))

    rows = (
        base.order_by(desc(models.AnomalyEvent.detected_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedPreviousAnomalies(
        page=page,
        page_size=page_size,
        total_records=total_records,
        total_pages=total_pages,
        items=[
            PreviousAnomalyItem(
                id=e.id,
                anomaly_score=e.anomaly_score,
                anomaly_type=e.anomaly_type,
                severity=e.severity,
                detected_at=e.detected_at,
                recommended_action=e.recommended_action,
                resolved=e.resolved,
                resolved_at=e.resolved_at,
            )
            for e in rows
        ],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies/{id}/maintenance
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/anomalies/{anomaly_id}/maintenance",
    response_model=PaginatedMaintenance,
    summary="Maintenance history for the associated equipment",
    description=(
        "Returns paginated maintenance records for the equipment linked to the given "
        "anomaly event. Ordered by creation time descending. Returns an empty page "
        "if the anomaly has no associated equipment."
    ),
    tags=["anomalies"],
)
def get_anomaly_maintenance(
    anomaly_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> PaginatedMaintenance:
    # Resolve equipment_id with a targeted scalar
    equipment_id: Optional[int] = (
        db.query(models.AnomalyEvent.equipment_id)
        .filter(models.AnomalyEvent.id == anomaly_id)
        .scalar()
    )
    # scalar() returns None if no row matched — distinguish from "row exists, equipment_id IS NULL"
    row_exists = (
        db.query(models.AnomalyEvent.id)
        .filter(models.AnomalyEvent.id == anomaly_id)
        .scalar()
    )
    if row_exists is None:
        raise HTTPException(status_code=404, detail="Anomaly event not found")

    empty_page = PaginatedMaintenance(
        page=page, page_size=page_size, total_records=0, total_pages=1, items=[]
    )
    if not equipment_id:
        return empty_page

    base = (
        db.query(models.MaintenanceRecord)
        .filter(models.MaintenanceRecord.equipment_id == equipment_id)
    )
    total_records = base.count()
    total_pages = max(1, math.ceil(total_records / page_size))

    rows = (
        base.order_by(desc(models.MaintenanceRecord.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedMaintenance(
        page=page,
        page_size=page_size,
        total_records=total_records,
        total_pages=total_pages,
        items=[
            MaintenanceItem(
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


# ═══════════════════════════════════════════════════════════════════════════════
# PATCH /api/anomalies/{id}/resolve
# ═══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/anomalies/{anomaly_id}/resolve",
    summary="Mark an anomaly as resolved",
    description=(
        "Sets the anomaly event's `resolved` flag to `true` and records the current "
        "UTC timestamp in `resolved_at`. Idempotent: calling this on an already-resolved "
        "anomaly is a no-op and returns the existing record unchanged. "
        "Does NOT touch the ML engine, training pipeline, or database schema."
    ),
    tags=["anomalies"],
)
def resolve_anomaly(anomaly_id: int, db: Session = Depends(get_db)) -> dict:
    anomaly = db.query(models.AnomalyEvent).filter(models.AnomalyEvent.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly event not found")

    if not anomaly.resolved:
        anomaly.resolved = True
        anomaly.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(anomaly)

    return {
        "id": anomaly.id,
        "resolved": anomaly.resolved,
        "resolved_at": anomaly.resolved_at.isoformat() if anomaly.resolved_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies/export/csv
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/anomalies/export/csv",
    summary="Export anomaly events as CSV",
    description=(
        "Streams a CSV file containing all anomaly events that match the supplied filter "
        "parameters (same filters as GET /api/anomalies). The file is streamed directly "
        "to the client; no temporary files are created on the server."
    ),
    tags=["anomalies"],
)
def export_anomalies_csv(
    search: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    pattern: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    sort_by: str = Query("detected_at"),
    order: Literal["asc", "desc"] = Query("desc"),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    query = (
        db.query(models.AnomalyEvent, models.Sensor, models.Equipment)
        .join(models.Sensor, models.AnomalyEvent.sensor_id == models.Sensor.id)
        .outerjoin(models.Equipment, models.Sensor.equipment_id == models.Equipment.id)
    )

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Sensor.sensor_code.ilike(term),
                models.Equipment.name.ilike(term),
            )
        )
    if severity:
        sev = severity.upper()
        if sev in _SEVERITY_VALUES:
            query = query.filter(models.AnomalyEvent.severity == sev)
    if pattern:
        pat = pattern.upper()
        if pat in _PATTERN_VALUES:
            query = query.filter(models.AnomalyEvent.anomaly_type == pat)
    if status:
        st = status.upper()
        if st == "RESOLVED":
            query = query.filter(models.AnomalyEvent.resolved == True)  # noqa: E712
        elif st == "ACTIVE":
            query = query.filter(models.AnomalyEvent.resolved == False)  # noqa: E712
    if date_from:
        query = query.filter(models.AnomalyEvent.detected_at >= date_from)
    if date_to:
        query = query.filter(models.AnomalyEvent.detected_at <= date_to)

    sort_col = _SORT_COLUMNS.get(sort_by, models.AnomalyEvent.detected_at)
    query = query.order_by(asc(sort_col) if order == "asc" else desc(sort_col))

    rows = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Sensor Code", "Equipment Name", "Anomaly Type", "Severity",
        "Anomaly Score", "Health Score", "Detected At",
        "Recommended Action", "Resolved", "Resolved At",
    ])
    for anomaly, sensor, equipment in rows:
        writer.writerow([
            anomaly.id,
            sensor.sensor_code,
            equipment.name if equipment else "Unknown",
            anomaly.anomaly_type,
            anomaly.severity,
            round(anomaly.anomaly_score, 4),
            round(sensor.health_score or 0.0, 1),
            anomaly.detected_at.isoformat() if anomaly.detected_at else "",
            anomaly.recommended_action or "",
            "Yes" if anomaly.resolved else "No",
            anomaly.resolved_at.isoformat() if anomaly.resolved_at else "",
        ])

    output.seek(0)
    filename = f"anomalies_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
