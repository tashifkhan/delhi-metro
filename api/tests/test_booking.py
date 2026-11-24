"""Official ticket booking links across operators."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from main import app
from schemas.planner import MetroNetwork
from services.booking import booking_options_for, bookings_for, whatsapp_booking

client = TestClient(app)


class WhatsAppBookingTests(unittest.TestCase):
    def test_delhi_link_only_prefills_hi(self) -> None:
        booking = whatsapp_booking(MetroNetwork.DMRC)

        self.assertEqual(booking.phone, "+919650855800")
        self.assertEqual(booking.url, "https://wa.me/919650855800?text=Hi")
        self.assertNotIn("station", booking.url.lower())

    def test_noida_link_only_prefills_hi(self) -> None:
        booking = whatsapp_booking(MetroNetwork.NMRC)

        self.assertEqual(booking.phone, "+919599030188")
        self.assertEqual(booking.url, "https://wa.me/919599030188?text=Hi")

    def test_cross_network_keeps_travel_order_without_duplicates(self) -> None:
        links = bookings_for(
            [MetroNetwork.DMRC, MetroNetwork.NMRC, MetroNetwork.DMRC]
        )

        self.assertEqual(
            [item.network for item in links],
            [MetroNetwork.DMRC, MetroNetwork.NMRC],
        )

    def test_each_network_exposes_its_own_booking_route(self) -> None:
        delhi = client.get("/api/v1/dmrc/booking")
        noida = client.get("/api/v1/nmrc/booking")

        self.assertEqual(delhi.status_code, 200)
        self.assertEqual(noida.status_code, 200)
        self.assertEqual(delhi.json()["network"], "dmrc")
        self.assertEqual(noida.json()["network"], "nmrc")
        self.assertTrue(delhi.json()["url"].startswith("https://wa.me/919650855800"))
        self.assertTrue(noida.json()["url"].startswith("https://wa.me/919599030188"))

    def test_ncrtc_exposes_its_app_and_website(self) -> None:
        response = client.get("/api/v1/ncrtc/booking")

        self.assertEqual(response.status_code, 200)
        option = response.json()
        self.assertEqual(option["network"], "ncrtc")
        self.assertEqual(option["channel"], "app")
        self.assertEqual(option["url"], "https://namobharat.ncrtc.in/")
        self.assertTrue(option["android_url"].endswith("id=com.ncrtc"))
        self.assertTrue(option["ios_url"].endswith("id6448940583"))

    def test_booking_options_cover_all_ridden_operators_in_order(self) -> None:
        networks = [MetroNetwork.NMRC, MetroNetwork.DMRC, MetroNetwork.NCRTC]
        options = booking_options_for([*networks, MetroNetwork.NCRTC])

        self.assertEqual([option.network for option in options], networks)
