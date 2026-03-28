"""Business service that composes DMRC API resources."""

from __future__ import annotations

import asyncio
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

    def __init__(self, client: DmrcApiClient) -> None:
        self._client = client

    @staticmethod
    def _normalize_station_code(code: str) -> str:
        """Normalize station codes to DMRC expected format (uppercase, trimmed)."""

        return code.strip().upper()

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
        encoded_query = quote(query.strip())
        payload = await self._client.get_json_list(
            f"station_by_keyword/{search_filter.value}/{encoded_query}"
        )
        return self._validate_with_adapter(self._station_search_adapter, payload)

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
    ) -> JourneyFareWithRoute:
        from_code = self._normalize_station_code(from_station_code)
        to_code = self._normalize_station_code(to_station_code)
        payload = await self._client.get_json_dict(
            f"new_fare_with_route/{from_code}/{to_code}/{strategy.value}/"
        )
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
            ),
            self.journey_fare_with_route(
                from_station_code=from_station_code,
                to_station_code=to_station_code,
                strategy=RouteStrategy.MINIMUM_INTERCHANGE,
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
