import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./test.db") # Fallback for local testing if needed
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")

settings = Settings()
