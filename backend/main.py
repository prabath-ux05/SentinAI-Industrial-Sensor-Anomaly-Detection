from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
import sys
import os
import logging

# Add parent directory to path to allow importing engine module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.database import Base, engine, get_db
from backend.api import telemetry, dashboard, equipment, copilot, reports, anomalies, suppliers
from backend.core.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Create database tables
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully.")
except Exception as e:
    logger.error(f"Failed to create database tables: {e}")

app = FastAPI(title="SentinAI API", version="1.0.0")

# Setup CORS
allowed_origins = ["*"] # Default for local dev
if settings.FRONTEND_URL:
    allowed_origins = [settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"]
    logger.info(f"CORS configured for origins: {allowed_origins}")
else:
    logger.warning("FRONTEND_URL not set in environment. Defaulting to allow all origins ('*').")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry.router, prefix="/api", tags=["telemetry"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(equipment.router, prefix="/api", tags=["equipment", "sensors"])
app.include_router(anomalies.router, prefix="/api", tags=["anomalies"])
app.include_router(copilot.router, prefix="/api/copilot", tags=["copilot"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["suppliers"])

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check DB error: {e}")
        db_status = "failed"
    return {"status": "ok", "database": db_status}
