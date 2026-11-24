"""NCRTC fare lookup and complete offline fare matrices."""

from typing import Literal

from pydantic import BaseModel, Field, TypeAdapter

from clients.ncrtc import ncrtc_client
from schemas.planner import FareClass
from services.ncrtc.catalog import JOURNEY, Station

FARE_PATH = "/tickets/journey/fare/v3"


class ClassQuote(BaseModel):
    classType: int
    txnAmount: float = Field(ge=0)


class Measurement(BaseModel):
    value: float = Field(ge=0)
    unit: str


class TripSummary(BaseModel):
    distance: Measurement


class FareQuote(BaseModel):
    fare: list[ClassQuote]
    tripSummary: TripSummary
    isPremiumClassAvailable: bool = True

    def classes_for(self, premium: bool) -> list[FareClass]:
        amounts = {quote.classType: quote.txnAmount for quote in self.fare}
        classes = [
            FareClass.model_validate({"class": "standard", "amount": amounts[2]})
        ]
        if premium and self.isPremiumClassAvailable and 1 in amounts:
            classes.append(
                FareClass.model_validate({"class": "premium", "amount": amounts[1]})
            )
        return classes


def _parse_quote(payload: object) -> FareQuote:
    quote = FareQuote.model_validate(payload)
    if (
        2 not in {item.classType for item in quote.fare}
        or quote.tripSummary.distance.unit != "m"
    ):
        raise ValueError("NCRTC fare requires a standard amount and distance in metres")
    return quote


async def get_fare(origin: Station, destination: Station) -> FareQuote:
    snapshot = await ncrtc_client.get(
        FARE_PATH,
        _parse_quote,
        params={"fst": origin.id, "tst": destination.id, "jc": 2, "tc": 1, "not": 1},
    )
    return snapshot.data


class MatrixStation(BaseModel):
    code: str


class MatrixFare(BaseModel):
    fromStation: MatrixStation
    toStation: MatrixStation
    classType: Literal[1, 2]
    discountedFare: float = Field(ge=0)


_matrix_adapter = TypeAdapter(list[MatrixFare])


async def fare_matrix(class_type: Literal[1, 2]) -> list[MatrixFare]:
    def parse(payload: object) -> list[MatrixFare]:
        rows = _matrix_adapter.validate_python(payload)
        if not rows or any(row.classType != class_type for row in rows):
            raise ValueError("Unexpected NCRTC fare matrix")
        return rows

    snapshot = await ncrtc_client.get(
        f"{JOURNEY}/fare-details",
        parse,
        params={"jc": class_type},
    )
    return snapshot.data
