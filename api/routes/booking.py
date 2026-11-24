"""Ticket booking information under each network prefix."""

from fastapi import APIRouter

from schemas.planner import AppBooking, MetroNetwork, TicketBooking, WhatsAppBooking
from services.booking import ticket_booking


def mount_booking(router: APIRouter, network: MetroNetwork) -> None:
    """Add `GET /booking` to a network router."""

    @router.get(
        "/booking",
        response_model=AppBooking if network is MetroNetwork.NCRTC else WhatsAppBooking,
        summary=f"Official ticket booking option for {network.value.upper()}",
        tags=["booking"],
    )
    async def get_booking() -> TicketBooking:
        return ticket_booking(network)
