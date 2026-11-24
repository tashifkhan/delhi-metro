"""Service for DMRC passenger notification resources."""

from __future__ import annotations

import re
from urllib.parse import quote, urljoin, urlsplit

from pydantic import TypeAdapter

from clients.dmrc import dmrc_client
from core.config import settings
from core.errors import ApiRequestError
from core.validation import validate_model, validate_with_adapter
from schemas.notification import (
    PassengerNotification,
    PassengerNotificationDetail,
    PassengerPressReleaseDetail,
)

from services.notification_body import body_blocks

_notification_adapter = TypeAdapter(list[PassengerNotification])
_slug_pattern = re.compile(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")


async def list_notifications() -> list[PassengerNotification]:
    """Return current passenger notifications."""

    payload = await dmrc_client.get_json_list("passengers/notification/")
    return validate_with_adapter(_notification_adapter, payload)


def notice_slug(notice: PassengerNotification) -> str | None:
    """Find the slug in DMRC's bare, relative, or full-URL notice links."""

    target = (notice.link_to_internal_page or notice.link_to_outside_url or "").strip()
    if _slug_pattern.fullmatch(target):
        return target
    url = urlsplit(urljoin(str(settings.dmrc_frontend_base_url), target))
    host = url.hostname or ""
    slug = url.path.rstrip("/").rsplit("/", 1)[-1]
    if (
        (host == "delhimetrorail.com" or host.endswith(".delhimetrorail.com"))
        and url.path.startswith("/pages/")
        and _slug_pattern.fullmatch(slug)
    ):
        return slug
    return None


async def get_notification_detail(page_slug: str) -> PassengerNotificationDetail:
    """Return normalized corporate-page or press-release notice content."""

    normalized_slug = page_slug.strip()
    encoded_slug = quote(normalized_slug, safe="")
    payload = await dmrc_client.get_json_list(f"corporate/{encoded_slug}/")

    if payload:
        detail = validate_model(PassengerNotificationDetail, payload[0])
        detail.body_blocks = body_blocks(detail.content, str(settings.dmrc_frontend_base_url))
        return detail

    # DMRC's notification feed links press releases through
    # `/pages/{language}/pressrelease_details/{slug}`. Those records are not
    # returned by `/corporate/{slug}/`; they have their own object endpoint
    # and use different field names.
    press_release_payload = await dmrc_client.get_json_dict(
        f"pressrelease_details/{encoded_slug}"
    )
    press_release = validate_model(
        PassengerPressReleaseDetail,
        press_release_payload,
    )
    title = press_release.english_title or press_release.hindi_title
    content = press_release.body_english or press_release.body_hindi

    if not title or not content:
        raise ApiRequestError(
            message=f"Notification detail '{normalized_slug}' was not found",
            status_code=404,
        )

    return PassengerNotificationDetail(
        title=title,
        content=content,
        body_blocks=body_blocks(content, str(settings.dmrc_frontend_base_url)),
        page_slug=press_release.page_slug,
    )
