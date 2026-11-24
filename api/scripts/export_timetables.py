"""Collect first and last departures by line and heading for the offline pack."""

import asyncio
import json
import re
from collections import defaultdict
from pathlib import Path

from core.errors import UpstreamApiError
from schemas.journey import RouteStrategy
from services.dmrc.journey import first_last_train
from services.nmrc.data import STATIONS as AQUA_STATIONS
from services.offline_router import pattern_pairs

from scripts.export_catalog import write_json
from scripts.export_graph import station_key

_TRAIN_TIMING = re.compile(
    r"^(first|last)\s+(?:(mrts)\s+)?train\s+towards\s+(.+?)\.?$", re.I
)


async def _departure(
    origin: str, next_stop: str, checkpoint: Path
) -> tuple[str | None, str | None]:
    a, b = (code.split(":", 1)[1] for code in (origin, next_stop))
    path = checkpoint / "dmrc-timetables" / f"{a}-{b}.json"
    try:
        first, last = json.loads(path.read_bytes())
        return first, last
    except FileNotFoundError:
        pass
    try:
        result = await first_last_train(
            from_station_code=a,
            to_station_code=b,
            strategy=RouteStrategy.LEAST_DISTANCE,
        )
    except UpstreamApiError as exc:
        print(f"DMRC timetable {a} → {b} unavailable: {exc}", flush=True)
        return None, None
    first = (
        next(
            (
                leg.start_time
                for leg in result.first_train.first_train_route_detail
                if leg.start_st == a
            ),
            None,
        )
        if result.first_train
        else None
    )
    last = (
        next(
            (
                leg.start_time
                for leg in result.last_train.last_train_route_detail
                if leg.start_st == a
            ),
            None,
        )
        if result.last_train
        else None
    )
    write_json(path, [first, last])
    return first, last


def _dmrc_headings(patterns: list[dict]) -> dict[tuple[str, str], list[dict]]:
    pairs = defaultdict(list)
    for pattern in patterns:
        if pattern["network"] != "dmrc":
            continue
        for (a, b), hop in zip(pattern_pairs(pattern), pattern["hops"], strict=True):
            directions = [("forward", a, b)]
            if hop["reverse_minutes"] is not None:
                directions.append(("reverse", b, a))
            for direction, origin, next_stop in directions:
                terminal = pattern["stops"][-1 if direction == "forward" else 0]
                row = {
                    "station": origin,
                    "pattern": pattern["id"],
                    "line_code": pattern["line_code"],
                    "direction": direction,
                    "next": next_stop,
                    "towards": next_stop if pattern["loop"] else terminal,
                    "days": "published",
                    "source": "dmrc",
                }
                pairs[origin, next_stop].append(row)
    return pairs


async def _dmrc_timetables(
    patterns: list[dict], checkpoint: Path, calibrations: dict
) -> list[dict]:
    pairs = _dmrc_headings(patterns)
    print(
        f"Collecting first and last trains for {len(pairs)} DMRC directions", flush=True
    )
    result = []
    directions = list(pairs)
    for index in range(0, len(directions), 12):
        batch = directions[index : index + 12]
        values = await asyncio.gather(
            *(_departure(*pair, checkpoint) for pair in batch)
        )
        for pair, (first, last) in zip(batch, values, strict=True):
            if first is None and last is None:
                continue
            result.extend(dict(row, first=first, last=last) for row in pairs[pair])
        if (index + 12) % 120 == 0:
            print(f"Checked {index + 12} of {len(pairs)} DMRC directions", flush=True)

    # Keep Sarthi's published terminal times for headings for which DMRC had no
    # timetable. The Sarthi label may be a display name rather than a code.
    covered = {row["station"] for row in result}
    for station, timings in calibrations.items():
        if station in covered:
            continue
        result.extend(
            {
                "station": station,
                "pattern": None,
                "line_code": None,
                "direction": None,
                "next": None,
                "towards": timing["towards"],
                "days": "sampled",
                "source": "sarthi",
                "first": timing["first"],
                "last": timing["last"],
            }
            for timing in timings
            if timing["first"] or timing["last"]
        )
    return result


def _nmrc_timetables() -> list[dict]:
    result = []
    for station in AQUA_STATIONS:
        for destination, step, weekday, sunday, last in (
            (
                AQUA_STATIONS[-1],
                1,
                station.first_mon_sat_depot,
                station.first_sunday_depot,
                station.last_depot,
            ),
            (
                AQUA_STATIONS[0],
                -1,
                station.first_mon_sat_sector_51,
                station.first_sunday_sector_51,
                station.last_sector_51,
            ),
        ):
            if station == destination:
                continue
            for days, first in (("mon-sat", weekday), ("sun", sunday)):
                if first or last:
                    result.append(
                        {
                            "station": station_key("nmrc", station.code),
                            "pattern": "nmrc:AQUA",
                            "line_code": "AQUA",
                            "direction": "forward" if step == 1 else "reverse",
                            "next": station_key(
                                "nmrc",
                                AQUA_STATIONS[station.upstream_id - 1 + step].code,
                            ),
                            "towards": station_key("nmrc", destination.code),
                            "days": days,
                            "source": "nmrc",
                            "first": first,
                            "last": last,
                        }
                    )
    return result


def _ncrtc_timetables(stations: list[dict]) -> list[dict]:
    result = {}
    for station in stations:
        if station["network"] != "ncrtc":
            continue
        key = station_key("ncrtc", station["code"])
        for item in station["detail"].get("first_last_train") or []:
            match = _TRAIN_TIMING.fullmatch(item["direction"].strip())
            if not match or not item.get("time"):
                continue
            which, mrts, heading = match.groups()
            heading = " ".join(heading.lower().split())
            line = "MRTS" if mrts else "RRTS"
            days = item["day"].lower()
            direction_key = key, line, heading, days
            row = result.setdefault(
                direction_key,
                {
                    "station": key,
                    "pattern": None,
                    "line_code": line,
                    "direction": None,
                    "next": None,
                    "towards": heading.title(),
                    "days": days,
                    "source": "ncrtc",
                    "first": None,
                    "last": None,
                },
            )
            row[which.lower()] = item["time"]
    return list(result.values())


async def collect_timetables(
    graph: dict, stations: list[dict], calibrations: dict, checkpoint: Path
) -> list[dict]:
    dmrc = await _dmrc_timetables(graph["patterns"], checkpoint, calibrations)
    return dmrc + _nmrc_timetables() + _ncrtc_timetables(stations)
