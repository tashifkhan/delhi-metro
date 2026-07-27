"""Shared Pydantic schemas used across endpoints."""

from pydantic import BaseModel, Field


class AssetImage(BaseModel):
    """Represents an image file metadata object from DMRC."""

    title: str = Field(..., description="Original file title.")
    file: str = Field(..., description="Relative media path on DMRC backend.")


class StationFacility(BaseModel):
    """Facility information available at a station."""

    name: str
    class_name: str
    image: AssetImage
