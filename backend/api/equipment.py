from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.core.database import get_db
from backend.models import domain as models
from backend.schemas import domain as schemas

router = APIRouter()

@router.get("/equipment", response_model=List[schemas.EquipmentResponse])
def get_equipment(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    equipment = db.query(models.Equipment).offset(skip).limit(limit).all()
    return equipment

@router.post("/equipment", response_model=schemas.EquipmentResponse)
def create_equipment(equipment: schemas.EquipmentCreate, db: Session = Depends(get_db)):
    db_equip = models.Equipment(**equipment.dict())
    db.add(db_equip)
    db.commit()
    db.refresh(db_equip)
    return db_equip

@router.get("/sensors", response_model=List[schemas.SensorResponse])
def get_sensors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sensors = db.query(models.Sensor).offset(skip).limit(limit).all()
    return sensors
