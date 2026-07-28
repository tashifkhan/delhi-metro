"""Cross-network journey planning through the Sector 52/51 interchange."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from schemas.journey import RouteStrategy
from schemas.planner import (
    JourneySource,
    LegKind,
    MetroNetwork,
    PlannedFare,
    PlannedJourney,
    PlannedLeg,
    PlannedStation,
)
from services import planner
from services.interchange import SECTOR_52_51, find_interchange


def _plan(
    *,
    source: JourneySource,
    origin: tuple[str, str],
    destination: tuple[str, str],
    total_time: str,
    normal_fare: float,
    stations: int,
    distance_km: float | None = None,
) -> PlannedJourney:
    return PlannedJourney(
        source=source,
        strategy=RouteStrategy.LEAST_DISTANCE,
        exclude_airport_line=False,
        origin=PlannedStation(name=origin[0], code=origin[1]),
        destination=PlannedStation(name=destination[0], code=destination[1]),
        station_count=stations,
        total_time=total_time,
        total_distance_km=distance_km,
        fare=PlannedFare(normal=normal_fare, special=normal_fare),
        legs=[
            PlannedLeg(
                line_name="Test Line",
                from_station=origin[0],
                to_station=destination[0],
            )
        ],
    )


class DurationParsingTests(unittest.TestCase):
    def test_every_upstream_duration_format_is_read(self) -> None:
        # DMRC clock, Sarthi minutes, NMRC minutes.
        self.assertEqual(planner._duration_minutes("0:38:26"), 38.4)
        self.assertEqual(planner._duration_minutes("31 mins"), 31.0)
        self.assertEqual(planner._duration_minutes("6 min"), 6.0)
        self.assertIsNone(planner._duration_minutes(None))
        self.assertIsNone(planner._duration_minutes("shortly"))


class InterchangeLookupTests(unittest.TestCase):
    def test_same_network_has_no_interchange(self) -> None:
        self.assertIsNone(
            find_interchange(MetroNetwork.DMRC, MetroNetwork.DMRC)
        )

    def test_networks_are_linked_in_both_directions(self) -> None:
        self.assertIs(
            find_interchange(MetroNetwork.DMRC, MetroNetwork.NMRC), SECTOR_52_51
        )
        self.assertIs(
            find_interchange(MetroNetwork.NMRC, MetroNetwork.DMRC), SECTOR_52_51
        )

    def test_each_side_reports_its_own_station(self) -> None:
        self.assertEqual(SECTOR_52_51.code_for(MetroNetwork.DMRC), "SFTN")
        self.assertEqual(SECTOR_52_51.code_for(MetroNetwork.NMRC), "NM01")
        self.assertEqual(SECTOR_52_51.name_for(MetroNetwork.NMRC), "Noida Sector 51")


class CrossNetworkPlanTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.dmrc_half = _plan(
            source=JourneySource.SARTHI,
            origin=("NOIDA SECTOR-18", "NSET"),
            destination=("SECTOR - 52 NOIDA", "SFTN"),
            total_time="0:10:00",
            normal_fare=30.0,
            stations=6,
            distance_km=5.5,
        )
        self.nmrc_half = _plan(
            source=JourneySource.NMRC,
            origin=("Noida Sector 51", "NM01"),
            destination=("Pari Chowk", "NM17"),
            total_time="32 min",
            normal_fare=40.0,
            stations=16,
            distance_km=21.29,
        )

    async def _plan_cross(self, from_code: str, to_code: str) -> PlannedJourney:
        async def fake_dmrc(**_kwargs) -> PlannedJourney:
            return self.dmrc_half

        async def fake_nmrc(**_kwargs) -> PlannedJourney:
            return self.nmrc_half

        with (
            patch.object(
                planner, "_detect_network", AsyncMock(side_effect=self._network_of)
            ),
            patch.object(
                planner, "_canonical_code", AsyncMock(side_effect=self._canonical)
            ),
            patch.object(planner, "_plan_on_dmrc", fake_dmrc),
            patch.object(planner.nmrc_planner, "plan_journey", fake_nmrc),
        ):
            return await planner.plan_journey(
                from_station_code=from_code,
                to_station_code=to_code,
            )

    @staticmethod
    async def _network_of(code: str) -> MetroNetwork:
        return MetroNetwork.NMRC if code.startswith("NM") else MetroNetwork.DMRC

    @staticmethod
    async def _canonical(code: str, network: MetroNetwork) -> str:
        return code

    async def test_walking_transfer_joins_the_two_halves(self) -> None:
        plan = await self._plan_cross("NSET", "NM17")

        self.assertEqual(plan.source, JourneySource.COMBINED)
        self.assertEqual(plan.networks, [MetroNetwork.DMRC, MetroNetwork.NMRC])
        self.assertEqual([leg.kind for leg in plan.legs], [
            LegKind.METRO,
            LegKind.TRANSFER,
            LegKind.METRO,
        ])
        self.assertEqual(
            [leg.network for leg in plan.legs],
            [MetroNetwork.DMRC, None, MetroNetwork.NMRC],
        )

        transfer = plan.legs[1]
        self.assertEqual(transfer.from_station_code, "SFTN")
        self.assertEqual(transfer.to_station_code, "NM01")
        self.assertEqual(transfer.walk_metres, SECTOR_52_51.walk_metres)

    async def test_each_leg_reports_the_upstream_that_produced_it(self) -> None:
        plan = await self._plan_cross("NSET", "NM17")

        self.assertEqual(plan.legs[0].source, JourneySource.SARTHI)
        self.assertEqual(plan.legs[2].source, JourneySource.NMRC)

    async def test_totals_sum_both_halves_plus_the_walk(self) -> None:
        plan = await self._plan_cross("NSET", "NM17")

        # 10 min + 6 min walk + 32 min
        self.assertEqual(plan.total_time, "48 min")
        self.assertEqual(plan.station_count, 22)
        self.assertEqual(plan.total_distance_km, 26.79)

    async def test_fares_are_summed_and_split_by_network(self) -> None:
        plan = await self._plan_cross("NSET", "NM17")

        self.assertEqual(plan.fare.normal, 70.0)
        self.assertTrue(plan.separate_tickets)
        self.assertEqual(
            [(item.network, item.normal) for item in plan.fare.breakdown],
            [(MetroNetwork.DMRC, 30.0), (MetroNetwork.NMRC, 40.0)],
        )

    async def test_starting_at_the_interchange_skips_that_half(self) -> None:
        plan = await self._plan_cross("SFTN", "NM17")

        self.assertEqual([leg.kind for leg in plan.legs], [
            LegKind.TRANSFER,
            LegKind.METRO,
        ])
        self.assertEqual(plan.origin.code, "SFTN")
        self.assertEqual(plan.station_count, 16)
        # One ticket only: the traveller is already outside the DMRC network.
        self.assertFalse(plan.separate_tickets)
        self.assertEqual(plan.fare.normal, 40.0)

    async def test_interchange_walk_alone_is_a_valid_journey(self) -> None:
        plan = await self._plan_cross("SFTN", "NM01")

        self.assertEqual([leg.kind for leg in plan.legs], [LegKind.TRANSFER])
        self.assertEqual(plan.total_time, "6 min")
        self.assertEqual(plan.fare.normal, 0.0)
        self.assertFalse(plan.separate_tickets)

    async def test_reverse_direction_walks_the_other_way(self) -> None:
        self.dmrc_half = _plan(
            source=JourneySource.SARTHI,
            origin=("SECTOR - 52 NOIDA", "SFTN"),
            destination=("RAJIV CHOWK", "RCK"),
            total_time="0:36:00",
            normal_fare=43.0,
            stations=22,
        )
        self.nmrc_half = _plan(
            source=JourneySource.NMRC,
            origin=("Depot Station", "NM21"),
            destination=("Noida Sector 51", "NM01"),
            total_time="40 min",
            normal_fare=50.0,
            stations=20,
        )

        plan = await self._plan_cross("NM21", "RCK")

        self.assertEqual(plan.networks, [MetroNetwork.NMRC, MetroNetwork.DMRC])
        transfer = plan.legs[1]
        self.assertEqual(transfer.from_station_code, "NM01")
        self.assertEqual(transfer.to_station_code, "SFTN")


if __name__ == "__main__":
    unittest.main()
