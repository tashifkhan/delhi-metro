"""NCRTC contract tests against recorded public responses."""

import json
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from clients.ncrtc import NCRTCClient, ncrtc_client
from main import app
from schemas.journey import RouteStrategy
from services.ncrtc.journey import plan_journey
from services.ncrtc.catalog import parse_stations
from services.ncrtc.fare import _parse_quote

FIXTURES = Path(__file__).parent / "fixtures"


def recorded(name):
    return json.loads((FIXTURES / f"ncrtc-{name}.json").read_text())


class NCRTCProviderTests(unittest.TestCase):
    def test_public_routes_use_recorded_payloads(self):
        fixtures = {
            "stations": "stations",
            "stations/v2/details": "station-details",
            "trains/v2/frequency": "train-frequency",
            "trains/v3/live": "trains-live",
            "parking/v1/live": "parking-live",
            "parking/v1/charges": "parking-charges",
            "app-banners": "app-banners",
            "statics/news": "news",
            "web/notifications": "notices",
        }

        def upstream(request):
            path = request.url.path.removeprefix("/commons/journey/")
            if path == "app-media":
                name = (
                    "app-media-map"
                    if request.url.params["cd"] == "namoBharatWebMap"
                    else "app-media-dmrc"
                )
            else:
                name = fixtures[path]
            if path == "trains/v2/frequency":
                self.assertEqual(request.url.params["fst"], "12")
            return httpx.Response(200, json=recorded(name))

        def mock_client(**kwargs):
            return original_client(transport=httpx.MockTransport(upstream), **kwargs)

        original_client = httpx.AsyncClient
        with (
            patch("clients.ncrtc.httpx.AsyncClient", side_effect=mock_client),
            patch.multiple(
                ncrtc_client,
                cache={},
                expiry={},
                locks={},
            ),
            TestClient(app) as client,
        ):

            def get(path):
                response = client.get("/api/v1/ncrtc/" + path)
                self.assertEqual(response.status_code, 200, response.text)
                return response.json()

            self.assertEqual(len(get("lines/RRTS/stations")), 23)
            self.assertEqual(len(get("lines/MRTS/stations")), 12)
            self.assertEqual(
                get("stations/search?query=duhai")[1]["station_code"], "AS2"
            )
            station = get("stations/Z00")
            self.assertTrue(station["has_parking"])
            self.assertTrue(station["gates"] and station["first_last_train"])
            self.assertFalse(get("stations/Z00/next-trains")["stale"])
            self.assertTrue(get("trains/live")["data"]["trainsStatus"])
            self.assertTrue(get("parking")["data"]["charges"]["charges"])
            self.assertEqual(len(get("maps/assets")["assets"]), 3)
            slug = get("notifications")[0]["link_to_internal_page"]
            self.assertEqual(get("notifications/" + slug)["page_slug"], slug)

    def test_fare_classes_follow_service(self):
        quote = _parse_quote(recorded("fare-v3-skk-gzb")["data"])
        self.assertEqual(
            [(fare.name, fare.amount) for fare in quote.classes_for(True)],
            [("standard", 80), ("premium", 95)],
        )
        self.assertEqual(len(quote.classes_for(False)), 1)


class NCRTCRefreshTests(unittest.IsolatedAsyncioTestCase):
    async def test_station_retry_and_stale_fallback(self):
        payload = recorded("stations")
        incomplete = [dict(item, name="") for item in payload]
        responses = iter([incomplete, payload, incomplete, incomplete])
        client = NCRTCClient()
        original_client = httpx.AsyncClient

        def respond(_):
            return httpx.Response(200, json=next(responses))

        with patch(
            "clients.ncrtc.httpx.AsyncClient",
            side_effect=lambda **kwargs: original_client(
                transport=httpx.MockTransport(respond), **kwargs
            ),
        ):
            first = await client.get("/stations", parse_stations, ttl=0, retry=True)
            stale = await client.get("/stations", parse_stations, ttl=0, retry=True)
            cached = await client.get("/stations", parse_stations, ttl=0, retry=True)

        self.assertFalse(first.stale)
        self.assertTrue(stale.stale)
        self.assertEqual(stale.fetched_at, first.fetched_at)
        self.assertIs(cached, stale)

    async def test_delhi_to_meerut_local_station_changes_lines(self):
        route = recorded("route-info")
        route[0]["routeInfo"] = [
            row
            for row in route[0]["routeInfo"]
            if int(row["stationInfo"]["code"][1:]) <= 12
        ]
        fare = recorded("fare-v3-skk-gzb")
        original_client = httpx.AsyncClient

        def upstream(request):
            path = request.url.path
            if path.endswith("/stations"):
                data = recorded("stations")
            elif path.endswith("/routes/info"):
                self.assertEqual(request.url.params["tst"], "15")
                data = route
            else:
                data = fare
            return httpx.Response(200, json=data)

        with (
            patch(
                "clients.ncrtc.httpx.AsyncClient",
                side_effect=lambda **kwargs: original_client(
                    transport=httpx.MockTransport(upstream), **kwargs
                ),
            ),
            patch.multiple(
                ncrtc_client,
                cache={},
                expiry={},
                locks={},
            ),
        ):
            plan = await plan_journey(
                from_station_code="Z00",
                to_station_code="A12",
                strategy=RouteStrategy.LEAST_DISTANCE,
            )
        self.assertEqual(
            [leg.line_name for leg in plan.legs], ["Namo Bharat", "Meerut Metro"]
        )
        self.assertEqual(plan.legs[0].to_station_code, "A10")
        self.assertEqual(plan.legs[1].from_station_code, "A10")
        self.assertEqual(plan.legs[1].to_station_code, "A12")
        self.assertEqual(
            plan.fare.model_dump(by_alias=True)["classes"][1]["class"], "premium"
        )
