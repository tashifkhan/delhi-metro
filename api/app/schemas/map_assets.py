"""Schemas for DMRC map asset discovery and download APIs."""

from __future__ import annotations

from enum import Enum

from pydantic import AnyHttpUrl, BaseModel, Field


class MapFamily(str, Enum):
    """Logical map groups exposed by this API."""

    NETWORK = "network"
    AIRPORT_EXPRESS = "airport-express"
    RAPID_METRO = "rapid-metro"


class MapFormat(str, Enum):
    """Supported map output formats."""

    IMAGE = "image"
    PDF = "pdf"
    ANY = "any"


class MapAssetType(str, Enum):
    """File type category for discovered assets."""

    IMAGE = "image"
    PDF = "pdf"


class MapAsset(BaseModel):
    """A discovered map asset from DMRC frontend manifest."""

    id: str = Field(..., description="Stable identifier for this API.")
    family: MapFamily = Field(..., description="Map family/group.")
    file_type: MapAssetType = Field(..., description="Asset file category.")
    display_name: str = Field(..., description="Human-readable asset title.")
    source_path: str = Field(..., description="Original static path in DMRC build.")
    url: AnyHttpUrl = Field(..., description="Fully-qualified static file URL.")
    content_type: str | None = Field(
        default=None,
        description="HTTP content-type when known.",
    )
    content_length: int | None = Field(
        default=None,
        ge=1,
        description="File size in bytes when known.",
    )


class MapAssetListResponse(BaseModel):
    """Collection wrapper for map asset listing."""

    assets: list[MapAsset] = Field(default_factory=list)


class MapAssetByFormatResponse(BaseModel):
    """Resolved primary assets for a map family by format."""

    family: MapFamily
    image: MapAsset | None = None
    pdf: MapAsset | None = None
