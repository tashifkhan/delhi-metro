"""Pydantic models for DMRC upstream payloads.

These schemas are intentionally strict enough for safe typing, while still
allowing nullable/optional fields where upstream values are inconsistent.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import AssetImage, StationFacility


class RouteStrategy(str, Enum):
    """Journey optimization strategy supported by DMRC APIs."""

    LEAST_DISTANCE = "least-distance"
    MINIMUM_INTERCHANGE = "minimum-interchange"


class StationSearchFilter(str, Enum):
    """Search mode for station keyword lookup."""

    ALL = "all"
    LEAST_DISTANCE = "least-distance"
    MINIMUM_INTERCHANGE = "minimum-interchange"


class MetroLine(BaseModel):
    """Line metadata returned by `/line_list`."""

    id: int
    name: str
    line_color: str
    line_code: str
    primary_color_code: str
    secondary_color_code: str
    class_primary: str
    class_secondary: str | None = None
    start_station: str
    end_station: str
    show_in_frontend: bool
    status: str


class NotificationType(BaseModel):
    """Notification category object."""

    name: str
    image: AssetImage


class PassengerNotification(BaseModel):
    """Passenger notification item."""

    id: int
    title: str
    notification_type: NotificationType | None = None
    image: AssetImage | None = None
    video_url: str | None = None
    link_to: str | None = None
    link_to_file: str | None = None
    link_to_internal_page: str | None = None
    link_to_outside_url: str | None = None
    date: str


class StationSearchResult(BaseModel):
    """Compact station object used in search results."""

    id: int
    station_name: str
    station_code: str
    station_facility: list[StationFacility] = Field(default_factory=list)


class StationByLineItem(StationSearchResult):
    """Station listing item for a line."""

    interchange: bool
    status: str


class Platform(BaseModel):
    """Platform information for a station."""

    platform_name: str
    train_towards: str | None = None
    platform_code: str | None = None
    train_towards_second: str | None = None


class Gate(BaseModel):
    """Gate metadata for station wayfinding."""

    gate_name: str
    gate_code: str | None = None
    location: str | None = None
    gate_latitude: float | None = None
    gate_longitude: float | None = None
    divyang_friendly: bool | None = None
    status: str | None = None


class Lift(BaseModel):
    """Lift/escalator detail for accessibility UI."""

    lift_type: str | None = None
    name: str | None = None
    description_location: str | None = None
    code: str | None = None
    from_gate_code: str | None = None
    to_gate_code: str | None = None
    from_platform_code: str | None = None
    to_platform_code: str | None = None
    available_outside_inside: str | None = None
    divyang_friendly: bool | None = None
    status: str | None = None
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


class JourneyPathPoint(BaseModel):
    """Station point inside one route segment."""

    name: str
    status: str | None = None


class JourneyRouteSegment(BaseModel):
    """One route segment over a specific metro line."""

    model_config = ConfigDict(populate_by_name=True)

    line: str
    line_no: int | None = None
    path: list[JourneyPathPoint] = Field(default_factory=list)
    path_time: str | None = None
    map_path: list[str] = Field(default_factory=list, alias="map-path")
    station_interchange_time: int | float | None = None
    start: str
    end: str


class JourneyFareWithRoute(BaseModel):
    """Fare and route result returned by `/new_fare_with_route/...`."""

    model_config = ConfigDict(populate_by_name=True)

    stations: int
    from_station: str = Field(alias="from")
    to_station: str = Field(alias="to")
    total_time: str
    weekday_fare: int | float
    weekend_fare: int | float
    route: list[JourneyRouteSegment] = Field(default_factory=list)


class TrainRouteDetail(BaseModel):
    """Train timing detail for a single hop/segment."""

    start_st: str
    start_time: str
    end_st: str
    end_time: str
    interchange_time: str | None = None
    start_station_name: str
    end_station_name: str


class FirstTrainInfo(BaseModel):
    """First train result structure."""

    endstation_from_first_train_estimated_time: str
    first_train_route_detail: list[TrainRouteDetail] = Field(default_factory=list)


class LastTrainInfo(BaseModel):
    """Last train result structure."""

    endstation_from_last_train_estimated_time: str
    last_train_route_detail: list[TrainRouteDetail] = Field(default_factory=list)


class FirstLastTrainResponse(BaseModel):
    """First and last train timings for a route strategy."""

    first_train: FirstTrainInfo
    last_train: LastTrainInfo


class JourneyPlan(BaseModel):
    """Combined route and timing payload for both strategy tabs."""

    least_distance_fare: JourneyFareWithRoute
    minimum_interchange_fare: JourneyFareWithRoute
    least_distance_train: FirstLastTrainResponse
    minimum_interchange_train: FirstLastTrainResponse
