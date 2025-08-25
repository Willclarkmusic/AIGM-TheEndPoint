"""Settings configuration for AI Service."""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""
    
    # Application
    app_name: str = "AI Service"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8080
    
    # Google Cloud
    gcp_project_id: Optional[str] = None
    gcp_region: str = "us-central1"
    
    # Firebase
    firebase_credentials_path: Optional[str] = None
    
    # API Keys (will be loaded from Secret Manager in production)
    gemini_api_key: Optional[str] = None
    stability_api_key: Optional[str] = None
    
    # Rate Limiting
    rate_limit_per_minute: int = 5
    rate_limit_burst: int = 10
    
    # Credits
    chat_credit_cost: int = 1
    image_generation_cost: int = 1
    music_generation_cost: int = 2
    
    # Free tier limits
    free_chat_credits_monthly: int = 25
    free_gen_ai_credits_monthly: int = 25
    
    # AI Model Settings
    gemini_model: str = "gemini-1.5-flash"
    max_context_length: int = 4096
    temperature: float = 0.7
    
    # Stability AI Settings
    stability_engine: str = "stable-diffusion-xl-1024-v1-0"
    stability_music_engine: str = "stable-audio-open-1.0"
    
    # Storage
    gcs_bucket_name: Optional[str] = None
    
    # CORS
    cors_origins: list[str] = ["*"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()