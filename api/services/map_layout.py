"""Station positions on each operator's official map, read by Gemini.

The flow runs when someone asks for a layout, not on a schedule:

1. Fetch the operator's current official map image and hash it.
2. If the hash matches the layout this process already holds (or the one
   checked in under `data/map_layouts/`), return that layout. No Gemini call.
3. If the image changed, cut it into tiles when it is large, ask Gemini where
   each known station's marker sits, merge the tiles, and keep the result only
   if enough stations were found.

Every step is reported as an event so a client can tell the person to wait
while Gemini works. Each network is a `LayoutSource` with its own on/off
setting, so a network can be switched on without touching the flow.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from PIL import Image

from clients import gemini
from core.catalog import get_catalog
from core.config import settings
from schemas.map_asset import MapFamily
from schemas.map_layout import (
    LayoutCoverage,
    LayoutImage,
    LayoutStage,
    LayoutStation,
    LayoutStatus,
    LayoutStatusEvent,
    MapLayout,
)
from schemas.planner import MetroNetwork
from services.dmrc import map_asset as dmrc_maps
from services.nmrc import map_asset as nmrc_maps
from services.nmrc.data import STATIONS as NMRC_STATIONS

logger = logging.getLogger(__name__)

# Operator map images are trusted and already capped by
# `map_download_max_bytes`. The full DMRC map is 16237 x 14438, which trips
# Pillow's decompression-bomb guard.
Image.MAX_IMAGE_PIXELS = None

TILE_OVERLAP = 0.12
MAX_PARALLEL_TILES = 4
TILE_ATTEMPTS = 3

# ---------------------------------------------------------------------------
# Sources: one per network, each with its own switch.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class FetchedImage:
    content: bytes
    url: str
    mime_type: str


@dataclass(frozen=True, slots=True)
class LayoutSource:
    network: MetroNetwork
    operator: str
    is_enabled: Callable[[], bool]
    fetch_image: Callable[[], Awaitable[FetchedImage]]
    stations: Callable[[], list[tuple[str, str]]]
    disabled_reason: str
    # Station codes per line in travel order, for the off-line check.
    line_orders: Callable[[], Awaitable[list[list[str]]]] = field(default=None)  # type: ignore[assignment]


async def _fetch_dmrc() -> FetchedImage:
    assets = await dmrc_maps.resolve_primary_assets(MapFamily.NETWORK)
    if assets.image is None:
        raise LookupError("DMRC publishes no network map image right now")
    content, headers = await dmrc_maps.download_asset(assets.image)
    return FetchedImage(content, str(assets.image.url), _mime(headers))


async def _fetch_nmrc() -> FetchedImage:
    assets = nmrc_maps.resolve_primary_assets(MapFamily.NETWORK)
    if assets.image is None:
        raise LookupError("NMRC publishes no network map image right now")
    content, headers = await nmrc_maps.download_asset(assets.image)
    return FetchedImage(content, str(assets.image.url), _mime(headers))


def _mime(headers: dict[str, str]) -> str:
    value = headers.get("content-type", "image/jpeg").split(";", maxsplit=1)[0].strip().lower()
    return "image/jpeg" if value == "image/jpg" else value


def _dmrc_stations() -> list[tuple[str, str]]:
    return [
        (station.legacy_code, station.name)
        for station in get_catalog().stations
        if station.legacy_code
    ]


def _nmrc_stations() -> list[tuple[str, str]]:
    return [(station.code, station.name) for station in NMRC_STATIONS]


async def _dmrc_line_orders() -> list[list[str]]:
    from services.dmrc import line as dmrc_line
    from services.dmrc import station as dmrc_station

    orders: list[list[str]] = []
    for line in await dmrc_line.list_lines():
        try:
            items = await dmrc_station.stations_by_line(line.line_code)
        except Exception as exc:  # one bad line shouldn't stop the check
            logger.info("map layout: no order for %s: %s", line.line_code, exc)
            continue
        orders.append([item.station_code.strip().upper() for item in items])
    return orders


async def _nmrc_line_orders() -> list[list[str]]:
    return [[station.code for station in NMRC_STATIONS]]


SOURCES: dict[MetroNetwork, LayoutSource] = {
    MetroNetwork.DMRC: LayoutSource(
        network=MetroNetwork.DMRC,
        operator="Delhi Metro",
        is_enabled=lambda: settings.map_layout_dmrc_enabled,
        fetch_image=_fetch_dmrc,
        stations=_dmrc_stations,
        line_orders=_dmrc_line_orders,
        disabled_reason=(
            "Turned off for Delhi Metro. Station coordinates come from DMRC's own "
            "data. Set MAP_LAYOUT_DMRC_ENABLED=true to read the official map instead."
        ),
    ),
    MetroNetwork.NMRC: LayoutSource(
        network=MetroNetwork.NMRC,
        operator="Noida Metro",
        is_enabled=lambda: settings.map_layout_nmrc_enabled,
        fetch_image=_fetch_nmrc,
        stations=_nmrc_stations,
        line_orders=_nmrc_line_orders,
        disabled_reason="Turned off for Noida Metro. Set MAP_LAYOUT_NMRC_ENABLED=true.",
    ),
}

# ---------------------------------------------------------------------------
# Tiling and merging. Pure functions, covered by tests.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Tile:
    left: int
    top: int
    width: int
    height: int


def plan_tiles(width: int, height: int, tile_px: int, overlap: float = TILE_OVERLAP) -> list[Tile]:
    """Cover the image with overlapping tiles no bigger than `tile_px`."""

    if width <= tile_px and height <= tile_px:
        return [Tile(0, 0, width, height)]

    step = max(1, int(tile_px * (1 - overlap)))

    def starts(length: int) -> list[int]:
        if length <= tile_px:
            return [0]
        positions = list(range(0, length - tile_px, step))
        positions.append(length - tile_px)
        return sorted(set(positions))

    return [
        Tile(left, top, min(tile_px, width - left), min(tile_px, height - top))
        for top in starts(height)
        for left in starts(width)
    ]


@dataclass(slots=True)
class Candidate:
    x: float
    y: float
    margin: float


def to_image_fraction(tile: Tile, point: list[int], width: int, height: int) -> Candidate | None:
    """Turn Gemini's [y, x] on a 0-1000 grid over one tile into image fractions."""

    if len(point) != 2:
        return None
    py, px = (max(0, min(1000, int(v))) / 1000 for v in point)
    # Distance from the tile's nearest edge, so overlapping tiles prefer the
    # one that saw the marker in full rather than cut off at its border.
    margin = min(px, 1 - px, py, 1 - py)
    return Candidate(
        x=(tile.left + px * tile.width) / width,
        y=(tile.top + py * tile.height) / height,
        margin=margin,
    )


def merge_candidates(found: dict[str, list[Candidate]]) -> dict[str, Candidate]:
    """Keep, per station, the sighting furthest from any tile edge."""

    return {code: max(items, key=lambda c: c.margin) for code, items in found.items() if items}


def find_off_line(
    points: dict[str, tuple[float, float]],
    lines: list[list[str]],
    width: int,
    height: int,
    max_detour: float = 1.8,
) -> list[str]:
    """Codes of stations that sit far off their own lines, worst first.

    For each run of three placed stations along a line, compare the path
    through the middle one with the direct hop between its neighbours. A
    station Gemini put on the wrong marker makes a long detour.

    Sharp 135-degree turns also make long detours, and interchanges often sit
    on them (Inderlok, Central Secretariat). A correctly placed interchange
    still runs straight along at least one of its lines, so a station is only
    dropped when it detours on every line where it has two placed neighbours.
    The worst one goes first and the rest are re-checked, so one bad point
    doesn't condemn its neighbours.
    """

    def dist(a: tuple[float, float], b: tuple[float, float]) -> float:
        return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5

    placed = {code: (x * width, y * height) for code, (x, y) in points.items()}
    dropped: list[str] = []
    while True:
        # code -> detour ratio on each line where it has both neighbours
        ratios: dict[str, list[float]] = {}
        for line in lines:
            seq = [code for code in line if code in placed]
            for a, middle, b in zip(seq, seq[1:], seq[2:]):
                direct = dist(placed[a], placed[b])
                if direct <= 0:
                    continue
                through = dist(placed[a], placed[middle]) + dist(placed[middle], placed[b])
                ratios.setdefault(middle, []).append(through / direct)

        offenders = [
            (min(values), code)
            for code, values in ratios.items()
            if min(values) > max_detour
        ]
        if not offenders:
            return dropped
        _, worst = max(offenders)
        dropped.append(worst)
        placed.pop(worst)


# ---------------------------------------------------------------------------
# Gemini call
# ---------------------------------------------------------------------------

_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "stations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "code": {"type": "STRING"},
                    "point": {"type": "ARRAY", "items": {"type": "INTEGER"}},
                },
                "required": ["code", "point"],
            },
        }
    },
    "required": ["stations"],
}


def build_prompt(operator: str, stations: list[tuple[str, str]], whole_image: bool) -> str:
    listing = "\n".join(f"{code}: {name}" for code, name in stations)
    scope = "the official map" if whole_image else "one tile cut from the official map"
    return (
        f"This image is {scope} published by {operator}.\n"
        "For every station in the list below that you can see in this image, return its "
        "code and the centre of its station marker on the line (the dot, circle or "
        "'M' badge, not the text label) as point [y, x], normalised to 0-1000 over this "
        "image. Skip stations that are not visible. Use only codes from the list, each at "
        "most once. Hindi and English labels both name the same station.\n\n"
        f"Stations:\n{listing}"
    )


def _encode_tile(image: Image.Image, tile: Tile) -> bytes:
    crop = image.crop((tile.left, tile.top, tile.left + tile.width, tile.top + tile.height))
    buffer = io.BytesIO()
    crop.convert("RGB").save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def _open_scaled(content: bytes, tile_px: int) -> tuple[Image.Image, int, int]:
    """Open the image, letting the JPEG decoder shrink huge maps cheaply.

    Gemini can't read more detail than ~tile_px per tile anyway, so a map far
    bigger than a 4 x 4 grid of tiles is decoded at 1/2, 1/4 or 1/8 size.
    """

    image = Image.open(io.BytesIO(content))
    original = image.size
    scale = draft_scale(max(original), tile_px)
    if image.format == "JPEG" and scale > 1:
        # `draft` keeps the result at least as large as the size asked for, so
        # ask for exactly 1/scale or it silently stays at full resolution.
        image.draft("RGB", (original[0] // scale, original[1] // scale))
    image.load()
    return image, original[0], original[1]


def draft_scale(longest: int, tile_px: int) -> int:
    """JPEG decode reduction (1, 2, 4 or 8) that leaves about a 4 x 4 tile grid."""

    target = tile_px * 4
    for scale in (1, 2, 4, 8):
        if longest / scale <= target * 1.25:
            return scale
    return 8


ProgressFn = Callable[[int, int], Awaitable[None]]


async def extract(
    source: LayoutSource,
    fetched: FetchedImage,
    sha: str,
    on_progress: ProgressFn,
) -> MapLayout:
    stations = source.stations()
    names = dict(stations)
    image, width, height = _open_scaled(fetched.content, settings.map_layout_tile_px)
    scaled_w, scaled_h = image.size
    tiles = plan_tiles(scaled_w, scaled_h, settings.map_layout_tile_px)
    prompt = build_prompt(source.operator, stations, whole_image=len(tiles) == 1)

    found: dict[str, list[Candidate]] = {}
    done = 0
    gate = asyncio.Semaphore(MAX_PARALLEL_TILES)
    lock = asyncio.Lock()

    async def ask(tile: Tile) -> Any:
        # Rate limits and timeouts hit single tiles on a big map. Retry a
        # couple of times, then give up on that tile only; the coverage check
        # decides whether what came back is good enough.
        for attempt in range(TILE_ATTEMPTS):
            try:
                async with gate:
                    return await gemini.generate_json(
                        image=_encode_tile(image, tile),
                        mime_type="image/jpeg",
                        prompt=prompt,
                        schema=_RESPONSE_SCHEMA,
                    )
            except gemini.GeminiNotConfigured:
                raise
            except Exception as exc:
                if attempt == TILE_ATTEMPTS - 1:
                    logger.warning("map layout: tile %s skipped: %s", tile, exc)
                    return None
                await asyncio.sleep(2 * (attempt + 1))
        return None

    async def read(tile: Tile) -> None:
        nonlocal done
        reply = await ask(tile)
        async with lock:
            for item in (reply or {}).get("stations", []):
                code = str(item.get("code", "")).strip().upper()
                if code not in names:
                    continue
                candidate = to_image_fraction(tile, item.get("point") or [], scaled_w, scaled_h)
                if candidate is not None:
                    found.setdefault(code, []).append(candidate)
            done += 1
            await on_progress(done, len(tiles))

    await asyncio.gather(*(read(tile) for tile in tiles))
    if not found:
        raise RuntimeError("Gemini found no stations on any part of the map")

    merged = merge_candidates(found)
    dropped: list[str] = []
    if source.line_orders is not None:
        try:
            orders = await source.line_orders()
        except Exception as exc:
            logger.info("map layout: skipping off-line check for %s: %s", source.network.value, exc)
        else:
            dropped = find_off_line(
                {code: (c.x, c.y) for code, c in merged.items()}, orders, scaled_w, scaled_h
            )
            for code in dropped:
                merged.pop(code, None)
    return MapLayout(
        network=source.network,
        status=LayoutStatus.READY,
        image=LayoutImage(url=fetched.url, sha256=sha, width=width, height=height),
        model=settings.gemini_model,
        extracted_at=datetime.now(UTC),
        coverage=LayoutCoverage(expected=len(stations), found=len(merged)),
        dropped=sorted(dropped),
        stations=[
            LayoutStation(code=code, name=names[code], x=round(c.x, 5), y=round(c.y, 5))
            for code, c in sorted(merged.items())
        ],
    )


# ---------------------------------------------------------------------------
# Cache and the event stream
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class _Held:
    layout: MapLayout
    checked_at: float


@dataclass(slots=True)
class _State:
    held: dict[MetroNetwork, _Held] = field(default_factory=dict)
    inflight: dict[MetroNetwork, "_Job"] = field(default_factory=dict)


_state = _State()


def saved_layout(network: MetroNetwork) -> MapLayout | None:
    """The layout checked in under `data/map_layouts/`, if any."""

    path = settings.map_layout_dir / f"{network.value}.json"
    try:
        return MapLayout.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return None


def _current(network: MetroNetwork) -> MapLayout | None:
    held = _state.held.get(network)
    return held.layout if held else saved_layout(network)


def reset_cache() -> None:
    """Forget held layouts. For tests."""

    _state.held.clear()
    _state.inflight.clear()


Event = tuple[str, dict[str, Any]]


def _status(stage: LayoutStage, message: str, done: int | None = None, total: int | None = None) -> Event:
    return (
        "status",
        LayoutStatusEvent(stage=stage, message=message, done=done, total=total).model_dump(mode="json"),
    )


def _layout(layout: MapLayout) -> Event:
    return ("layout", layout.model_dump(mode="json"))


def _unavailable(source: LayoutSource, detail: str) -> MapLayout:
    return MapLayout(
        network=source.network,
        status=LayoutStatus.UNAVAILABLE,
        detail=detail,
        coverage=LayoutCoverage(expected=len(source.stations()), found=0),
    )


async def layout_events(network: MetroNetwork) -> AsyncIterator[Event]:
    """Yield `status` events, then one `layout`. Errors come as `error` then `layout`."""

    source = SOURCES[network]
    if not source.is_enabled():
        yield _layout(
            MapLayout(network=network, status=LayoutStatus.DISABLED, detail=source.disabled_reason)
        )
        return

    held = _state.held.get(network)
    if held and time.monotonic() - held.checked_at < settings.map_layout_recheck_seconds:
        yield _layout(held.layout)
        return

    yield _status(LayoutStage.CHECKING, f"Checking the official {source.operator} map.")

    try:
        fetched = await source.fetch_image()
    except Exception as exc:  # upstream down, asset gone, size cap hit
        logger.warning("map layout: image fetch failed for %s: %s", network.value, exc)
        previous = _current(network)
        yield ("error", {"detail": f"Couldn't fetch the official {source.operator} map."})
        yield _layout(previous or _unavailable(source, "The official map couldn't be fetched."))
        return

    sha = hashlib.sha256(fetched.content).hexdigest()
    previous = _current(network)
    if previous and previous.image and previous.image.sha256 == sha:
        _state.held[network] = _Held(previous, time.monotonic())
        yield _status(LayoutStage.UNCHANGED, "The official map hasn't changed.")
        yield _layout(previous)
        return

    if not gemini.is_configured():
        detail = "The official map changed, but no Gemini key is set to read it."
        yield ("error", {"detail": detail})
        yield _layout(_with_detail(previous, detail) or _unavailable(source, detail))
        return

    job = _state.inflight.get(network)
    if job is None or job.sha != sha:
        job = _Job(sha=sha, source=source, fetched=fetched, previous=previous)
        job.task = asyncio.create_task(job.run())
        _state.inflight[network] = job
        job.task.add_done_callback(lambda _t, n=network, j=job: _clear_inflight(n, j))

    yield _status(
        LayoutStage.EXTRACTING,
        f"The official {source.operator} map changed. Reading it again, "
        "this takes about a minute.",
    )
    listener = job.listen()
    try:
        while (event := await listener.get()) is not None:
            yield event
    finally:
        job.unlisten(listener)

    for event in job.outcome:
        yield event


def _clear_inflight(network: MetroNetwork, job: "_Job") -> None:
    if _state.inflight.get(network) is job:
        _state.inflight.pop(network, None)


@dataclass(slots=True, eq=False)
class _Job:
    """One Gemini read of one image, shared by every request that needs it.

    It keeps running if the request that started it disconnects, saves its
    own result, and replays progress to everyone listening.
    """

    sha: str
    source: LayoutSource
    fetched: FetchedImage
    previous: MapLayout | None
    task: asyncio.Task[None] | None = None
    listeners: list[asyncio.Queue[Event | None]] = field(default_factory=list)
    outcome: list[Event] = field(default_factory=list)
    finished: bool = False

    def listen(self) -> asyncio.Queue[Event | None]:
        queue: asyncio.Queue[Event | None] = asyncio.Queue()
        if self.finished:
            queue.put_nowait(None)
        else:
            self.listeners.append(queue)
        return queue

    def unlisten(self, queue: asyncio.Queue[Event | None]) -> None:
        if queue in self.listeners:
            self.listeners.remove(queue)

    def _send(self, event: Event | None) -> None:
        for queue in list(self.listeners):
            queue.put_nowait(event)

    async def run(self) -> None:
        network = self.source.network

        async def on_progress(done: int, total: int) -> None:
            if total > 1:
                self._send(
                    _status(LayoutStage.PROGRESS, f"Read {done} of {total} parts of the map.", done, total)
                )

        try:
            layout = await extract(self.source, self.fetched, self.sha, on_progress)
        except gemini.GeminiNotConfigured:
            self._fail("The official map changed, but no Gemini key is set to read it.")
        except Exception as exc:
            logger.warning("map layout: extraction failed for %s: %s", network.value, exc)
            self._fail("Reading the new map failed. Showing the last good layout.")
        else:
            expected = max(1, layout.coverage.expected)
            if layout.coverage.found / expected < settings.map_layout_min_coverage:
                self._fail(
                    f"Only {layout.coverage.found} of {layout.coverage.expected} stations were "
                    "found on the new map, so the last good layout is kept."
                )
            else:
                _state.held[network] = _Held(layout, time.monotonic())
                self.outcome = [
                    _status(
                        LayoutStage.SAVED,
                        f"Placed {layout.coverage.found} of {layout.coverage.expected} stations.",
                    ),
                    _layout(layout),
                ]
        finally:
            self.finished = True
            self._send(None)

    def _fail(self, detail: str) -> None:
        fallback = _with_detail(self.previous, detail) or _unavailable(self.source, detail)
        self.outcome = [("error", {"detail": detail}), _layout(fallback)]


def _with_detail(layout: MapLayout | None, detail: str) -> MapLayout | None:
    return layout.model_copy(update={"detail": detail}) if layout else None


async def resolve_layout(network: MetroNetwork) -> MapLayout:
    """Run the flow to the end and return the final layout (the JSON route)."""

    final: MapLayout | None = None
    async for name, data in layout_events(network):
        if name == "layout":
            final = MapLayout.model_validate(data)
    assert final is not None
    return final
