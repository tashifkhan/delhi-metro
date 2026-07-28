from __future__ import annotations

import unittest

from services.nmrc.data import STATIONS
from services.nmrc.parsing import (
    parse_journey_page,
    parse_press_releases,
    parse_station_options,
)


class NmrcDomParserTests(unittest.TestCase):
    def _station_options(self) -> str:
        return "\n".join(
            (
                f"<option value='{station.upstream_id}'>"
                f"<span>{station.name}</span></option>"
            )
            for station in STATIONS
        )

    def test_station_parser_recovers_malformed_and_nested_markup(self) -> None:
        page = f"<select ID=SourceStation>{self._station_options()}</select><div"

        parsed = parse_station_options(page)

        self.assertEqual(len(parsed), 21)
        self.assertEqual(parsed[0], (1, "Noida Sector 51"))
        self.assertEqual(parsed[-1], (21, "Depot Station"))

    def test_journey_parser_uses_semantic_cards_and_labels(self) -> None:
        page = """
        <div class="single-station extra"><p><span>Sector 101</span></p></div>
        <div class="extra single-station"><p>Sector 76</p></div>
        <div class="single-station"><p>Sector 50</p></div>
        <div class="single-station"><p>Sector 51</p></div>
        <div class="line-with-icon"><strong>Timing :</strong><span>6 Min</span></div>
        <div class="line-with-icon"><strong>Distance:</strong> 3.43 KM</div>
        <article class="ticket-fare-card">
          <h3>Concessional Fare / National Holiday</h3>
          <div class="ticket-price"><span>₹</span> 15</div>
        </article>
        <article class="ticket-fare-card promoted">
          <h3>Normal Fare</h3>
          <div class="ticket-price"><span>Rs.</span>20</div>
        </article>
        """

        result = parse_journey_page(page)

        self.assertEqual(
            result["stops"],
            [
                "Sector 101",
                "Sector 76",
                "Sector 50",
                "Sector 51",
            ],
        )
        self.assertEqual(result["duration_minutes"], 6.0)
        self.assertEqual(result["distance_km"], 3.43)
        # Labels, rather than card order, determine the two fare meanings.
        self.assertEqual(result["normal_fare"], 20.0)
        self.assertEqual(result["special_fare"], 15.0)

    def test_journey_parser_supports_older_icon_tail_fares(self) -> None:
        page = """
        <div class="single-station"><p>Sector 101</p></div>
        <div class="single-station"><p>Sector 51</p></div>
        <strong>Timing:</strong> 6 Min
        <strong>Distance:</strong> 3.43 KM
        <i class="bi bi-currency-rupee"></i>20/-
        <i class="bi-currency-rupee bi"></i>15/-
        """

        result = parse_journey_page(page)

        self.assertEqual(result["normal_fare"], 20.0)
        self.assertEqual(result["special_fare"], 15.0)

    def test_press_parser_does_not_depend_on_section_boundary(self) -> None:
        page = """
        <main>
          <article class="position-relative link-card featured">
            <a href="../uploads/press_releases/Service Update.pdf">
              <span>Service update</span><i></i>
            </a>
            <p><span>Date:</span> <strong><time>11-09-2025</time></strong></p>
          </article>
        </main>
        """

        releases = parse_press_releases(page)

        self.assertEqual(len(releases), 1)
        self.assertEqual(releases[0].title, "Service update")
        self.assertEqual(releases[0].date, "11-09-2025")
        self.assertIn(
            "Service%20Update.pdf",
            releases[0].link_to_outside_url or "",
        )


if __name__ == "__main__":
    unittest.main()
