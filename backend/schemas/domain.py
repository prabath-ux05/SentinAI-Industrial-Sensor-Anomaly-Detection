from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Generic, TypeVar
from datetime import datetime, date

T = TypeVar("T")

class SensorTelemetryCreate(BaseModel):
    sensor_id: str
    sensor_type: str
    value: float
    timestamp: float

class EquipmentBase(BaseModel):
    equipment_code: str
    name: str
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "Active"
    health_score: Optional[float] = 100.0

class EquipmentCreate(BaseModel):
    """Payload accepted by POST /api/equipment."""
    equipment_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "Active"
    installation_date: Optional[datetime] = None
    image_url: Optional[str] = None

    @field_validator("equipment_code")
    @classmethod
    def code_no_spaces(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("name")
    @classmethod
    def name_strip(cls, v: str) -> str:
        return v.strip()

class EquipmentUpdate(BaseModel):
    """Payload accepted by PATCH /api/equipment/{id}."""
    name: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    installation_date: Optional[datetime] = None
    image_url: Optional[str] = None

class EquipmentResponse(EquipmentBase):
    id: int
    created_at: datetime
    image_url: Optional[str] = None
    installation_date: Optional[datetime] = None
    class Config:
        from_attributes = True

class EquipmentListItem(EquipmentBase):
    """Single row returned by GET /api/equipment."""
    id: int
    created_at: datetime
    image_url: Optional[str] = None
    installation_date: Optional[datetime] = None
    sensor_count: int = 0
    
    class Config:
        from_attributes = True

class PaginatedEquipment(BaseModel):
    """Paginated envelope for GET /api/equipment."""
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_records: int = Field(..., description="Total matching records across all pages")
    total_pages: int = Field(..., description="Total number of pages")
    items: List[EquipmentListItem]


class SensorBase(BaseModel):
    sensor_code: str
    sensor_type: str
    equipment_id: Optional[int] = None
    location: Optional[str] = None
    status: Optional[str] = "Active"
    health_score: Optional[float] = 100.0

class SensorResponse(SensorBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class EquipmentDetail(EquipmentBase):
    """Full profile returned by GET /api/equipment/{id}."""
    id: int
    created_at: datetime
    image_url: Optional[str] = None
    installation_date: Optional[datetime] = None
    sensor_count: int = 0
    active_alert_count: int = 0
    
    class Config:
        from_attributes = True

class EquipmentSensorItem(SensorBase):
    """Sensor row returned by GET /api/equipment/{id}/sensors."""
    id: int
    created_at: datetime
    latest_reading: Optional[float] = None
    latest_reading_time: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AnomalyEventResponse(BaseModel):
    id: int
    sensor_id: int
    equipment_id: Optional[int] = None
    anomaly_score: float
    anomaly_type: str
    severity: str
    detected_at: datetime
    recommended_action: Optional[str] = None
    resolved: bool
    
    class Config:
        from_attributes = True


# ─── Anomaly List ─────────────────────────────────────────────────────────────

class AnomalyListItem(BaseModel):
    """Single row returned by GET /api/anomalies."""
    id: int
    sensor_id: int
    sensor_code: str
    equipment_name: str
    anomaly_score: float
    anomaly_type: str
    severity: str
    health_score: float
    detected_at: Optional[datetime] = None
    recommended_action: Optional[str] = None
    resolved: bool
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaginatedAnomalies(BaseModel):
    """Paginated envelope for GET /api/anomalies."""
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_records: int = Field(..., description="Total matching records across all pages")
    total_pages: int = Field(..., description="Total number of pages")
    items: List[AnomalyListItem]


# ─── Anomaly Summary ──────────────────────────────────────────────────────────

class AnomalySummary(BaseModel):
    """Response for GET /api/anomalies/summary."""
    total_today: int = Field(..., description="Anomalies detected today")
    critical: int = Field(..., description="Unresolved CRITICAL anomalies")
    high: int = Field(..., description="Unresolved HIGH anomalies")
    resolved: int = Field(..., description="All-time resolved anomaly count")


# ─── Anomaly Detail ───────────────────────────────────────────────────────────

class AnomalyDetail(BaseModel):
    """Response for GET /api/anomalies/{id}."""
    # Event fields
    id: int
    anomaly_score: float
    anomaly_type: str
    severity: str
    detected_at: Optional[datetime] = None
    recommended_action: Optional[str] = None
    resolved: bool
    resolved_at: Optional[datetime] = None
    # Sensor fields
    sensor_id: int
    sensor_code: str
    sensor_type: Optional[str] = None
    sensor_location: Optional[str] = None
    sensor_status: Optional[str] = None
    sensor_health_score: float
    # Equipment fields
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    equipment_name: str
    equipment_model: Optional[str] = None
    equipment_manufacturer: Optional[str] = None
    equipment_status: Optional[str] = None
    equipment_health_score: Optional[float] = None
    equipment_installation_date: Optional[datetime] = None


# ─── Telemetry ────────────────────────────────────────────────────────────────

class TelemetryPoint(BaseModel):
    """One telemetry reading returned by telemetry endpoints."""
    timestamp: Optional[datetime] = None
    sensor_code: Optional[str] = None
    sensor_type: Optional[str] = None
    temperature: Optional[float] = None
    pressure: Optional[float] = None
    flow: Optional[float] = None
    anomaly_score: float
    is_anomaly: bool
    severity: Optional[str] = None


# ─── Previous Anomalies ───────────────────────────────────────────────────────

class PreviousAnomalyItem(BaseModel):
    """One item returned by GET /api/anomalies/{id}/previous."""
    id: int
    anomaly_score: float
    anomaly_type: str
    severity: str
    detected_at: Optional[datetime] = None
    recommended_action: Optional[str] = None
    resolved: bool
    resolved_at: Optional[datetime] = None


class PaginatedPreviousAnomalies(BaseModel):
    """Paginated envelope for GET /api/anomalies/{id}/previous."""
    page: int
    page_size: int
    total_records: int
    total_pages: int
    items: List[PreviousAnomalyItem]


# ─── Maintenance ──────────────────────────────────────────────────────────────

class MaintenanceItem(BaseModel):
    """One item returned by GET /api/anomalies/{id}/maintenance."""
    id: int
    issue: Optional[str] = None
    action_taken: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class PaginatedMaintenance(BaseModel):
    """Paginated envelope for GET /api/anomalies/{id}/maintenance."""
    page: int
    page_size: int
    total_records: int
    total_pages: int
    items: List[MaintenanceItem]

