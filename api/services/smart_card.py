"""Estimate operator smart-card fares from published discount rules."""

from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from schemas.planner import MetroNetwork, PlannedFare, PlannedLeg, SmartCardFare

DELHI_TIMEZONE = ZoneInfo("Asia/Kolkata")
_NATIONAL_HOLIDAYS = {(1, 26), (8, 15), (10, 2)}


def local_departure(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(DELHI_TIMEZONE)
    if value.tzinfo is None:
        return value.replace(tzinfo=DELHI_TIMEZONE)
    return value.astimezone(DELHI_TIMEZONE)


def is_airport_leg(leg: PlannedLeg) -> bool:
    return leg.line_number == 10 or "airport" in leg.line_name.casefold()


def is_special_day(departure: datetime) -> bool:
    return (
        departure.weekday() == 6
        or (departure.month, departure.day) in _NATIONAL_HOLIDAYS
    )


def token_amount(fare: PlannedFare, departure: datetime) -> float:
    if fare.applicable is not None:
        return fare.applicable
    if fare.special is not None and is_special_day(departure):
        return fare.special
    return fare.normal


def _amount(token: float, base_multiplier: str = "0.90") -> Decimal:
    return Decimal(str(token)) * Decimal(base_multiplier)


def smart_card_fare(
    fare: PlannedFare,
    network: MetroNetwork,
    journey_time: datetime | None,
    *,
    airport_fare: float | None = None,
    airport_line: bool = False,
) -> SmartCardFare | None:
    departure = local_departure(journey_time)
    token = token_amount(fare, departure)
    off_peak = False
    if network is MetroNetwork.DMRC:
        # DMRC publishes the 08:00–12:00 and 17:00–21:00 peak windows here:
        # https://x.com/OfficialDMRC/status/1227596461786796033
        # The additional off-peak discount excludes Airport Express:
        # https://x.com/OfficialDMRC/status/1975063449878003819
        clock = departure.time()
        outside_peak = not (time(8) <= clock < time(12) or time(17) <= clock < time(21))
        airport = min(
            token,
            airport_fare if airport_fare is not None else token if airport_line else 0,
        )
        off_peak = outside_peak and token > airport
        amount = _amount(airport) + _amount(
            token - airport, "0.80" if off_peak else "0.90"
        )
        rule = (
            "DMRC smart card: 20% off during off-peak hours, except Airport Express"
            if off_peak
            else "DMRC smart card: 10% off"
        )
    elif network is MetroNetwork.NMRC:
        # https://www.nmrcnoida.com/Passenger-Information/Metro-Rail/Train-Timings
        amount = _amount(token)
        rule = "NMRC smart card: 10% off"
    else:
        return None
    return SmartCardFare(
        amount=float(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        off_peak=off_peak,
        rule=rule,
    )


def combined_card_fare(
    fares: list[PlannedFare], departure: datetime
) -> SmartCardFare | None:
    card_fares = [fare.smart_card for fare in fares if fare.smart_card is not None]
    if not card_fares:
        return None
    amount = sum(
        Decimal(
            str(
                fare.smart_card.amount
                if fare.smart_card
                else token_amount(fare, departure)
            )
        )
        for fare in fares
    )
    return SmartCardFare(
        amount=float(amount),
        off_peak=any(fare.off_peak for fare in card_fares),
        rule=" and ".join(fare.rule for fare in card_fares),
    )
