"""
SentinAI Maintenance Copilot – backend chat endpoint.

Flow
----
1. Intent Detection  – classify what data the user needs
2. Tool Execution    – call the relevant copilot_tools function to fetch live DB data
3. Prompt Assembly   – build a strict system prompt + context payload for the LLM
4. LLM Call          – ask_llm() tries Gemini → OpenAI → Groq → Claude (first key found wins)
5. Rule Fallback     – if no LLM key is present, return the pre-formatted rule-based string
"""

import re
import json
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.core.database import get_db
from backend.models import domain as models
from backend.services import copilot_tools
from backend.services.llm_client import ask_llm

router = APIRouter()

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str] = []
    llm_powered: bool = False

# ── System prompt template ────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are SentinAI Copilot, an industrial maintenance AI assistant.
Your ONLY job is to answer operational questions using the provided Context Data.

RULES (follow strictly):
1. Be concise and professional. Use bullet points when listing multiple items.
2. If the Context Data is empty, missing, or insufficient to answer the question,
   respond EXACTLY with: "I don't have enough telemetry data to determine that."
3. NEVER invent physical causes, sensor values, or maintenance history that is not in the Context Data.
4. Use hedged language: "Likely cause", "Possible pattern", "Recommended inspection".
5. Format monetary values, scores, and percentages to 2 decimal places.
6. Do not mention the phrase "Context Data" in your response.
7. Answer only operational/maintenance questions. Politely decline anything else.
"""

def build_prompt(tool_name: str, tool_data: dict | list, user_message: str) -> tuple[str, str]:
    """Return (system_prompt, user_prompt) ready for the LLM."""
    context_json = json.dumps(tool_data, indent=2, default=str)
    user_prompt = (
        f"Context Data (from {tool_name}):\n```json\n{context_json}\n```\n\n"
        f"Question: {user_message}"
    )
    return SYSTEM_PROMPT, user_prompt

# ── Helper: extract asset code from message ───────────────────────────────────

def extract_code(msg: str, default: str) -> str:
    """Extract an alphanumeric asset code like P-104 or F-201 from the message."""
    match = re.search(r'\b([a-zA-Z]-\d{3})\b', msg)
    return match.group(1).upper() if match else default

# ── Rule-based fallback strings (used when no LLM key is present) ─────────────

def rule_unhealthy_sensors(unhealthy: list) -> str:
    if not unhealthy:
        return "All sensors are currently operating within normal parameters. There are no unhealthy sensors."
    lines = "\n".join(f"• **{s['sensor_code']}**: {s['status']} (Health: {s['health']:.1f}%)" for s in unhealthy)
    return f"I found the following unhealthy sensors:\n\n{lines}\n\nI recommend reviewing the latest anomalies for these sensors."

def rule_equipment_attention(items: list) -> str:
    critical = [e for e in items if e["health"] < 75]
    if not critical:
        return "All equipment is currently in good health. No immediate action required."
    lines = "\n".join(f"• **{e['name']} ({e['code']})**: Health Score {e['health']:.1f}%" for e in critical)
    return f"The following equipment requires immediate attention:\n\n{lines}\n\nPlease schedule maintenance or diagnostics on these assets."

def rule_sensor_flagged(code: str, data: dict) -> str:
    if not data:
        return f"I couldn't find any recent anomaly events for **{code}** in the database. It appears to be operating normally."
    return (
        f"**{code}** was recently flagged by the AI pattern detector for a **{data['pattern'].replace('_', ' ').title()}**.\n\n"
        f"• **Severity:** {data['severity']}\n"
        f"• **Anomaly Score:** {data.get('score', 'N/A')}\n"
        f"• **Recommended Action:** {data['recommendation']}"
    )

def rule_system_summary(data: dict) -> str:
    msg = (
        f"Here is today's system health summary:\n\n"
        f"• **Overall Health:** {data['system_health']:.1f}%\n"
        f"• **Healthy Sensors:** {data['healthy_sensors']}\n"
        f"• **Critical Sensors:** {data['critical_sensors']}\n"
        f"• **Active Alerts:** {data['active_alerts']}"
    )
    if data["critical_sensors"] > 0:
        msg += f"\n\n⚠️ There are currently **{data['critical_sensors']}** critical sensors requiring immediate attention."
    else:
        msg += "\n\n✅ No critical sensors. The system is stable."
    return msg

def rule_today_anomalies(events: list) -> str:
    today = datetime.utcnow().date().isoformat()
    today_events = [e for e in events if e["detected_at"].startswith(today)]
    if not today_events:
        return "No anomalies have been detected today. The system is operating normally."
    lines = "\n".join(
        f"• **{e['sensor']}**: {e['type'].replace('_', ' ').title()} ({e['severity']}) at {e['detected_at'][11:19]}"
        for e in today_events[:5]
    )
    return f"Anomalies detected today:\n\n{lines}"

def rule_inspect_equipment(data: dict) -> str:
    if not data:
        return "I couldn't find equipment matching that identifier in the database."
    bad = [s for s in data.get("sensors", []) if s["health"] < 80]
    reply = (
        f"For **{data['equipment_name']} ({data['equipment_code']})** "
        f"(Health: {data['health']:.1f}%):\n\n"
    )
    if bad:
        reply += "**Sensors requiring inspection:**\n"
        reply += "\n".join(f"• {s['code']}: Health {s['health']:.1f}% ({s['status']})" for s in bad)
    else:
        reply += "All linked sensors are reporting healthy metrics. A standard visual inspection is sufficient."
    return reply

def rule_critical_alerts(data: dict) -> str:
    if data["critical_faults"] == 0:
        return "There are currently zero active critical alerts. The system is secure."
    lines = "\n\n".join(
        f"🔴 **{d['type'].replace('_', ' ').title()}**\n  Action: {d['action']}"
        for d in data["critical_details"]
    )
    return f"There are **{data['critical_faults']}** active critical alerts:\n\n{lines}"

# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.get("/status")
def copilot_status():
    import os
    if os.environ.get("GEMINI_API_KEY"):
        return {"llm_configured": True, "provider": "Gemini"}
    if os.environ.get("OPENAI_API_KEY"):
        return {"llm_configured": True, "provider": "OpenAI"}
    if os.environ.get("GROQ_API_KEY"):
        return {"llm_configured": True, "provider": "Groq"}
    if os.environ.get("ANTHROPIC_API_KEY"):
        return {"llm_configured": True, "provider": "Anthropic (Claude)"}
    return {"llm_configured": False, "provider": None}

@router.post("/chat", response_model=ChatResponse)
def copilot_chat(request: ChatRequest, db: Session = Depends(get_db)):
    msg = request.message.lower()
    tools: list[str] = []
    tool_name = ""
    tool_data: dict | list = {}
    rule_reply = ""

    # ── Intent 1: Unhealthy sensors ──
    if ("unhealthy" in msg and "sensor" in msg) or "sensor" in msg and "health" in msg:
        tools.append("get_sensor_status()")
        tool_name = "get_sensor_status"
        rows = db.query(models.Sensor).filter(models.Sensor.status != "Healthy").all()
        tool_data = [{"sensor_code": s.sensor_code, "status": s.status, "health": s.health_score} for s in rows]
        rule_reply = rule_unhealthy_sensors(tool_data)  # type: ignore[arg-type]

    # ── Intent 2: Equipment needing attention ──
    elif ("attention" in msg or "lowest health" in msg) and "equipment" in msg:
        tools.append("get_equipment_health()")
        tool_name = "get_equipment_details"
        rows = db.query(models.Equipment).order_by(models.Equipment.health_score.asc()).limit(5).all()
        tool_data = [{"name": e.name, "code": e.equipment_code, "health": e.health_score} for e in rows]
        rule_reply = rule_equipment_attention(tool_data)  # type: ignore[arg-type]

    # ── Intent 3: Why was [sensor] flagged ──
    elif "why was" in msg and "flagged" in msg:
        tools.append("get_sensor_status()")
        code = extract_code(msg, "P-104")
        tool_name = "get_sensor_status"
        sensor_data = copilot_tools.get_sensor_status(db, code)
        # Also pull the raw anomaly score from the DB for richer context
        event = db.query(models.AnomalyEvent).join(models.Sensor).filter(
            models.Sensor.sensor_code == code
        ).order_by(models.AnomalyEvent.detected_at.desc()).first()
        if event:
            sensor_data["score"] = round(event.anomaly_score, 4)
            sensor_data["detected_at"] = event.detected_at.isoformat()
        tool_data = sensor_data
        rule_reply = rule_sensor_flagged(code, sensor_data)

    # ── Intent 4: System health summary ──
    elif "summarize" in msg or "system health" in msg or "today's" in msg and "health" in msg:
        tools.append("get_system_summary()")
        tool_name = "get_system_summary"
        tool_data = copilot_tools.get_system_summary(db)
        rule_reply = rule_system_summary(tool_data)  # type: ignore[arg-type]

    # ── Intent 5: Anomalies today ──
    elif "anomalies" in msg and ("today" in msg or "recent" in msg or "occurred" in msg):
        tools.append("get_recent_anomalies()")
        tool_name = "get_recent_anomalies"
        tool_data = copilot_tools.get_recent_anomalies(db)
        rule_reply = rule_today_anomalies(tool_data)  # type: ignore[arg-type]

    # ── Intent 6: What to inspect for equipment ──
    elif "inspect" in msg or "maintenance" in msg and ("for" in msg or "on" in msg):
        tools.append("get_equipment_details()")
        code = extract_code(msg, "F-201")
        tool_name = "get_equipment_details"
        tool_data = copilot_tools.get_equipment_details(db, code)
        rule_reply = rule_inspect_equipment(tool_data)  # type: ignore[arg-type]

    # ── Intent 7: Critical / active alerts ──
    elif "critical" in msg or "active alert" in msg or "fault" in msg:
        tools.append("generate_fault_summary()")
        tool_name = "generate_fault_summary"
        tool_data = copilot_tools.generate_fault_summary(db)
        rule_reply = rule_critical_alerts(tool_data)  # type: ignore[arg-type]

    # ── Sensor history ──
    elif "history" in msg or "telemetry" in msg:
        code = extract_code(msg, "")
        if code:
            tools.append("get_sensor_history()")
            tool_name = "get_sensor_history"
            tool_data = copilot_tools.get_sensor_history(db, code)
            rule_reply = f"Here is the recent history for **{code}**:\n\n" + json.dumps(tool_data, indent=2, default=str)
        else:
            rule_reply = "Please specify a sensor code (e.g. P-104) so I can retrieve its history."

    # ── Fallback ──
    else:
        return ChatResponse(
            reply=(
                "I'm the SentinAI Copilot, connected to your live operational database.\n\n"
                "You can ask me:\n"
                "• *Which sensors are currently unhealthy?*\n"
                "• *Summarize today's system health.*\n"
                "• *Why was P-104 flagged?*\n"
                "• *What should I inspect for F-201?*\n"
                "• *Show active critical alerts.*"
            ),
            tools_used=[],
            llm_powered=False,
        )

    # ── Try LLM ──────────────────────────────────────────────────────────────
    if tool_data:
        system_prompt, user_prompt = build_prompt(tool_name, tool_data, request.message)
        llm_reply = ask_llm(system_prompt, user_prompt)
        if llm_reply:
            return ChatResponse(reply=llm_reply.strip(), tools_used=tools, llm_powered=True)

    # ── Rule-based fallback ──────────────────────────────────────────────────
    return ChatResponse(reply=rule_reply.strip(), tools_used=tools, llm_powered=False)
