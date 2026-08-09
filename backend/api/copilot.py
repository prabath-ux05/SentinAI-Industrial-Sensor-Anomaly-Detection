from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.core.database import get_db
from backend.models import domain as models
from backend.core.config import settings

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str] = []

@router.post("/chat", response_model=ChatResponse)
def copilot_chat(request: ChatRequest, db: Session = Depends(get_db)):
    msg = request.message.lower()
    
    reply = ""
    tools = []
    
    # Mock LLM logic with tool usage
    if "which sensors are currently unhealthy" in msg or "unhealthy" in msg:
        tools.append("get_sensor_status()")
        unhealthy = db.query(models.Sensor).filter(models.Sensor.status != "Healthy").all()
        if not unhealthy:
             reply = "All sensors are currently healthy."
        else:
             reply = "The following sensors are currently unhealthy: " + ", ".join([f"{s.sensor_code} ({s.status})" for s in unhealthy])
             
    elif "which equipment needs immediate attention" in msg or "attention" in msg:
        tools.append("get_equipment_health()")
        attention_eq = db.query(models.Equipment).filter(models.Equipment.health_score < 70).all()
        if not attention_eq:
             reply = "No equipment currently needs immediate attention."
        else:
             reply = "The following equipment requires attention: " + ", ".join([f"{e.name} (Health: {e.health_score}%)" for e in attention_eq])
             
    elif "why was" in msg and "flagged" in msg:
        tools.append("get_recent_anomalies()")
        # Extract sensor ID, very naive parsing
        words = msg.split()
        target = "P-104" # default for demo
        for word in words:
            if "-" in word:
                target = word.upper().replace('?', '')
                break
                
        event = db.query(models.AnomalyEvent).join(models.Sensor).filter(
            models.Sensor.sensor_code == target
        ).order_by(models.AnomalyEvent.detected_at.desc()).first()
        
        if event:
            reply = f"{target} was flagged because of a '{event.anomaly_type.replace('_', ' ')}'. The anomaly score was {event.anomaly_score:.2f} and severity is {event.severity}. Recommended action: {event.recommended_action}"
        else:
            reply = f"I couldn't find any recent anomaly events for {target}."
            
    else:
        reply = "I'm the SentinAI Copilot. Ask me about sensor health, recent anomalies, or equipment status. (Note: LLM Integration requires an API key in .env)"
        
    return ChatResponse(reply=reply, tools_used=tools)
