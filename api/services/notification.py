"""Service for DMRC passenger notification resources."""

from __future__ import annotations

from urllib.parse import quote

from pydantic import TypeAdapter

from clients.dmrc import dmrc_client
from core.errors import UpstreamApiError
from core.validation import validate_model, validate_with_adapter
from schemas.notification import (
    PassengerNotification,
    PassengerNotificationDetail,
    PassengerPressReleaseDetail,
)

_notification_adapter = TypeAdapter(list[PassengerNotification])


async def list_notifications() -> list[PassengerNotification]:
    """Return current passenger notifications."""

    payload = await dmrc_client.get_json_list("passengers/notification/")
    return validate_with_adapter(_notification_adapter, payload)


async def get_notification_detail(page_slug: str) -> PassengerNotificationDetail:
    """Return normalized corporate-page or press-release notice content."""

    normalized_slug = page_slug.strip()
    encoded_slug = quote(normalized_slug, safe="")
    payload = await dmrc_client.get_json_list(f"corporate/{encoded_slug}/")

    if payload:
        return validate_model(PassengerNotificationDetail, payload[0])

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
        raise UpstreamApiError(
            message=f"Notification detail '{normalized_slug}' was not found",
            status_code=404,
        )

    return PassengerNotificationDetail(
        title=title,
        content=content,
        page_slug=press_release.page_slug,
    )
