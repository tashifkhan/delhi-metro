"""Passenger notification routes."""

from typing import Annotated

from fastapi import APIRouter, Path

from schemas.notification import PassengerNotification, PassengerNotificationDetail
from services.dmrc.notification import get_notification_detail, list_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get(
    "",
    response_model=list[PassengerNotification],
    summary="List passenger notifications",
    description=(
        "Returns current DMRC passenger notices that can be displayed as in-app "
        "alerts, banners, or notification feeds."
    ),
)
async def list_notifications_route() -> list[PassengerNotification]:
    """Fetch current passenger notifications."""

    return await list_notifications()


@router.get(
    "/{page_slug}",
    response_model=PassengerNotificationDetail,
    summary="Get notification details",
    description=(
        "Returns normalized detail content for a DMRC corporate-page or "
        "press-release notification, including its raw HTML content."
    ),
)
async def get_notification_detail_route(
    page_slug: Annotated[
        str,
        Path(
            min_length=1,
            pattern=r"^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$",
            description="Notification page slug, e.g. service-update-3.",
        ),
    ],
) -> PassengerNotificationDetail:
    """Fetch a notification's normalized detail page by slug."""

    return await get_notification_detail(page_slug)
