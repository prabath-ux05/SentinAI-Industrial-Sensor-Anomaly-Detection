from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.core.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(Integer, primary_key=True, index=True)
    equipment_code = Column(String, unique=True, index=True)
    name = Column(String)
    model = Column(String)
    manufacturer = Column(String)
    description = Column(String)
    image_url = Column(String)
    installation_date = Column(DateTime)
    status = Column(String)
    health_score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sensors = relationship("Sensor", back_populates="equipment")

class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(Integer, primary_key=True, index=True)
    sensor_code = Column(String, unique=True, index=True)
    sensor_type = Column(String)
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    location = Column(String)
    status = Column(String)
    health_score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    equipment = relationship("Equipment", back_populates="sensors")
    telemetry = relationship("SensorTelemetry", back_populates="sensor")

class SensorTelemetry(Base):
    __tablename__ = "sensor_telemetry"
    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    temperature = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    flow = Column(Float, nullable=True)
    anomaly_score = Column(Float)
    is_anomaly = Column(Boolean)
    severity = Column(String)

    sensor = relationship("Sensor", back_populates="telemetry")

class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"
    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"))
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    anomaly_score = Column(Float)
    anomaly_type = Column(String)
    severity = Column(String)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    recommended_action = Column(String)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=True)
    issue = Column(String)
    action_taken = Column(String)
    status = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
