from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from schemas.journey import RouteStrategy
from schemas.planner import JourneySource
from services.nmrc import journey as nmrc_journey
from services.nmrc import parsing
from services.nmrc.data import STATIONS


class NmrcParserTests(unittest.TestCase):
    def test_station_options_are_extracted_from_the_planner_select(self) -> None:
        options = "\n".join(
            f'<option value="{station.upstream_id}">{station.name}</option>'
            for station in STATIONS
        )
        page = f'<select id="sourceStation">{options}</select>'

        parsed = parsing.parse_station_options(page)

        self.assertEqual(len(parsed), 21)
        self.assertEqual(parsed[0], (1, "Noida Sector 51"))
        self.assertEqual(parsed[-1], (21, "Depot Station"))

    def test_server_rendered_journey_is_normalized(self) -> None:
        page = """
        <div class="single-station position-relative"><p>Noida Sector 101</p></div>
        <div class="single-station position-relative"><p>Noida Sector 76</p></div>
        <div class="single-station position-relative"><p>Noida Sector 50</p></div>
        <div class="single-station position-relative"><p>Noida Sector 51</p></div>
        <strong> Timing:</strong> 6 Min
        <strong>Distance:</strong> 3.43 KM
        <i class="bi bi-currency-rupee"></i>20/-
        <i class="bi bi-currency-rupee"></i>15/-
        """

        result = parsing.parse_journey_page(page)

        self.assertEqual(result["duration_minutes"], 6.0)
        self.assertEqual(result["distance_km"], 3.43)
        self.assertEqual(result["normal_fare"], 20.0)
        self.assertEqual(result["special_fare"], 15.0)
        self.assertEqual(len(result["stops"]), 4)

    def test_press_release_links_are_absolute_and_encoded(self) -> None:
        page = """
        <div class="link-card position-relative">
          <a href="../uploads/press_releases/Press Release.pdf" target="_blank">
            Service update <i></i>
          </a>
          <p>Date: <strong>11-09-2025</strong></p>
        </div>
        </section>
        """

        releases = parsing.parse_press_releases(page)

        self.assertEqual(len(releases), 1)
        self.assertEqual(releases[0].title, "Service update")
        self.assertIn("Press%20Release.pdf", releases[0].link_to_outside_url or "")


class NmrcJourneyTests(unittest.IsolatedAsyncioTestCase):
    async def test_plan_uses_the_same_contract_as_dmrc(self) -> None:
        live_result = {
            "stops": [
                "Noida Sector 101",
                "Noida Sector 76",
                "Noida Sector 50",
                "Noida Sector 51",
            ],
            "duration_minutes": 6.0,
            "distance_km": 3.43,
            "normal_fare": 20.0,
            "special_fare": 15.0,
        }
        with (
            patch.object(
                nmrc_journey,
                "get_station_catalog",
                AsyncMock(return_value=STATIONS),
            ),
            patch.object(
                nmrc_journey,
                "_scrape_journey",
                AsyncMock(return_value=live_result),
            ),
        ):
            plan = await nmrc_journey.plan_journey(
                from_station_code="NM04",
                to_station_code="NM01",
                strategy=RouteStrategy.LEAST_DISTANCE,
            )

        self.assertEqual(plan.source, JourneySource.NMRC)
        self.assertEqual(plan.origin.code, "NM04")
        self.assertEqual(plan.destination.code, "NM01")
        self.assertEqual(plan.station_count, 3)
        self.assertEqual(plan.total_distance_km, 3.43)
        self.assertEqual(plan.legs[0].towards_station, "Noida Sector 51")
        self.assertIsNone(plan.fallback_reason)


if __name__ == "__main__":
    unittest.main()
