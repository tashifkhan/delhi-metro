"""Canonical station crosswalk between the legacy DMRC and Sarthi catalogs.

The two upstreams use different station IDs and, for three stations, different
station codes. `data/stations.normalized.json` is the generated crosswalk that
maps both vocabularies onto one canonical slug per physical station; see
`scripts/normalize_station_catalogs.py` and `docs/station-identifiers.md`.

Callers pass a station code in either vocabulary and get back the code the
target upstream actually expects.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache

from core.config import settings


@dataclass(frozen=True, slots=True)
class SarthiStation:
    """One Sarthi record for a canonical station."""

    id: str
    code: str
    name: str
    commercial_name: str | None
    lines: tuple[str, ...]
    latitude: float | None
    longitude: float | None
    status: str | None


@dataclass(frozen=True, slots=True)
class CanonicalStation:
    """One physical station, with both upstreams' native identifiers."""

    slug: str
    name: str
    legacy_code: str
    legacy_id: int | None
    legacy_lines: tuple[str, ...]
    sarthi: tuple[SarthiStation, ...]

    @property
    def sarthi_code(self) -> str | None:
        """Preferred Sarthi code for journey planning.

        Sikanderpur is the one station with two Sarthi records (the Yellow Line
        station and the Rapid Metro station). The record whose name matches the
        canonical name is the main-network one, which is what a journey query
        should use.
        """

        if not self.sarthi:
            return None

        for record in self.sarthi:
            if record.name.strip().upper() == self.name.strip().upper():
                return record.code
        return self.sarthi[0].code


@dataclass(frozen=True, slots=True)
class StationCatalog:
    """Loaded crosswalk with lookup indexes over both code vocabularies."""

    stations: tuple[CanonicalStation, ...]
    by_slug: dict[str, CanonicalStation]
    by_code: dict[str, CanonicalStation]

    def resolve(self, code: str) -> CanonicalStation | None:
        """Resolve a station code from either upstream to its canonical record."""

        return self.by_code.get(code.strip().upper())


def _parse_sarthi(raw: dict) -> SarthiStation:
    return SarthiStation(
        id=str(raw["id"]),
        code=str(raw["code"]).upper(),
        name=str(raw["name"]),
        commercial_name=raw.get("commercial_name"),
        lines=tuple(raw.get("lines") or ()),
        latitude=raw.get("latitude"),
        longitude=raw.get("longitude"),
        status=raw.get("status"),
    )


@lru_cache(maxsize=1)
def get_catalog() -> StationCatalog:
    """Load and cache the generated station crosswalk."""

    payload = json.loads(settings.station_catalog_path.read_text(encoding="utf-8"))

    stations: list[CanonicalStation] = []
    for raw in payload["stations"]:
        legacy = raw.get("legacy") or {}
        stations.append(
            CanonicalStation(
                slug=raw["slug"],
                name=raw["name"],
                legacy_code=str(legacy.get("code", "")).upper(),
                legacy_id=legacy.get("id"),
                legacy_lines=tuple(legacy.get("lines") or ()),
                sarthi=tuple(_parse_sarthi(item) for item in raw.get("sarthi") or ()),
            )
        )

    by_slug = {station.slug: station for station in stations}
    by_code: dict[str, CanonicalStation] = {}
    for station in stations:
        if station.legacy_code:
            by_code[station.legacy_code] = station
        for record in station.sarthi:
            by_code[record.code] = station

    return StationCatalog(
        stations=tuple(stations),
        by_slug=by_slug,
        by_code=by_code,
    )


def resolve_station(code: str) -> CanonicalStation | None:
    """Resolve a legacy or Sarthi station code to its canonical record."""

    return get_catalog().resolve(code)


def to_sarthi_code(code: str) -> str | None:
    """Translate a station code to the code Sarthi expects.

    Returns `None` for a station Sarthi does not publish (currently Soorghat),
    which is a signal to use the legacy planner instead.
    """

    station = resolve_station(code)
    if station is None:
        return None
    return station.sarthi_code


def to_legacy_code(code: str) -> str | None:
    """Translate a station code to the code the legacy DMRC API expects."""

    station = resolve_station(code)
    if station is None or not station.legacy_code:
        return None
    return station.legacy_code
