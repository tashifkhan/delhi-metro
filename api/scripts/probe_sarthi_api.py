#!/usr/bin/env python3
"""Read-only probe for the public route API used by Delhi Metro Sarthi.

This is intentionally separate from the production client. The upstream is an
undocumented, vendor-operated interface, so it should be evaluated behind a
feature flag and fallback before it becomes a production dependency.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

BASE_URL = "https://dmrc.autope.in/metro/v4/"
DELHI_TIMEZONE = ZoneInfo("Asia/Kolkata")
STRATEGIES = ("least-distance", "minimum-interchange")


def delhi_now() -> str:
    """Return the timestamp format expected in the journey path."""

    return datetime.now(DELHI_TIMEZONE).strftime("%Y-%m-%dT%H:%M")


def print_json(payload: Any, *, compact: bool) -> None:
    """Print deterministic UTF-8 JSON."""

    indent = None if compact else 2
    print(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=indent,
            separators=(",", ":") if compact else None,
            sort_keys=compact,
        )
    )


def get_json(
    client: httpx.Client,
    path: str,
    *,
    params: dict[str, str | int] | None = None,
) -> Any:
    """GET JSON and fail with the upstream response body on non-2xx status."""

    response = client.get(path, params=params)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()
        raise SystemExit(
            f"Upstream returned HTTP {response.status_code}: {detail}"
        ) from exc

    try:
        return response.json()
    except ValueError as exc:
        raise SystemExit("Upstream returned a non-JSON response") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Probe Delhi Metro Sarthi's unauthenticated Metro API."
    )
    parser.add_argument(
        "--base-url",
        default=BASE_URL,
        help=f"Upstream base URL (default: {BASE_URL})",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print compact JSON.",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    route_parser = subparsers.add_parser("route", help="Plan one Metro journey.")
    route_parser.add_argument("from_code", help="Origin station code, e.g. AIIMS.")
    route_parser.add_argument("to_code", help="Destination station code, e.g. ASDM.")
    route_parser.add_argument(
        "--strategy",
        choices=STRATEGIES,
        default="least-distance",
    )
    route_parser.add_argument(
        "--at",
        default=delhi_now(),
        metavar="YYYY-MM-DDTHH:MM",
        help="Journey date/time in Delhi local time.",
    )
    route_parser.add_argument(
        "--exclude-airport-line",
        action="store_true",
        help="Ask the planner not to route through the Airport Express line.",
    )

    stations_parser = subparsers.add_parser(
        "stations", help="Fetch the station directory."
    )
    stations_parser.add_argument("--limit", type=int, default=500)

    lines_parser = subparsers.add_parser("lines", help="Fetch the line directory.")
    lines_parser.add_argument("--limit", type=int, default=100)

    return parser


def main() -> None:
    args = build_parser().parse_args()

    with httpx.Client(
        base_url=args.base_url,
        timeout=20.0,
        headers={"Accept": "application/json"},
        follow_redirects=True,
    ) as client:
        if args.command == "route":
            try:
                datetime.strptime(args.at, "%Y-%m-%dT%H:%M")
            except ValueError as exc:
                raise SystemExit("--at must use YYYY-MM-DDTHH:MM") from exc

            origin = args.from_code.strip().upper()
            destination = args.to_code.strip().upper()
            payload = get_json(
                client,
                f"journey/{origin}/{destination}/{args.strategy}/{args.at}",
                params={
                    "exclude_airport_line": str(
                        args.exclude_airport_line
                    ).lower()
                },
            )
        elif args.command == "stations":
            payload = get_json(
                client,
                "stations",
                params={"page": 0, "limit": args.limit},
            )
        else:
            payload = get_json(
                client,
                "lines/",
                params={"page": 0, "limit": args.limit},
            )

    print_json(payload, compact=args.compact)


if __name__ == "__main__":
    main()
