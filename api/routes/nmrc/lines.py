"""NMRC metro line routes."""

from typing import Annotated

from fastapi import APIRouter, Path

from schemas.line import MetroLine
from schemas.station import StationByLineItem
from services.nmrc.catalog import list_lines
from services.nmrc.station import stations_by_line

router = APIRouter(prefix="/lines", tags=["nmrc"])


@router.get(
    "",
    response_model=list[MetroLine],
    summary="List NMRC lines",
    description=(
        "Returns NMRC line metadata in the same shape as the DMRC line "
        "catalog. NMRC currently operates the Aqua Line alone."
    ),
)
async def list_lines_route() -> list[MetroLine]:
    """Fetch the NMRC line catalog."""

    return await list_lines()


@router.get(
    "/{line_code}/stations",
    response_model=list[StationByLineItem],
    summary="List stations on an NMRC line",
    description="Returns the ordered station sequence for a line code, e.g. `AQUA`.",
)
async def list_line_stations_route(
    line_code: Annotated[
        str,
        Path(min_length=2, description="NMRC line code, e.g. AQUA."),
    ],
) -> list[StationByLineItem]:
    """Fetch ordered line stations by line code."""

    return await stations_by_line(line_code)
