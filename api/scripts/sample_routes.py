"""Compare offline routes with Sarthi and retain differing route skeletons."""

import argparse
import asyncio
import json
import sys
from collections import defaultdict
from dataclasses import asdict
from itertools import pairwise, permutations
from math import gcd
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from clients.sarthi import sarthi_client
from core.errors import ApiRequestError, UpstreamApiError
from core.upstream_pacing import paced_requests
from schemas.journey import RouteStrategy
from services.dmrc import sarthi
from services.offline_export import read_artifact, write_artifact
from services.offline_router import OfflineRouter, RouteLeg, pattern_pairs
from services.planner import _duration_minutes

from scripts.export_catalog import as_json, write_json
from scripts.export_graph import _dmrc_codes, _ride_path, station_key

# Fixed trips used for comparison between runs. The remaining pairs rotate.
_POPULAR = (
    ("AIIMS", "ASDM"),
    ("NDI", "APOT"),
    ("RCK", "NSET"),
    ("KG", "HCC"),
    ("NDI", "KG"),
    ("NIZM", "RCK"),
    ("AVIT", "NDI"),
    ("SKRP", "HCC"),
    ("SJSU", "APOT"),
    ("DACY", "NIZM"),
    ("LJPN", "RCK"),
    ("NSET", "AVIT"),
    ("RCK", "NECC"),
    ("NDI", "DACY"),
    ("BCGN", "INA"),
    ("SFTN", "HCC"),
    ("RI", "RCK"),
    ("DSET", "NAGR"),
    ("AIIMS", "NBAA"),
    ("MUPR", "AVIT"),
)


def _state(path: Path) -> dict:
    try:
        return json.loads(path.read_bytes())
    except FileNotFoundError:
        return {}


def _choose_pairs(codes: list[str], count: int, cursor: int):
    known = set(codes)
    popular = list(dict.fromkeys(pair for pair in _POPULAR if set(pair) <= known))[
        :count
    ]
    rotation = [(a, b) for a, b in permutations(codes, 2) if (a, b) not in popular]
    if not rotation:
        return popular, 0, len(popular)
    count = min(count - len(popular), len(rotation))
    # Traverse the full list with a fixed stride coprime to its length.
    stride = 997
    while gcd(stride, len(rotation)) != 1:
        stride += 2
    chosen = [rotation[((cursor + i) * stride) % len(rotation)] for i in range(count)]
    return popular + chosen, (cursor + count) % len(rotation), len(popular)


class SkeletonReader:
    def __init__(self, graph: dict, stations: list[dict]) -> None:
        self.aliases = {
            code: station_key("dmrc", row["code"])
            for row in stations
            if row["network"] == "dmrc"
            for code in _dmrc_codes(row)
        }
        self.patterns = {pattern["id"]: pattern for pattern in graph["patterns"]}
        self.edges = {}
        for id_, pattern in self.patterns.items():
            forward = pattern_pairs(pattern)
            self.edges[id_] = set(forward) | {
                (b, a)
                for (a, b), hop in zip(forward, pattern["hops"], strict=True)
                if hop["reverse_minutes"] is not None
            }
        self.walks = {
            pair
            for walk in graph["walks"]
            for pair in ((walk["from"], walk["to"]), (walk["to"], walk["from"]))
        }

    def read(self, legs: list[dict]) -> tuple[RouteLeg, ...] | None:
        result = []
        for leg in legs:
            origin = self.aliases.get(leg["from_station_code"])
            destination = self.aliases.get(leg["to_station_code"])
            if not origin or not destination:
                return None
            if result and result[-1].destination != origin:
                previous = result[-1].destination
                if (previous, origin) not in self.walks:
                    return None
                result.append(
                    RouteLeg("transfer", None, previous, origin, (previous, origin))
                )
            if (origin, destination) in self.walks and (
                not leg["line_number"]
                or leg["line_number"] == 12
                or "bridge" in leg["line_name"].lower()
            ):
                result.append(
                    RouteLeg(
                        "transfer", None, origin, destination, (origin, destination)
                    )
                )
                continue
            stops = _ride_path(leg, self.aliases)
            if len(stops) < 2:
                return None
            edges = set(pairwise(stops))
            candidates = [
                pattern
                for pattern, known in self.edges.items()
                if pattern.startswith("dmrc:") and edges <= known
            ]
            if not candidates:
                return None
            pattern = min(
                candidates,
                key=lambda id_: (
                    self.patterns[id_]["line_number"] != leg["line_number"],
                    id_,
                ),
            )
            result.append(RouteLeg("metro", pattern, origin, destination, tuple(stops)))
        return tuple(result) or None

    def comparable(self, legs: tuple[RouteLeg, ...]) -> tuple:
        def line(leg):
            if leg.pattern is None:
                return None
            code = self.patterns[leg.pattern]["line_code"]
            return "LN3" if code == "LN4" else code

        return tuple((leg.kind, line(leg), leg.stops) for leg in legs)

    def valid(self, override: dict) -> bool:
        legs = override["legs"]
        return bool(legs) and (
            legs[0]["origin"] == override["from"]
            and legs[-1]["destination"] == override["to"]
            and all(a["destination"] == b["origin"] for a, b in pairwise(legs))
            and all(
                leg["stops"]
                and leg["origin"] == leg["stops"][0]
                and leg["destination"] == leg["stops"][-1]
                and (
                    (leg["origin"], leg["destination"]) in self.walks
                    if leg["kind"] == "transfer"
                    else leg["pattern"] in self.edges
                    and set(pairwise(leg["stops"])) <= self.edges[leg["pattern"]]
                )
                for leg in legs
            )
        )


async def _plan(a: str, b: str, strategy: RouteStrategy, checkpoint: Path | None):
    bookmark = checkpoint / f"{a}-{b}-{strategy.value}.json" if checkpoint else None
    if bookmark is not None:
        try:
            return json.loads(bookmark.read_bytes())
        except FileNotFoundError:
            pass
    try:
        plan = await sarthi.plan_journey(
            from_station_code=a, to_station_code=b, strategy=strategy
        )
    except (ApiRequestError, UpstreamApiError) as exc:
        print(f"Sarthi sample {a} → {b}, {strategy.value}: {exc}", flush=True)
        return None
    result = as_json(plan)
    if bookmark is not None:
        write_json(bookmark, result)
    return result


async def sample(
    bundle: dict, previous: list[dict], state: dict, pairs: int, checkpoint: Path | None
):
    sections = bundle["sections"]
    graph = sections["routing_graph"]
    stations = sections["stations"]
    reader = SkeletonReader(graph, stations)
    router = OfflineRouter(graph)
    codes = sorted(
        row["code"]
        for row in stations
        if row["network"] == "dmrc" and row["codes"].get("sarthi")
    )
    chosen, cursor, popular_count = _choose_pairs(codes, pairs, state.get("cursor", 0))
    trees = {}
    overrides = {
        (row["from"], row["to"], row["strategy"]): row
        for row in previous
        if reader.valid(row)
    }
    stats = defaultdict(int)
    try:
        with paced_requests():
            for index, (a, b) in enumerate(chosen):
                from_key, to_key = station_key("dmrc", a), station_key("dmrc", b)
                for strategy in (
                    RouteStrategy.LEAST_DISTANCE,
                    RouteStrategy.MINIMUM_INTERCHANGE,
                ):
                    stats["requested"] += 1
                    plan = await _plan(a, b, strategy, checkpoint)
                    if plan is None:
                        continue
                    duration = _duration_minutes(plan["total_time"])
                    if duration is None or not plan["legs"]:
                        continue
                    stats["scored"] += 1
                    is_popular = index < popular_count
                    if is_popular:
                        stats["popular_scored"] += 1
                    cache_key = from_key, strategy
                    if cache_key not in trees:
                        trees[cache_key] = router.tree(
                            from_key, strategy, networks=frozenset({"dmrc"})
                        )
                    reference = trees[cache_key].route_to(to_key)
                    actual = reader.read(plan["legs"])
                    if actual is None or reference is None:
                        stats["unmapped"] += 1
                        continue
                    same = reader.comparable(actual) == reader.comparable(
                        reference.legs
                    )
                    override_key = from_key, to_key, strategy.value
                    if same:
                        overrides.pop(override_key, None)
                        if abs(reference.minutes - duration) <= 2:
                            stats["agreed"] += 1
                            if is_popular:
                                stats["popular_agreed"] += 1
                    else:
                        overrides[override_key] = {
                            "from": from_key,
                            "to": to_key,
                            "strategy": strategy.value,
                            "legs": [asdict(leg) for leg in actual],
                        }
                if (index + 1) % 25 == 0:
                    print(
                        f"Sampled {index + 1} of {len(chosen)} DMRC station pairs",
                        flush=True,
                    )
    finally:
        await sarthi_client.close()

    if not stats["requested"] or stats["scored"] < stats["requested"] * 0.8:
        raise ValueError(
            f"Too few Sarthi routes were available for comparison: {dict(stats)}"
        )
    agreement = stats["agreed"] / stats["scored"]
    fixed_agreement = (
        stats["popular_agreed"] / stats["popular_scored"]
        if stats["popular_scored"]
        else None
    )
    if (
        state.get("popular_scored") == stats["popular_scored"]
        and state.get("popular_agreement") is not None
    ):
        previous_fixed = state["popular_agreement"]
        if fixed_agreement is not None and fixed_agreement < previous_fixed:
            raise ValueError(
                f"Agreement on the fixed pairs fell from {previous_fixed:.3%} to {fixed_agreement:.3%}"
            )

    sections["overrides"] = [value for _, value in sorted(overrides.items())]
    new_state = {
        "cursor": cursor,
        "popular_scored": stats["popular_scored"],
        "popular_agreement": fixed_agreement,
    }
    print(
        f"Route agreement {stats['agreed']}/{stats['scored']} ({agreement:.2%}); "
        f"{stats['unmapped']} unassignable, {len(overrides)} overrides",
        flush=True,
    )
    return agreement, new_state


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument(
        "--previous", type=Path, help="Previous published archive with overrides"
    )
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument(
        "--checkpoint",
        type=Path,
        help="Reuse Sarthi results from an interrupted sample",
    )
    parser.add_argument("--pairs", type=int, default=300)
    args = parser.parse_args()
    if args.pairs <= 0:
        parser.error("--pairs must be positive")
    bundle = read_artifact(args.bundle).read_bundle()
    previous = (
        read_artifact(args.previous).read_bundle()
        if args.previous and args.previous.exists()
        else bundle
    )
    agreement, state = asyncio.run(
        sample(
            bundle,
            previous["sections"]["overrides"],
            _state(args.state),
            args.pairs,
            args.checkpoint,
        )
    )
    manifest = write_artifact(bundle, args.bundle, router_agreement=agreement)
    write_json(args.state, state)
    print(f"{args.bundle}: {manifest.size_bytes:,} gzip bytes, {manifest.version}")
