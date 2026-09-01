# Delhi Metro Sarthi route planner research

Research date: 27 July 2026

I assumed Sarthi would call an API every time you plan a route. It does not, at least not for the normal metro to metro case. That surprised me.

## Executive finding

The Sarthi Android app does not make a journey API request for an ordinary metro to metro trip. It looks up a complete precomputed route matrix from a SQLite database bundled in the APK and then fills in details locally.

The same app bundle also ships an older HTTP route client. That endpoint is still live, it is public, and it is nicer than the API behind `delhimetrorail.com`:

```http
GET https://dmrc.autope.in/metro/v4/journey/{from}/{to}/{strategy}/{date_time}
    ?exclude_airport_line={true|false}
```

I hit it without a token, without an API key, without a cookie, without a Referer, and without any app header. It just answered. That makes it the practical candidate for this project, with the caveats on stability and licensing noted below.

## Provenance

- official Android package: `com.sraoss.dmrc`
- app version inspected: `2.1.17` with `versionCode` 20117
- Google Play listing: <https://play.google.com/store/apps/details?id=com.sraoss.dmrc>
- APK signing certificate SHA-256: `a69bb3c9e277abb88cb795e5a65bbf46703a14c8a0a4b3f6102b781d2fdb7762`
- runtime and API host: `https://dmrc.autope.in`
- app build: React Native with a Hermes bytecode bundle

I checked the package name and signing certificate before opening the bundle. I did not use a user account, I did not touch a payment flow, and I did not use any private or authenticated API.

## Route request

### Path parameters

| Parameter | Values and format | Notes |
| --- | --- | --- |
| `from` | Station code | Uppercase, for example `AIIMS` |
| `to` | Station code | Uppercase, for example `ASDM` |
| `strategy` | `least-distance` or `minimum-interchange` | Both exist in the app and in the bundled matrix |
| `date_time` | `YYYY-MM-DDTHH:mm` | Delhi local time, the app uses exactly this format |

### Query parameter

| Parameter | Values | Notes |
| --- | --- | --- |
| `exclude_airport_line` | `true` or `false` | This is a query param, not the last path segment |

The last path segment is easy to misread. The decompiled path builder takes four values, but the fourth is the journey date and time. Airport exclusion comes separately as a query param.

### Reproducible request

```bash
curl -sS -G \
  "https://dmrc.autope.in/metro/v4/journey/AIIMS/ASDM/least-distance/2026-07-27T20:01" \
  --data-urlencode "exclude_airport_line=false" |
  jq .
```

Result for AIIMS to Akshardham in my test:

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

The full response also held:

- `fare_breakup[]`
- `from_station_status` and `to_station_status`
- `routes[]`
- `interchanges[]`
- `serviceStatus`

Each item in `routes[]` held:

- line name, color, and number
- start and end station names and codes
- direction `up` or `down`
- platform number
- ordered station objects
- map edge ids
- toward and terminus station
- segment time and distance
- calculated start and end times
- interchange time

For that test trip the two legs were:

1. Yellow Line, AIIMS to Rajiv Chowk, Platform 2, toward Samaypur Badli.
2. Blue Line, Rajiv Chowk to Akshardham, Platform 3, toward Noida Electronic City.

### Airport exclusion actually works

New Delhi `NDI` to Dwarka Sector 21 `DSTO` at the same time:

| Query | Result |
| --- | --- |
| `exclude_airport_line=false` | Orange Line, 6 stations, 22.297 km, 24 min |
| `exclude_airport_line=true` | Yellow and Blue, 30 stations, 32.015 km, 64 min |

Toggling it changed the graph, so the flag is not decorative.

## Station and line discovery

The app asks for all stations with a high limit:

```http
GET https://dmrc.autope.in/metro/v4/stations?page=0&limit=500
```

Observed envelope:

```json
{
  "results": [],
  "page": 1,
  "limit": 500,
  "totalPages": 1,
  "totalResults": 254
}
```

A station record includes `code`, `name`, `commercialName`, line metadata, status, latitude and longitude, search key, facilities, ticketing ids, and version. One quirk I hit: `geoloc.coordinates` came back in latitude and longitude order even though GeoJSON wants longitude and latitude. Some nested records also expose a correctly ordered `geoFormatted` field, so check which one you use.

Lines live at:

```http
GET https://dmrc.autope.in/metro/v4/lines/?page=0&limit=100
```

The line result includes station order, endpoints, distance, line colors, service state, station count, journey time, and maximum fare.

Rich station detail lives at:

```http
GET https://dmrc.autope.in/metro/v4/stations/api/{station_code}
```

## Why the Android planner works differently

The APK ships two database assets:

- `DMRC_METRO_v7.5.db` at 148,951,040 bytes
- `DMRC_STATIC_v5.1.db` at 32,854,016 bytes

The main route database has:

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

It held 255 stations and exactly 259,080 route rows:

```text
255 origins times 254 other destinations times
2 strategies times 2 airport choices = 259,080
```

The lookup key is built as:

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

The app then fills names, line metadata, platform and direction, fare, and first and last train info from the other local tables.

In a live emulator trace, tapping View Route for AIIMS to Akshardham made no `/journey/...` request at all. The screen appeared from the SQLite lookup. The only request at that moment was an unrelated version check:

```http
GET https://dmrc.autope.in/metro/v4/update/updateApp
```

That route database is not downloaded later. It is baked into the APK. A new APK ships a new matrix.

## Comparison with the current website API

Same trip, AIIMS to Akshardham, same day:

| Source and strategy | Route | Stations | Reported time |
| --- | --- | ---: | ---: |
| Website `least-distance` | Yellow to Pink to Blue | 9 | 38:26 |
| Website `minimum-interchange` | Yellow to Blue | 14 | 33:02 |
| Sarthi `least-distance` | Yellow to Blue | 14 | 31 min |
| Sarthi `minimum-interchange` | Yellow to Blue | 14 | 31 min |

Sarthi is richer here and its precomputed recommendation was faster for this example. It also gives you platform, direction, toward station, status, distance, and fare breakup in one response, which the website API does not.

## Observed quirks and risks

1. Undocumented and vendor run. `dmrc.autope.in` is used by the official app but it is not a published DMRC developer API. The fact that it is reachable does not mean you have permission to redistribute the data at scale.

2. No browser CORS. Responses did not include `Access-Control-Allow-Origin`. Call it server side, not directly from browser or React Native JS.

3. Error semantics are rough. Bad station codes, bad strategies, and same origin and destination all came back as HTTP 500 with a generic message, not a tidy 4xx.

4. Date and time semantics. The date affected `applicableFare`. A Sunday test picked the special fare. But the per leg `start_time` values I saw followed the server clock, not a far future `journey_time` I sent. Treat those dynamic segment times as indicative for now.

5. Directory quirks. The lines envelope reported 12 total records but returned 11 visible line records in one live response.

6. Contract drift. Fields and station data can change without notice and without versioning.

7. Unrelated endpoints. `/journey-planner/plan-my-journey` and `/journey-planner/plan-enquiry` belong to the door to door integrated journey feature, not the normal metro route screen.

8. Do not copy app auth. The route, station, line, and station detail calls above work without auth. There is no need to replicate the app token flow or private credentials.

## Recommended integration shape

Do not swap the website client out in one go. Put a server side Sarthi adapter in front with:

1. a feature flag
2. strict response validation
3. short timeouts and no retries on generic 500s
4. cached station and line directories
5. the current website API as fallback
6. telemetry that compares route legs and total time between sources
7. explicit approval from DMRC and AutoPe before you depend on this or redistribute it at scale

### Implementation status

That shape is now live behind `/api/v2/journeys/plan`:

| Recommendation | Where it lives |
| --- | --- |
| Feature flag | `DMRC_SARTHI_ENABLED` default `true` in `api/core/config.py` |
| Strict response validation | `api/schemas/sarthi.py` via `core.validation` |
| Short timeout, no retries on 500s | `api/clients/sarthi.py`, `DMRC_SARTHI_TIMEOUT_SECONDS` default `8.0` |
| Cached station directory | `api/data/stations.normalized.json` loaded once by `api/core/catalog.py` |
| Website API as fallback | `api/services/planner.py`, which falls back to `api/services/journey.py` |
| Telemetry comparing sources | `fallback_reason` in the response, a warning log per fallback, and `?source=sarthi|dmrc` to fetch either source directly |

Approval from DMRC and AutoPe before depending on or redistributing this data at scale is still outstanding.

A read only probe at `api/scripts/probe_sarthi_api.py` replays the three public calls without adding them to prod traffic:

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
