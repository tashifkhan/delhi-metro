"""Custom documentation landing page and live playground.

Mirrors the Stat APIs Command-Code docs design: dark themed HTML docs at `/`
and a browser-side playground at `/playground`. FastAPI's built-in Swagger and
ReDoc stay at `/docs` and `/redoc`.
"""

from __future__ import annotations

import json
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response

from routes._docs_assets import _BASE_CSS, _JS, _PLAYGROUND_CSS

router = APIRouter(tags=["Documentation"])
docs_router = router

PLATFORM = "Delhi NCR Metro"
ACCENT = "#E53935"
DESCRIPTION = (
    "A typed REST API for Delhi NCR. Lines, stations, fares, routes, "
    "first and last trains, maps, and notifications for DMRC and NMRC, "
    "plus a unified v2 planner that stitches both networks when you cross from Delhi into Noida."
)
REPO = "tashifkhan/delhi-metro"
PLATFORM_KEY = "delhi-metro"
POSTHOG_PROXY_HOST = "https://eu.i.posthog.com"
SITE_URL = "https://tashif.codes"

# Sample codes used in docs curl examples and playground defaults.
SAMPLE_FROM = "AIIMS"
SAMPLE_TO = "ASDM"
SAMPLE_STATION = "RG"
SAMPLE_LINE = "LN3"
SAMPLE_NMRC_STATION = "NM01"
SAMPLE_NMRC_LINE = "AQUA"
TRY_PATH = (
    f"/api/v2/journeys/plan?from_station_code={SAMPLE_FROM}"
    f"&to_station_code={SAMPLE_TO}&strategy=least-distance"
)

# Endpoint catalogue used by both the docs accordion and the playground.
# Each tuple: (method, path, summary, group, path_params, query_params, example_key)
# path_params / query_params: list of (name, type, required, description)
# example_key: key into _EXAMPLES, or None

Endpoint = tuple[
    str,
    str,
    str,
    str,
    list[tuple[str, str, bool, str]],
    list[tuple[str, str, bool, str]],
    str | None,
]

HEALTH_ENDPOINTS: list[Endpoint] = [
    (
        "GET",
        "/api/v1/health",
        "Liveness probe",
        "health",
        [],
        [],
        "health",
    ),
]

DMRC_ENDPOINTS: list[Endpoint] = [
    (
        "GET",
        "/api/v1/dmrc/lines",
        "List metro lines",
        "dmrc",
        [],
        [],
        "lines",
    ),
    (
        "GET",
        "/api/v1/dmrc/lines/{line_code}/stations",
        "Stations on a line",
        "dmrc",
        [
            (
                "line_code",
                "string",
                True,
                f"DMRC line code, e.g. {SAMPLE_LINE}, LN10, LN11.",
            )
        ],
        [],
        "line_stations",
    ),
    (
        "GET",
        "/api/v1/dmrc/stations/search",
        "Search stations",
        "dmrc",
        [],
        [
            (
                "query",
                "string",
                False,
                "Station name keyword. Empty returns the full station list.",
            ),
            (
                "filter",
                "string",
                False,
                "`all` (default), `least-distance`, or `minimum-interchange`.",
            ),
        ],
        "station_search",
    ),
    (
        "GET",
        "/api/v1/dmrc/stations/{station_code}",
        "Station detail",
        "dmrc",
        [
            (
                "station_code",
                "string",
                True,
                f"DMRC station code, e.g. {SAMPLE_STATION}, AIIMS, ASDM.",
            )
        ],
        [],
        "station_detail",
    ),
    (
        "GET",
        "/api/v1/dmrc/journeys/fare-route",
        "Fare and route",
        "dmrc",
        [],
        [
            ("from_station_code", "string", True, "Origin station code."),
            ("to_station_code", "string", True, "Destination station code."),
            (
                "strategy",
                "string",
                False,
                "`least-distance` (default) or `minimum-interchange`.",
            ),
            (
                "journey_time",
                "datetime",
                False,
                "Optional ISO-8601 departure time for timed planning.",
            ),
        ],
        "fare_route",
    ),
    (
        "GET",
        "/api/v1/dmrc/journeys/fare-route/least-distance",
        "Fare route · least distance",
        "dmrc",
        [],
        [
            ("from_station_code", "string", True, "Origin station code."),
            ("to_station_code", "string", True, "Destination station code."),
            ("journey_time", "datetime", False, "Optional ISO-8601 departure."),
        ],
        "fare_route",
    ),
    (
        "GET",
        "/api/v1/dmrc/journeys/fare-route/minimum-interchange",
        "Fare route · min interchange",
        "dmrc",
        [],
        [
            ("from_station_code", "string", True, "Origin station code."),
            ("to_station_code", "string", True, "Destination station code."),
            ("journey_time", "datetime", False, "Optional ISO-8601 departure."),
        ],
        "fare_route",
    ),
    (
        "GET",
        "/api/v1/dmrc/journeys/first-last-train",
        "First and last train",
        "dmrc",
        [],
        [
            ("from_station_code", "string", True, "Origin station code."),
            ("to_station_code", "string", True, "Destination station code."),
            (
                "strategy",
                "string",
                False,
                "`least-distance` (default) or `minimum-interchange`.",
            ),
        ],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/journeys/complete",
        "Complete journey plan (v1)",
        "dmrc",
        [],
        [
            ("from_station_code", "string", True, "Origin station code."),
            ("to_station_code", "string", True, "Destination station code."),
            ("journey_time", "datetime", False, "Optional ISO-8601 departure."),
        ],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/notifications",
        "Passenger notifications",
        "dmrc",
        [],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/notifications/{page_slug}",
        "Notification detail page",
        "dmrc",
        [
            (
                "page_slug",
                "string",
                True,
                "Page slug from the notifications feed.",
            )
        ],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/maps/assets",
        "List map assets",
        "dmrc",
        [],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/maps/{family}",
        "Map family summary",
        "dmrc",
        [
            (
                "family",
                "string",
                True,
                "`network`, `airport-express`, or `rapid-metro`.",
            )
        ],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/maps/{family}/assets",
        "Map assets by family",
        "dmrc",
        [
            (
                "family",
                "string",
                True,
                "`network`, `airport-express`, or `rapid-metro`.",
            )
        ],
        [
            (
                "format",
                "string",
                False,
                "`image`, `pdf`, or `any` (default).",
            )
        ],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/maps/{family}/download",
        "Redirect to map file",
        "dmrc",
        [
            (
                "family",
                "string",
                True,
                "`network`, `airport-express`, or `rapid-metro`.",
            )
        ],
        [
            (
                "format",
                "string",
                False,
                "`image`, `pdf`, or `any` (default).",
            )
        ],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/maps/{family}/file",
        "Proxy map file bytes",
        "dmrc",
        [
            (
                "family",
                "string",
                True,
                "`network`, `airport-express`, or `rapid-metro`.",
            )
        ],
        [
            (
                "format",
                "string",
                False,
                "`image`, `pdf`, or `any` (default).",
            )
        ],
        None,
    ),
    (
        "GET",
        "/api/v1/dmrc/maps/assets/{asset_id}",
        "Map asset by id",
        "dmrc",
        [("asset_id", "string", True, "Asset id from `/maps/assets`.")],
        [],
        None,
    ),
]

NMRC_ENDPOINTS: list[Endpoint] = [
    (
        "GET",
        "/api/v1/nmrc/lines",
        "List Aqua Line",
        "nmrc",
        [],
        [],
        "nmrc_lines",
    ),
    (
        "GET",
        "/api/v1/nmrc/lines/{line_code}/stations",
        "Aqua Line stations",
        "nmrc",
        [
            (
                "line_code",
                "string",
                True,
                f"NMRC line code. Currently only `{SAMPLE_NMRC_LINE}`.",
            )
        ],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/stations/search",
        "Search NMRC stations",
        "nmrc",
        [],
        [
            ("query", "string", False, "Station name keyword."),
            (
                "filter",
                "string",
                False,
                "`all` (default), `least-distance`, or `minimum-interchange`.",
            ),
        ],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/stations/{station_code}",
        "NMRC station detail",
        "nmrc",
        [
            (
                "station_code",
                "string",
                True,
                f"NMRC station code, e.g. {SAMPLE_NMRC_STATION}.",
            )
        ],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/notifications",
        "NMRC notifications",
        "nmrc",
        [],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/maps/assets",
        "NMRC map assets",
        "nmrc",
        [],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/maps/{family}",
        "NMRC map family",
        "nmrc",
        [
            (
                "family",
                "string",
                True,
                "Currently only `network` is populated for NMRC.",
            )
        ],
        [],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/maps/{family}/assets",
        "NMRC map assets by family",
        "nmrc",
        [("family", "string", True, "Map family, usually `network`.")],
        [
            (
                "format",
                "string",
                False,
                "`image`, `pdf`, or `any`. PDF is empty for NMRC.",
            )
        ],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/maps/{family}/download",
        "Redirect to NMRC map",
        "nmrc",
        [("family", "string", True, "Map family, usually `network`.")],
        [("format", "string", False, "`image`, `pdf`, or `any`.")],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/maps/{family}/file",
        "Proxy NMRC map file",
        "nmrc",
        [("family", "string", True, "Map family, usually `network`.")],
        [("format", "string", False, "`image`, `pdf`, or `any`.")],
        None,
    ),
    (
        "GET",
        "/api/v1/nmrc/maps/assets/{asset_id}",
        "NMRC map asset by id",
        "nmrc",
        [("asset_id", "string", True, "Asset id from `/nmrc/maps/assets`.")],
        [],
        None,
    ),
]

PLANNER_ENDPOINTS: list[Endpoint] = [
    (
        "GET",
        "/api/v2/journeys/plan",
        "Plan a journey (v2)",
        "planner",
        [],
        [
            (
                "from_station_code",
                "string",
                True,
                "Origin code in either DMRC or NMRC vocabulary.",
            ),
            (
                "to_station_code",
                "string",
                True,
                "Destination code in either DMRC or NMRC vocabulary.",
            ),
            (
                "strategy",
                "string",
                False,
                "`least-distance` (default) or `minimum-interchange`.",
            ),
            (
                "journey_time",
                "datetime",
                False,
                "ISO-8601 departure, Delhi local time. Affects applicable fare.",
            ),
            (
                "exclude_airport_line",
                "boolean",
                False,
                "Avoid Airport Express. Honoured by Sarthi only.",
            ),
            (
                "source",
                "string",
                False,
                "Pin to `sarthi` or `dmrc` instead of the fallback chain.",
            ),
            (
                "network",
                "string",
                False,
                "`dmrc` (default) or `nmrc`. Cross-network plans auto-stitch.",
            ),
        ],
        "planned_journey",
    ),
]

ALL_ENDPOINTS = (
    HEALTH_ENDPOINTS + DMRC_ENDPOINTS + NMRC_ENDPOINTS + PLANNER_ENDPOINTS
)

# Playground "run all" subset, stable, useful demos.
PLAYGROUND_CORE: list[Endpoint] = [
    HEALTH_ENDPOINTS[0],
    DMRC_ENDPOINTS[0],  # lines
    DMRC_ENDPOINTS[2],  # station search
    DMRC_ENDPOINTS[3],  # station detail
    DMRC_ENDPOINTS[4],  # fare-route
    PLANNER_ENDPOINTS[0],
    NMRC_ENDPOINTS[0],
]

_POSTHOG_SCRIPT = """
<script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;void 0!==a?u=e[a]=[]:a="posthog";u.people=u.people||[];u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e};u.people.toString=function(){return u.toString(1)+".people (stub)"};o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" ");for(n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_xxpoU7jHjt4nKAb4ygdiNwheukaBi7QvoAT4AsrdBcZC',{api_host:'/ph',ui_host:'https://eu.posthog.com',defaults:'2026-05-30'});
</script>
"""

_SEARCH_SVG = (
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round">'
    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5"/></svg>'
)

_GITHUB_ICON = (
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385'
    ".6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61"
    "-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084"
    "-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998"
    ".108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465"
    "-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23"
    ".96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23"
    " 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 "
    "4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896"
    "-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627"
    '-5.373-12-12-12"/></svg>'
)

# Simple metro mark for the brand glyph / favicon.
_METRO_PATH = (
    "M12 2C7.58 2 4 4.69 4 8v8.5c0 1.38 1.12 2.5 2.5 2.5h1.25l.75 2h1.5l.75-2"
    "h3.5l.75 2h1.5l.75-2H17.5c1.38 0 2.5-1.12 2.5-2.5V8c0-3.31-3.58-6-8-6zm"
    "-4 14.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5"
    " 1.5zm8 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5"
    "-1.5 1.5zM6.5 11V8.5c0-1.93 2.46-3.5 5.5-3.5s5.5 1.57 5.5 3.5V11H6.5z"
)

_ACCENT_INK = "#050506"
_FAVICON_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
    f'<rect width="24" height="24" rx="5" fill="{ACCENT}"/>'
    f'<g transform="translate(3 3) scale(0.75)" fill="{_ACCENT_INK}">'
    f'<path d="{_METRO_PATH}"/></g></svg>'
)
_FAVICON_LINK = (
    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,'
    + quote(_FAVICON_SVG)
    + '"/>'
)

_EXAMPLES: dict[str, object] = {
    "health": {"status": "ok"},
    "lines": [
        {
            "id": 3,
            "name": "Yellow Line",
            "line_color": "Yellow",
            "line_code": "LN3",
            "primary_color_code": "#FFD200",
            "secondary_color_code": None,
            "class_primary": "yellow",
            "class_secondary": None,
            "start_station": "Samaypur Badli",
            "end_station": "HUDA City Centre",
            "show_in_frontend": True,
            "status": "1",
        }
    ],
    "line_stations": [
        {
            "id": 1,
            "station_name": "Samaypur Badli",
            "station_code": "SPB",
            "station_facility": [],
            "metro_lines": [],
            "interchange": False,
            "status": "1",
        }
    ],
    "station_search": [
        {
            "id": 42,
            "station_name": "Rajiv Chowk",
            "station_code": "RC",
            "station_facility": [],
            "metro_lines": [
                {
                    "line_id": 3,
                    "line_code": "LN3",
                    "line_name": "Yellow Line",
                    "line_color": "Yellow",
                    "primary_color_code": "#FFD200",
                }
            ],
        }
    ],
    "station_detail": {
        "id": 12,
        "station_name": "Rajouri Garden",
        "station_code": "RG",
        "station_status": "1",
        "station_type": "Elevated",
        "latitude": "28.649",
        "longitude": "77.123",
        "metro_lines": [],
        "platforms": [],
        "gates": [],
        "station_facility": [],
    },
    "fare_route": {
        "from_station": "AIIMS",
        "to_station": "ASDM",
        "total_time": "00:28:00",
        "total_stations": 12,
        "fare": {"normal": 40, "special": 30},
        "route": [],
    },
    "nmrc_lines": [
        {
            "id": 1,
            "name": "Aqua Line",
            "line_color": "Aqua",
            "line_code": "AQUA",
            "primary_color_code": "#00A8E8",
            "secondary_color_code": None,
            "class_primary": "aqua",
            "class_secondary": None,
            "start_station": "Noida Sector 51",
            "end_station": "Depot Station",
            "show_in_frontend": True,
            "status": "1",
        }
    ],
    "planned_journey": {
        "source": "sarthi",
        "fallback_reason": None,
        "strategy": "least-distance",
        "from_station": {
            "name": "AIIMS",
            "code": "AIIMS",
            "slug": "aiims",
            "legacy_code": "AIIMS",
            "sarthi_code": "AIIMS",
        },
        "to_station": {
            "name": "Anand Vihar ISBT",
            "code": "ASDM",
            "slug": "anand-vihar-isbt",
            "legacy_code": "ASDM",
            "sarthi_code": "ASDM",
        },
        "total_time": "00:38:26",
        "total_distance_km": 18.4,
        "fare": {
            "normal": 50.0,
            "special": 40.0,
            "applicable": 50.0,
            "breakdown": [],
        },
        "legs": [
            {
                "kind": "metro",
                "network": "dmrc",
                "line_name": "Yellow Line",
                "line_color": "#FFD200",
                "from_station": "AIIMS",
                "to_station": "Rajiv Chowk",
                "platform_name": "Platform 1",
                "direction": "up",
                "towards_station": "Samaypur Badli",
                "duration": "00:10:00",
                "distance_km": 4.2,
            }
        ],
        "exclude_airport_line": False,
        "separate_tickets": False,
        "networks": ["dmrc"],
    },
    "error": {
        "detail": "Upstream DMRC request failed.",
        "upstream_status_code": 502,
    },
}


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _logo_svg() -> str:
    return (
        f'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
        f'<path d="{_METRO_PATH}"/></svg>'
    )


def _params_table(
    title: str,
    rows: list[tuple[str, str, bool, str]],
) -> str:
    if not rows:
        return (
            f'<div class="ep-sub">{title}</div>'
            '<p class="ep-note">None.</p>'
        )
    body = "".join(
        f'<tr><td><code>{_esc(name)}</code></td><td>{_esc(typ)}</td>'
        f'<td><span class="{"req" if req else "opt"}">'
        f'{"required" if req else "optional"}</span></td>'
        f"<td>{desc}</td></tr>"
        for name, typ, req, desc in rows
    )
    return (
        f'<div class="ep-sub">{title}</div>'
        '<table class="ptable"><thead><tr><th>Name</th><th>Type</th><th></th>'
        f"<th>Description</th></tr></thead><tbody>{body}</tbody></table>"
    )


def _endpoint_rows(endpoints: list[Endpoint]) -> str:
    out: list[str] = []
    for method, path, summary, _group, path_params, query_params, example_key in endpoints:
        ptable = _params_table("Path parameters", path_params)
        ptable += _params_table("Query parameters", query_params)

        if example_key and example_key in _EXAMPLES:
            example = json.dumps(_EXAMPLES[example_key], indent=2)
            block = (
                '<div class="ep-sub">Response &middot; 200 OK</div>'
                '<div class="code small"><div class="cap"><span class="dot"></span>'
                "application/json"
                f'<button class="copy">Copy</button></div>'
                f"<pre>{_esc(example)}</pre></div>"
            )
        elif path.rstrip("/").endswith(("/download", "/file")):
            block = (
                '<div class="ep-sub">Response</div>'
                '<p class="ep-note"><code class="ic">/download</code> returns a '
                "307 redirect to the upstream static URL. "
                '<code class="ic">/file</code> streams the bytes through this API.</p>'
            )
        else:
            block = (
                '<div class="ep-sub">Response &middot; 200 OK</div>'
                '<p class="ep-note">See the <a class="link" href="/docs">OpenAPI '
                "schema</a> for the exact response model, or try it in the "
                '<a class="link" href="/playground">playground</a>.</p>'
            )

        out.append(
            '<div class="ep"><button class="ep-head" aria-expanded="false">'
            f'<span class="verb">{method}</span>'
            f'<code class="ep-path">{_esc(path)}</code>'
            f'<span class="ep-desc">{_esc(summary)}</span>'
            '<span class="chev">&rsaquo;</span></button>'
            f'<div class="ep-body">{ptable}{block}</div></div>'
        )
    return "".join(out)


def _playground_rows(endpoints: list[Endpoint]) -> str:
    out: list[str] = []
    for method, path, summary, _group, path_params, query_params, _ex in endpoints:
        # Encode which form fields this endpoint needs.
        needs: list[str] = []
        for name, *_ in path_params:
            needs.append(name)
        for name, *_ in query_params:
            needs.append(name)
        needs_attr = ",".join(needs)

        body_seed = (
            '<pre class="pg-ep-resp"><span class="pg-placeholder">'
            "Run this endpoint to see the live response here."
            "</span></pre>"
        )
        out.append(
            f'<div class="ep" data-path="{_esc(path)}" '
            f'data-needs="{_esc(needs_attr)}">'
            '<div class="ep-head pg-row" role="button" tabindex="0">'
            f'<span class="verb">{method}</span>'
            f'<code class="ep-path">{_esc(path)}</code>'
            f'<span class="ep-desc">{_esc(summary)}</span>'
            '<span class="pg-status"></span>'
            '<button type="button" class="pg-run-btn">Run</button>'
            '<span class="chev">&rsaquo;</span>'
            "</div>"
            f'<div class="ep-body">{body_seed}</div>'
            "</div>"
        )
    return "".join(out)


def _topbar(show_menu_btn: bool = True) -> str:
    menu_btn = (
        '<button class="menu-btn" aria-label="Toggle navigation">&#9776;</button>'
        if show_menu_btn
        else ""
    )
    return f"""
<header class="topbar">
  {menu_btn}
  <a class="brand" href="/"><span class="glyph">{_logo_svg()}</span>{PLATFORM}<span class="sub">/ API</span></a>
  <nav class="topnav">
    <a href="/">Home</a>
    <a href="/docs">OpenAPI</a>
    <a href="/redoc">ReDoc</a>
    <a class="icon" href="https://github.com/{REPO}" target="_blank" rel="noreferrer" title="View source on GitHub" aria-label="GitHub repository">{_GITHUB_ICON}</a>
    <a class="cta" href="/playground">Try it</a>
  </nav>
</header>"""


_PLAYGROUND_JS = r"""
(function(){
  var STORE_KEY = 'pg_recent_' + PLATFORM_KEY;
  var form = document.querySelector('.pg-form');
  var fromInput = document.getElementById('pg-from');
  var toInput = document.getElementById('pg-to');
  var stationInput = document.getElementById('pg-station');
  var lineInput = document.getElementById('pg-line');
  var queryInput = document.getElementById('pg-query');
  var runAllBtn = document.querySelector('.pg-runall');
  var runAllDefaultHTML = runAllBtn.innerHTML;
  var progressEl = document.querySelector('.pg-progress');
  var progressBarEl = document.querySelector('.pg-progress-bar');
  var recentBox = document.querySelector('.pg-recent');
  var coreEps = Array.prototype.slice.call(document.querySelectorAll('.pg-core-list .ep'));
  var allEps = Array.prototype.slice.call(document.querySelectorAll('.ep[data-path]'));

  function values(){
    return {
      from_station_code: (fromInput.value || '').trim(),
      to_station_code: (toInput.value || '').trim(),
      station_code: (stationInput.value || '').trim(),
      line_code: (lineInput.value || '').trim(),
      query: (queryInput.value || '').trim(),
      page_slug: 'passenger-notice',
      family: 'network',
      asset_id: 'network-map',
      filter: 'all',
      strategy: 'least-distance',
      format: 'image',
      network: 'dmrc',
      exclude_airport_line: 'false'
    };
  }

  function getRecent(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }catch(e){ return []; } }
  function saveRecent(list){ localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 6))); }
  function pushRecent(label){
    var list = getRecent().filter(function(x){ return x !== label; });
    list.unshift(label);
    saveRecent(list);
    renderRecent();
  }
  function renderRecent(){
    var list = getRecent();
    if(!list.length){ recentBox.classList.remove('open'); recentBox.innerHTML=''; return; }
    recentBox.innerHTML = '<div class="pg-recent-head">Recent pairs<button type="button" class="pg-clear">Clear</button></div>' +
      list.map(function(h){ return '<button type="button" class="pg-recent-item">' + h.replace(/</g,'&lt;') + '</button>'; }).join('');
    recentBox.querySelector('.pg-clear').addEventListener('click', function(e){ e.stopPropagation(); saveRecent([]); renderRecent(); });
    Array.prototype.forEach.call(recentBox.querySelectorAll('.pg-recent-item'), function(b){
      b.addEventListener('click', function(){
        var parts = b.textContent.split(/\s*[→->]\s*/);
        if(parts[0]) fromInput.value = parts[0].trim();
        if(parts[1]) toInput.value = parts[1].trim();
        recentBox.classList.remove('open');
      });
    });
  }
  renderRecent();
  fromInput.addEventListener('focus', function(){ if(getRecent().length) recentBox.classList.add('open'); });
  document.addEventListener('click', function(e){ if(!recentBox.contains(e.target) && e.target !== fromInput) recentBox.classList.remove('open'); });

  function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function buildUrl(tmpl, needs){
    var v = values();
    var path = tmpl.replace(/\{([^}]+)\}/g, function(_, key){
      var val = v[key];
      if(val === undefined || val === ''){
        if(key === 'station_code') val = v.station_code || v.from_station_code;
        if(key === 'line_code') val = v.line_code;
      }
      return encodeURIComponent(val || '');
    });
    var q = [];
    var needList = (needs || '').split(',').filter(Boolean);
    needList.forEach(function(key){
      if(tmpl.indexOf('{' + key + '}') !== -1) return;
      var val = v[key];
      if(val === undefined || val === '') return;
      if(key === 'query' && val === '') return;
      q.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
    });
    // Always attach journey pair for journey endpoints even if not listed
    // (path-only endpoints ignore unused query keys).
    if(tmpl.indexOf('/journeys/') !== -1){
      if(v.from_station_code && path.indexOf('from_station_code=') === -1 &&
         needList.indexOf('from_station_code') === -1){
        q.push('from_station_code=' + encodeURIComponent(v.from_station_code));
      }
      if(v.to_station_code && path.indexOf('to_station_code=') === -1 &&
         needList.indexOf('to_station_code') === -1){
        q.push('to_station_code=' + encodeURIComponent(v.to_station_code));
      }
    }
    return path + (q.length ? '?' + q.join('&') : '');
  }

  function isPlainObject(v){ return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isScalar(v){ return v === null || typeof v !== 'object'; }
  function fmtScalar(v){
    if(v === null || v === undefined || v === '') return '\u2014';
    if(typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  }
  function humanize(key){
    return String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
      .replace(/^./, function(c){ return c.toUpperCase(); });
  }
  function renderScalarGrid(obj, keys){
    return '<div class="pg-cards">' + keys.map(function(k){
      var v = fmtScalar(obj[k]);
      return '<div class="pg-card"><div class="pg-card-lbl">' + escHtml(humanize(k)) + '</div>' +
        '<div class="pg-card-val" title="' + escHtml(v) + '">' + escHtml(v) + '</div></div>';
    }).join('') + '</div>';
  }
  function renderTable(rows){
    var cap = 25;
    var cols = [];
    rows.slice(0, cap).forEach(function(r){
      if(isPlainObject(r)){
        Object.keys(r).forEach(function(k){ if(cols.indexOf(k) === -1) cols.push(k); });
      }
    });
    if(!cols.length){
      return '<div class="pg-chips">' + rows.slice(0, cap).map(function(v){
        return '<span class="pg-chip">' + escHtml(fmtScalar(v)) + '</span>';
      }).join('') + '</div>';
    }
    cols = cols.slice(0, 8);
    var thead = '<tr>' + cols.map(function(c){ return '<th>' + escHtml(humanize(c)) + '</th>'; }).join('') + '</tr>';
    var tbody = rows.slice(0, cap).map(function(r){
      return '<tr>' + cols.map(function(c){
        var v = isPlainObject(r) ? r[c] : undefined;
        var text = v === undefined ? '\u2014' : (isScalar(v) ? fmtScalar(v) : JSON.stringify(v));
        return '<td title="' + escHtml(text) + '">' + escHtml(text) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var note = rows.length > cap ? '<p class="pg-table-note">Showing ' + cap + ' of ' + rows.length + ' rows.</p>' : '';
    return '<div class="pg-table-wrap"><table class="pg-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>' + note;
  }
  function renderSection(label, html){
    return '<div class="pg-section"><div class="pg-section-lbl">' + escHtml(label) + '</div>' + html + '</div>';
  }
  function renderNode(value){
    if(Array.isArray(value)) return value.length ? renderTable(value) : '<p class="pg-empty">Empty list.</p>';
    if(!isPlainObject(value)) return '<p class="pg-empty">' + escHtml(fmtScalar(value)) + '</p>';
    var keys = Object.keys(value);
    if(!keys.length) return '<p class="pg-empty">Empty response.</p>';
    var scalarKeys = keys.filter(function(k){ return isScalar(value[k]); });
    var complexKeys = keys.filter(function(k){ return !isScalar(value[k]); });
    var out = scalarKeys.length ? renderScalarGrid(value, scalarKeys) : '';
    complexKeys.forEach(function(k){
      var v = value[k];
      var inner;
      if(Array.isArray(v)){
        inner = v.length ? renderTable(v) : '<p class="pg-empty">Empty list.</p>';
      } else {
        var subKeys = Object.keys(v);
        inner = (subKeys.length && subKeys.every(function(sk){ return isScalar(v[sk]); }))
          ? renderScalarGrid(v, subKeys)
          : '<pre class="pg-ep-resp">' + escHtml(JSON.stringify(v, null, 2)) + '</pre>';
      }
      out += renderSection(humanize(k), inner);
    });
    return out;
  }

  function runOne(ep){
    var tmpl = ep.getAttribute('data-path');
    var needs = ep.getAttribute('data-needs') || '';
    var v = values();
    if(needs.indexOf('from_station_code') !== -1 && !v.from_station_code){ fromInput.focus(); return Promise.resolve(); }
    if(needs.indexOf('to_station_code') !== -1 && !v.to_station_code){ toInput.focus(); return Promise.resolve(); }
    if(needs.indexOf('station_code') !== -1 && !v.station_code && !v.from_station_code){ stationInput.focus(); return Promise.resolve(); }
    if(needs.indexOf('line_code') !== -1 && !v.line_code){ lineInput.focus(); return Promise.resolve(); }
    var url = buildUrl(tmpl, needs);
    var status = ep.querySelector('.pg-status');
    var body = ep.querySelector('.ep-body');
    var runBtn = ep.querySelector('.pg-run-btn');
    var runBtnHTML = runBtn.innerHTML;
    ep.classList.add('open', 'busy');
    ep.classList.remove('ok', 'err');
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="pg-spinner"></span>';
    status.innerHTML = '<span class="pg-spinner"></span>';
    status.className = 'pg-status busy';
    body.innerHTML = '<div class="pg-ep-loading"><div class="req"><span class="pg-spinner"></span>Requesting ' + escHtml(url) + '\u2026</div>' +
      '<div class="pg-skel w90"></div><div class="pg-skel w70"></div><div class="pg-skel w50"></div><div class="pg-skel w35"></div></div>';
    var start = performance.now();
    return fetch(url).then(function(r){
      var ms = Math.round(performance.now() - start);
      var ctype = (r.headers.get('content-type') || '').toLowerCase();
      if(ctype.indexOf('image/') === 0 || ctype.indexOf('application/pdf') === 0 || ctype.indexOf('application/octet') === 0){
        return r.blob().then(function(blob){
          ep.classList.remove('busy');
          ep.classList.add(r.ok ? 'ok' : 'err');
          status.textContent = r.status + ' \u00b7 ' + ms + 'ms';
          status.className = 'pg-status ' + (r.ok ? 'ok' : 'err');
          var meta = '<div class="pg-ep-meta"><span class="url">GET ' + escHtml(url) + '</span><button type="button" class="pg-copy">Copy URL</button></div>';
          if(ctype.indexOf('image/') === 0){
            var objUrl = URL.createObjectURL(blob);
            body.innerHTML = meta + '<div class="pg-ep-svg"><img alt="map asset" src="' + objUrl + '"/></div>';
          } else {
            body.innerHTML = meta + '<p class="pg-empty">Binary response (' + escHtml(ctype || 'unknown') + ', ' + blob.size + ' bytes).</p>';
          }
          body.querySelector('.pg-copy').addEventListener('click', function(e){
            e.stopPropagation();
            navigator.clipboard.writeText(url).then(function(){
              var b = e.currentTarget, t = b.textContent;
              b.textContent = 'Copied'; setTimeout(function(){ b.textContent = t; }, 1200);
            });
          });
        });
      }
      return r.text().then(function(text){
        var parsed = null;
        try{ parsed = JSON.parse(text); }catch(e){}
        var pretty = parsed !== null ? JSON.stringify(parsed, null, 2) : text;
        var formatted = parsed !== null ? renderNode(parsed) : '';
        ep.classList.remove('busy');
        ep.classList.add(r.ok ? 'ok' : 'err');
        status.textContent = r.status + ' \u00b7 ' + ms + 'ms';
        status.className = 'pg-status ' + (r.ok ? 'ok' : 'err');
        var meta = '<div class="pg-ep-meta"><span class="url">GET ' + escHtml(url) + '</span><button type="button" class="pg-copy">Copy</button></div>';
        var tabs = formatted
          ? '<div class="pg-tabs"><button type="button" class="pg-tab-btn active" data-view="pretty">Formatted</button>' +
            '<button type="button" class="pg-tab-btn" data-view="raw">Raw JSON</button></div>'
          : '';
        var prettyView = '<div class="pg-view" data-view="pretty"' + (formatted ? '' : ' hidden') + '>' + formatted + '</div>';
        var rawView = '<div class="pg-view" data-view="raw"' + (formatted ? ' hidden' : '') + '><pre class="pg-ep-resp">' + escHtml(pretty) + '</pre></div>';
        body.innerHTML = meta + tabs + prettyView + rawView;
        body.querySelector('.pg-copy').addEventListener('click', function(e){
          e.stopPropagation();
          navigator.clipboard.writeText(pretty).then(function(){
            var b = e.currentTarget, t = b.textContent;
            b.textContent = 'Copied'; setTimeout(function(){ b.textContent = t; }, 1200);
          });
        });
        Array.prototype.forEach.call(body.querySelectorAll('.pg-tab-btn'), function(btn){
          btn.addEventListener('click', function(e){
            e.stopPropagation();
            var view = btn.getAttribute('data-view');
            Array.prototype.forEach.call(body.querySelectorAll('.pg-tab-btn'), function(b){ b.classList.toggle('active', b === btn); });
            Array.prototype.forEach.call(body.querySelectorAll('.pg-view'), function(v){ v.hidden = v.getAttribute('data-view') !== view; });
          });
        });
      });
    }).catch(function(err){
      ep.classList.remove('busy'); ep.classList.add('err');
      status.textContent = 'error'; status.className = 'pg-status err';
      body.innerHTML = '<div class="pg-ep-loading">' + escHtml(err.message || 'Request failed.') + '</div>';
    }).finally(function(){ runBtn.disabled = false; runBtn.innerHTML = runBtnHTML; });
  }

  allEps.forEach(function(ep){
    var head = ep.querySelector('.ep-head');
    var runBtn = ep.querySelector('.pg-run-btn');
    head.addEventListener('click', function(){ ep.classList.toggle('open'); });
    head.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); ep.classList.toggle('open'); } });
    runBtn.addEventListener('click', function(e){ e.stopPropagation(); runOne(ep); });
  });

  var moreToggle = document.querySelector('.pg-legacy-toggle');
  if(moreToggle){
    moreToggle.addEventListener('click', function(){
      var list = document.querySelector('.pg-more-list');
      var open = list.classList.toggle('open');
      moreToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = values();
    if(!v.from_station_code || !v.to_station_code){
      fromInput.classList.remove('shake');
      void fromInput.offsetWidth;
      fromInput.classList.add('shake');
      fromInput.focus();
      return;
    }
    recentBox.classList.remove('open');
    pushRecent(v.from_station_code + ' \u2192 ' + v.to_station_code);
    if(!v.station_code) stationInput.value = v.from_station_code;
    runAllBtn.disabled = true;
    var total = coreEps.length, done = 0;
    if(progressEl) progressEl.classList.add('active');
    if(progressBarEl) progressBarEl.style.width = '0%';
    runAllBtn.innerHTML = '<span class="pg-spinner"></span>Running 0/' + total;
    function tick(){
      done++;
      runAllBtn.innerHTML = '<span class="pg-spinner"></span>Running ' + done + '/' + total;
      if(progressBarEl) progressBarEl.style.width = Math.round((done / total) * 100) + '%';
    }
    Promise.all(coreEps.map(function(ep){ return runOne(ep).then(tick); })).finally(function(){
      runAllBtn.disabled = false;
      runAllBtn.innerHTML = runAllDefaultHTML;
      if(progressEl) setTimeout(function(){ progressEl.classList.remove('active'); }, 400);
    });
  });
})();
"""

_EXTRA_CSS = """
.pg-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.pg-fields .pg-input-wrap{position:relative}
.pg-fields label{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-family:var(--mono);margin:0 0 5px}
@media(max-width:640px){.pg-fields{grid-template-columns:1fr}}
.pg-more-list{display:none}
.pg-more-list.open{display:grid}
"""


def _playground_html() -> str:
    core_rows = _playground_rows(PLAYGROUND_CORE)
    more = [ep for ep in ALL_ENDPOINTS if ep not in PLAYGROUND_CORE]
    more_rows = _playground_rows(more)

    body = f"""
{_topbar(show_menu_btn=False)}
<main class="pg-main">
  <div class="pg-eyebrow">Live playground &middot; {PLATFORM}</div>
  <h1 class="pg-h1">Try the Delhi NCR Metro API live</h1>
  <p class="pg-sub">Pick two stations once and hit Run on anything below. No keys, no local setup. The page calls the live API straight from your browser, and journey endpoints reuse your <code class="ic">from</code> and <code class="ic">to</code> so you are not retyping codes.</p>

  <div class="pg-bar">
    <form class="pg-form" autocomplete="off">
      <div class="pg-fields">
        <div class="pg-input-wrap">
          <label for="pg-from">From station</label>
          <input class="pg-input" id="pg-from" type="text" value="{SAMPLE_FROM}" placeholder="e.g. {SAMPLE_FROM}" aria-label="From station code"/>
          <div class="pg-recent"></div>
        </div>
        <div class="pg-input-wrap">
          <label for="pg-to">To station</label>
          <input class="pg-input" id="pg-to" type="text" value="{SAMPLE_TO}" placeholder="e.g. {SAMPLE_TO}" aria-label="To station code"/>
        </div>
        <div class="pg-input-wrap">
          <label for="pg-station">Station code</label>
          <input class="pg-input" id="pg-station" type="text" value="{SAMPLE_STATION}" placeholder="e.g. {SAMPLE_STATION}" aria-label="Station code"/>
        </div>
        <div class="pg-input-wrap">
          <label for="pg-line">Line code</label>
          <input class="pg-input" id="pg-line" type="text" value="{SAMPLE_LINE}" placeholder="e.g. {SAMPLE_LINE}" aria-label="Line code"/>
        </div>
        <div class="pg-input-wrap" style="grid-column:1/-1">
          <label for="pg-query">Search query</label>
          <input class="pg-input" id="pg-query" type="text" value="rajiv" placeholder="station search keyword" aria-label="Search query"/>
        </div>
      </div>
      <div class="pg-bar-row">
        <button class="pg-btn pg-runall" type="submit" style="width:100%;height:42px">{_SEARCH_SVG}Run core endpoints</button>
      </div>
      <div class="pg-progress"><div class="pg-progress-bar"></div></div>
    </form>
    <p class="pg-hint">Defaults plan {SAMPLE_FROM} &rarr; {SAMPLE_TO} on the v2 planner. Prefer raw JSON? Open <a class="link" href="{TRY_PATH}">{TRY_PATH}</a>.</p>
  </div>

  <div class="pg-group-label"><span>Core endpoints &middot; {len(PLAYGROUND_CORE)}</span></div>
  <div class="eps pg-core-list pg-canonical-list">{core_rows}</div>

  <div class="pg-group-label">
    <span>All endpoints &middot; {len(more)}</span>
    <button type="button" class="pg-legacy-toggle" aria-expanded="false">Show<span class="chev">&rsaquo;</span></button>
  </div>
  <div class="eps pg-more-list">{more_rows}</div>

  <p class="pg-foot-note">Source on <a class="link" href="https://github.com/{REPO}" target="_blank" rel="noreferrer">GitHub</a>.</p>
</main>
"""
    script = f"var PLATFORM_KEY={json.dumps(PLATFORM_KEY)};{_PLAYGROUND_JS}"
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"/>'
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>'
        + _FAVICON_LINK
        + f"<title>{PLATFORM} Playground</title>"
        '<link rel="preconnect" href="https://fonts.googleapis.com"/>'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>'
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>'
        f"<style>:root{{--accent:{ACCENT};}}</style>"
        f"<style>{_BASE_CSS}{_PLAYGROUND_CSS}{_EXTRA_CSS}</style></head><body>"
        f"{body}<script>{script}</script></body></html>"
    )


def _docs_html() -> str:
    health = _endpoint_rows(HEALTH_ENDPOINTS)
    dmrc = _endpoint_rows(DMRC_ENDPOINTS)
    nmrc = _endpoint_rows(NMRC_ENDPOINTS)
    planner = _endpoint_rows(PLANNER_ENDPOINTS)

    curl_sample = (
        f'<span class="cmt"># Plan a journey (v2 · Sarthi with DMRC fallback)</span>\n'
        f"curl '<span data-origin></span>/api/v2/journeys/plan"
        f"?from_station_code={SAMPLE_FROM}"
        f"&to_station_code={SAMPLE_TO}"
        f"&strategy=least-distance'"
    )
    curl_lines = (
        f'<span class="cmt"># List Delhi Metro lines</span>\n'
        f"curl <span data-origin></span>/api/v1/dmrc/lines"
    )
    error_sample = _esc(json.dumps(_EXAMPLES["error"], indent=2))
    plan_sample = _esc(json.dumps(_EXAMPLES["planned_journey"], indent=2))

    body = f"""
{_topbar()}
<div class="wrap">
  <aside class="side">
    <div class="search">{_SEARCH_SVG}<input placeholder="Search the docs..." aria-label="Search"/><kbd>/</kbd></div>
    <div class="navgroup"><h4>Get Started</h4>
      <a href="#introduction" data-nav>Introduction</a>
      <a href="#quickstart" data-nav>Quickstart</a>
      <a href="#errors" data-nav>Errors</a>
      <a href="#versions" data-nav>API versions</a>
    </div>
    <div class="navgroup"><h4>Endpoints</h4>
      <a href="#health" data-nav>Health</a>
      <a href="#dmrc" data-nav>DMRC (v1)</a>
      <a href="#nmrc" data-nav>NMRC (v1)</a>
      <a href="#planner" data-nav>Planner (v2)</a>
    </div>
    <div class="navgroup"><h4>Reference</h4>
      <a href="/playground">Live Playground</a>
      <a href="/docs">OpenAPI Explorer</a>
      <a href="/redoc">ReDoc</a>
      <a href="https://github.com/{REPO}" target="_blank" rel="noreferrer">GitHub &#8599;</a>
    </div>
  </aside>

  <main class="doc">
    <section id="introduction">
      <div class="eyebrow">NCR Metro API &middot; DMRC + NMRC</div>
      <h1 class="title">{PLATFORM} API</h1>
      <p class="lede">If you have ever tried to build anything on top of Delhi's metro data, you know it is a patchwork. Official endpoints that disagree, an Aqua Line with no API at all, and map files that change names every deploy. This API cleans that up.</p>
      <p class="lede">{DESCRIPTION}</p>
      <p class="lede">It is a thin, typed wrapper. Pydantic everywhere, one predictable error shape whether you messed up or an upstream did, and the same schemas for Delhi and Noida so your app does not need two code paths. REST and JSON, no auth. If you can fetch, you can use it. <code class="ic">/api/v1</code> mirrors the operators one for one, <code class="ic">/api/v2</code> is the nicer planner that prefers Sarthi and falls back to the legacy route when it has to.</p>
      <div class="metarow">
        <span class="chip">REST</span>
        <span class="chip">JSON</span>
        <span class="chip">No auth</span>
        <span class="chip">v1 + v2</span>
        <span class="chip">DMRC &middot; NMRC</span>
      </div>
    </section>

    <div class="steps">
      <section class="section" id="quickstart">
        <div class="section-head"><span class="step">1</span><h2>Make your first request</h2></div>
        <p>No API key, no ceremony. Plan a journey or list every line with curl. On the v2 planner you can mix station codes from either operator and the API handles the translation for you.</p>
        <div class="code">
          <div class="cap"><span class="dot"></span>Terminal<button class="copy">Copy</button></div>
          <pre>{curl_sample}</pre>
        </div>
        <div class="code">
          <div class="cap"><span class="dot"></span>Terminal<button class="copy">Copy</button></div>
          <pre>{curl_lines}</pre>
        </div>
        <div class="callout">
          <span class="ic">i</span>
          <div><span class="t">Tip</span>
            <p>Prefer a browser? Use the <a class="link" href="/playground">live playground</a>, open <a class="link" href="{TRY_PATH}">a sample plan</a>, or explore every route in the <a class="link" href="/docs">OpenAPI explorer</a>.</p>
          </div>
        </div>
      </section>

      <section class="section" id="errors">
        <div class="section-head"><span class="step">2</span><h2>Error envelope</h2></div>
        <p>Success returns the payload directly, no wrapper. Failures all look the same, which is on purpose. You get a <code class="ic">detail</code> string and, when an upstream is to blame, the status it returned.</p>
        <div class="code">
          <div class="cap"><span class="dot"></span>4xx / 502 &middot; application/json<button class="copy">Copy</button></div>
          <pre>{error_sample}</pre>
        </div>
        <p style="margin-top:12px"><code class="ic">400</code> / <code class="ic">404</code> are caller-visible request errors (<code class="ic">upstream_status_code</code> is <code class="ic">null</code>). <code class="ic">502</code> means the upstream DMRC, Sarthi, or NMRC request failed.</p>
      </section>

      <section class="section" id="versions">
        <div class="section-head"><span class="step">3</span><h2>API versions</h2></div>
        <p><code class="ic">/api/v1</code> is literal. It mirrors what each operator actually publishes, DMRC's JSON and NMRC's HTML, without pretending they are one system. <code class="ic">/api/v2</code> is the opinionated planner. Sarthi answers first because its data is richer, legacy DMRC fills in when Sarthi fails, and trips that cross from Delhi to Noida are stitched automatically at the Sector 52 to 51 walk.</p>
        <div class="code small">
          <div class="cap"><span class="dot"></span>200 OK &middot; PlannedJourney<button class="copy">Copy</button></div>
          <pre>{plan_sample}</pre>
        </div>
      </section>

      <section class="section" id="health">
        <div class="section-head"><span class="step">4</span><h2>Health</h2></div>
        <p>Liveness probe for deploys and local development.</p>
        <div class="eps">{health}</div>
      </section>

      <section class="section" id="dmrc">
        <div class="section-head"><span class="step">5</span><h2>DMRC endpoints (v1)</h2></div>
        <p>All the Delhi Metro primitives. Lines, stations, journeys, notifications, and map assets. Open any route for params and a real sample payload.</p>
        <div class="eps">{dmrc}</div>
      </section>

      <section class="section" id="nmrc">
        <div class="section-head"><span class="step">6</span><h2>NMRC endpoints (v1)</h2></div>
        <p>The Aqua Line, same shapes and schemas as Delhi Metro so your client does not branch. The data comes from NMRC's public pages, parsed on the server, with checked-in tables as fallback when the HTML is unavailable.</p>
        <div class="eps">{nmrc}</div>
      </section>

      <section class="section" id="planner">
        <div class="section-head"><span class="step">7</span><h2>Journey planner (v2)</h2></div>
        <p>One clean <code class="ic">PlannedJourney</code> no matter who answered. Cross-network trips come back with <code class="ic">source: "combined"</code>, a walking leg for the Sector 52 to 51 bridge, and fares split in <code class="ic">fare.breakdown</code> because the two systems do not share tickets.</p>
        <div class="eps">{planner}</div>
      </section>
    </div>

    <div class="foot">
      <span>{PLATFORM} API &middot; open source</span>
      <span><a href="/docs">OpenAPI</a> &middot; <a href="/redoc">ReDoc</a> &middot; <a href="https://github.com/{REPO}">GitHub</a></span>
    </div>
  </main>

  <aside class="toc">
    <h5>On this page</h5>
    <a href="#introduction" data-toc>Introduction</a>
    <a href="#quickstart" data-toc>Quickstart</a>
    <a href="#errors" data-toc>Errors</a>
    <a href="#versions" data-toc>API versions</a>
    <a href="#health" data-toc>Health</a>
    <a href="#dmrc" data-toc>DMRC (v1)</a>
    <a href="#nmrc" data-toc>NMRC (v1)</a>
    <a href="#planner" data-toc>Planner (v2)</a>
  </aside>
</div>
"""

    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"/>'
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>'
        + _FAVICON_LINK
        + f"<title>{PLATFORM} API</title>"
        '<meta name="description" content="'
        + _esc(DESCRIPTION)
        + '"/>'
        '<link rel="preconnect" href="https://fonts.googleapis.com"/>'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>'
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>'
        f"<style>:root{{--accent:{ACCENT};}}</style>"
        f"<style>{_BASE_CSS}</style></head><body>"
        f"{body}<script>{_JS}</script>{_POSTHOG_SCRIPT}</body></html>"
    )


@router.api_route(
    "/ph/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=False,
)
async def posthog_proxy(path: str, request: Request) -> Response:
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length"}
    }
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        upstream = await client.request(
            request.method,
            f"{POSTHOG_PROXY_HOST}/{path}",
            params=request.query_params,
            content=await request.body(),
            headers=headers,
        )
    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in {"connection", "content-encoding", "transfer-encoding"}
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
    )


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
async def docs() -> HTMLResponse:
    return HTMLResponse(_docs_html())


@router.get("/playground", response_class=HTMLResponse, include_in_schema=False)
async def playground() -> HTMLResponse:
    return HTMLResponse(_playground_html())
