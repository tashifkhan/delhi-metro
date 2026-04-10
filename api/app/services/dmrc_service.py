"""Business service that composes DMRC API resources."""

from __future__ import annotations

import asyncio
from time import monotonic
from datetime import datetime
from urllib.parse import quote
from typing import TypeVar

from pydantic import BaseModel
from pydantic import TypeAdapter
from pydantic import ValidationError

from app.clients.dmrc_client import DmrcApiClient
from app.core.errors import UpstreamApiError
from app.schemas.dmrc import (
    FirstLastTrainResponse,
    JourneyFareWithRoute,
    JourneyPlan,
    MetroLine,
    PassengerNotification,
    RouteStrategy,
    StationByLineItem,
    StationDetail,
    StationLineBadge,
    StationSearchFilter,
    StationSearchResult,
)

ModelT = TypeVar("ModelT", bound=BaseModel)


class DmrcService:
    """Service abstraction over upstream DMRC resources.

    It is responsible for:
    - path construction
    - calling upstream through the HTTP client
    - strict pydantic validation into typed models
    """

    _line_adapter = TypeAdapter(list[MetroLine])
    _notification_adapter = TypeAdapter(list[PassengerNotification])
    _station_search_adapter = TypeAdapter(list[StationSearchResult])
    _station_by_line_adapter = TypeAdapter(list[StationByLineItem])
    _station_line_badges_cache_ttl_seconds = 300.0

    def __init__(self, client: DmrcApiClient) -> None:
        self._client = client
        self._station_line_badges_cache: dict[str, list[StationLineBadge]] | None = None
        self._station_line_badges_cache_expiry = 0.0

    @staticmethod
    def _normalize_station_code(code: str) -> str:
        """Normalize station codes to DMRC expected format (uppercase, trimmed)."""

        return code.strip().upper()

    @staticmethod
    def _format_journey_time(journey_time: datetime) -> str:
        """Format datetime for DMRC `/station_route/.../{timestamp}` path."""

        local_time = journey_time
        if journey_time.tzinfo is not None:
            local_time = journey_time.astimezone().replace(tzinfo=None)

        return local_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]

    @staticmethod
    def _validate_with_adapter[T](adapter: TypeAdapter[T], payload: object) -> T:
        """Validate payload and normalize pydantic failures as upstream errors."""

        try:
            return adapter.validate_python(payload)
        except ValidationError as exc:
            raise UpstreamApiError("DMRC payload validation failed") from exc

    @staticmethod
    def _validate_model(model_type: type[ModelT], payload: object) -> ModelT:
        """Validate typed model and map schema mismatches to upstream errors."""

        try:
            return model_type.model_validate(payload)
        except ValidationError as exc:
            raise UpstreamApiError("DMRC payload validation failed") from exc

    @staticmethod
    def _line_badge_from_line(line: MetroLine) -> StationLineBadge:
        return StationLineBadge(
            line_id=line.id,
            line_code=line.line_code,
            line_name=line.name,
            line_color=line.line_color,
            primary_color_code=line.primary_color_code,
        )

    async def _get_station_line_badges_map(self) -> dict[str, list[StationLineBadge]]:
        now = monotonic()
        if (
            self._station_line_badges_cache is not None
            and now < self._station_line_badges_cache_expiry
        ):
            return self._station_line_badges_cache

        lines = await self.get_lines()
        stations_per_line = await asyncio.gather(
            *(self.stations_by_line(line.line_code) for line in lines)
        )

        badges_by_station_code: dict[str, list[StationLineBadge]] = {}
        seen_pairs: set[tuple[str, str]] = set()

        for line, line_stations in zip(lines, stations_per_line):
            line_badge = self._line_badge_from_line(line)
            for station in line_stations:
                normalized_code = self._normalize_station_code(station.station_code)
                pair = (normalized_code, line_badge.line_code)
                if pair in seen_pairs:
                    continue

                badges_by_station_code.setdefault(normalized_code, []).append(
                    line_badge
                )
                seen_pairs.add(pair)

        for badges in badges_by_station_code.values():
            badges.sort(key=lambda item: (item.line_id, item.line_code))

        self._station_line_badges_cache = badges_by_station_code
        self._station_line_badges_cache_expiry = (
            now + self._station_line_badges_cache_ttl_seconds
        )
        return badges_by_station_code

    async def _with_station_line_badges(
        self,
        stations: list[StationSearchResult],
    ) -> list[StationSearchResult]:
        if not stations:
            return stations

        badges_by_station_code = await self._get_station_line_badges_map()
        return [
            station.model_copy(
                update={
                    "metro_lines": list(
                        badges_by_station_code.get(
                            self._normalize_station_code(station.station_code),
                            [],
                        )
                    )
                }
            )
            for station in stations
        ]

    async def get_lines(self) -> list[MetroLine]:
        payload = await self._client.get_json_list("line_list")
        return self._validate_with_adapter(self._line_adapter, payload)

    async def get_notifications(self) -> list[PassengerNotification]:
        payload = await self._client.get_json_list("passengers/notification/")
        return self._validate_with_adapter(self._notification_adapter, payload)

    async def station_search(
        self,
        *,
        query: str,
        search_filter: StationSearchFilter,
    ) -> list[StationSearchResult]:
        normalized_query = query.strip()
        if not normalized_query:
            return await self.all_stations()

        encoded_query = quote(normalized_query)
        payload = await self._client.get_json_list(
            f"station_by_keyword/{search_filter.value}/{encoded_query}"
        )
        stations = self._validate_with_adapter(self._station_search_adapter, payload)
        return await self._with_station_line_badges(stations)

    async def all_stations(self) -> list[StationSearchResult]:
        """Return a de-duplicated station catalog across all DMRC lines."""

        lines = await self.get_lines()
        stations_per_line = await asyncio.gather(
            *(self.stations_by_line(line.line_code) for line in lines)
        )

        station_by_code: dict[str, StationSearchResult] = {}
        station_line_badges_by_code: dict[str, list[StationLineBadge]] = {}
        seen_station_line_pairs: set[tuple[str, str]] = set()

        for line, line_stations in zip(lines, stations_per_line):
            line_badge = self._line_badge_from_line(line)
            for station in line_stations:
                normalized_code = self._normalize_station_code(station.station_code)

                pair = (normalized_code, line_badge.line_code)
                if pair not in seen_station_line_pairs:
                    station_line_badges_by_code.setdefault(normalized_code, []).append(
                        line_badge
                    )
                    seen_station_line_pairs.add(pair)

                if normalized_code in station_by_code:
                    continue

                station_by_code[normalized_code] = StationSearchResult(
                    id=station.id,
                    station_name=station.station_name,
                    station_code=normalized_code,
                    station_facility=station.station_facility,
                    metro_lines=[],
                )

        for station_code, badges in station_line_badges_by_code.items():
            badges.sort(key=lambda item: (item.line_id, item.line_code))
            station = station_by_code.get(station_code)
            if station is None:
                continue
            station_by_code[station_code] = station.model_copy(
                update={"metro_lines": list(badges)}
            )

        return sorted(
            station_by_code.values(),
            key=lambda item: (item.station_name.upper(), item.station_code),
        )

    async def stations_by_line(self, line_code: str) -> list[StationByLineItem]:
        payload = await self._client.get_json_list(
            f"station_by_line/{line_code.strip().upper()}"
        )
        return self._validate_with_adapter(self._station_by_line_adapter, payload)

    async def station_detail(self, station_code: str) -> StationDetail:
        normalized_code = self._normalize_station_code(station_code)
        payload = await self._client.get_json_dict(f"station/{normalized_code}")
        return self._validate_model(StationDetail, payload)

    async def journey_fare_with_route(
        self,
        *,
        from_station_code: str,
        to_station_code: str,
        strategy: RouteStrategy,
        journey_time: datetime | None = None,
    ) -> JourneyFareWithRoute:
        from_code = self._normalize_station_code(from_station_code)
        to_code = self._normalize_station_code(to_station_code)

        if journey_time is None:
            payload = await self._client.get_json_dict(
                f"new_fare_with_route/{from_code}/{to_code}/{strategy.value}/"
            )
        else:
            formatted_time = self._format_journey_time(journey_time)
            payload = await self._client.get_json_dict(
                f"station_route/{from_code}/{to_code}/{strategy.value}/{formatted_time}"
            )

            if "fare" in payload:
                timed_fare = payload.get("fare")
                payload["weekday_fare"] = timed_fare
                payload["weekend_fare"] = timed_fare

        return self._validate_model(JourneyFareWithRoute, payload)

    async def first_last_train(
        self,
        *,
        from_station_code: str,
        to_station_code: str,
        strategy: RouteStrategy,
    ) -> FirstLastTrainResponse:
        from_code = self._normalize_station_code(from_station_code)
        to_code = self._normalize_station_code(to_station_code)
        payload = await self._client.get_json_dict(
            f"first_and_last_train_with_filter/{from_code}/{to_code}/{strategy.value}/"
        )
        return self._validate_model(FirstLastTrainResponse, payload)

    async def complete_journey_plan(
        self,
        *,
        from_station_code: str,
        to_station_code: str,
        journey_time: datetime | None = None,
    ) -> JourneyPlan:
        """Build combined payload for both route strategy tabs."""

        (
            least_distance_fare,
            minimum_interchange_fare,
            least_distance_train,
            minimum_interchange_train,
        ) = await asyncio.gather(
            self.journey_fare_with_route(
                from_station_code=from_station_code,
                to_station_code=to_station_code,
                strategy=RouteStrategy.LEAST_DISTANCE,
                journey_time=journey_time,
            ),
            self.journey_fare_with_route(
                from_station_code=from_station_code,
                to_station_code=to_station_code,
                strategy=RouteStrategy.MINIMUM_INTERCHANGE,
                journey_time=journey_time,
            ),
            self.first_last_train(
                from_station_code=from_station_code,
                to_station_code=to_station_code,
                strategy=RouteStrategy.LEAST_DISTANCE,
            ),
            self.first_last_train(
                from_station_code=from_station_code,
                to_station_code=to_station_code,
                strategy=RouteStrategy.MINIMUM_INTERCHANGE,
            ),
        )

        return JourneyPlan(
            least_distance_fare=least_distance_fare,
            minimum_interchange_fare=minimum_interchange_fare,
            least_distance_train=least_distance_train,
            minimum_interchange_train=minimum_interchange_train,
        )
