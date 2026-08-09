from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

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

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentResponse(EquipmentBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

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
