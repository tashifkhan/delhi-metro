"""Fare assumptions and passenger notice text conversion."""

import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from schemas.planner import MetroNetwork, PlannedFare, PlannedLeg
from schemas.sarthi import SarthiJourney
from services.notification_body import body_blocks
from services.smart_card import is_airport_leg, smart_card_fare


class SmartCardTests(unittest.TestCase):
    def test_uses_local_departure_and_applicable_token(self):
        payload = Path(__file__).parent / "fixtures" / "sarthi-aiims-asdm.json"
        raw = SarthiJourney.model_validate(json.loads(payload.read_text()))
        fare = PlannedFare(
            normal=raw.fare.normal,
            special=raw.fare.special,
            applicable=raw.applicable_fare,
        )
        # 06:30 UTC is noon in Delhi.
        noon = smart_card_fare(
            fare, MetroNetwork.DMRC, datetime(2026, 11, 24, 6, 30, tzinfo=timezone.utc)
        )
        peak = smart_card_fare(fare, MetroNetwork.DMRC, datetime(2026, 11, 24, 17))
        airport = smart_card_fare(
            fare,
            MetroNetwork.DMRC,
            datetime(2026, 11, 24, 7),
            airport_fare=30,
            airport_line=True,
        )
        self.assertEqual((noon.amount, noon.off_peak, noon.derived), (34.4, True, True))
        self.assertEqual((peak.amount, peak.off_peak), (38.7, False))
        self.assertEqual((airport.amount, airport.off_peak), (37.4, True))
        self.assertIsNone(smart_card_fare(fare, MetroNetwork.NCRTC, None))
        self.assertTrue(
            is_airport_leg(
                PlannedLeg(
                    line_number=10,
                    line_name="Orange Line",
                    from_station="A",
                    to_station="B",
                )
            )
        )


class NoticeTextTests(unittest.TestCase):
    def test_orders_text_and_links_and_ignores_script_and_unsafe_urls(self):
        blocks = body_blocks(
            "<h2>Service update</h2><p>Starts <strong>today</strong>.<br>Expect delays.</p>"
            '<ul><li>Use gate 3</li><li><a href="/map">Station map</a></li></ul>'
            '<script>alert(1)</script><a href="javascript:alert(1)">Plain text</a>',
            "https://example.org/pages/notices",
        )
        self.assertEqual(
            [(block.type, block.text, block.href) for block in blocks],
            [
                ("heading", "Service update", None),
                ("paragraph", "Starts today.", None),
                ("paragraph", "Expect delays.", None),
                ("list_item", "Use gate 3", None),
                ("link", "Station map", "https://example.org/map"),
                ("paragraph", "Plain text", None),
            ],
        )
