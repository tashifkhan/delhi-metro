"""WhatsApp ticket link, mounted once under each network prefix."""

from fastapi import APIRouter

from schemas.planner import MetroNetwork, WhatsAppBooking
from services.booking import whatsapp_booking


def mount_booking(router: APIRouter, network: MetroNetwork) -> None:
    """Add `GET /booking` to a network router."""

    @router.get(
        "/booking",
        response_model=WhatsAppBooking,
        summary=f"WhatsApp ticket link for {network.value.upper()}",
        description=(
            "Returns the operator's WhatsApp chatbot link. The URL opens a "
            "chat with Hi already filled in. It does not carry the stations."
        ),
        tags=["booking"],
    )
    async def get_booking() -> WhatsAppBooking:
        return whatsapp_booking(network)
