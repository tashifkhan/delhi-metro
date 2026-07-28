"""Metro line routes."""

from typing import Annotated

from fastapi import APIRouter, Path

from schemas.line import MetroLine
from schemas.station import StationByLineItem
from services.dmrc.line import list_lines
from services.dmrc.station import stations_by_line

router = APIRouter(prefix="/lines", tags=["lines"])


@router.get(
    "",
    response_model=list[MetroLine],
    summary="List metro lines",
    description=(
        "Returns Delhi Metro line metadata including line code, colors, terminal "
        "stations, and operational status."
    ),
)
async def list_lines_route() -> list[MetroLine]:
    """Fetch the line catalog from DMRC upstream."""

    return await list_lines()


@router.get(
    "/{line_code}/stations",
    response_model=list[StationByLineItem],
    summary="List stations for a line",
    description=(
        "Returns station sequence for a given line code such as `LN3`, `LN10`, "
        "or `LN11`."
    ),
)
async def list_line_stations_route(
    line_code: Annotated[
        str,
        Path(
            min_length=2,
            max_length=16,
            pattern=r"^[A-Za-z0-9]+$",
            description="DMRC line code, e.g. LN10.",
        ),
    ],
) -> list[StationByLineItem]:
    """Fetch ordered line stations by line code."""

    return await stations_by_line(line_code)
