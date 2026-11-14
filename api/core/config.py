"""Application configuration and settings.

This module centralizes all runtime settings using pydantic-settings so values
can be safely loaded from environment variables or `.env` files.
"""

from pathlib import Path

from pydantic import AliasChoices, AnyHttpUrl, Field, SecretStr
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

    # Map layouts: station positions read off each operator's official map
    # image by Gemini, redone only when the image's hash changes.
    gemini_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("GEMINI_API_KEY", "DMRC_GEMINI_API_KEY"),
        description="Google AI Studio key. Without it, layouts serve the last saved copy.",
    )
    gemini_model: str = Field(
        default="gemini-4-hydrogen",
        validation_alias=AliasChoices("GEMINI_MODEL", "DMRC_GEMINI_MODEL"),
        description="Gemini model that reads station positions off map images.",
    )
    gemini_thinking_level: str | None = Field(
        default="high",
        validation_alias=AliasChoices("GEMINI_THINKING_LEVEL", "DMRC_GEMINI_THINKING_LEVEL"),
        description="Reasoning level sent as thinkingConfig.thinkingLevel. Empty to use the model default.",
    )
    gemini_timeout_seconds: float = Field(default=180.0, ge=5.0, le=600.0)
    map_layout_dmrc_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("MAP_LAYOUT_DMRC_ENABLED", "DMRC_MAP_LAYOUT_DMRC_ENABLED"),
        description=(
            "Read the DMRC official map with Gemini. Off by default: Delhi "
            "station coordinates already come from DMRC's own data."
        ),
    )
    map_layout_nmrc_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("MAP_LAYOUT_NMRC_ENABLED", "DMRC_MAP_LAYOUT_NMRC_ENABLED"),
        description="Read the NMRC Aqua Line map with Gemini.",
    )
    map_layout_recheck_seconds: int = Field(
        default=6 * 60 * 60,
        ge=60,
        description="How long a process trusts the last image hash before fetching the image again.",
    )
    map_layout_min_coverage: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Share of a network's stations Gemini must find before a new layout replaces the old one.",
    )
    map_layout_tile_px: int = Field(
        default=2048,
        ge=512,
        le=4096,
        description="Largest tile edge sent to Gemini. Bigger images are cut into overlapping tiles.",
    )
    map_layout_dir: Path = Field(
        default=API_ROOT / "data" / "map_layouts",
        description="Checked-in layouts served when the image hash still matches.",
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
