"""Official-map layouts: tiling, merging, switches, hashing and the stream."""

from __future__ import annotations

import hashlib
import io
import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient
from PIL import Image

from core.config import settings
from main import app
from schemas.map_layout import LayoutStatus
from schemas.planner import MetroNetwork
from services import map_layout
from services.dmrc import map_asset as dmrc_maps

client = TestClient(app)


def _jpeg(width: int = 400, height: int = 300) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="JPEG")
    return buffer.getvalue()


def _events(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.split("\n\n"):
        lines = [line for line in block.splitlines() if not line.startswith(":")]
        if not lines:
            continue
        name = lines[0].removeprefix("event: ")
        events.append((name, json.loads(lines[1].removeprefix("data: "))))
    return events


class TilingTests(unittest.TestCase):
    def test_small_image_is_one_tile(self) -> None:
        self.assertEqual(map_layout.plan_tiles(1200, 701, 2048), [map_layout.Tile(0, 0, 1200, 701)])

    def test_tiles_cover_the_whole_image_and_overlap(self) -> None:
        tiles = map_layout.plan_tiles(8118, 7219, 2048)
        self.assertEqual(max(t.left + t.width for t in tiles), 8118)
        self.assertEqual(max(t.top + t.height for t in tiles), 7219)
        self.assertTrue(all(t.width <= 2048 and t.height <= 2048 for t in tiles))
        lefts = sorted({t.left for t in tiles})
        self.assertLess(lefts[1] - lefts[0], 2048)

    def test_full_dmrc_map_decodes_at_half_size(self) -> None:
        self.assertEqual(map_layout.draft_scale(16237, 2048), 2)
        self.assertEqual(map_layout.draft_scale(1200, 2048), 1)

    def test_tile_points_map_back_to_image_fractions(self) -> None:
        tile = map_layout.Tile(1000, 500, 1000, 1000)
        point = map_layout.to_image_fraction(tile, [500, 250], 4000, 2000)
        assert point is not None
        self.assertAlmostEqual(point.x, (1000 + 250) / 4000)
        self.assertAlmostEqual(point.y, (500 + 500) / 2000)

    def test_merge_prefers_the_sighting_away_from_tile_edges(self) -> None:
        edge = map_layout.Candidate(0.1, 0.1, margin=0.01)
        centre = map_layout.Candidate(0.11, 0.1, margin=0.4)
        self.assertIs(map_layout.merge_candidates({"KG": [edge, centre]})["KG"], centre)


class OffLineCheckTests(unittest.TestCase):
    # A straight east-west line with stops every 0.1 of the width.
    LINE = ["A", "B", "C", "D", "E"]
    STRAIGHT = {code: (0.1 * (i + 1), 0.5) for i, code in enumerate(LINE)}

    def test_straight_line_keeps_everything(self) -> None:
        self.assertEqual(map_layout.find_off_line(self.STRAIGHT, [self.LINE], 1000, 1000), [])

    def test_station_on_the_wrong_marker_is_dropped_alone(self) -> None:
        points = dict(self.STRAIGHT, C=(0.3, 0.9))
        self.assertEqual(map_layout.find_off_line(points, [self.LINE], 1000, 1000), ["C"])

    def test_interchange_on_a_sharp_turn_is_kept(self) -> None:
        # Line 1 runs straight through X. Line 2 doubles back at X, the way the
        # Red Line turns at Inderlok. X is fine because line 1 vouches for it.
        points = {
            "W": (0.2, 0.5), "X": (0.3, 0.5), "Y": (0.4, 0.5),
            "P": (0.4, 0.45), "Q": (0.4, 0.55),
        }
        lines = [["W", "X", "Y"], ["P", "X", "Q"]]
        self.assertEqual(map_layout.find_off_line(points, lines, 1000, 1000), [])

    def test_line_ends_and_unplaced_stops_are_skipped(self) -> None:
        points = {"A": (0.1, 0.5), "C": (0.3, 0.5)}
        self.assertEqual(map_layout.find_off_line(points, [self.LINE], 1000, 1000), [])


class DmrcMapDiscoveryTests(unittest.TestCase):
    def test_renamed_full_map_still_matches_and_outranks_the_preview(self) -> None:
        full = "/static/media/DMRC-NMRC-and-NCRTC-MAP-10.09.2026.3fc17df1.jpg"
        self.assertTrue(dmrc_maps._matches_token(full, "dmrc-nmrc-and-ncrtc-map"))
        self.assertLess(
            dmrc_maps._stable_rank(full),
            dmrc_maps._stable_rank("/static/media/mapimgEng.6f2a6c7e.jpg"),
        )


class LayoutFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        map_layout.reset_cache()
        self.image = _jpeg()
        self.sha = hashlib.sha256(self.image).hexdigest()
        self.fetch = mock.AsyncMock(
            return_value=map_layout.FetchedImage(self.image, "https://example.test/map.jpg", "image/jpeg")
        )
        source = map_layout.SOURCES[MetroNetwork.NMRC]
        patched = map_layout.LayoutSource(
            network=source.network,
            operator=source.operator,
            is_enabled=lambda: True,
            fetch_image=self.fetch,
            stations=lambda: [("NM01", "Noida Sector 51"), ("NM02", "Noida Sector 50")],
            disabled_reason=source.disabled_reason,
        )
        self.sources = mock.patch.dict(map_layout.SOURCES, {MetroNetwork.NMRC: patched})
        self.sources.start()
        self.no_saved = mock.patch.object(map_layout, "saved_layout", return_value=None)
        self.no_saved.start()

    def tearDown(self) -> None:
        self.sources.stop()
        self.no_saved.stop()
        map_layout.reset_cache()

    def test_switched_off_network_says_so_without_fetching(self) -> None:
        response = client.get("/api/v1/dmrc/maps/layout")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], LayoutStatus.DISABLED.value)

    def test_layout_path_is_not_read_as_a_map_family(self) -> None:
        with mock.patch.object(map_layout.gemini, "is_configured", return_value=False):
            response = client.get("/api/v1/nmrc/maps/layout")
        self.assertEqual(response.status_code, 200)

    def test_changed_map_is_read_once_then_served_from_the_hash(self) -> None:
        reply = {"stations": [{"code": "NM01", "point": [100, 200]}, {"code": "nm02", "point": [900, 800]}]}
        with (
            mock.patch.object(map_layout.gemini, "is_configured", return_value=True),
            mock.patch.object(map_layout.gemini, "generate_json", mock.AsyncMock(return_value=reply)) as ask,
        ):
            first = _events(client.get("/api/v1/nmrc/maps/layout?stream=true").text)
            stages = [data["stage"] for name, data in first if name == "status"]
            self.assertEqual(stages, ["checking", "extracting", "saved"])
            name, layout = first[-1]
            self.assertEqual(name, "layout")
            self.assertEqual(layout["coverage"], {"expected": 2, "found": 2})
            self.assertEqual(layout["image"]["sha256"], self.sha)
            self.assertAlmostEqual(layout["stations"][0]["x"], 0.2)

            # Within the recheck window the held layout comes back untouched.
            second = client.get("/api/v1/nmrc/maps/layout").json()
            self.assertEqual(second["stations"], layout["stations"])
            self.assertEqual(ask.await_count, 1)

    def test_same_hash_after_recheck_skips_gemini(self) -> None:
        reply = {"stations": [{"code": "NM01", "point": [100, 200]}, {"code": "NM02", "point": [900, 800]}]}
        with (
            mock.patch.object(map_layout.gemini, "is_configured", return_value=True),
            mock.patch.object(map_layout.gemini, "generate_json", mock.AsyncMock(return_value=reply)) as ask,
            mock.patch.object(settings, "map_layout_recheck_seconds", 0),
        ):
            client.get("/api/v1/nmrc/maps/layout")
            events = _events(client.get("/api/v1/nmrc/maps/layout?stream=true").text)
        self.assertIn(("status", "unchanged"), [(n, d.get("stage")) for n, d in events])
        self.assertEqual(ask.await_count, 1)

    def test_low_coverage_keeps_nothing_and_reports_why(self) -> None:
        reply = {"stations": [{"code": "NM01", "point": [100, 200]}]}
        with (
            mock.patch.object(map_layout.gemini, "is_configured", return_value=True),
            mock.patch.object(map_layout.gemini, "generate_json", mock.AsyncMock(return_value=reply)),
            mock.patch.object(settings, "map_layout_min_coverage", 0.9),
        ):
            events = _events(client.get("/api/v1/nmrc/maps/layout?stream=true").text)
        self.assertEqual(events[-2][0], "error")
        self.assertEqual(events[-1][1]["status"], LayoutStatus.UNAVAILABLE.value)

    def test_missing_key_reports_instead_of_pretending_to_read(self) -> None:
        with mock.patch.object(map_layout.gemini, "is_configured", return_value=False):
            events = _events(client.get("/api/v1/nmrc/maps/layout?stream=true").text)
        stages = [data.get("stage") for name, data in events if name == "status"]
        self.assertNotIn("extracting", stages)
        self.assertEqual(events[-2][0], "error")

    def test_failed_image_fetch_still_ends_with_a_layout(self) -> None:
        self.fetch.side_effect = LookupError("gone")
        events = _events(client.get("/api/v1/nmrc/maps/layout?stream=true").text)
        self.assertEqual([name for name, _ in events][-2:], ["error", "layout"])


class SavedLayoutTests(unittest.TestCase):
    def test_checked_in_noida_layout_places_every_station(self) -> None:
        layout = map_layout.saved_layout(MetroNetwork.NMRC)
        assert layout is not None
        self.assertEqual(layout.coverage.found, layout.coverage.expected)
        self.assertEqual(len(layout.stations), 21)


if __name__ == "__main__":
    unittest.main()
