"""Pydantic models for DMRC station payloads.

These schemas are intentionally strict enough for safe typing, while still
allowing nullable/optional fields where upstream values are inconsistent.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from schemas.common import StationFacility
from schemas.line import MetroLine, StationLineBadge


class StationSearchFilter(str, Enum):
    """Search mode for station keyword lookup."""

    ALL = "all"
    LEAST_DISTANCE = "least-distance"
    MINIMUM_INTERCHANGE = "minimum-interchange"


class StationRef(BaseModel):
    """Station reference object sometimes returned in platform direction fields."""

    id: int
    station_name: str
    station_code: str


class StationSearchResult(BaseModel):
    """Compact station object used in search results."""

    id: int
    station_name: str
    station_code: str
    station_facility: list[StationFacility] = Field(default_factory=list)
    metro_lines: list[StationLineBadge] = Field(default_factory=list)


class StationByLineItem(StationSearchResult):
    """Station listing item for a line."""

    interchange: bool
    status: str


class Platform(BaseModel):
    """Platform information for a station."""

    platform_name: str
    train_towards: str | StationRef | None = None
    platform_code: str | None = None
    train_towards_second: str | StationRef | None = None


class Gate(BaseModel):
    """Gate metadata for station wayfinding."""

    model_config = ConfigDict(extra="allow")

    gate_name: str | None = None
    gate_code: str | None = None
    location: str | None = None
    gate_latitude: float | None = None
    gate_longitude: float | None = None
    divyang_friendly: bool | None = None
    status: str | None = None

    @field_validator("gate_latitude", "gate_longitude", mode="before")
    @classmethod
    def _normalize_blank_geo(cls, value: object) -> object:
        if value == "":
            return None
        return value


class Lift(BaseModel):
    """Lift/escalator detail for accessibility UI."""

    model_config = ConfigDict(extra="allow")

    lift_type: str | None = None
    name: str | None = None
    description_location: str | None = None
    code: str | None = None
    from_gate_code: str | list[str] | None = None
    to_gate_code: str | list[str] | None = None
    from_platform_code: str | list[str] | None = None
    to_platform_code: str | list[str] | None = None
    available_outside_inside: str | None = None
    divyang_friendly: bool | None = None
    status: str | bool | None = None
    note: str | None = None
    last_update: str | None = None


class StationDetail(BaseModel):
    """Detailed station response returned by `/station/{code}`."""

    model_config = ConfigDict(extra="allow")

    id: int
    station_code: str
    station_name: str
    station_commercial_name: str | None = None
    station_description: str | None = None
    station_type: str | None = None
    interchange: bool | None = None
    latitude: float | None = None
    longitude: float | None = None
    x_coords: float | None = None
    y_coords: float | None = None
    mobile: str | None = None
    landline: str | None = None

    station_status: list[dict] = Field(default_factory=list)
    metro_lines: list[MetroLine] = Field(default_factory=list)
    prev_next_stations: list[dict] = Field(default_factory=list)
    station_facility: list[StationFacility] = Field(default_factory=list)

    gates: list[Gate] = Field(default_factory=list)
    lifts: list[Lift] = Field(default_factory=list)
    platforms: list[Platform] = Field(default_factory=list)

    stations_facilities: list[dict] = Field(default_factory=list)
    parkings: list[dict] = Field(default_factory=list)
    nearby_places: list[dict] = Field(default_factory=list)
    feeder: list[dict] = Field(default_factory=list)
    first_last_train: list[dict] | dict | None = None
