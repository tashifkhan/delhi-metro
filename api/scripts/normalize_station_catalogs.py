#!/usr/bin/env python3
"""Build a canonical station crosswalk for the two DMRC passenger APIs.

The legacy DMRC website API and the Delhi Metro Sarthi API expose different
identifiers for the same physical stations. This script fetches both catalogs,
matches stations conservatively, and emits deterministic JSON and CSV files.

Only read-only, unauthenticated station and line endpoints are used.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable

import httpx

LEGACY_BASE_URL = "https://backend.delhimetrorail.com/api/v2/en/"
SARTHI_BASE_URL = "https://dmrc.autope.in/metro/v4/"

LEGACY_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) "
        "Gecko/20100101 Firefox/148.0"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://delhimetrorail.com/",
    "Origin": "https://delhimetrorail.com",
    "Content-Type": "application/json",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
}

# These are deliberate station-name equivalences, not fuzzy guesses. Keep both
# sides in the normalized form returned by normalize_name().
NAME_ALIASES = {
    "BRIG HOSHIAR SINGH": "BRIGADIER HOSHIAR SINGH",
    "HUDA CITY CENTRE": "MILLENNIUM CITY CENTRE GURUGRAM",
    "JANAK PURI EAST": "JANAKPURI EAST",
    "JANAK PURI WEST": "JANAKPURI WEST",
    "MAJOR MOHIT SHARMA": "MAJOR MOHIT SHARMA RAJENDRA NAGAR",
    "NOIDA ELECTRONIC CITY": "NOIDA ELECTRONIC CITY CENTRE",
    "PRAGATI MAIDAN": "SUPREME COURT",
    "R K ASHRAM MARG": "RK ASHRAM MARG",
    "YASHOBHOOMI DWARKA SECTOR 25": "YASHOBHOOMI DWARKA SECTOR 25",
}

_NON_ALNUM_RE = re.compile(r"[^A-Z0-9]+")
_SLUG_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
_STATION_VARIANT_RE = re.compile(r"\(\s*(?:RAPID\s+METRO)\s*\)", re.IGNORECASE)
_FORMER_NAME_RE = re.compile(
    r"\(\s*(?:FORMERLY|EARLIER)\b[^)]*\)",
    re.IGNORECASE,
)


@dataclass
class LegacyStation:
    id: int | None
    code: str
    name: str
    lines: set[str] = field(default_factory=set)


def normalize_name(value: str) -> str:
    """Return a punctuation-insensitive station name used only for matching."""

    ascii_value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .upper()
        .replace("&", " AND ")
    )
    return " ".join(_NON_ALNUM_RE.sub(" ", ascii_value).split())


def normalize_physical_name(value: str) -> str:
    """Normalize a name after removing a network-specific station qualifier."""

    return normalize_name(_STATION_VARIANT_RE.sub(" ", value))


def slugify(value: str) -> str:
    """Create a stable, ASCII, URL-safe canonical station slug."""

    ascii_value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    return _SLUG_NON_ALNUM_RE.sub("-", ascii_value).strip("-")


def clean_display_name(value: str) -> str:
    """Remove historical qualifiers that should not become part of a slug."""

    cleaned = _FORMER_NAME_RE.sub(" ", value)
    cleaned = re.sub(r"\s*-\s*", "-", cleaned)
    return " ".join(cleaned.strip().split())


def get_json(client: httpx.Client, path: str, **kwargs: Any) -> Any:
    """Fetch JSON and include the upstream response body in failures."""

    response = client.get(path, **kwargs)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise RuntimeError(
            f"GET {response.url} returned HTTP {response.status_code}: {detail}"
        ) from exc

    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError(f"GET {response.url} returned non-JSON data") from exc


def fetch_legacy_catalog(base_url: str) -> list[LegacyStation]:
    """Fetch and de-duplicate stations across every legacy DMRC line."""

    with httpx.Client(
        base_url=base_url,
        headers=LEGACY_HEADERS,
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        lines = get_json(client, "line_list")
        if not isinstance(lines, list):
            raise RuntimeError("Legacy line_list response is not an array")

        stations_by_code: dict[str, LegacyStation] = {}
        for line in lines:
            line_code = str(line.get("line_code", "")).strip().upper()
            if not line_code:
                continue

            stations = get_json(client, f"station_by_line/{line_code}")
            if not isinstance(stations, list):
                raise RuntimeError(
                    f"Legacy station_by_line/{line_code} response is not an array"
                )

            for raw_station in stations:
                code = str(raw_station.get("station_code", "")).strip().upper()
                name = str(raw_station.get("station_name", "")).strip()
                if not code or not name:
                    continue

                existing = stations_by_code.get(code)
                if existing is None:
                    raw_id = raw_station.get("id")
                    existing = LegacyStation(
                        id=raw_id if isinstance(raw_id, int) else None,
                        code=code,
                        name=name,
                    )
                    stations_by_code[code] = existing
                existing.lines.add(line_code)

    return sorted(
        stations_by_code.values(),
        key=lambda station: (normalize_name(station.name), station.code),
    )


def fetch_sarthi_catalog(base_url: str) -> list[dict[str, Any]]:
    """Fetch the complete Sarthi station catalog."""

    with httpx.Client(
        base_url=base_url,
        headers={"Accept": "application/json"},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        payload = get_json(
            client,
            "stations",
            params={"page": 0, "limit": 500},
        )

    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise RuntimeError("Sarthi stations response has an unexpected shape")

    return sorted(
        payload["results"],
        key=lambda station: (
            normalize_name(str(station.get("name", ""))),
            str(station.get("code", "")),
        ),
    )


def sarthi_line_codes(station: dict[str, Any]) -> list[str]:
    """Extract sorted line codes from one Sarthi station record."""

    result = {
        str(line.get("code", "")).strip().upper()
        for line in station.get("lineCode", [])
        if isinstance(line, dict) and line.get("code")
    }
    return sorted(result)


def sarthi_summary(station: dict[str, Any]) -> dict[str, Any]:
    """Reduce a Sarthi record to stable identifiers and useful metadata."""

    return {
        "id": station.get("id"),
        "code": station.get("code"),
        "name": station.get("name"),
        "commercial_name": station.get("commercialName"),
        "search_key": station.get("searchkey"),
        "lines": sarthi_line_codes(station),
        "latitude": station.get("lat"),
        "longitude": station.get("long"),
        "status": station.get("status"),
    }


def legacy_summary(station: LegacyStation) -> dict[str, Any]:
    """Convert one legacy station to its output representation."""

    return {
        "id": station.id,
        "code": station.code,
        "name": station.name,
        "lines": sorted(station.lines),
    }


def unique_index(
    stations: Iterable[dict[str, Any]],
    key_function: Any,
) -> dict[str, dict[str, Any]]:
    """Index values that occur exactly once and omit ambiguous duplicates."""

    candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for station in stations:
        key = key_function(station)
        if key:
            candidates[key].append(station)
    return {
        key: values[0]
        for key, values in candidates.items()
        if len(values) == 1
    }


def best_suggestion(
    legacy: LegacyStation,
    available_sarthi: Iterable[dict[str, Any]],
) -> dict[str, Any] | None:
    """Return a non-binding fuzzy suggestion for an unmatched legacy station."""

    legacy_name = normalize_name(legacy.name)
    scored: list[tuple[float, dict[str, Any]]] = []
    for station in available_sarthi:
        sarthi_name = normalize_name(str(station.get("name", "")))
        score = SequenceMatcher(None, legacy_name, sarthi_name).ratio()
        scored.append((score, station))

    if not scored:
        return None

    score, station = max(scored, key=lambda item: item[0])
    if score < 0.65:
        return None
    return {
        "score": round(score, 4),
        "sarthi_code": station.get("code"),
        "sarthi_name": station.get("name"),
    }


def build_crosswalk(
    legacy_stations: list[LegacyStation],
    sarthi_stations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Match the two catalogs without silently accepting fuzzy candidates."""

    sarthi_by_code = unique_index(
        sarthi_stations,
        lambda station: str(station.get("code", "")).strip().upper(),
    )
    sarthi_by_name = unique_index(
        sarthi_stations,
        lambda station: normalize_name(str(station.get("name", ""))),
    )

    used_sarthi_ids: set[str] = set()
    records: list[dict[str, Any]] = []

    for legacy in legacy_stations:
        match: dict[str, Any] | None = None
        method: str | None = None

        code_candidate = sarthi_by_code.get(legacy.code)
        if code_candidate is not None:
            match = code_candidate
            method = "code"
        else:
            normalized_legacy_name = normalize_name(legacy.name)
            name_candidate = sarthi_by_name.get(normalized_legacy_name)
            if name_candidate is not None:
                match = name_candidate
                method = "name"
            else:
                aliased_name = NAME_ALIASES.get(normalized_legacy_name)
                alias_candidate = (
                    sarthi_by_name.get(aliased_name) if aliased_name else None
                )
                if alias_candidate is not None:
                    match = alias_candidate
                    method = "alias"

        record: dict[str, Any] = {
            "slug": slugify(legacy.name),
            "name": legacy.name,
            "match": {
                "status": "matched" if match is not None else "legacy_only",
                "method": method,
            },
            "legacy": legacy_summary(legacy),
            "sarthi": [sarthi_summary(match)] if match is not None else [],
        }

        if match is not None:
            match_id = str(match.get("id", ""))
            if match_id:
                used_sarthi_ids.add(match_id)
        else:
            suggestion = best_suggestion(legacy, sarthi_stations)
            if suggestion is not None:
                record["match"]["suggestion"] = suggestion

        records.append(record)

    # Sarthi models Sikanderpur as separate Yellow and Rapid Metro records,
    # while the legacy API models it as one interchange. Attach an otherwise
    # unmatched network-qualified record to the unique physical-station match.
    records_by_physical_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        legacy = record.get("legacy")
        if legacy:
            records_by_physical_name[
                normalize_physical_name(str(legacy["name"]))
            ].append(record)

    for station in sarthi_stations:
        station_id = str(station.get("id", ""))
        if station_id and station_id in used_sarthi_ids:
            continue

        physical_name = normalize_physical_name(str(station.get("name", "")))
        physical_candidates = records_by_physical_name.get(physical_name, [])
        if len(physical_candidates) == 1:
            record = physical_candidates[0]
            record["sarthi"].append(sarthi_summary(station))
            record["sarthi"].sort(key=lambda value: str(value.get("code", "")))
            record["match"]["status"] = "matched"
            existing_method = record["match"].get("method")
            record["match"]["method"] = (
                f"{existing_method}+physical_name"
                if existing_method
                else "physical_name"
            )
            if station_id:
                used_sarthi_ids.add(station_id)
            continue

        canonical_name = str(station.get("name", "")).strip()
        records.append(
            {
                "slug": slugify(canonical_name),
                "name": canonical_name,
                "match": {"status": "sarthi_only", "method": None},
                "legacy": None,
                "sarthi": [sarthi_summary(station)],
            }
        )

    for record in records:
        sarthi_records = record["sarthi"]
        legacy = record.get("legacy")
        if not sarthi_records:
            continue

        preferred_sarthi_name = str(sarthi_records[0]["name"]).strip()
        if legacy:
            normalized_legacy = normalize_name(str(legacy["name"]))
            exact_name = next(
                (
                    str(station["name"]).strip()
                    for station in sarthi_records
                    if normalize_name(str(station.get("name", "")))
                    == normalized_legacy
                ),
                None,
            )
            if exact_name:
                preferred_sarthi_name = exact_name

        record["name"] = clean_display_name(preferred_sarthi_name)
        record["slug"] = slugify(record["name"])
        native_names = {
            str(station.get("name", "")).strip()
            for station in sarthi_records
            if station.get("name")
        }
        if legacy:
            native_names.add(str(legacy["name"]).strip())
        record["aliases"] = sorted(
            name
            for name in native_names
            if name and normalize_name(name) != normalize_name(record["name"])
        )

    for record in records:
        record.setdefault("aliases", [])

    ensure_unique_slugs(records)
    return sorted(records, key=lambda record: (record["slug"], record["name"]))


def ensure_unique_slugs(records: list[dict[str, Any]]) -> None:
    """Disambiguate the rare duplicate name using a native station code."""

    records_by_slug: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        records_by_slug[record["slug"]].append(record)

    for slug, duplicates in records_by_slug.items():
        if len(duplicates) < 2:
            continue
        for record in duplicates:
            sarthi_records = record.get("sarthi") or []
            native = sarthi_records[0] if sarthi_records else record.get("legacy") or {}
            code = str(native.get("code", "")).strip().lower()
            record["slug"] = f"{slug}-{code}" if code else slug


def build_document(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Wrap records with counts and direct lookup indexes."""

    status_counts: dict[str, int] = defaultdict(int)
    by_slug: dict[str, int] = {}
    by_legacy_code: dict[str, str] = {}
    by_sarthi_code: dict[str, str] = {}

    for index, record in enumerate(records):
        status_counts[record["match"]["status"]] += 1
        by_slug[record["slug"]] = index
        if record["legacy"]:
            by_legacy_code[record["legacy"]["code"]] = record["slug"]
        for sarthi in record["sarthi"]:
            by_sarthi_code[sarthi["code"]] = record["slug"]

    return {
        "schema_version": 1,
        "sources": {
            "legacy": f"{LEGACY_BASE_URL}line_list + station_by_line/{{line_code}}",
            "sarthi": f"{SARTHI_BASE_URL}stations?page=0&limit=500",
        },
        "counts": {
            "canonical": len(records),
            "matched": status_counts["matched"],
            "legacy_only": status_counts["legacy_only"],
            "sarthi_only": status_counts["sarthi_only"],
        },
        "indexes": {
            "by_slug": by_slug,
            "by_legacy_code": dict(sorted(by_legacy_code.items())),
            "by_sarthi_code": dict(sorted(by_sarthi_code.items())),
        },
        "stations": records,
    }


def write_json(path: Path, document: dict[str, Any]) -> None:
    """Write deterministic, human-readable JSON."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_csv(path: Path, records: list[dict[str, Any]]) -> None:
    """Write the crosswalk as a spreadsheet-friendly flat table."""

    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "slug",
        "name",
        "aliases",
        "match_status",
        "match_method",
        "legacy_id",
        "legacy_code",
        "legacy_name",
        "legacy_lines",
        "sarthi_id",
        "sarthi_code",
        "sarthi_name",
        "sarthi_commercial_name",
        "sarthi_search_key",
        "sarthi_lines",
        "latitude",
        "longitude",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            legacy = record.get("legacy") or {}
            sarthi_records = record.get("sarthi") or []
            writer.writerow(
                {
                    "slug": record["slug"],
                    "name": record["name"],
                    "aliases": "|".join(record.get("aliases", [])),
                    "match_status": record["match"]["status"],
                    "match_method": record["match"]["method"],
                    "legacy_id": legacy.get("id", ""),
                    "legacy_code": legacy.get("code", ""),
                    "legacy_name": legacy.get("name", ""),
                    "legacy_lines": "|".join(legacy.get("lines", [])),
                    "sarthi_id": "|".join(
                        str(sarthi.get("id", ""))
                        for sarthi in sarthi_records
                    ),
                    "sarthi_code": "|".join(
                        str(sarthi.get("code", ""))
                        for sarthi in sarthi_records
                    ),
                    "sarthi_name": "|".join(
                        str(sarthi.get("name", ""))
                        for sarthi in sarthi_records
                    ),
                    "sarthi_commercial_name": "|".join(
                        str(sarthi.get("commercial_name", ""))
                        for sarthi in sarthi_records
                    ),
                    "sarthi_search_key": "|".join(
                        str(sarthi.get("search_key", ""))
                        for sarthi in sarthi_records
                    ),
                    "sarthi_lines": "|".join(
                        ",".join(sarthi.get("lines", []))
                        for sarthi in sarthi_records
                    ),
                    "latitude": "|".join(
                        str(sarthi.get("latitude", ""))
                        for sarthi in sarthi_records
                    ),
                    "longitude": "|".join(
                        str(sarthi.get("longitude", ""))
                        for sarthi in sarthi_records
                    ),
                }
            )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Build a station ID/code/slug crosswalk between the legacy DMRC "
            "website API and Delhi Metro Sarthi."
        )
    )
    parser.add_argument("--legacy-base-url", default=LEGACY_BASE_URL)
    parser.add_argument("--sarthi-base-url", default=SARTHI_BASE_URL)
    parser.add_argument(
        "--json-output",
        type=Path,
        help="Write the full normalized catalog as JSON.",
    )
    parser.add_argument(
        "--csv-output",
        type=Path,
        help="Write a flat station crosswalk as CSV.",
    )
    parser.add_argument(
        "--fail-on-unmatched",
        action="store_true",
        help="Exit non-zero if either upstream contains unmatched stations.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        legacy_stations = fetch_legacy_catalog(args.legacy_base_url)
        sarthi_stations = fetch_sarthi_catalog(args.sarthi_base_url)
        records = build_crosswalk(legacy_stations, sarthi_stations)
        document = build_document(records)
    except (httpx.HTTPError, RuntimeError) as exc:
        raise SystemExit(str(exc)) from exc

    if args.json_output:
        write_json(args.json_output, document)
    if args.csv_output:
        write_csv(args.csv_output, records)
    if not args.json_output and not args.csv_output:
        json.dump(document, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")

    counts = document["counts"]
    print(
        (
            f"legacy={len(legacy_stations)} sarthi={len(sarthi_stations)} "
            f"canonical={counts['canonical']} matched={counts['matched']} "
            f"legacy_only={counts['legacy_only']} "
            f"sarthi_only={counts['sarthi_only']}"
        ),
        file=sys.stderr,
    )

    if args.fail_on_unmatched and (
        counts["legacy_only"] or counts["sarthi_only"]
    ):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
