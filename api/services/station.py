"""Service for DMRC station resources."""

from __future__ import annotations

import asyncio
from time import monotonic
from urllib.parse import quote

from pydantic import TypeAdapter

from clients.dmrc import dmrc_client
from core.validation import validate_model, validate_with_adapter
from schemas.line import StationLineBadge
from schemas.station import (
    StationByLineItem,
    StationDetail,
    StationSearchFilter,
    StationSearchResult,
)
from services.line import line_badge, list_lines

_station_search_adapter = TypeAdapter(list[StationSearchResult])
_station_by_line_adapter = TypeAdapter(list[StationByLineItem])

# The badge map is derived from every line's station list, so it costs one
# request per line to rebuild. Station-to-line mapping changes rarely.
_BADGE_CACHE_TTL_SECONDS = 300.0
_badge_cache: dict[str, list[StationLineBadge]] | None = None
_badge_cache_expiry = 0.0


def normalize_station_code(code: str) -> str:
    """Normalize station codes to DMRC expected format (uppercase, trimmed)."""

    return code.strip().upper()


async def stations_by_line(line_code: str) -> list[StationByLineItem]:
    """Return the ordered station sequence for one line."""

    payload = await dmrc_client.get_json_list(
        f"station_by_line/{line_code.strip().upper()}"
    )
    return validate_with_adapter(_station_by_line_adapter, payload)


async def get_station_detail(station_code: str) -> StationDetail:
    """Return the detailed station payload for a station code."""

    payload = await dmrc_client.get_json_dict(
        f"station/{normalize_station_code(station_code)}"
    )
    return validate_model(StationDetail, payload)


async def search_stations(
    *,
    query: str,
    search_filter: StationSearchFilter,
) -> list[StationSearchResult]:
    """Return keyword search results, or the full catalog for an empty query."""

    normalized_query = query.strip()
    if not normalized_query:
        return await list_all_stations()

    encoded_query = quote(normalized_query)
    payload = await dmrc_client.get_json_list(
        f"station_by_keyword/{search_filter.value}/{encoded_query}"
    )
    stations = validate_with_adapter(_station_search_adapter, payload)
    return await _with_line_badges(stations)


async def list_all_stations() -> list[StationSearchResult]:
    """Return a de-duplicated station catalog across all DMRC lines."""

    lines = await list_lines()
    stations_per_line = await asyncio.gather(
        *(stations_by_line(line.line_code) for line in lines)
    )

    station_by_code: dict[str, StationSearchResult] = {}
    badges_by_code: dict[str, list[StationLineBadge]] = {}
    seen_station_line_pairs: set[tuple[str, str]] = set()

    for line, line_stations in zip(lines, stations_per_line):
        badge = line_badge(line)
        for station in line_stations:
            normalized_code = normalize_station_code(station.station_code)

            pair = (normalized_code, badge.line_code)
            if pair not in seen_station_line_pairs:
                badges_by_code.setdefault(normalized_code, []).append(badge)
                seen_station_line_pairs.add(pair)

            if normalized_code in station_by_code:
                continue

            station_by_code[normalized_code] = StationSearchResult(
                id=station.id,
                station_name=station.station_name,
                station_code=normalized_code,
                station_facility=station.station_facility,
                metro_lines=[],
            )

    for station_code, badges in badges_by_code.items():
        badges.sort(key=lambda item: (item.line_id, item.line_code))
        station = station_by_code.get(station_code)
        if station is None:
            continue
        station_by_code[station_code] = station.model_copy(
            update={"metro_lines": list(badges)}
        )

    return sorted(
        station_by_code.values(),
        key=lambda item: (item.station_name.upper(), item.station_code),
    )


async def _get_badge_map() -> dict[str, list[StationLineBadge]]:
    """Return (and cache) the station-code to line-badge mapping."""

    global _badge_cache, _badge_cache_expiry

    now = monotonic()
    if _badge_cache is not None and now < _badge_cache_expiry:
        return _badge_cache

    lines = await list_lines()
    stations_per_line = await asyncio.gather(
        *(stations_by_line(line.line_code) for line in lines)
    )

    badges_by_code: dict[str, list[StationLineBadge]] = {}
    seen_pairs: set[tuple[str, str]] = set()

    for line, line_stations in zip(lines, stations_per_line):
        badge = line_badge(line)
        for station in line_stations:
            normalized_code = normalize_station_code(station.station_code)
            pair = (normalized_code, badge.line_code)
            if pair in seen_pairs:
                continue

            badges_by_code.setdefault(normalized_code, []).append(badge)
            seen_pairs.add(pair)

    for badges in badges_by_code.values():
        badges.sort(key=lambda item: (item.line_id, item.line_code))

    _badge_cache = badges_by_code
    _badge_cache_expiry = now + _BADGE_CACHE_TTL_SECONDS
    return badges_by_code


async def _with_line_badges(
    stations: list[StationSearchResult],
) -> list[StationSearchResult]:
    """Attach line badges to search results, which upstream omits."""

    if not stations:
        return stations

    badges_by_code = await _get_badge_map()
    return [
        station.model_copy(
            update={
                "metro_lines": list(
                    badges_by_code.get(
                        normalize_station_code(station.station_code),
                        [],
                    )
                )
            }
        )
        for station in stations
    ]
