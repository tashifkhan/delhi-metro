"""Build the app's offline network map snapshot.

Writes app/src/data/networkMap.json: every DMRC line in travel order with its
colour, and every station with coordinates, so the map screen can draw the
network without a request.

Coordinates come from data/stations.normalized.csv (the Sarthi latitude and
longitude columns). Line order comes from the live API, one request per line.

The NMRC Aqua Line has no coordinates anywhere in this repo. Its stations are
placed along the corridor by interpolating between a few fixed anchors on the
Noida-Greater Noida Expressway, and are marked `approx: true`. Good enough for
a schematic, not for distances.

Run from the repo root:

    python3 -I api/scripts/build_network_map.py
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "api" / "data" / "stations.normalized.csv"
NMRC_DATA = ROOT / "api" / "services" / "nmrc" / "data.py"
OUT_PATH = ROOT / "app" / "src" / "data" / "networkMap.json"
API = "https://ncr-metro.tashif.codes/api/v1"

# Not passenger lines.
SKIP_LINES = {"LN12"}

# The Pink Line's list starts partway round its loop, so a gap at the start
# continues from the end of the list.
RING_LINES = {"LN7"}

PLACEHOLDER = (28.5704, 77.1844)

# Anchors for the Aqua Line, in travel order, as (station index, lat, lng).
# Indexes are positions in the NMRC station list; stations in between are
# interpolated along the path.
AQUA_ANCHORS = [
    (0, 28.5810, 77.3740),  # Noida Sector 51, beside Blue Line Sector 52
    (4, 28.5470, 77.3820),  # Sector 83, where the line turns onto the expressway
    (8, 28.5000, 77.4100),  # Sector 142
    (13, 28.4690, 77.4800),  # Knowledge Park II
    (16, 28.4660, 77.5040),  # Pari Chowk
    (20, 28.4520, 77.5420),  # Depot
]


def fetch(path: str):
    # The edge rejects urllib's default user agent.
    request = urllib.request.Request(
        f"{API}{path}", headers={"User-Agent": "ncr-metro-map-builder", "Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def load_coords() -> tuple[dict[str, tuple[float, float]], dict[str, str]]:
    coords: dict[str, tuple[float, float]] = {}
    names: dict[str, str] = {}
    with CSV_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            code = (row["legacy_code"] or row["sarthi_code"]).strip().upper()
            if not code:
                continue
            names[code] = row["name"].strip()
            # Stations matched to several Sarthi records join values with "|".
            lat = row["latitude"].split("|")[0]
            lng = row["longitude"].split("|")[0]
            if lat and lng:
                coords[code] = (float(lat), float(lng))
    return coords, names


def load_nmrc_stations() -> list[tuple[str, str]]:
    """(code, name) for each Aqua Line station, parsed from the data module."""

    text = NMRC_DATA.read_text()
    out: list[tuple[str, str]] = []
    marker = "NmrcStation("
    for chunk in text.split(marker)[1:]:
        parts = [p.strip() for p in chunk.split(",")]
        if len(parts) < 3 or not parts[1].startswith('"'):
            continue
        out.append((parts[1].strip('"'), parts[2].strip('"')))
    return out


def interpolate_aqua(count: int) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for index in range(count):
        for (i0, la0, lo0), (i1, la1, lo1) in zip(AQUA_ANCHORS, AQUA_ANCHORS[1:]):
            if i0 <= index <= i1:
                t = 0 if i1 == i0 else (index - i0) / (i1 - i0)
                points.append((la0 + (la1 - la0) * t, lo0 + (lo1 - lo0) * t))
                break
        else:
            points.append(AQUA_ANCHORS[-1][1:])
    return points


def fill_gaps(order: list[str], known: dict[str, tuple[float, float]], ring: bool):
    """Positions for stations on one line that have no coordinates.

    Each run of unknown stations is spread evenly between the known stations
    either side of it. A run at the end of an open line continues the last
    known step. On a ring line a run at the start wraps to the line's end.
    """

    filled: dict[str, tuple[float, float]] = {}
    n = len(order)
    pos = [known.get(code) for code in order]
    i = 0
    while i < n:
        if pos[i] is not None:
            i += 1
            continue
        j = i
        while j < n and pos[j] is None:
            j += 1
        before = pos[i - 1] if i > 0 else (pos[-1] if ring and pos[-1] is not None else None)
        after = pos[j] if j < n else None
        run = j - i
        for k in range(run):
            if before and after:
                t = (k + 1) / (run + 1)
                point = (before[0] + (after[0] - before[0]) * t, before[1] + (after[1] - before[1]) * t)
            else:
                anchor_index = i - 1 if before else j
                anchor = before or after
                other_index = anchor_index - 1 if before else anchor_index + 1
                other = pos[other_index] if 0 <= other_index < n and pos[other_index] else None
                step = (
                    (anchor[0] - other[0], anchor[1] - other[1]) if other else (0.008, 0.0)
                )
                steps = k + 1 if before else run - k
                point = (anchor[0] + step[0] * steps, anchor[1] + step[1] * steps)
            pos[i + k] = point
            filled[order[i + k]] = point
        i = j
    return filled


def main() -> int:
    coords, names = load_coords()
    # Newer stations carry this placeholder instead of a real position.
    coords = {k: v for k, v in coords.items() if (round(v[0], 4), round(v[1], 4)) != PLACEHOLDER}
    stations: dict[str, dict] = {}
    lines: list[dict] = []
    approximate: list[str] = []
    raw: list[tuple[dict, list[tuple[str, str]]]] = []

    for line in fetch("/dmrc/lines"):
        code = line["line_code"]
        if code in SKIP_LINES or line.get("show_in_frontend") is False:
            continue
        items = [
            (item["station_code"].strip().upper(), item["station_name"].strip())
            for item in fetch(f"/dmrc/lines/{code}/stations")
        ]
        raw.append((line, items))

    guessed: dict[str, tuple[float, float]] = {}
    for line, items in raw:
        order = [code for code, _ in items]
        known = {**guessed, **coords}
        for code, point in fill_gaps(order, known, line["line_code"] in RING_LINES).items():
            guessed.setdefault(code, point)

    for line, items in raw:
        code = line["line_code"]
        for station_code, upstream_name in items:
            point = coords.get(station_code) or guessed[station_code]
            entry = stations.setdefault(
                station_code,
                {
                    "code": station_code,
                    "name": names.get(station_code, upstream_name).strip(),
                    "lat": round(point[0], 5),
                    "lng": round(point[1], 5),
                    "lines": [],
                },
            )
            if station_code not in coords:
                entry["approx"] = True
                if station_code not in approximate:
                    approximate.append(station_code)
            if code not in entry["lines"]:
                entry["lines"].append(code)
        lines.append(
            {
                "code": code,
                "name": line["line_color"],
                "color": line["primary_color_code"],
                "network": "dmrc",
                "stations": [station_code for station_code, _ in items],
            }
        )

    aqua = load_nmrc_stations()
    aqua_points = interpolate_aqua(len(aqua))
    for (code, name), (lat, lng) in zip(aqua, aqua_points):
        stations[code] = {
            "code": code,
            "name": name,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "lines": ["AQUA"],
            "approx": True,
        }
    lines.append(
        {
            "code": "AQUA",
            "name": "Aqua Line",
            "color": "#00AEEF",
            "network": "nmrc",
            "stations": [code for code, _ in aqua],
        }
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"lines": lines, "stations": sorted(stations.values(), key=lambda s: s["code"])}
    OUT_PATH.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"{len(lines)} lines, {len(stations)} stations -> {OUT_PATH.relative_to(ROOT)}")
    if approximate:
        print(f"placed {len(approximate)} DMRC stations by interpolation: {', '.join(approximate)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
