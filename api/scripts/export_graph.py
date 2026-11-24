"""Build the offline routing graph and collect journey timings from Sarthi."""

import json
from collections import defaultdict
from itertools import pairwise
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from core.errors import ApiRequestError, UpstreamApiError
from schemas.journey import RouteStrategy
from services.dmrc import sarthi
from services.interchange import INTERCHANGES
from services.ncrtc.catalog import (
    MEERUT_CODES,
    NAMO_BHARAT_MEERUT_STOPS,
    stations as ncrtc_stations,
)
from services.ncrtc.journey import (
    DUHAI_CHANGE_MINUTES,
    MEERUT_CHANGE_MINUTES,
    route_stops,
)
from services.nmrc.data import ADJACENT_DISTANCE_KM
from services.offline_router import pattern_pairs
from services.planner import _duration_minutes

from scripts.export_catalog import as_json, write_json

_LOCAL_CHANGE_MINUTES = 5
_WALK_LINE = "LN12"


def station_key(network: str, code: str) -> str:
    return f"{network}:{code}"


def _pattern(
    line: dict, stops: list[str], *, suffix: str = "", loop_start: int | None = None
) -> dict:
    network = line["network"]
    return {
        "id": station_key(network, line["line_code"]) + suffix,
        "network": network,
        "line_code": line["line_code"],
        "line_number": line["id"],
        "name": line["line_color"]
        if network == "dmrc" and line["name"].startswith("Line ")
        else line["name"],
        "color": line["primary_color_code"],
        "stops": [station_key(network, code) for code in stops],
        "loop": loop_start is not None,
        "loop_start": loop_start,
    }


def line_patterns(lines: list[dict]) -> list[dict]:
    dmrc = {line["line_code"]: line for line in lines if line["network"] == "dmrc"}
    patterns = []
    for line in lines:
        code = line["line_code"]
        stops = line["stations"]
        if code == _WALK_LINE:
            continue
        if code == "LN4":
            west = dmrc["LN3"]["stations"]
            stops = west[: west.index(stops[0])] + stops
        if code == "LN5" and {"ILOK", "SRSM", "KNR"} <= set(stops):
            # Sarthi routes both branches through Ashok Park Main.
            trunk = stops[stops.index("ILOK") + 1 :]
            patterns.append(_pattern(line, ["KNR", "SRSM", *trunk]))
            patterns.append(_pattern(line, ["ILOK", *trunk], suffix="-inderlok"))
        elif code == "RRTS":
            main = [
                stop
                for stop in stops
                if stop != "AS2"
                and (stop not in MEERUT_CODES or stop in NAMO_BHARAT_MEERUT_STOPS)
            ]
            patterns.append(_pattern(line, main))
            spur = main[: main.index("A06") + 1] + ["AS2"]
            patterns.append(_pattern(line, spur, suffix="-duhai-depot"))
        elif code == "LN7":
            patterns.append(_pattern(line, stops, loop_start=0))
        elif code == "LN11":
            patterns.append(_pattern(line, stops, loop_start=stops.index("DL2")))
        else:
            patterns.append(_pattern(line, stops))
    return patterns


def _as_coordinates(station: dict) -> tuple[float, float] | None:
    lat, lng = station["latitude"], station["longitude"]
    if lat is None or lng is None:
        return None
    return radians(lat), radians(lng)


def _distance(station_a: dict, station_b: dict) -> float:
    first, second = _as_coordinates(station_a), _as_coordinates(station_b)
    if first is None or second is None:
        return 1.0
    latitude, longitude = first
    other_latitude, other_longitude = second
    relative = sin((other_latitude - latitude) / 2) ** 2 + (
        cos(latitude)
        * cos(other_latitude)
        * sin((other_longitude - longitude) / 2) ** 2
    )
    return max(0.05, 12742 * asin(min(1.0, sqrt(relative))))


def _dmrc_codes(station: dict) -> set[str]:
    return set(station["codes"]["dmrc"] + station["codes"].get("sarthi", []))


def _ride_path(leg: dict, aliases: dict[str, str]) -> list[str]:
    origin = aliases.get(leg["from_station_code"])
    destination = aliases.get(leg["to_station_code"])
    if not origin or not destination:
        return []
    stops = [origin]
    for edge in leg["map_path"]:
        codes = [aliases.get(code) for code in edge.split("-")]
        if len(codes) != 2 or None in codes or stops[-1] not in codes:
            return []
        stops.append(codes[1] if stops[-1] == codes[0] else codes[0])
    return stops if stops[-1] == destination else []


async def _sarthi_plan(
    origin: str,
    destination: str,
    strategy: RouteStrategy,
    checkpoint: Path,
) -> dict | None:
    a, b = (key.split(":", 1)[1] for key in (origin, destination))
    if strategy is RouteStrategy.MINIMUM_INTERCHANGE:
        path = checkpoint / "sarthi-graph" / f"{a}-{b}-fewest-changes.json"
    else:
        path = checkpoint / "sarthi-graph" / f"{a}-{b}.json"
    try:
        return json.loads(path.read_bytes())
    except FileNotFoundError:
        pass
    try:
        plan = await sarthi.plan_journey(
            from_station_code=a,
            to_station_code=b,
            strategy=strategy,
        )
    except (ApiRequestError, UpstreamApiError) as exc:
        print(f"Sarthi graph probe {a} → {b} unavailable: {exc}", flush=True)
        return None
    payload = as_json(plan)
    write_json(path, payload)
    return payload


def _interchange_probes(patterns: list[dict]) -> dict[str, tuple[str, str]]:
    candidates = defaultdict(list)
    for pattern in patterns:
        if pattern["network"] != "dmrc":
            continue
        for first, second in pattern_pairs(pattern):
            candidates[first].append((pattern["line_code"], second))
            candidates[second].append((pattern["line_code"], first))

    probes = {}
    for station, neighbours in candidates.items():
        for left_line, left in neighbours:
            right = next(
                (
                    candidate
                    for line, candidate in neighbours
                    if line != left_line
                    and left != candidate
                    and (line, left) not in neighbours
                    and (left_line, candidate) not in neighbours
                ),
                None,
            )
            if right is not None:
                probes[station] = (left, right)
                break
    return probes


async def collect_dmrc_calibration(patterns, stations, checkpoint):
    aliases = {
        code: key
        for key, row in stations.items()
        if row["network"] == "dmrc"
        for code in _dmrc_codes(row)
    }
    terminal_probes = set()
    for pattern in patterns:
        if pattern["network"] != "dmrc":
            continue
        first, last = pattern["stops"][0], pattern["stops"][-1]
        if pattern["loop"]:
            middle = pattern["stops"][len(pattern["stops"]) // 2]
            terminal_probes.update(
                {
                    (first, middle),
                    (middle, first),
                    (last, middle),
                    (middle, last),
                    (first, last),
                    (last, first),
                }
            )
        else:
            terminal_probes.update({(first, last), (last, first)})
    probes = {
        (origin, destination, RouteStrategy.MINIMUM_INTERCHANGE)
        for origin, destination in terminal_probes
    } | {
        (origin, destination, RouteStrategy.LEAST_DISTANCE)
        for origin, destination in _interchange_probes(patterns).values()
    }
    print(f"Collecting {len(probes)} DMRC timing probes", flush=True)
    timetable = defaultdict(list)
    hop_samples = defaultdict(list)
    change_samples = defaultdict(list)
    for origin, destination, strategy in sorted(probes):
        plan = await _sarthi_plan(origin, destination, strategy, checkpoint)
        if not plan:
            continue
        if plan["metro_service"] and plan["legs"]:
            leg = plan["legs"][0]
            timetable[origin].append(
                {
                    "line_number": leg["line_number"],
                    "towards": leg["towards_station"],
                    **plan["metro_service"],
                    "source": "sarthi",
                }
            )
        for leg in plan["legs"]:
            path = _ride_path(leg, aliases)
            duration = _duration_minutes(leg["duration"])
            if len(path) >= 2 and duration is not None and duration > 0:
                pairs = list(pairwise(path))
                distances = [_distance(stations[a], stations[b]) for a, b in pairs]
                combined = sum(distances)
                for pair, distance in zip(pairs, distances, strict=True):
                    minutes = duration * distance / combined
                    km = (
                        leg["distance_km"] * distance / combined
                        if leg["distance_km"]
                        else distance
                    )
                    hop_samples[pair].append((len(pairs), minutes, km))
            change = leg["interchange_minutes"]
            start = aliases.get(leg["from_station_code"])
            if start and change and change > 0:
                change_samples[start].append(change)
        for change in plan["interchanges"]:
            station = aliases.get(change["station"])
            if station and change["minutes"] and change["minutes"] > 0:
                change_samples[station].append(change["minutes"])
    return hop_samples, change_samples, timetable


async def _ncrtc_hops(checkpoint: Path) -> dict[tuple[str, str], float]:
    catalog = {item.code: item for item in await ncrtc_stations()}
    routes = [("Z00", "A21"), ("A21", "Z00"), ("AS2", "Z00"), ("Z00", "AS2")]
    hops = {}
    for origin, destination in routes:
        path = checkpoint / "ncrtc-graph" / f"{origin}-{destination}.json"
        try:
            stops = json.loads(path.read_bytes())
        except FileNotFoundError:
            stops = [
                as_json(item)
                for item in await route_stops(catalog[origin], catalog[destination])
            ]
            write_json(path, stops)
        for left, right in pairwise(stops):
            hops[(left["code"], right["code"])] = right["time"]["value"] / 60
    return hops


def _ncrtc_time(hops: dict, origin: str, destination: str) -> float:
    def order(code: str) -> int:
        return -1 if code == "Z00" else int(code[1:])

    if (origin, destination) in hops:
        return hops[origin, destination]
    first, last = order(origin), order(destination)
    step = 1 if first < last else -1
    codes = ["Z00" if i == -1 else f"A{i:02}" for i in range(first, last + step, step)]
    return sum(hops[pair] for pair in pairwise(codes))


def _median(values: list[float]) -> float:
    values = sorted(values)
    middle = len(values) // 2
    return (values[middle] + values[~middle]) / 2


def _dmrc_hop(hop_samples, origin, destination, distance):
    def estimate(direction):
        samples = hop_samples.get(direction, [])
        if samples:
            large = [
                sample
                for sample in samples
                if sample[0] == max(row[0] for row in samples)
            ]
            return _median([sample[1] for sample in large]), _median(
                [sample[2] for sample in large]
            )
        return None

    forward = estimate((origin, destination))
    reverse = estimate((destination, origin))
    fallback = (distance * 1.45 + 0.55, distance)
    out = forward or reverse or fallback
    back = reverse or forward or fallback
    return (
        out[0],
        back[0],
        (out[1] + back[1]) / 2,
        "sarthi"
        if forward and reverse
        else "sarthi-partial"
        if forward or reverse
        else "estimated",
    )


async def collect_graph(lines, stations, checkpoint):
    index = {station_key(row["network"], row["code"]): row for row in stations}
    patterns = line_patterns(lines)
    hop_samples, change_samples, timetable = await collect_dmrc_calibration(
        patterns, index, checkpoint
    )
    ncrtc_hops = await _ncrtc_hops(checkpoint)
    membership = defaultdict(list)
    for pattern in patterns:
        network = pattern["network"]
        pattern["hops"] = []
        for hop_index, (origin, destination) in enumerate(pattern_pairs(pattern)):
            distance = _distance(index[origin], index[destination])
            if network == "dmrc":
                forward, reverse, distance, source = _dmrc_hop(
                    hop_samples, origin, destination, distance
                )
            elif network == "ncrtc":
                a, b = (key.split(":", 1)[1] for key in (origin, destination))
                forward = _ncrtc_time(ncrtc_hops, a, b)
                reverse = _ncrtc_time(ncrtc_hops, b, a)
                source = "ncrtc"
            else:
                distance = ADJACENT_DISTANCE_KM[int(index[origin]["code"][2:]) - 1]
                forward = reverse = 2.0
                source = "nmrc-estimate"
            # Rapid Metro runs the Cyber City loop in the listed direction.
            one_way = (
                pattern["line_code"] == "LN11" and hop_index >= pattern["loop_start"]
            )
            pattern["hops"].append(
                {
                    "minutes": round(forward, 4),
                    "reverse_minutes": None if one_way else round(reverse, 4),
                    "km": round(distance, 5),
                    "source": source,
                }
            )
        for stop in pattern["stops"]:
            membership[stop].append(pattern["id"])

    changes = []
    for station, on_patterns in sorted(membership.items()):
        if len(on_patterns) < 2:
            continue
        if station in change_samples:
            minutes, source = _median(change_samples[station]), "sarthi"
        elif station.startswith("ncrtc:"):
            minutes = (
                DUHAI_CHANGE_MINUTES
                if station.endswith(":A06")
                else MEERUT_CHANGE_MINUTES
            )
            source = "estimated"
        else:
            minutes, source = _LOCAL_CHANGE_MINUTES, "estimated"
        changes.append({"station": station, "minutes": minutes, "source": source})

    walks = [
        {
            "from": station_key("dmrc", link.dmrc_code),
            "to": station_key(link.other_network.value, link.other_code),
            "minutes": link.walk_minutes,
            "metres": link.walk_metres,
            "note": link.note,
        }
        for link in INTERCHANGES
    ]
    for line in lines:
        if line["line_code"] == _WALK_LINE:
            walks.extend(
                {
                    "from": station_key("dmrc", a),
                    "to": station_key("dmrc", b),
                    "minutes": 7,
                    "metres": None,
                    "note": "Walk between Dhaula Kuan and Durgabai Deshmukh South Campus.",
                }
                for a, b in pairwise(line["stations"])
            )
    if set(membership) != set(index):
        raise ValueError(
            f"Graph station coverage mismatch: {sorted(set(index) - set(membership))}"
        )
    return {"patterns": patterns, "changes": changes, "walks": walks}, timetable
