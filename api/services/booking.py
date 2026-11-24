"""Official ticket booking links."""

from __future__ import annotations

from urllib.parse import quote

from schemas.planner import AppBooking, MetroNetwork, TicketBooking, WhatsAppBooking

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


def ticket_booking(network: MetroNetwork) -> TicketBooking:
    if network is not MetroNetwork.NCRTC:
        return whatsapp_booking(network)

    # NCRTC lists Namo Bharat Connect for ticket purchases on its passenger site.
    return AppBooking(
        network=network,
        label="Namo Bharat Connect",
        url="https://namobharat.ncrtc.in/",
        android_url="https://play.google.com/store/apps/details?id=com.ncrtc",
        ios_url="https://apps.apple.com/in/app/namo-bharat-connect/id6448940583",
        note="Choose your stations in Namo Bharat Connect, or buy your ticket at the station.",
    )


def booking_options_for(networks: list[MetroNetwork]) -> list[TicketBooking]:
    return [ticket_booking(network) for network in dict.fromkeys(networks)]
