<div align="center">

<h1>
  <img src="https://img.shields.io/badge/SentinAI-Industrial%20Monitoring-0d9488?style=for-the-badge" alt="SentinAI" />
</h1>

<h3>AI-Powered Industrial Sensor Anomaly Detection Platform</h3>

<p>
  A production-grade, full-stack monitoring platform that ingests real-time sensor telemetry, detects anomalies using a custom ML pipeline, scores equipment health, and surfaces intelligent maintenance recommendations — all through a beautiful, responsive dashboard.
</p>

<p>
   <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi" />
  <img src="https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase" />
  <img src="https://img.shields.io/badge/AI-Groq%20%2B%20LLaMA%203-F55036?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Deploy-Docker%20%2B%20Render-2496ED?style=for-the-badge&logo=docker" />
</p>

</div>

---

## 🎥 Demo Video

<p align="center">
  <a href="https://drive.google.com/file/d/1ziXvUwYBnDC0tkWOig68zK0IHpS5yBH7/view?usp=sharing">
    <img src="docs/images/dashboard-preview.png" width="900">
  </a>
</p>

<p align="center">
  <strong>Click the preview image to watch the complete SentinAI demonstration.</strong>
</p>


## 🚀 Overview

**SentinAI** is a full-stack industrial IoT monitoring platform built for real-world sensor data. It continuously ingests telemetry from sensors (temperature, pressure, flow), runs it through a custom anomaly detection engine, maintains a live equipment health score, and provides an AI-powered Maintenance Copilot for root-cause analysis and action planning.

The platform is designed to simulate a real factory floor, where dozens of sensors feed data into a central system that automatically flags faults, ranks severity, and guides operators toward the right actions — before critical failures happen.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| **📊 Live Dashboard** | Real-time telemetry charts (Temperature, Pressure, Flow), system health score, sensor distribution, and recent alerts |
| **🔍 Anomaly Detection** | Paginated anomaly event table with search, filter by severity/pattern/status, sort, CSV export, and one-click resolve |
| **⚙️ Equipment Management** | Full asset registry with health scoring, sensor counts, per-equipment telemetry, alert history, and maintenance log |
| **🤖 Maintenance Copilot** | Groq-powered LLM assistant with full system context — ask it anything about sensor health, failure patterns, or next steps |
| **🗺️ Supplier Locator** | Google Maps–integrated supplier search by part type and location, with interactive map pins |
| **📈 Reports** | Health trend charts, anomaly frequency breakdowns, sensor performance exports |
| **⚙️ Settings** | User profile management, notification preferences, theme configuration |

---

## 🧠 ML Anomaly Detection Engine

The core engine (`/engine`) is built from scratch — no external ML libraries required.

```
engine/
├── anomaly_detector.py      # Rolling-window Z-score anomaly scorer
├── pattern_detector.py      # Classifies DRIFT, SPIKE, FLATLINE, NOISE patterns
├── feature_engineering.py   # Rolling mean, std, rate-of-change feature extraction
├── health_engine.py         # Exponential decay health scoring per sensor
└── models/                  # Trained model artifacts
```

**How it works:**
1. Each telemetry reading is fed into a **rolling Z-score window** (default: 10 readings).
2. The **feature engineering** module extracts statistical features (mean, std, rate of change).
3. The **pattern detector** classifies the anomaly type — DRIFT, SPIKE, FLATLINE, or NOISE.
4. The **health engine** applies exponential decay to the sensor's running health score, decaying on anomalies and recovering on healthy readings.
5. An `AnomalyEvent` is created in the database and a severity label (`LOW` → `CRITICAL`) is assigned.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel (Frontend)                    │
│   Next.js 15 · TypeScript · Recharts                        │
│   Pages: Dashboard · Anomalies · Equipment · Copilot        │
│          Suppliers · Reports · Settings                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS REST API
                         ▼
┌───────────────────────────────────────────────────────────┐
│                     Render (Backend)                      │
│   FastAPI · Python 3.12 · Docker · Uvicorn                │
│   ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │
│   │  REST APIs  │  │  ML Engine   │  │ Groq LLM API   │   │
│   │  /telemetry │  │ Z-score +    │  │ LLaMA 3.3 70B  │   │
│   │  /anomalies │  │ Pattern Det. │  │ Copilot Chat   │   │
│   │  /equipment │  │ Health Score │  └────────────────┘   │
│   │  /dashboard │  └──────────────┘                       │
│   └─────────────┘                                         │
└────────────────────────┬──────────────────────────────────┘
                         │ SQLAlchemy ORM
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL)                  │
│   Tables: equipment · sensors · sensor_telemetry        │
│           anomaly_events · maintenance_records          │
└─────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
SentinAI/
├── backend/                   # FastAPI application
│   ├── api/                   # Route handlers
│   │   ├── anomalies.py       # Anomaly list, detail, resolve, CSV export
│   │   ├── dashboard.py       # Summary KPIs, telemetry trends, alerts
│   │   ├── equipment.py       # Asset registry CRUD + sensor/alert sub-endpoints
│   │   ├── telemetry.py       # Sensor data ingestion + ML pipeline trigger
│   │   ├── copilot.py         # Groq LLM AI assistant
│   │   ├── reports.py         # Analytics and exports
│   │   └── suppliers.py       # Google Maps supplier search
│   ├── core/
│   │   ├── config.py          # Environment configuration
│   │   └── database.py        # SQLAlchemy engine + session
│   ├── models/domain.py       # ORM models (Equipment, Sensor, Telemetry, etc.)
│   ├── schemas/domain.py      # Pydantic request/response schemas
│   ├── services/              # LLM client and service layer
│   ├── main.py                # App factory, CORS, router registration
│   ├── Dockerfile             # Docker build for Render deployment
│   └── requirements.txt
│
├── engine/                    # Custom ML Anomaly Detection Engine
│   ├── anomaly_detector.py    # Z-score rolling window scorer
│   ├── pattern_detector.py    # DRIFT / SPIKE / FLATLINE / NOISE classifier
│   ├── feature_engineering.py # Rolling statistical feature extraction
│   └── health_engine.py       # Exponential decay health scoring
│
├── frontend/                  # Next.js 15 Application
│   └── src/app/
│       ├── dashboard/         # Live telemetry dashboard
│       ├── anomalies/         # Anomaly detection console
│       ├── equipment/         # Asset management
│       ├── copilot/           # AI maintenance assistant
│       ├── suppliers/         # Supplier locator (Google Maps)
│       ├── reports/           # Analytics reports
│       └── settings/          # User settings
│
├── scripts/
│   └── simulate_sensors.py    # Sensor data simulator (normal/anomaly/mixed modes)
│
├── seed_equipment.py          # Seeds Equipment + Sensor data into the database
├── .env.example               # Environment variable template
└── vercel.json                # Vercel deployment configuration
```

---

## 🛠️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — High-performance Python API framework
- [SQLAlchemy](https://www.sqlalchemy.org/) — ORM for PostgreSQL
- [Pydantic](https://docs.pydantic.dev/) — Data validation and serialization
- [Groq API](https://groq.com/) — LLaMA 3.3 70B for the AI Copilot
- [Docker](https://www.docker.com/) — Containerized deployment on Render

**Frontend**
- [Next.js 15](https://nextjs.org/) — React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) — Type-safe frontend
- [Recharts](https://recharts.org/) — Telemetry trend charts
- [Lucide React](https://lucide.dev/) — Icon system
- [Google Maps API](https://developers.google.com/maps) — Supplier location maps

**Infrastructure**
- [Supabase](https://supabase.com/) — Managed PostgreSQL database
- [Render](https://render.com/) — Backend Docker deployment
- [Vercel](https://vercel.com/) — Frontend deployment and CI/CD

---

## ⚙️ Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/prabath-ux05/SentinAI-Industrial-Sensor-Anomaly-Detection.git
cd SentinAI-Industrial-Sensor-Anomaly-Detection
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate # macOS/Linux

# Install dependencies
pip install -r backend/requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section)

# Start the backend server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Seed the Database

```bash
# From the project root (with .venv active)
python seed_equipment.py
```

### 5. Run the Sensor Simulator

```bash
python scripts/simulate_sensors.py --mode mixed
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_publishable_key

# Authentication
JWT_SECRET=your_64_char_random_secret

# AI Copilot
GROQ_API_KEY=gsk_your_groq_api_key

# Google Maps (Supplier Locator)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Environment
ENVIRONMENT=development
FRONTEND_URL=http://localhost:3000
```

> In production, set `ENVIRONMENT=production`. The backend will reject SQLite fallback URLs.

---

## 🚢 Deployment

### Backend → Render (Docker)

1. Connect your GitHub repo to Render and create a new **Web Service**.
2. Set **Runtime** to `Docker` and **Dockerfile Path** to `backend/Dockerfile`.
3. Add all environment variables in **Render → Environment**.
4. Set **Health Check Path** to `/api/health`.
5. Every push to `main` triggers an automatic redeploy.

### Frontend → Vercel

1. Import your GitHub repo on Vercel.
2. Set **Root Directory** to `frontend`.
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` → your Render backend URL (e.g. `https://yourapp.onrender.com/api`)
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` → your Google Maps key
4. Every push to `main` triggers an automatic redeploy.

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check — DB connectivity status |
| `POST` | `/api/telemetry` | Ingest a sensor reading (triggers ML engine) |
| `GET` | `/api/dashboard/summary` | System-wide KPI metrics |
| `GET` | `/api/dashboard/telemetry` | Recent telemetry for live charts |
| `GET` | `/api/dashboard/alerts` | Latest anomaly alerts |
| `GET` | `/api/anomalies` | Paginated, filtered anomaly event list |
| `GET` | `/api/anomalies/summary` | Anomaly KPI counters (today / critical / high / resolved) |
| `GET` | `/api/anomalies/{id}` | Full detail for a single anomaly event |
| `PATCH` | `/api/anomalies/{id}/resolve` | Mark an anomaly as resolved |
| `GET` | `/api/anomalies/export/csv` | Stream anomaly data as CSV |
| `GET` | `/api/equipment` | Paginated equipment asset list |
| `POST` | `/api/equipment` | Register new equipment |
| `GET` | `/api/equipment/{id}` | Equipment detail with live health score |
| `GET` | `/api/equipment/{id}/sensors` | All sensors for an asset with latest reading |
| `GET` | `/api/equipment/{id}/alerts` | Active (unresolved) alerts for an asset |
| `GET` | `/api/equipment/{id}/telemetry` | Recent telemetry for all sensors on an asset |
| `GET` | `/api/equipment/{id}/maintenance` | Paginated maintenance history |
| `POST` | `/api/copilot/chat` | AI Copilot message (Groq + LLaMA 3.3 70B) |
| `GET` | `/api/suppliers/search` | Find suppliers by part type and location |

Full interactive documentation available at `http://localhost:8000/docs` (Swagger UI).

---

## 🧪 Sensor Simulator

The simulator (`scripts/simulate_sensors.py`) generates realistic industrial sensor readings and POSTs them to the API. Use it to populate your dashboard with live data.

```bash
# Default: runs against localhost:8000
python scripts/simulate_sensors.py --mode mixed

# Target your live cloud backend
$env:API_URL="https://your-render-url.onrender.com/api/telemetry"  # Windows PowerShell
python scripts/simulate_sensors.py --mode mixed
```

| Mode | Behaviour |
|------|-----------|
| `normal` | Stable, healthy readings within expected ranges |
| `anomaly` | Injects spikes, flatlines, and drift to trigger alerts |
| `mixed` | Alternates between normal and anomaly patterns (best for demos) |

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**.

---

<div align="center">

Built with ❤️ by Prabath D

⭐ **Star this repo if you found it useful!** ⭐

</div>
