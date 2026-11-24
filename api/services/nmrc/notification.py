"""NMRC press releases, served as passenger notifications."""

from __future__ import annotations

import asyncio
import time
from html import escape

from clients.nmrc import nmrc_client
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from schemas.notification import PassengerNotification, PassengerNotificationDetail
from services.nmrc.catalog import CACHE_TTL_SECONDS
from services.nmrc.parsing import parse_press_releases
from services.notification_body import body_blocks

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


async def get_notification_detail(page_slug: str) -> PassengerNotificationDetail:
    """NMRC publishes a link to the release file in place of an HTML article."""

    for notice in await list_notifications():
        if str(notice.id) == page_slug and notice.link_to_outside_url:
            url = escape(notice.link_to_outside_url, quote=True)
            content = f'<p><a href="{url}">{escape(notice.title)}</a></p>'
            return PassengerNotificationDetail(
                page_id=notice.id, title=notice.title, content=content, page_slug=page_slug,
                body_blocks=body_blocks(content, str(settings.nmrc_base_url)),
            )
    raise ApiRequestError(f"Unknown NMRC notification '{page_slug}'", 404)
