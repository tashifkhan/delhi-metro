"""Build the offline archive from the normalized metro services."""

import argparse
import asyncio
import base64
import json
import sys
import tempfile
from hashlib import sha256
from html import escape
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin

from PIL import Image

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parent
sys.path.insert(0, str(API_ROOT))

from clients.dmrc import dmrc_client
from clients.frontend import frontend_client
from clients.sarthi import sarthi_client
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from core.upstream_pacing import paced_requests
from schemas.map_asset import MapFamily
from schemas.notification import PassengerNotificationDetail
from schemas.planner import MetroNetwork
from services.dmrc import map_asset as dmrc_maps
from services.dmrc import notification as dmrc_notices
from services.map_layout import saved_layout
from services.ncrtc import map_asset as ncrtc_maps
from services.ncrtc import notification as ncrtc_notices
from services.ncrtc.fare import fare_matrix
from services.nmrc import map_asset as nmrc_maps
from services.nmrc import notification as nmrc_notices
from services.nmrc.journey import _published_fare
from services.notification_body import body_blocks
from services.offline_export import ARCHIVE_NAME, write_artifact
from services.offline_router import OfflineRouter

from scripts.export_catalog import as_json, collect_catalog, write_json
from scripts.export_graph import collect_graph, station_key
from scripts.export_timetables import collect_timetables

# Normal rates effective 25 August 2025. Holiday estimates follow fares seen
# in Sarthi. Airport Express has its own distance and ticket bands.
_DMRC_FARES = (
    (2, 11, 11),
    (5, 21, 11),
    (12, 32, 22),
    (21, 43, 33),
    (32, 54, 44),
    (None, 64, 54),
)
_FALLBACK_MAP = REPO_ROOT / "app/assets/delhi-metro-network-map-2026-07.webp"
_TERRAIN = REPO_ROOT / "app/src/data/terrainDetail.json"


async def _cached_collect(path: Path, collect):
    try:
        return json.loads(path.read_bytes())
    except FileNotFoundError:
        value = await collect()
        write_json(path, value)
        return value


async def _notice_section() -> list[dict]:
    rows = []
    for network, service in (
        ("dmrc", dmrc_notices),
        ("nmrc", nmrc_notices),
        ("ncrtc", ncrtc_notices),
    ):
        notices = await service.list_notifications()
        for notice in notices[:12]:
            slug = (
                dmrc_notices.notice_slug(notice)
                if network == "dmrc"
                else notice.link_to_internal_page
            )
            detail = None
            if slug:
                try:
                    detail = as_json(await service.get_notification_detail(slug))
                except (ApiRequestError, UpstreamApiError) as exc:
                    print(
                        f"Offline notice detail {network}/{slug} unavailable: {exc}",
                        flush=True,
                    )
            if detail is None:
                url = notice.link_to_outside_url
                if not url and notice.link_to_file:
                    url = urljoin(str(settings.dmrc_base_url), notice.link_to_file)
                if url:
                    content = f'<p><a href="{escape(url, quote=True)}">{escape(notice.title)}</a></p>'
                    detail = as_json(
                        PassengerNotificationDetail(
                            page_id=notice.id,
                            title=notice.title,
                            page_slug=slug or str(notice.id),
                            content=content,
                            body_blocks=body_blocks(
                                content, str(settings.dmrc_frontend_base_url)
                            ),
                        )
                    )
            rows.append(
                {"network": network, "notice": as_json(notice), "detail": detail}
            )
    return rows


async def _fares() -> dict:
    ncrtc = []
    for class_type, name in ((1, "premium"), (2, "standard")):
        ncrtc.extend(
            {
                "from": station_key("ncrtc", fare.fromStation.code),
                "to": station_key("ncrtc", fare.toStation.code),
                "class": name,
                "amount": fare.discountedFare,
            }
            for fare in await fare_matrix(class_type)
        )
    return {
        "dmrc_distance_slabs": [
            {"max_km": km, "normal": regular, "special": special}
            for km, regular, special in _DMRC_FARES
        ],
        "nmrc_station_count_slabs": [
            {
                "max_stations": count,
                "normal": _published_fare(count)[0],
                "special": _published_fare(count)[1],
            }
            for count in (1, 2, 6, 9, 16, 20)
        ],
        "ncrtc_fare_matrix": ncrtc,
    }


def _webp(data: bytes, limit: int = 4096) -> tuple[bytes, int, int]:
    # JPEG draft avoids decoding the full 230-megapixel DMRC source.
    previous_limit = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = 250_000_000
    try:
        with Image.open(BytesIO(data)) as image:
            if image.width * image.height > Image.MAX_IMAGE_PIXELS:
                raise ValueError("Official map exceeds the source pixel limit")
            image.draft("RGB", (limit, limit))
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
            output = BytesIO()
            image.convert("RGB").save(output, format="WEBP", quality=82)
            return output.getvalue(), image.width, image.height
    finally:
        Image.MAX_IMAGE_PIXELS = previous_limit


async def _official_map(network: str, service) -> dict | None:
    try:
        primary = service.resolve_primary_assets(MapFamily.NETWORK)
        if network != "nmrc":
            primary = await primary
        asset = primary.image
        if asset is None:
            raise UpstreamApiError("No official map image")
        data, _ = await service.download_asset(asset)
        source_digest = sha256(data).hexdigest()
        content, width, height = _webp(data)
        url = str(asset.url)
    except (UpstreamApiError, OSError, ValueError, Image.DecompressionBombError) as exc:
        if network != "dmrc":
            print(f"Offline map {network} unavailable: {exc}", flush=True)
            return None
        print(f"Using the checked-in DMRC official map image: {exc}", flush=True)
        content = _FALLBACK_MAP.read_bytes()
        with Image.open(BytesIO(content)) as image:
            width, height = image.size
        source_digest = url = None
    return {
        "content_type": "image/webp",
        "data_base64": base64.b64encode(content).decode("ascii"),
        "sha256": sha256(content).hexdigest(),
        "size_bytes": len(content),
        "source_url": url,
        "source_sha256": source_digest,
        "width": width,
        "height": height,
    }


async def _maps() -> dict:
    result = {}
    for network, service in (
        ("dmrc", dmrc_maps),
        ("nmrc", nmrc_maps),
        ("ncrtc", ncrtc_maps),
    ):
        if image := await _official_map(network, service):
            result[network] = image
    return result


async def build(checkpoint: Path) -> dict:
    try:
        with paced_requests():
            catalog = await _cached_collect(
                checkpoint / "catalog.json", lambda: _catalog(checkpoint)
            )
            lines, stations = catalog["lines"], catalog["stations"]
            graph, timings = await _cached_collect(
                checkpoint / "routing.json",
                lambda: collect_graph(lines, stations, checkpoint),
            )
            router = OfflineRouter(graph)
            _validate_connected(router)
            fares = await _cached_collect(checkpoint / "fares.json", _fares)
            notices = await _cached_collect(
                checkpoint / "notices.json", _notice_section
            )
            images = await _cached_collect(checkpoint / "maps.json", _maps)
            schedules = await collect_timetables(graph, stations, timings, checkpoint)
    finally:
        await dmrc_client.close()
        await frontend_client.close()
        await sarthi_client.close()
    layouts = {
        network.value: as_json(layout)
        for network in MetroNetwork
        if (layout := saved_layout(network)) is not None
    }
    return {
        "schema_version": 1,
        "sections": {
            "lines": lines,
            "stations": stations,
            "first_last_trains": schedules,
            "notices": notices,
            "map_layout": layouts,
            "official_map": images,
            "terrain_detail": json.loads(_TERRAIN.read_bytes()),
            "fares": fares,
            "routing_graph": graph,
            "overrides": [],
        },
    }


async def _catalog(checkpoint: Path) -> dict:
    lines, stations = await collect_catalog(checkpoint)
    return {"lines": lines, "stations": stations}


def _validate_connected(router: OfflineRouter) -> None:
    from schemas.journey import RouteStrategy

    if not router.states:
        raise ValueError("Offline graph has no stations")
    origin = next(iter(router.states))
    tree = router.tree(origin, RouteStrategy.LEAST_DISTANCE)
    disconnected = [
        station for station in router.states if tree.route_to(station) is None
    ]
    if disconnected:
        raise ValueError(f"Offline graph has disconnected stations: {disconnected}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=API_ROOT / "data" / ARCHIVE_NAME)
    parser.add_argument(
        "--checkpoint",
        type=Path,
        help="Reuse completed reads from an interrupted build",
    )
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="metro-export-") as temporary:
        bundle = asyncio.run(build(args.checkpoint or Path(temporary)))
    manifest = write_artifact(bundle, args.output)
    print(f"{args.output}: {manifest.size_bytes:,} gzip bytes, {manifest.version}")
