from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: Optional[str] = None
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.3-70b-versatile"
    run_migrations: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False

    # Pest-risk ML prediction (deployment_bundle)
    prediction_backend: str = "local"  # local | http | vertex
    pest_model_dir: Optional[str] = None
    prediction_http_url: str = "http://localhost:8080"
    vertex_project: Optional[str] = None
    vertex_location: str = "us-central1"
    vertex_endpoint_id: Optional[str] = None


settings = Settings()
