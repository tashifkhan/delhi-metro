"""Offline endpoint and all-pairs checks against the recorded export."""

import hashlib
import tempfile
import unittest
from itertools import pairwise
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from core.config import settings
from main import app
from schemas.journey import RouteStrategy
from scripts.sample_routes import SkeletonReader
from services.offline_export import (
    ExportStore,
    json_bytes,
    read_artifact,
    write_artifact,
)
from services.offline_router import OfflineRouter


class ExportApiTests(unittest.TestCase):
    def test_export_uses_local_snapshot_and_supports_conditional_requests(self):
        bundle = {"schema_version": 1, "sections": {"stations": [{"code": "AIIMS"}]}}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test-export.zip"
            manifest = write_artifact(bundle, path, router_agreement=0.75)
            with (
                patch.multiple(
                    settings, offline_export_path=path, offline_export_url=None
                ),
                patch(
                    "routes.offline_export.export_store",
                    ExportStore(),
                ),
                patch("services.offline_export._download") as remote,
                TestClient(app) as client,
            ):
                metadata = client.get("/api/v1/export/manifest")
                self.assertEqual(metadata.status_code, 200)
                self.assertEqual(metadata.json(), manifest.model_dump(mode="json"))
                self.assertEqual(metadata.json()["sections"]["stations"]["count"], 1)

                result = client.get("/api/v1/export")
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json(), bundle)
                self.assertEqual(result.headers["content-encoding"], "gzip")
                self.assertEqual(
                    int(result.headers["content-length"]), manifest.size_bytes
                )
                self.assertEqual(
                    hashlib.sha256(result.content).hexdigest(), manifest.sha256
                )
                response = client.get(
                    "/api/v1/export", headers={"If-None-Match": result.headers["etag"]}
                )
                self.assertEqual(response.status_code, 304)
                self.assertFalse(response.content)
                remote.assert_not_called()


class OfflineGraphTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        artifact = read_artifact(settings.offline_export_path)
        cls.manifest = artifact.manifest
        cls.bundle = artifact.read_bundle()
        cls.sections = cls.bundle["sections"]
        cls.graph = cls.sections["routing_graph"]
        cls.router = OfflineRouter(cls.graph)

    def test_all_station_pairs_route_with_connected_legs(self):
        stations = set(self.router.states)
        self.assertEqual(
            stations,
            {f"{row['network']}:{row['code']}" for row in self.sections["stations"]},
        )
        self.assertGreaterEqual(len(stations), 298)
        for origin in sorted(stations):
            shortest = self.router.tree(origin, RouteStrategy.LEAST_DISTANCE)
            fewest = self.router.tree(origin, RouteStrategy.MINIMUM_INTERCHANGE)
            network = origin.split(":", 1)[0]
            local_shortest = self.router.tree(
                origin,
                RouteStrategy.LEAST_DISTANCE,
                networks=frozenset({network}),
            )
            local_fewest = self.router.tree(
                origin,
                RouteStrategy.MINIMUM_INTERCHANGE,
                networks=frozenset({network}),
            )
            for destination in stations - {origin}:
                local = destination.startswith(f"{network}:")
                distance_route = (local_shortest if local else shortest).route_to(
                    destination
                )
                change_route = (local_fewest if local else fewest).route_to(destination)
                self.assertIsNotNone(distance_route, (origin, destination))
                self.assertIsNotNone(change_route, (origin, destination))
                self.assertLessEqual(
                    change_route.changes, distance_route.changes, (origin, destination)
                )
                for route in (distance_route, change_route):
                    self.assertEqual(route.legs[0].origin, origin)
                    self.assertEqual(route.legs[-1].destination, destination)
                    self.assertTrue(
                        all(a.destination == b.origin for a, b in pairwise(route.legs))
                    )

    def test_rapid_metro_loop_preserves_service_direction(self):
        outward = self.router.route(
            "dmrc:DL2", "dmrc:DL3", RouteStrategy.LEAST_DISTANCE
        )
        back = self.router.route("dmrc:DL3", "dmrc:DL2", RouteStrategy.LEAST_DISTANCE)
        self.assertEqual(
            outward.legs[0].stops,
            ("dmrc:DL2", "dmrc:BEL", "dmrc:GAT", "dmrc:MAL", "dmrc:DL3"),
        )
        self.assertEqual(back.legs[0].stops, ("dmrc:DL3", "dmrc:DL2"))

    def test_route_overrides_follow_the_graph(self):
        reader = SkeletonReader(self.graph, self.sections["stations"])
        for override in self.sections["overrides"]:
            self.assertTrue(reader.valid(override), override)

    def test_section_hashes_and_map_bytes(self):
        import base64

        for name, section in self.sections.items():
            expected = self.manifest.sections[name]
            self.assertEqual(len(section), expected.count, name)
            self.assertEqual(
                hashlib.sha256(json_bytes(section)).hexdigest(), expected.sha256, name
            )
        for network, image in self.sections["official_map"].items():
            content = base64.b64decode(image["data_base64"], validate=True)
            self.assertEqual(len(content), image["size_bytes"], network)
            self.assertEqual(
                hashlib.sha256(content).hexdigest(), image["sha256"], network
            )
