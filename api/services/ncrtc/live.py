"""Live trains and parking. Preserve upstream field names inside data."""

import asyncio

from pydantic import BaseModel, ConfigDict, TypeAdapter

from clients.ncrtc import LIVE_TTL, ncrtc_client
from services.ncrtc.catalog import JOURNEY, resolve


class TrainEndpoint(BaseModel):
    model_config = ConfigDict(extra="allow")

    code: str


class Train(BaseModel):
    model_config = ConfigDict(extra="allow")

    trainId: str
    source: TrainEndpoint
    destination: TrainEndpoint


class Frequency(BaseModel):
    model_config = ConfigDict(extra="allow")

    trains: list[Train]


class LiveTrains(BaseModel):
    model_config = ConfigDict(extra="allow")

    trainsStatus: list[dict]


class ParkingStation(BaseModel):
    model_config = ConfigDict(extra="allow")

    station: dict
    availability: list[dict]


class ParkingCharges(BaseModel):
    model_config = ConfigDict(extra="allow")

    charges: list[dict]


def validate(model):
    adapter = TypeAdapter(model)
    return lambda payload: adapter.dump_python(
        adapter.validate_python(payload), mode="json"
    )


async def next_trains(code):
    station = await resolve(code)
    return await ncrtc_client.get(
        f"{JOURNEY}/trains/v2/frequency",
        validate(Frequency),
        params={"fst": station.id, "mts": 30},
        ttl=LIVE_TTL,
    )


async def live_trains():
    return await ncrtc_client.get(
        f"{JOURNEY}/trains/v3/live", validate(LiveTrains), ttl=LIVE_TTL
    )


async def parking_live():
    return await ncrtc_client.get(
        f"{JOURNEY}/parking/v1/live", validate(list[ParkingStation]), ttl=LIVE_TTL
    )


async def parking():
    live, charges = await asyncio.gather(
        parking_live(),
        ncrtc_client.get(f"{JOURNEY}/parking/v1/charges", validate(ParkingCharges)),
    )
    return {
        "data": {"live": live.data, "charges": charges.data},
        "stale": live.stale or charges.stale,
        "fetched_at": min(
            item.fetched_at
            for item in (live, charges)
            if item.stale or not (live.stale or charges.stale)
        ),
    }
