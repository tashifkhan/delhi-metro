"""WhatsApp ticket links for the two operators.

Neither operator accepts a station pair in the first message. The link only
opens their chatbot with "Hi" filled in. The passenger picks the stations
again inside the chat.
"""

from __future__ import annotations

from urllib.parse import quote

from schemas.planner import MetroNetwork, WhatsAppBooking

_GREETING = "Hi"

# E.164 without the plus. Confirmed against each operator's WhatsApp profile:
# Delhi Metro Rail Corporation, and Noida Metro Rail Corporation Limited.
_CHANNELS: dict[MetroNetwork, tuple[str, str, str]] = {
    MetroNetwork.DMRC: (
        "919650855800",
        "Delhi Metro",
        "Opens WhatsApp with Hi ready to send. The bot asks for the stations again.",
    ),
    MetroNetwork.NMRC: (
        "919599030188",
        "Noida Metro",
        "Opens WhatsApp with Hi ready to send. Tap Book Now, then pick the stations again.",
    ),
}


def whatsapp_booking(network: MetroNetwork) -> WhatsAppBooking:
    """Build the booking link for one network."""

    phone, label, note = _CHANNELS[network]
    return WhatsAppBooking(
        network=network,
        label=label,
        phone=f"+{phone}",
        url=f"https://wa.me/{phone}?text={quote(_GREETING)}",
        note=note,
    )


def bookings_for(networks: list[MetroNetwork]) -> list[WhatsAppBooking]:
    """One link per network, in travel order, with duplicates dropped."""

    ordered: list[MetroNetwork] = []
    for network in networks:
        if network not in ordered and network in _CHANNELS:
            ordered.append(network)
    return [whatsapp_booking(network) for network in ordered]
