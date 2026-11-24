"""Reference Dijkstra for the offline export routing graph."""

from dataclasses import dataclass
from heapq import heappop, heappush
from itertools import pairwise
from typing import Literal

from schemas.journey import RouteStrategy

State = tuple[str, str]  # Pattern ID and network-qualified station key.
Cost = tuple[float, float, float]


def pattern_pairs(pattern: dict) -> list[tuple[str, str]]:
    stops = pattern["stops"]
    if pattern["loop"]:
        stops = [*stops, stops[pattern.get("loop_start", 0)]]
    return list(pairwise(stops))


@dataclass(frozen=True, slots=True)
class Edge:
    target: State
    kind: Literal["ride", "change", "walk"]
    minutes: float
    km: float = 0.0


@dataclass(frozen=True, slots=True)
class RouteLeg:
    kind: Literal["metro", "transfer"]
    pattern: str | None
    origin: str
    destination: str
    stops: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class OfflineRoute:
    legs: tuple[RouteLeg, ...]
    changes: int
    minutes: float
    km: float


class RouteTree:
    def __init__(self, states, costs, previous, strategy: RouteStrategy) -> None:
        self.states = states
        self.costs = costs
        self.previous = previous
        self.strategy = strategy

    def route_to(self, destination: str) -> OfflineRoute | None:
        candidates = [
            state for state in self.states.get(destination, ()) if state in self.costs
        ]
        if not candidates:
            return None
        state = min(candidates, key=self.costs.__getitem__)
        primary, minutes, secondary = self.costs[state]
        if self.strategy is RouteStrategy.MINIMUM_INTERCHANGE:
            changes, km = int(primary), secondary
        else:
            km, changes = primary, int(secondary)
        edges = []
        while state in self.previous:
            source, edge = self.previous[state]
            edges.append((source, edge))
            state = source

        legs: list[RouteLeg] = []
        for (pattern, origin), edge in reversed(edges):
            if edge.kind == "change":
                continue
            target = edge.target[1]
            if edge.kind == "walk":
                legs.append(
                    RouteLeg("transfer", None, origin, target, (origin, target))
                )
            elif legs and legs[-1].pattern == pattern:
                last = legs[-1]
                legs[-1] = RouteLeg(
                    "metro", pattern, last.origin, target, last.stops + (target,)
                )
            else:
                legs.append(
                    RouteLeg("metro", pattern, origin, target, (origin, target))
                )
        return OfflineRoute(tuple(legs), changes, minutes, km)


class OfflineRouter:
    def __init__(self, graph: dict) -> None:
        self.states: dict[str, list[State]] = {}
        self.edges: dict[State, list[Edge]] = {}

        for pattern in graph["patterns"]:
            states = [(pattern["id"], stop) for stop in pattern["stops"]]
            for state in states:
                if state in self.edges:
                    raise ValueError(f"Duplicate graph state {state}")
                self.states.setdefault(state[1], []).append(state)
                self.edges[state] = []
            for (origin, destination), hop in zip(
                pattern_pairs(pattern), pattern["hops"], strict=True
            ):
                first, second = (pattern["id"], origin), (pattern["id"], destination)
                self.edges[first].append(
                    Edge(second, "ride", hop["minutes"], hop["km"])
                )
                if hop["reverse_minutes"] is not None:
                    self.edges[second].append(
                        Edge(first, "ride", hop["reverse_minutes"], hop["km"])
                    )

        change_minutes = {item["station"]: item["minutes"] for item in graph["changes"]}
        for station, states in self.states.items():
            for first in states:
                for second in states:
                    if first != second:
                        self.edges[first].append(
                            Edge(second, "change", change_minutes[station])
                        )

        for walk in graph["walks"]:
            for first in self.states[walk["from"]]:
                for second in self.states[walk["to"]]:
                    km = (walk["metres"] or 0) / 1000
                    self.edges[first].append(Edge(second, "walk", walk["minutes"], km))
                    self.edges[second].append(Edge(first, "walk", walk["minutes"], km))

    def tree(
        self,
        origin: str,
        strategy: RouteStrategy,
        *,
        exclude_airport: bool = False,
        networks: frozenset[str] | None = None,
    ) -> RouteTree:
        def allowed(state: State) -> bool:
            if exclude_airport and state[0] == "dmrc:LN10":
                return False
            return networks is None or state[1].split(":", 1)[0] in networks

        seeds = [state for state in self.states.get(origin, ()) if allowed(state)]
        costs = {state: (0.0, 0.0, 0.0) for state in seeds}
        queue = []
        previous: dict[State, tuple[State, Edge]] = {}
        for state, cost in costs.items():
            heappush(queue, (cost, state))

        least_changes = strategy is RouteStrategy.MINIMUM_INTERCHANGE
        while queue:
            cost, state = heappop(queue)
            if cost != costs[state]:
                continue
            for edge in self.edges[state]:
                if not allowed(edge.target):
                    continue
                change = int(edge.kind != "ride")
                if least_changes:
                    candidate = (
                        cost[0] + change,
                        cost[1] + edge.minutes,
                        round(cost[2] + edge.km, 6),
                    )
                else:
                    candidate = (
                        round(cost[0] + edge.km, 6),
                        cost[1] + edge.minutes,
                        cost[2] + change,
                    )
                if edge.target not in costs or candidate < costs[edge.target]:
                    costs[edge.target] = candidate
                    previous[edge.target] = (state, edge)
                    heappush(queue, (candidate, edge.target))
        return RouteTree(self.states, costs, previous, strategy)

    def route(
        self, origin: str, destination: str, strategy: RouteStrategy
    ) -> OfflineRoute | None:
        first, last = (station.split(":", 1)[0] for station in (origin, destination))
        networks = frozenset({first}) if first == last else None
        return self.tree(origin, strategy, networks=networks).route_to(destination)
