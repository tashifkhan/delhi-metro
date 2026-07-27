# Delhi Metro Sarthi route-planner research

Research date: 27 July 2026

## Executive finding

The current Delhi Metro Sarthi Android app does **not** make a journey API
request when a user plans an ordinary Metro-to-Metro trip. It reads a complete
precomputed route matrix from a bundled SQLite database and enriches that
record locally.

The app bundle also contains an older HTTP route client. Its endpoint is still
live, public, and substantially richer than the API behind
`delhimetrorail.com`:

```http
GET https://dmrc.autope.in/metro/v4/journey/{from}/{to}/{strategy}/{date_time}
    ?exclude_airport_line={true|false}
```

No access token, API key, cookie, `Referer`, or app-specific header was needed
in live tests. This is the practical API candidate for this project, with the
stability and licensing caveats below.

## Provenance

- Official Android package: `com.sraoss.dmrc`
- App version inspected: `2.1.17` (`versionCode` 20117)
- Google Play listing:
  <https://play.google.com/store/apps/details?id=com.sraoss.dmrc>
- APK signing certificate SHA-256:
  `a69bb3c9e277abb88cb795e5a65bbf46703a14c8a0a4b3f6102b781d2fdb7762`
- Runtime/API host: `https://dmrc.autope.in`
- App implementation: React Native with a Hermes bytecode bundle

The package name and signing certificate were checked before inspecting the
bundle. No user account, payment flow, private user data, or authenticated API
was used.

## Route request

### Path parameters

| Parameter | Values/format | Notes |
| --- | --- | --- |
| `from` | Station code | Uppercase, for example `AIIMS` |
| `to` | Station code | Uppercase, for example `ASDM` |
| `strategy` | `least-distance` or `minimum-interchange` | Both exist in the app and bundled matrix |
| `date_time` | `YYYY-MM-DDTHH:mm` | Delhi local time; the app uses this exact format |

### Query parameter

| Parameter | Values | Notes |
| --- | --- | --- |
| `exclude_airport_line` | `true` or `false` | This is a query parameter, not the final path segment |

The last path segment is easy to misidentify. The decompiled path builder
takes four values, but the fourth is the journey date/time. Airport exclusion
is passed separately as a query parameter.

### Reproducible request

```bash
curl -sS -G \
  "https://dmrc.autope.in/metro/v4/journey/AIIMS/ASDM/least-distance/2026-07-27T20:01" \
  --data-urlencode "exclude_airport_line=false" |
  jq .
```

Test result for AIIMS to Akshardham:

```json
{
  "from": "AIIMS",
  "from_code": "AIIMS",
  "to": "AKSHARDHAM",
  "to_code": "ASDM",
  "applicableFare": 43,
  "fare": {"normal": 43, "special": 33},
  "metroTime": {"first": "05:32:19", "last": "23:04:25"},
  "stations": 14,
  "total_time": "31 mins",
  "total_distance": 14.171,
  "ticketAvailable": false
}
```

The full response also contained:

- `fare_breakup[]`
- `from_station_status` and `to_station_status`
- `routes[]`
- `interchanges[]`
- `serviceStatus`

Each `routes[]` item contained:

- line name, color, and number
- start/end station names and codes
- direction (`up` or `down`)
- platform number
- ordered station objects
- map edge IDs
- toward/terminus station
- segment time and distance
- calculated start/end times
- interchange time

For the tested trip the two route legs were:

1. Yellow Line, AIIMS to Rajiv Chowk, Platform 2, toward Samaypur Badli.
2. Blue Line, Rajiv Chowk to Akshardham, Platform 3, toward Noida Electronic
   City.

### Airport exclusion is functional

New Delhi (`NDI`) to Dwarka Sector 21 (`DSTO`) at the same time:

| Query | Result |
| --- | --- |
| `exclude_airport_line=false` | Orange Line, 6 stations, 22.297 km, 24 min |
| `exclude_airport_line=true` | Yellow + Blue, 30 stations, 32.015 km, 64 min |

## Station and line discovery

The app requests all stations with a high page limit:

```http
GET https://dmrc.autope.in/metro/v4/stations?page=0&limit=500
```

Observed response envelope:

```json
{
  "results": [],
  "page": 1,
  "limit": 500,
  "totalPages": 1,
  "totalResults": 254
}
```

A station record includes `code`, `name`, `commercialName`, line metadata,
status, latitude/longitude, search key, facilities, ticketing identifiers, and
version. One upstream quirk: the `geoloc.coordinates` array was observed in
latitude/longitude order even though GeoJSON normally requires
longitude/latitude. Some nested records also expose a correctly ordered
`geoFormatted` field.

Lines are available at:

```http
GET https://dmrc.autope.in/metro/v4/lines/?page=0&limit=100
```

The line result includes station order, endpoints, distance, line colors,
service state, station count, journey time, and maximum fare.

Rich station detail is available at:

```http
GET https://dmrc.autope.in/metro/v4/stations/api/{station_code}
```

## Why the Android planner works differently

The APK contains these two database assets:

- `DMRC_METRO_v7.5.db` — 148,951,040 bytes
- `DMRC_STATIC_v5.1.db` — 32,854,016 bytes

The principal route database has:

```sql
CREATE TABLE route(
  route_name TEXT PRIMARY KEY,
  val TEXT
);
CREATE TABLE fares(
  from_to TEXT,
  normal NUMBER NOT NULL,
  special NUMBER NOT NULL,
  version INTEGER,
  PRIMARY KEY(from_to)
);
CREATE TABLE firstLastTime(
  from_to TEXT PRIMARY KEY,
  first VARCHAR(20),
  last VARCHAR(20),
  version INTEGER
);
CREATE TABLE StationNames(
  stationCode TEXT,
  valueEn TEXT,
  valueHi TEXT,
  version INTEGER
);
```

There were 255 stations and exactly 259,080 route rows:

```text
255 origins × 254 other destinations ×
2 strategies × 2 airport-exclusion choices = 259,080
```

The lookup key is:

```text
{from}|{to}|{least-distance|minimum-interchange}|{false|true}
```

Example:

```text
AIIMS|ASDM|least-distance|false
```

The stored value is compact JSON:

```json
{
  "total_distance": 14.171,
  "from": "AIIMS",
  "to": "ASDM",
  "stations": 14,
  "lines": ["LN2", "LN3"],
  "total_time": 1844,
  "interchanges": [
    {
      "path": ["AIIMS", "INA", "JB", "LKM", "UDB", "CTST", "PTCK", "RCK"],
      "line": "LN2",
      "start": "AIIMS",
      "end": "RCK"
    },
    {
      "path": ["RCK", "BRKR", "MDHS", "PTMD", "IDPT", "YB", "ASDM"],
      "line": "LN3",
      "start": "RCK",
      "end": "ASDM"
    }
  ]
}
```

The app then resolves names, line metadata, platform/direction, fare, and
first/last-train information from the other local tables.

In a live emulator trace, pressing **View Route** for AIIMS to Akshardham
caused no `/journey/...` request. The result screen appeared from the SQLite
lookup. The only request at that transition was the unrelated app-version
check:

```http
GET https://dmrc.autope.in/metro/v4/update/updateApp
```

The route database is not downloaded by an update API in the inspected build;
it is packaged with the APK. A new APK can therefore carry a new matrix.

## Comparison with the current website API

For AIIMS to Akshardham on the same research date:

| Source/strategy | Route | Stations | Reported time |
| --- | --- | ---: | ---: |
| Website `least-distance` | Yellow → Pink → Blue | 9 | 38:26 |
| Website `minimum-interchange` | Yellow → Blue | 14 | 33:02 |
| Sarthi `least-distance` | Yellow → Blue | 14 | 31 min |
| Sarthi `minimum-interchange` | Yellow → Blue | 14 | 31 min |

The Sarthi response is richer and its precomputed recommendation is faster for
this example. It also supplies platform, direction, toward-station, status,
distance, and fare-breakdown fields in one response.

## Observed quirks and risks

1. **Undocumented/vendor-operated:** `dmrc.autope.in` is used by the official
   app but is not a published DMRC developer API. Public reachability is not a
   grant of redistribution or long-term use rights.
2. **No browser CORS:** responses did not include
   `Access-Control-Allow-Origin`. Call it server-side, not directly from the
   web/mobile JavaScript layer.
3. **Error semantics:** invalid station codes, invalid strategies, and
   same-origin/destination requests returned HTTP 500 with a generic message,
   rather than a client-friendly 4xx.
4. **Date/time semantics:** the date affects `applicableFare` (a Sunday test
   selected the special fare), but observed route-segment `start_time` values
   followed the server's current time rather than a requested future time.
   Treat those dynamic segment timestamps as unreliable until more cases are
   characterized.
5. **Directory inconsistencies:** the lines envelope reported 12 total records
   while returning 11 visible line records in one live request.
6. **Contract drift:** fields and station data can change independently of this
   repository.
7. **Unrelated endpoints:** `/journey-planner/plan-my-journey` and
   `/journey-planner/plan-enquiry` belong to the app's integrated/door-to-door
   journey feature. They are not used for the ordinary Metro route screen.
8. **Do not reproduce app authentication:** the route, station, line, and
   station-detail calls above work anonymously. There is no reason to copy the
   app's token mechanism or private credentials.

## Recommended integration shape

Do not replace the existing website client in one step. Add a server-side
Sarthi adapter with:

1. a feature flag;
2. strict response validation;
3. short timeouts and no retries on generic 500s;
4. cached station/line directories;
5. the current website API as a fallback;
6. telemetry comparing route legs and total time between sources; and
7. explicit approval from DMRC/AutoPe before depending on or redistributing
   this data at scale.

### Implementation status

This shape is now implemented behind `/api/v2/journeys/plan`:

| Recommendation | Where |
| --- | --- |
| Feature flag | `DMRC_SARTHI_ENABLED` (default `true`) in `api/core/config.py` |
| Strict response validation | `api/schemas/sarthi.py` via `core.validation` |
| Short timeout, no retries on 500s | `api/clients/sarthi.py`, `DMRC_SARTHI_TIMEOUT_SECONDS` default `8.0` |
| Cached station directory | `api/data/stations.normalized.json` loaded once by `api/core/catalog.py` |
| Website API as fallback | `api/services/planner.py`, which degrades to `api/services/journey.py` |
| Telemetry comparing sources | `fallback_reason` in the response, warning-level log per fallback, and `?source=sarthi|dmrc` to fetch either source directly |

Approval from DMRC/AutoPe before depending on or redistributing this data at
scale remains outstanding.

The read-only probe at
`api/scripts/probe_sarthi_api.py` reproduces the three public calls without
adding them to production traffic.

```bash
cd api
uv run python scripts/probe_sarthi_api.py route AIIMS ASDM \
  --strategy least-distance \
  --at 2026-07-27T20:01

uv run python scripts/probe_sarthi_api.py route NDI DSTO \
  --at 2026-07-27T20:01

uv run python scripts/probe_sarthi_api.py route NDI DSTO \
  --at 2026-07-27T20:01 \
  --exclude-airport-line

uv run python scripts/probe_sarthi_api.py --compact stations
```
