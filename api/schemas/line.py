"""Pydantic models for DMRC metro line payloads."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class MetroLine(BaseModel):
    """Line metadata returned by `/line_list`."""

    model_config = ConfigDict(extra="allow")

    id: int
    name: str
    line_color: str
    line_code: str
    primary_color_code: str
    secondary_color_code: str | None = None
    class_primary: str
    class_secondary: str | None = None
    start_station: str
    end_station: str
    show_in_frontend: bool | None = None
    status: str


class StationLineBadge(BaseModel):
    """Minimal metro line metadata for station-list disambiguation badges."""

    line_id: int
    line_code: str
    line_name: str
    line_color: str
    primary_color_code: str
