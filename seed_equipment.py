"""
seed_equipment.py – Seed the SentinAI SQLite database with realistic
industrial equipment and linked sensors. Safe to re-run (idempotent via
equipment_code uniqueness).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from backend.core.database import SessionLocal, Base, engine
from backend.models import domain as models

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ─── Helper ──────────────────────────────────────────────────────────────────

def get_or_create_equipment(code: str, **kwargs) -> models.Equipment:
    eq = db.query(models.Equipment).filter_by(equipment_code=code).first()
    if not eq:
        eq = models.Equipment(equipment_code=code, **kwargs)
        db.add(eq)
        db.flush()
        print(f"  [+] Equipment: {code} – {kwargs['name']}")
    else:
        print(f"  [=] Equipment exists: {code} – {eq.name}")
    return eq


def get_or_create_sensor(code: str, **kwargs) -> models.Sensor:
    s = db.query(models.Sensor).filter_by(sensor_code=code).first()
    if not s:
        s = models.Sensor(sensor_code=code, **kwargs)
        db.add(s)
        db.flush()
        print(f"      [+] Sensor: {code}")
    else:
        # Update equipment link if missing
        if s.equipment_id is None and kwargs.get("equipment_id"):
            s.equipment_id = kwargs["equipment_id"]
            db.flush()
            print(f"      [~] Linked sensor {code} -> equipment {kwargs['equipment_id']}")
        else:
            print(f"      [=] Sensor exists: {code}")
    return s


# ─── Seed Data ────────────────────────────────────────────────────────────────

print("\n=== Seeding Equipment ===\n")

EQUIPMENT = [
    {
        "code": "PUMP-001",
        "name": "Centrifugal Pump Alpha",
        "manufacturer": "Grundfos",
        "model": "CR 10-10",
        "status": "Active",
        "health_score": 87.4,
        "installation_date": datetime(2022, 3, 15),
        "description": "Primary cooling water circulation pump for reactor module A.",
        "sensors": [
            {"code": "T-101", "type": "temperature", "location": "Pump Inlet", "status": "Active", "health": 91.0},
            {"code": "P-104", "type": "pressure",    "location": "Discharge Line", "status": "Active", "health": 85.0},
            {"code": "F-201", "type": "flow",        "location": "Outlet Manifold", "status": "Active", "health": 88.0},
        ],
    },
    {
        "code": "COMP-002",
        "name": "Air Compressor Beta",
        "manufacturer": "Atlas Copco",
        "model": "GA 37 VSD+",
        "status": "Active",
        "health_score": 62.1,
        "installation_date": datetime(2020, 7, 8),
        "description": "Variable-speed drive air compressor serving the pneumatic line.",
        "sensors": [
            {"code": "P-202", "type": "pressure",    "location": "Discharge Header", "status": "Warning", "health": 58.0},
            {"code": "T-203", "type": "temperature", "location": "Intercooler",       "status": "Active",  "health": 67.5},
        ],
    },
    {
        "code": "FURN-003",
        "name": "Rotary Kiln Furnace",
        "manufacturer": "FLSmidth",
        "model": "RK-3000",
        "status": "Active",
        "health_score": 38.2,
        "installation_date": datetime(2018, 11, 22),
        "description": "High-temperature rotary kiln for calcination of industrial minerals.",
        "sensors": [
            {"code": "T-301", "type": "temperature", "location": "Kiln Inlet",    "status": "Critical", "health": 29.0},
            {"code": "T-302", "type": "temperature", "location": "Kiln Midpoint", "status": "Critical", "health": 35.0},
            {"code": "T-303", "type": "temperature", "location": "Kiln Outlet",   "status": "Warning",  "health": 48.0},
            {"code": "F-304", "type": "flow",        "location": "Fuel Feed",     "status": "Active",   "health": 71.0},
        ],
    },
    {
        "code": "MOTOR-004",
        "name": "Conveyor Drive Motor",
        "manufacturer": "ABB",
        "model": "M3BP 315 MLA 4",
        "status": "Maintenance",
        "health_score": 14.7,
        "installation_date": datetime(2019, 2, 5),
        "description": "Main drive motor for the ore conveyor belt in section C.",
        "sensors": [
            {"code": "T-401", "type": "temperature", "location": "Motor Winding", "status": "Critical", "health": 12.0},
            {"code": "P-402", "type": "pressure",    "location": "Bearing Housing", "status": "Critical", "health": 17.0},
        ],
    },
    {
        "code": "HEAT-005",
        "name": "Shell & Tube Heat Exchanger",
        "manufacturer": "Alfa Laval",
        "model": "Sigma M10-FD",
        "status": "Active",
        "health_score": 95.3,
        "installation_date": datetime(2023, 6, 1),
        "description": "Process fluid heat exchanger with corrosion-resistant titanium plates.",
        "sensors": [
            {"code": "T-501", "type": "temperature", "location": "Hot Side Inlet",  "status": "Active", "health": 97.0},
            {"code": "T-502", "type": "temperature", "location": "Hot Side Outlet", "status": "Active", "health": 96.0},
            {"code": "F-503", "type": "flow",        "location": "Cold Side Feed",  "status": "Active", "health": 94.0},
        ],
    },
]

for item in EQUIPMENT:
    eq = get_or_create_equipment(
        code=item["code"],
        name=item["name"],
        manufacturer=item["manufacturer"],
        model=item["model"],
        status=item["status"],
        health_score=item["health_score"],
        installation_date=item["installation_date"],
        description=item["description"],
    )
    for s in item["sensors"]:
        get_or_create_sensor(
            code=s["code"],
            sensor_type=s["type"],
            equipment_id=eq.id,
            location=s["location"],
            status=s["status"],
            health_score=s["health"],
        )

# Also fix any orphaned sensors from old test data
orphans = db.query(models.Sensor).filter(models.Sensor.equipment_id == None).all()
if orphans:
    print(f"\n[!] Found {len(orphans)} orphaned sensors with no equipment link – they remain unlinked.")

db.commit()
print("\n=== Seeding complete ===")

# Print summary
total_eq = db.query(models.Equipment).count()
total_s  = db.query(models.Sensor).count()
print(f"Equipment: {total_eq} | Sensors: {total_s}\n")
db.close()
