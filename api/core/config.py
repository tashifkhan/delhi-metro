"""Application configuration and settings.

This module centralizes all runtime settings using pydantic-settings so values
can be safely loaded from environment variables or `.env` files.
"""

from pathlib import Path

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime settings for the API process."""

    app_name: str = Field(default="Delhi NCR Metro API")
    app_version: str = Field(default="0.2.0")
    app_description: str = Field(
        default=(
            "A typed REST API for Delhi NCR. Lines, stations, fares, routes, "
            "first and last trains, maps, and notifications for DMRC and NMRC, "
            "plus a unified v2 planner that stitches both networks."
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
    map_download_max_bytes: int = Field(
        default=25 * 1024 * 1024,
        ge=1024,
        le=100 * 1024 * 1024,
        description="Maximum map file size buffered by the proxy.",
    )

    nmrc_base_url: AnyHttpUrl = Field(
        default="https://www.nmrcnoida.com/",
        description="Base URL for the public NMRC website and planner pages.",
    )
    nmrc_timeout_seconds: float = Field(default=20.0, ge=1.0, le=60.0)

    sarthi_base_url: AnyHttpUrl = Field(
        default="https://dmrc.autope.in/metro/v4/",
        description="Base URL for the Delhi Metro Sarthi journey API.",
    )
    # Sarthi is the preferred planner but never the only one: keep the timeout
    # short so a slow upstream falls back to DMRC quickly.
    sarthi_timeout_seconds: float = Field(default=8.0, ge=1.0, le=60.0)
    sarthi_enabled: bool = Field(
        default=True,
        description=(
            "When false, the v2 planner skips Sarthi and serves every request "
            "from the legacy DMRC API."
        ),
    )

    station_catalog_path: Path = Field(
        default=API_ROOT / "data" / "stations.normalized.json",
        description="Generated legacy/Sarthi station crosswalk.",
    )

    model_config = SettingsConfigDict(
        env_prefix="DMRC_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
