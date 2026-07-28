"""HTML parsers for NMRC's server-rendered passenger pages.

NMRC publishes no JSON API, so these pure functions turn the public pages into
typed values. They are kept free of I/O so page fixtures can be tested
directly; see `docs/nmrc-html-research.md` for the markup they target.
"""

from __future__ import annotations

import re
import zlib
from urllib.parse import quote, urljoin

from lxml import etree, html
from lxml.html import HtmlElement

from core.config import settings
from schemas.notification import PassengerNotification
from services.nmrc.data import STATIONS


def _parse_html(page: str) -> HtmlElement:
    """Build a recovered DOM without allowing parser-side network access."""

    try:
        parser = html.HTMLParser(recover=True, no_network=True)
        return html.document_fromstring(page, parser=parser)
    except (etree.ParserError, ValueError) as exc:
        raise ValueError("NMRC returned unreadable HTML") from exc


def _node_text(node: HtmlElement) -> str:
    """Return one element's decoded text with layout whitespace collapsed."""

    return " ".join("".join(node.itertext()).split())


def _has_class(class_name: str) -> str:
    """Return an XPath predicate that matches one complete class token."""

    return f"contains(concat(' ', normalize-space(@class), ' '), ' {class_name} ')"


def _parse_number(pattern: str, text: str, label: str) -> float:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        raise ValueError(f"NMRC journey {label} was not found")
    return float(match.group(1))


def _fare_amount(card: HtmlElement) -> float | None:
    """Read a fare from its price region, independent of the rupee icon tag."""

    price_nodes = card.xpath(f".//*[{_has_class('ticket-price')}]")
    price_text = _node_text(price_nodes[0] if price_nodes else card)
    match = re.search(
        r"(?:₹|Rs\.?)\s*([\d.]+)|(?<!\d)([\d.]+)\s*/-",
        price_text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    return float(match.group(1) or match.group(2))


def _fallback_fare_amounts(document: HtmlElement) -> list[float]:
    """Handle a fare-card class rename while retaining DOM-based extraction."""

    price_nodes = document.xpath(f"//*[{_has_class('ticket-price')}]")
    amounts = [
        amount for node in price_nodes if (amount := _fare_amount(node)) is not None
    ]
    if amounts:
        return amounts

    # Older NMRC markup placed the numeric value directly in a rupee icon's
    # text tail. This is deliberately a last-resort compatibility path.
    icon_nodes = document.xpath(f"//*[{_has_class('bi-currency-rupee')}]")
    for icon in icon_nodes:
        match = re.search(r"([\d.]+)\s*/-", icon.tail or "")
        if match:
            amounts.append(float(match.group(1)))
    return amounts


def parse_station_options(page: str) -> list[tuple[int, str]]:
    """Extract the first planner select's station IDs and labels."""

    document = _parse_html(page)
    option_nodes = document.xpath(
        "//*[@id and "
        "translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"
        " = 'sourcestation']//option"
    )
    if not option_nodes:
        raise ValueError("NMRC planner station selector was not found")

    options: list[tuple[int, str]] = []
    for option in option_nodes:
        value = (option.get("value") or "").strip()
        label = _node_text(option)
        if value.isdigit() and label:
            options.append((int(value), label))

    if len(options) != len(STATIONS):
        raise ValueError(
            f"Expected {len(STATIONS)} NMRC stations, found {len(options)}"
        )
    return options


def parse_journey_page(page: str) -> dict[str, object]:
    """Parse the server-rendered result section from the NMRC planner."""

    document = _parse_html(page)
    stop_names = [
        _node_text(node)
        for node in document.xpath(f"//*[{_has_class('single-station')}]//p[1]")
        if _node_text(node)
    ]
    if len(stop_names) < 2:
        raise ValueError("NMRC journey stops were not found")

    metric_nodes = document.xpath(f"//*[{_has_class('line-with-icon')}]")
    metric_text = " ".join(_node_text(node) for node in metric_nodes)
    if not metric_text:
        metric_text = _node_text(document)
    duration_minutes = _parse_number(
        r"\bTiming\s*:\s*([\d.]+)\s*Min\b",
        metric_text,
        "duration",
    )
    distance_km = _parse_number(
        r"\bDistance\s*:\s*([\d.]+)\s*KM\b",
        metric_text,
        "distance",
    )

    fare_cards = document.xpath(f"//*[{_has_class('ticket-fare-card')}]")
    labeled_fares: dict[str, float] = {}
    ordered_fares: list[float] = []
    for card in fare_cards:
        amount = _fare_amount(card)
        if amount is None:
            continue
        ordered_fares.append(amount)
        card_text = _node_text(card).casefold()
        if "normal fare" in card_text:
            labeled_fares["normal"] = amount
        elif "concessional fare" in card_text or "national holiday" in card_text:
            labeled_fares["special"] = amount

    if not ordered_fares:
        ordered_fares = _fallback_fare_amounts(document)

    normal_fare = labeled_fares.get("normal")
    special_fare = labeled_fares.get("special")
    if normal_fare is None and ordered_fares:
        normal_fare = ordered_fares[0]
    if special_fare is None and len(ordered_fares) > 1:
        special_fare = ordered_fares[1]
    if normal_fare is None or special_fare is None:
        raise ValueError("NMRC journey fares were not found")

    return {
        "stops": stop_names,
        "duration_minutes": duration_minutes,
        "distance_km": distance_km,
        "normal_fare": normal_fare,
        "special_fare": special_fare,
    }


def parse_press_releases(page: str) -> list[PassengerNotification]:
    """Extract press-release cards as passenger notifications."""

    releases: list[PassengerNotification] = []
    document = _parse_html(page)
    cards = document.xpath(f"//*[{_has_class('link-card')}]")
    for card in cards:
        links = card.xpath(".//a[@href]")
        date_containers = card.xpath(
            ".//p[contains("
            "translate(normalize-space(string(.)), "
            "'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "
            "'date:')]"
        )
        if not links or not date_containers:
            continue

        link = links[0]
        date_container = date_containers[0]
        strong_values = date_container.xpath(".//strong")
        if strong_values:
            date_text = _node_text(strong_values[0])
        else:
            date_match = re.search(
                r"\bDate\s*:\s*(.+?)(?:\s+File Format\s*:|$)",
                _node_text(date_container),
                flags=re.IGNORECASE,
            )
            date_text = date_match.group(1).strip() if date_match else ""

        href = (link.get("href") or "").strip()
        title = _node_text(link)
        if not href or not title or not date_text:
            continue
        url = quote(
            urljoin(str(settings.nmrc_base_url), href),
            safe=":/?=&%#",
        )
        # NMRC gives press releases no identifier, so derive a stable one from
        # the resolved file URL.
        identifier = zlib.crc32(url.encode("utf-8"))
        releases.append(
            PassengerNotification(
                id=identifier,
                title=title,
                notification_type=None,
                image=None,
                video_url=None,
                link_to=None,
                link_to_file=None,
                link_to_internal_page=None,
                link_to_outside_url=url,
                date=date_text,
            )
        )
    return releases
