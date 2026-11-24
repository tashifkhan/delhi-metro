"""NCRTC notices and banners from the anonymous passenger feeds."""

import asyncio
from hashlib import sha256
from html import escape
from urllib.parse import urljoin, urlsplit

from pydantic import BaseModel, ConfigDict, TypeAdapter

from clients.ncrtc import ROOT, ncrtc_client
from core.errors import ApiRequestError, UpstreamApiError
from schemas.common import AssetImage
from schemas.notification import NCRTCPassengerNotification, PassengerNotificationDetail
from services.ncrtc.catalog import JOURNEY
from services.notification_body import body_blocks


class Notice(BaseModel):
    model_config = ConfigDict(extra="allow")

    code: str | int | None = None
    id: str | int | None = None
    title: str | None = None
    name: str | None = None
    content: str | None = None
    description: str | None = None
    link: str | None = None
    url: str | None = None
    date: str | None = None
    images: dict[str, str | None] | None = None


_notice_list = TypeAdapter(list[Notice])


async def _notices():
    paths = ("web/notifications", "app-banners", "statics/news")
    snapshots = await asyncio.gather(
        *(
            ncrtc_client.get(f"{JOURNEY}/{path}", _notice_list.validate_python, ttl=900)
            for path in paths
        ),
        return_exceptions=True,
    )
    unique = {}
    if all(isinstance(item, UpstreamApiError) for item in snapshots):
        raise UpstreamApiError("NCRTC passenger notices are unavailable")
    for path, snapshot in zip(paths, snapshots, strict=True):
        if isinstance(snapshot, UpstreamApiError):
            continue
        if isinstance(snapshot, BaseException):
            raise snapshot
        for row in snapshot.data:
            title = row.title or row.name
            if not title:
                continue
            url = urljoin(ROOT, row.link or row.url or "")
            if url == ROOT or urlsplit(url).scheme not in {"http", "https"}:
                url = None
            stable_key = f"{path}:{row.code or row.id or url or title}"
            slug = "ncrtc-" + sha256(stable_key.encode()).hexdigest()[:12]
            unique.setdefault(slug, (title, url, row, snapshot))
    return unique


async def list_notifications() -> list[NCRTCPassengerNotification]:
    return [
        NCRTCPassengerNotification(
            id=int(slug[6:], 16),
            title=title,
            date=row.date or "",
            image=AssetImage(title=title, file=image)
            if (image := (row.images or {}).get("png"))
            else None,
            link_to="internal",
            link_to_outside_url=url,
            link_to_internal_page=slug,
            stale=snapshot.stale,
            fetched_at=snapshot.fetched_at,
        )
        for slug, (title, url, row, snapshot) in (await _notices()).items()
    ]


async def get_notification_detail(slug: str) -> PassengerNotificationDetail:
    notice = (await _notices()).get(slug)
    if notice is None:
        raise ApiRequestError(f"Unknown NCRTC notification '{slug}'", 404)
    title, url, row, snapshot = notice
    content = row.content or row.description or ""
    if url:
        content += f'<p><a href="{escape(url, quote=True)}">{escape(title)}</a></p>'
    return PassengerNotificationDetail(
        title=title,
        content=content,
        page_slug=slug,
        body_blocks=body_blocks(content, ROOT),
        stale=snapshot.stale,
        fetched_at=snapshot.fetched_at,
    )
