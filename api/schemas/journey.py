"""Pydantic models for DMRC journey planning payloads."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class RouteStrategy(str, Enum):
    """Journey optimization strategy supported by DMRC APIs."""

    LEAST_DISTANCE = "least-distance"
    MINIMUM_INTERCHANGE = "minimum-interchange"


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

    model_config = ConfigDict(extra="allow")

    start_st: str | None = None
    start_time: str | None = None
    end_st: str | None = None
    end_time: str | None = None
    interchange_time: str | int | float | None = None
    start_station_name: str | None = None
    end_station_name: str | None = None


class FirstTrainInfo(BaseModel):
    """First train result structure."""

    model_config = ConfigDict(extra="allow")

    endstation_from_first_train_estimated_time: str | None = None
    first_train_route_detail: list[TrainRouteDetail] = Field(default_factory=list)


class LastTrainInfo(BaseModel):
    """Last train result structure."""

    model_config = ConfigDict(extra="allow")

    endstation_from_last_train_estimated_time: str | None = None
    last_train_route_detail: list[TrainRouteDetail] = Field(default_factory=list)


class FirstLastTrainResponse(BaseModel):
    """First and last train timings for a route strategy."""

    model_config = ConfigDict(extra="allow")

    first_train: FirstTrainInfo | None = None
    last_train: LastTrainInfo | None = None


class JourneyPlan(BaseModel):
    """Combined route and timing payload for both strategy tabs."""

    least_distance_fare: JourneyFareWithRoute
    minimum_interchange_fare: JourneyFareWithRoute
    least_distance_train: FirstLastTrainResponse
    minimum_interchange_train: FirstLastTrainResponse
