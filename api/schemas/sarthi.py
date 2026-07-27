"""Pydantic models for raw Delhi Metro Sarthi journey payloads.

These mirror the upstream response so validation catches contract drift. The
API surface exposes the normalized `schemas.planner` models instead.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SarthiFare(BaseModel):
    """Normal and special (Sunday/holiday) fare for a journey."""

    normal: float
    special: float | None = None


class SarthiMetroTime(BaseModel):
    """First and last train clock times for the origin station."""

    first: str | None = None
    last: str | None = None


class SarthiStationStatus(BaseModel):
    """Operational status block for origin/destination stations."""

    model_config = ConfigDict(extra="allow")

    status: str | None = None
    title: str | None = None
    note: str | None = None


class SarthiPathStop(BaseModel):
    """One stop inside a route leg."""

    model_config = ConfigDict(extra="allow")

    name: str
    status: str | None = None


class SarthiRouteLeg(BaseModel):
    """One continuous leg of the journey on a single line."""

    model_config = ConfigDict(extra="allow")

    line: str
    line_no: int | None = None
    line_color: str | None = None
    direction: str | None = None
    start: str
    start_code: str | None = None
    end: str
    end_code: str | None = None
    station_count: int | None = None
    platform_name: str | None = None
    towards_station: str | None = None
    path: list[SarthiPathStop] = Field(default_factory=list)
    map_path: list[str] = Field(default_factory=list)
    path_time: str | None = None
    path_distance: float | None = None
    start_time: str | None = None
    end_time: str | None = None
    station_interchange_time: float | None = None


class SarthiInterchange(BaseModel):
    """Interchange point and its allowance in minutes."""

    model_config = ConfigDict(extra="allow")

    interchange_at: str | None = Field(default=None, alias="interchangeAt")
    interchange_time: float | None = Field(default=None, alias="interchangeTime")


class SarthiJourney(BaseModel):
    """Full journey payload from `/journey/{from}/{to}/{strategy}/{date_time}`."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    service_status: bool | None = Field(default=None, alias="serviceStatus")
    from_station: str = Field(alias="from")
    from_code: str
    to_station: str = Field(alias="to")
    to_code: str
    applicable_fare: float | None = Field(default=None, alias="applicableFare")
    fare: SarthiFare
    metro_time: SarthiMetroTime | None = Field(default=None, alias="metroTime")
    from_station_status: SarthiStationStatus | None = None
    to_station_status: SarthiStationStatus | None = None
    routes: list[SarthiRouteLeg] = Field(default_factory=list)
    interchanges: list[SarthiInterchange] = Field(default_factory=list)
    stations: int
    total_time: str
    total_distance: float | None = None
    ticket_available: bool | None = Field(default=None, alias="ticketAvailable")
