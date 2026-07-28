"""Unified journey planner models served by the v2 API.

Every planner service (Sarthi, legacy DMRC, and NMRC) normalizes into these
models, so a client sees one contract regardless of which upstream answered.
Fields that only one upstream can supply are optional and documented as such.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from schemas.journey import RouteStrategy


class JourneySource(str, Enum):
    """Upstream that produced a journey plan."""

    SARTHI = "sarthi"
    DMRC = "dmrc"
    NMRC = "nmrc"
    COMBINED = "combined"


class MetroNetwork(str, Enum):
    """Passenger network selected by the client."""

    DMRC = "dmrc"
    NMRC = "nmrc"


class LegKind(str, Enum):
    """What a traveller does during one leg."""

    METRO = "metro"
    TRANSFER = "transfer"


class PlannedStation(BaseModel):
    """Canonical identity of a journey endpoint station."""

    name: str = Field(..., description="Display name from the answering upstream.")
    code: str = Field(..., description="Station code as sent to that upstream.")
    slug: str | None = Field(
        default=None,
        description="Canonical slug from the station crosswalk, when resolvable.",
    )
    legacy_code: str | None = Field(
        default=None,
        description="Station code in the legacy DMRC vocabulary.",
    )
    sarthi_code: str | None = Field(
        default=None,
        description="Station code in the Sarthi vocabulary, when published there.",
    )
    status: str | None = Field(
        default=None,
        description="Operational status. Sarthi only.",
    )


class NetworkFare(BaseModel):
    """One network's share of a journey fare."""

    network: MetroNetwork
    normal: float
    special: float | None = None
    applicable: float | None = None


class PlannedFare(BaseModel):
    """Fare for the journey in INR."""

    normal: float = Field(..., description="Standard weekday fare.")
    special: float | None = Field(
        default=None,
        description="Sunday/national-holiday fare when the upstream reports one.",
    )
    applicable: float | None = Field(
        default=None,
        description="Fare that applies at the requested time. Sarthi only.",
    )
    breakdown: list[NetworkFare] = Field(
        default_factory=list,
        description=(
            "Per-network split, set only on a journey spanning both networks. "
            "Delhi Metro and Noida Metro fares are not integrated, so the "
            "totals above are the sum of two separate tickets."
        ),
    )


class PlannedStop(BaseModel):
    """One stop within a leg."""

    name: str
    status: str | None = None


class PlannedLeg(BaseModel):
    """One continuous leg of the journey on a single line."""

    kind: LegKind = Field(
        default=LegKind.METRO,
        description=(
            "`metro` for a ride, `transfer` for the walk between networks. A "
            "transfer leg has no line colour, platform, or fare."
        ),
    )
    network: MetroNetwork | None = Field(
        default=None,
        description="Network this leg runs on. Null on a transfer leg.",
    )
    source: JourneySource | None = Field(
        default=None,
        description="Upstream that produced this leg, on a combined journey.",
    )
    walk_metres: int | None = Field(
        default=None,
        description="Approximate walking distance. Transfer legs only.",
    )
    note: str | None = Field(
        default=None,
        description="Traveller-facing guidance, e.g. how the transfer works.",
    )
    line_name: str = Field(..., description="Line display name, e.g. Yellow Line.")
    line_number: int | None = None
    line_color: str | None = Field(
        default=None,
        description="Line hex color. Sarthi only.",
    )
    from_station: str
    from_station_code: str | None = None
    to_station: str
    to_station_code: str | None = None
    station_count: int | None = None
    stops: list[PlannedStop] = Field(default_factory=list)
    map_path: list[str] = Field(
        default_factory=list,
        description="Edge identifiers for drawing the leg on a network map.",
    )
    duration: str | None = Field(
        default=None,
        description="Leg travel time as reported upstream, e.g. `00:13:30`.",
    )
    distance_km: float | None = Field(
        default=None,
        description="Leg distance in kilometres. Sarthi only.",
    )
    direction: str | None = Field(
        default=None,
        description="Travel direction (`up`/`down`). Sarthi only.",
    )
    platform_name: str | None = Field(
        default=None,
        description="Boarding platform. Sarthi only.",
    )
    towards_station: str | None = Field(
        default=None,
        description="Terminus shown on the train. Sarthi only.",
    )
    start_time: str | None = Field(
        default=None,
        description=(
            "Calculated leg start time. Sarthi only, and observed to follow the "
            "server's current time rather than a requested future time."
        ),
    )
    end_time: str | None = Field(
        default=None,
        description="Calculated leg end time. Sarthi only, with the same caveat.",
    )
    interchange_minutes: float | None = Field(
        default=None,
        description="Interchange allowance before this leg.",
    )


class PlannedInterchange(BaseModel):
    """An interchange point along the journey."""

    station: str
    minutes: float | None = None


class ServiceTimes(BaseModel):
    """First and last train times relevant to the journey."""

    first: str | None = None
    last: str | None = None


class PlannedJourney(BaseModel):
    """A journey plan normalized across both upstreams."""

    source: JourneySource = Field(
        ...,
        description=(
            "Upstream that answered, or `combined` when the journey spans both "
            "networks and each leg carries its own `source`."
        ),
    )
    networks: list[MetroNetwork] = Field(
        default_factory=list,
        description="Networks used, in travel order.",
    )
    separate_tickets: bool = Field(
        default=False,
        description=(
            "True when the journey crosses networks, which requires buying a "
            "ticket on each. See `fare.breakdown` for the split."
        ),
    )
    fallback_reason: str | None = Field(
        default=None,
        description=(
            "Set when the preferred upstream failed and this plan came from the "
            "fallback. Useful for telemetry comparing the two sources."
        ),
    )
    strategy: RouteStrategy
    exclude_airport_line: bool = Field(
        ...,
        description=(
            "Whether Airport Express exclusion was actually applied. The legacy "
            "DMRC planner cannot honour this, so a fallback plan reports false."
        ),
    )
    origin: PlannedStation
    destination: PlannedStation
    station_count: int = Field(..., description="Total stations across the journey.")
    total_time: str = Field(..., description="Total journey time as reported upstream.")
    total_distance_km: float | None = Field(
        default=None,
        description="Total journey distance. Sarthi only.",
    )
    fare: PlannedFare
    legs: list[PlannedLeg] = Field(default_factory=list)
    interchanges: list[PlannedInterchange] = Field(default_factory=list)
    metro_service: ServiceTimes | None = Field(
        default=None,
        description="First/last train times for this origin-destination pair.",
    )
    service_available: bool | None = Field(
        default=None,
        description="Whether the upstream considers service available.",
    )
    ticket_available: bool | None = Field(
        default=None,
        description="Whether the upstream offers ticketing. Sarthi only.",
    )
