FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if required for ML or psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY backend ./backend

# Copy the ML engine (lives at project root, not inside backend)
COPY engine ./engine

# Environment variables
ENV PYTHONUNBUFFERED=1

# Expose port (Render sets this dynamically, but default to 8000)
EXPOSE 8000

# Start Uvicorn
# Use bash to evaluate the PORT variable or default to 8000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
