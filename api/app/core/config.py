"""Application configuration and settings.

This module centralizes all runtime settings using pydantic-settings so values
can be safely loaded from environment variables or `.env` files.
"""

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the API process."""

    app_name: str = Field(default="DMRC Wrapper API")
    app_version: str = Field(default="0.1.0")
    app_description: str = Field(
        default=(
            "Typed FastAPI wrapper around selected Delhi Metro Rail Corporation "
            "passenger APIs."
        )
    )
    debug: bool = Field(default=False)

    dmrc_base_url: AnyHttpUrl = Field(
        default="https://backend.delhimetrorail.com/api/v2/en/",
        description="Base URL for upstream DMRC passenger API.",
    )
    dmrc_timeout_seconds: float = Field(default=20.0, ge=1.0, le=60.0)

    dmrc_frontend_base_url: AnyHttpUrl = Field(
        default="https://delhimetrorail.com/",
        description="Base URL for DMRC frontend/static assets.",
    )
    dmrc_frontend_timeout_seconds: float = Field(default=20.0, ge=1.0, le=60.0)

    model_config = SettingsConfigDict(
        env_prefix="DMRC_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
