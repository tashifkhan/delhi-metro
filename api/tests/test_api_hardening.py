from __future__ import annotations

import asyncio
import os
import time
import unittest
from datetime import UTC, datetime
from typing import Self
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from clients.frontend import DmrcFrontendClient
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from core.validation import normalize_dmrc_identifier
from main import app, handle_upstream_error
from schemas.journey import JourneyFareWithRoute, RouteStrategy
from schemas.map_asset import MapAsset, MapAssetType, MapFamily
from schemas.planner import (
    JourneySource,
    PlannedFare,
    PlannedJourney,
    PlannedStation,
)
from schemas.station import StationSearchFilter, StationSearchResult
from services import planner
from services.dmrc import journey, station
from services.dmrc import map_asset as dmrc_map


def _dmrc_plan(*, total_time: str) -> PlannedJourney:
    """Build a minimal DMRC-sourced plan for planner orchestration tests."""

    return PlannedJourney(
        source=JourneySource.DMRC,
        strategy=RouteStrategy.LEAST_DISTANCE,
        exclude_airport_line=False,
        origin=PlannedStation(name="AIIMS", code="AIIMS"),
        destination=PlannedStation(name="AKSHARDHAM", code="ASDM"),
        station_count=2,
        total_time=total_time,
        fare=PlannedFare(normal=10),
    )


class InputAndTransportHardeningTests(unittest.TestCase):
    def test_dmrc_identifier_rejects_path_traversal(self) -> None:
        with self.assertRaises(ApiRequestError):
            normalize_dmrc_identifier("../../admin", label="Station code")

    def test_frontend_client_rejects_absolute_and_traversing_asset_urls(self) -> None:
        with self.assertRaises(UpstreamApiError):
            DmrcFrontendClient._normalize_relative_path(
                "https://169.254.169.254/network-map.png"
            )
        with self.assertRaises(UpstreamApiError):
            DmrcFrontendClient._normalize_relative_path("../network-map.png")

        self.assertEqual(
            DmrcFrontendClient._normalize_relative_path(
                "/static/media/network-map.png"
            ),
            "static/media/network-map.png",
        )

    def test_openapi_documents_gateway_errors(self) -> None:
        responses = app.openapi()["paths"]["/api/v2/journeys/plan"]["get"]["responses"]
        self.assertIn("400", responses)
        self.assertIn("404", responses)
        self.assertIn("502", responses)

    def test_route_rejects_traversing_station_code_before_service_call(self) -> None:
        with TestClient(app) as client:
            response = client.get(
                "/api/v1/dmrc/journeys/fare-route",
                params={
                    "from_station_code": "../../admin",
                    "to_station_code": "ASDM",
                },
            )
        self.assertEqual(response.status_code, 422)


class TransportHardeningTests(unittest.IsolatedAsyncioTestCase):
    async def test_map_download_enforces_runtime_size_limit(self) -> None:
        class FakeResponse:
            status_code = 200
            url = "https://delhimetrorail.com/static/media/network-map.png"

            def __init__(self) -> None:
                self.headers: dict[str, str] = {}

            async def __aenter__(self) -> Self:
                return self

            async def __aexit__(self, *_: object) -> None:
                return None

            async def aiter_bytes(self):
                yield b"123"
                yield b"45"

        class FakeClient:
            def stream(self, *_: object) -> FakeResponse:
                return FakeResponse()

        frontend = DmrcFrontendClient()
        with (
            patch.object(frontend, "_get_client", AsyncMock(return_value=FakeClient())),
            patch.object(settings, "map_download_max_bytes", 4),
            self.assertRaises(UpstreamApiError),
        ):
            await frontend.get_bytes("/static/media/network-map.png")

    async def test_map_proxy_rejects_active_or_unexpected_content(self) -> None:
        asset = MapAsset(
            id="network:image:network-map.png",
            family=MapFamily.NETWORK,
            file_type=MapAssetType.IMAGE,
            display_name="Network map",
            source_path="/static/media/network-map.png",
            url="https://delhimetrorail.com/static/media/network-map.png",
        )
        with (
            patch.object(dmrc_map, "_download_cache", {}),
            patch.object(
                dmrc_map.frontend_client,
                "get_bytes",
                AsyncMock(
                    return_value=(
                        b"<html>not a map</html>",
                        {"content-type": "text/html"},
                        str(asset.url),
                        200,
                    )
                ),
            ),
            self.assertRaises(UpstreamApiError),
        ):
            await dmrc_map.download_asset(asset)


class PlannerHardeningTests(unittest.IsolatedAsyncioTestCase):
    async def test_sarthi_pin_cannot_bypass_disabled_setting(self) -> None:
        fallback_result = _dmrc_plan(total_time="0:12:00")
        with (
            patch.object(settings, "sarthi_enabled", False),
            patch.object(
                planner.sarthi_planner,
                "plan_journey",
                AsyncMock(),
            ) as sarthi_plan,
            patch.object(
                planner.dmrc_planner,
                "plan_journey",
                AsyncMock(return_value=fallback_result),
            ) as dmrc_plan,
        ):
            result = await planner.plan_journey(
                from_station_code="AIIMS",
                to_station_code="ASDM",
                source=JourneySource.SARTHI,
            )

        self.assertEqual(result.source, JourneySource.DMRC)
        self.assertEqual(result.total_time, "0:12:00")
        sarthi_plan.assert_not_awaited()
        dmrc_plan.assert_awaited_once()

    async def test_upstream_404_is_returned_as_gateway_failure(self) -> None:
        response = await handle_upstream_error(
            None,  # type: ignore[arg-type]
            UpstreamApiError("upstream missing", status_code=404),
        )
        self.assertEqual(response.status_code, 502)

    async def test_dmrc_plan_survives_timing_endpoint_failure(self) -> None:
        fare = JourneyFareWithRoute.model_validate(
            {
                "stations": 2,
                "from": "AIIMS",
                "to": "GREEN PARK",
                "total_time": "00:04:00",
                "weekday_fare": 10,
                "weekend_fare": 10,
                "route": [],
            }
        )

        with (
            patch.object(
                journey,
                "fare_with_route",
                AsyncMock(return_value=fare),
            ),
            patch.object(
                journey,
                "first_last_train",
                AsyncMock(side_effect=UpstreamApiError("timings unavailable")),
            ),
        ):
            result = await journey.plan_journey(
                from_station_code="AIIMS",
                to_station_code="GNPK",
                strategy=RouteStrategy.LEAST_DISTANCE,
            )

        self.assertEqual(result.source, JourneySource.DMRC)
        self.assertIsNone(result.metro_service)

    async def test_station_catalog_refresh_is_single_flight(self) -> None:
        cached_station = StationSearchResult(
            id=1,
            station_name="AIIMS",
            station_code="AIIMS",
            station_facility=[],
            metro_lines=[],
        )

        async def delayed_refresh() -> list[StationSearchResult]:
            await asyncio.sleep(0)
            return [cached_station]

        with (
            patch.object(station, "_station_catalog_cache", None),
            patch.object(station, "_station_catalog_cache_expiry", 0.0),
            patch.object(
                station,
                "_refresh_all_stations",
                AsyncMock(side_effect=delayed_refresh),
            ) as refresh,
        ):
            first, second = await asyncio.gather(
                station.list_all_stations(),
                station.list_all_stations(),
            )

        self.assertEqual(first, second)
        refresh.assert_awaited_once()

    async def test_station_search_encodes_query_as_one_path_segment(self) -> None:
        with patch.object(
            station.dmrc_client,
            "get_json_list",
            AsyncMock(return_value=[]),
        ) as request:
            result = await station.search_stations(
                query="../../admin",
                search_filter=StationSearchFilter.ALL,
            )

        self.assertEqual(result, [])
        self.assertEqual(
            request.await_args.args[0],
            "station_by_keyword/all/..%2F..%2Fadmin",
        )


class TimezoneHardeningTests(unittest.TestCase):
    def test_dmrc_aware_time_is_always_converted_to_delhi(self) -> None:
        value = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
        with patch.dict(os.environ, {"TZ": "UTC"}):
            if hasattr(time, "tzset"):
                time.tzset()
            formatted = journey._format_journey_time(value)
        if hasattr(time, "tzset"):
            time.tzset()

        self.assertEqual(formatted, "2026-01-01T05:30:00.000")


if __name__ == "__main__":
    unittest.main()
