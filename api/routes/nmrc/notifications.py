"""NMRC passenger notification routes."""

from fastapi import APIRouter

from schemas.notification import PassengerNotification
from services.nmrc.notification import list_notifications

router = APIRouter(prefix="/notifications", tags=["nmrc"])


@router.get(
    "",
    response_model=list[PassengerNotification],
    summary="List NMRC press releases",
    description=(
        "Returns NMRC press releases from the current and archive pages as "
        "passenger notifications, each linking to its published file."
    ),
)
async def list_notifications_route() -> list[PassengerNotification]:
    """Fetch current and archived NMRC press releases."""

    return await list_notifications()
