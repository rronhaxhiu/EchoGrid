from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: Optional[str] = None
    run_migrations: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False


settings = Settings()
