"""Normalize station details while retaining NCRTC-specific metadata."""

from pydantic import BaseModel, ConfigDict, TypeAdapter

from clients.ncrtc import ncrtc_client
from core.errors import UpstreamApiError
from schemas.common import AssetImage, StationFacility
from schemas.station import StationDetail
from services.ncrtc.catalog import (
    JOURNEY,
    NAMO_BHARAT_MEERUT_STOPS,
    STATION_CODES,
    lines_for,
    resolve,
)
from services.ncrtc.live import parking_live


class StationRef(BaseModel):
    code: str


class NumberedPlace(BaseModel):
    model_config = ConfigDict(extra="allow")

    number: int | str
    location: str | None = None
    isOpen: bool | None = None
    hasSpecialAid: bool | None = None
    isPremiumLoungeAvailable: bool | None = None


class RawFacility(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    icon: dict[str, str | None] | None = None


class StationDetails(BaseModel):
    station: StationRef
    about: str | None = None
    stationControlRoom: str | int | None = None
    parkingCharges: dict | None = None
    gates: list[NumberedPlace] | None = None
    platforms: list[NumberedPlace] | None = None
    facilities: list[RawFacility] | None = None
    lift: list[dict] | None = None
    escalator: list[dict] | None = None
    feederBusRouteInfo: list[dict] | None = None
    trainTiming: list[dict] | None = None
    stationLayout: list[dict] | None = None


_station_details = TypeAdapter(list[StationDetails])


def parse_details(payload: object) -> dict[str, StationDetails]:
    rows = _station_details.validate_python(payload)
    indexed = {row.station.code: row for row in rows}
    if not indexed or len(indexed) != len(rows) or not indexed.keys() <= STATION_CODES:
        raise ValueError("Unexpected NCRTC station detail catalog")
    return indexed


async def get_station_detail(code: str) -> StationDetail:
    station = await resolve(code)
    snapshot = await ncrtc_client.get(f"{JOURNEY}/stations/v2/details", parse_details)
    details = snapshot.data.get(station.code)
    if details is None:
        raise UpstreamApiError(f"NCRTC station details missing for {station.code}")
    row = details.model_dump(mode="json")
    try:
        parking = await parking_live()
        spaces = [
            item for item in parking.data if item["station"].get("code") == station.code
        ]
    except UpstreamApiError:
        parking = None
        spaces = []
    charges = row.get("parkingCharges") or {}
    facilities = row.get("facilities") or []
    lifts = [
        dict(
            item,
            lift_type=kind,
            description_location=item.get("location"),
            status=item.get("isOpen"),
        )
        for kind, items in (
            ("Lift", row.get("lift")),
            ("Escalator", row.get("escalator")),
        )
        for item in items or []
    ]
    return StationDetail(
        id=station.id,
        station_name=station.name,
        station_code=station.code,
        latitude=station.latitude,
        longitude=station.longitude,
        station_description=row.get("about"),
        mobile=str(row["stationControlRoom"])
        if row.get("stationControlRoom")
        else None,
        interchange=station.code in NAMO_BHARAT_MEERUT_STOPS,
        metro_lines=lines_for(station.code),
        gates=[
            dict(
                item,
                gate_name=f"Gate {item['number']}",
                gate_code=str(item["number"]),
                divyang_friendly=item.get("hasSpecialAid"),
                status="Open" if item.get("isOpen") else "Closed",
            )
            for item in row.get("gates") or []
        ],
        lifts=lifts,
        platforms=[
            {
                "platform_name": f"Platform {item['number']}",
                "platform_code": str(item["number"]),
                "train_towards": item.get("location"),
            }
            for item in row.get("platforms") or []
        ],
        station_facility=[
            StationFacility(
                name=item["name"],
                class_name="facility",
                image=AssetImage(
                    title=item["name"], file=(item.get("icon") or {}).get("png") or ""
                ),
            )
            for item in facilities
        ],
        stations_facilities=facilities,
        feeder=row.get("feederBusRouteInfo") or [],
        parkings=spaces,
        first_last_train=row.get("trainTiming") or [],
        station_layout=row.get("stationLayout") or [],
        premium_lounges=[
            item
            for item in row.get("platforms") or []
            if item.get("isPremiumLoungeAvailable")
        ],
        parking_charges=charges,
        control_room_phone=str(row["stationControlRoom"])
        if row.get("stationControlRoom")
        else None,
        escalators=[item for item in lifts if item["lift_type"] == "Escalator"],
        has_parking=bool(spaces) if parking else None,
        stale=snapshot.stale or bool(parking and parking.stale),
        fetched_at=parking.fetched_at
        if parking and parking.stale and not snapshot.stale
        else snapshot.fetched_at,
    )
