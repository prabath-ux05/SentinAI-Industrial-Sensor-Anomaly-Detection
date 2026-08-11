import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

settings = Settings()

# Validation for Production
if settings.ENVIRONMENT.lower() == "production" and "sqlite" in settings.DATABASE_URL:
    raise ValueError("DATABASE_URL must be a valid PostgreSQL connection string in production. Found SQLite fallback.")
