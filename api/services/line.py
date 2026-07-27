"""Service for DMRC metro line resources."""

from __future__ import annotations

from pydantic import TypeAdapter

from clients.dmrc import dmrc_client
from core.validation import validate_with_adapter
from schemas.line import MetroLine, StationLineBadge

_line_adapter = TypeAdapter(list[MetroLine])


async def list_lines() -> list[MetroLine]:
    """Return the DMRC line catalog."""

    payload = await dmrc_client.get_json_list("line_list")
    return validate_with_adapter(_line_adapter, payload)


def line_badge(line: MetroLine) -> StationLineBadge:
    """Reduce a full line record to the badge shown next to station names."""

    return StationLineBadge(
        line_id=line.id,
        line_code=line.line_code,
        line_name=line.name,
        line_color=line.line_color,
        primary_color_code=line.primary_color_code,
    )
