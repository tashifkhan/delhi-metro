"""NMRC press releases, served as passenger notifications."""

from __future__ import annotations

import asyncio
import time

from clients.nmrc import nmrc_client
from core.errors import UpstreamApiError
from schemas.notification import PassengerNotification
from services.nmrc.catalog import CACHE_TTL_SECONDS
from services.nmrc.parsing import parse_press_releases

PRESS_RELEASE_PATH = "/Media/Press-Release"
PRESS_ARCHIVE_PATH = "/Media/ArchivePressRelease"

_notifications_cache: tuple[float, list[PassengerNotification]] | None = None


async def list_notifications() -> list[PassengerNotification]:
    """Return current and archived press releases, de-duplicated by file URL."""

    global _notifications_cache

    now = time.monotonic()
    if _notifications_cache and now - _notifications_cache[0] < CACHE_TTL_SECONDS:
        return list(_notifications_cache[1])

    # Either page alone is still a useful feed, so one failure is tolerated.
    pages = await asyncio.gather(
        nmrc_client.get_text(PRESS_RELEASE_PATH),
        nmrc_client.get_text(PRESS_ARCHIVE_PATH),
        return_exceptions=True,
    )
    releases: list[PassengerNotification] = []
    for page in pages:
        if isinstance(page, str):
            releases.extend(parse_press_releases(page))

    if not releases:
        raise UpstreamApiError("NMRC press releases could not be read")

    unique = {item.link_to_outside_url: item for item in releases}
    result = list(unique.values())
    _notifications_cache = (now, result)
    return result
