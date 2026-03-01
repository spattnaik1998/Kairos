"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # FRED
    fred_api_key: str = ""

    # HuggingFace
    hf_token: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # TimesFM model
    timesfm_repo: str = "google/timesfm-2.5-200m-pytorch"
    timesfm_max_context: int = 1024   # use 1024 for faster inference in dev
    timesfm_max_horizon: int = 128

    # Cache
    cache_db_path: str = "./data/kairos_cache.duckdb"
    cache_ttl_seconds: int = 3600


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
