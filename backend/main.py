from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Add parent directory to path to allow importing engine module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.database import Base, engine
from backend.api import telemetry, dashboard, equipment, copilot, reports

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SentinAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry.router, prefix="/api", tags=["telemetry"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(equipment.router, prefix="/api", tags=["equipment", "sensors"])
app.include_router(copilot.router, prefix="/api/copilot", tags=["copilot"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
