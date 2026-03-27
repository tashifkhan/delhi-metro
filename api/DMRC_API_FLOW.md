# DMRC Maps + API Documentation

This document is based on live requests to:

- `https://delhimetrorail.com/network_map`
- `https://delhimetrorail.com/airport-express-line`
- `https://delhimetrorail.com/rapid-metro`
- `https://backend.delhimetrorail.com/api/v2/en/*`

## 1) How to get Metro maps (HD image + PDF)

### Proven downloadable assets

The frontend is a React SPA. Route pages do not contain direct HTML image links; assets are listed in:

- `https://delhimetrorail.com/asset-manifest.json`

From that manifest, these map assets are directly downloadable:

- Network map (HD image):
  - `https://delhimetrorail.com/static/media/DMRC-Network-Map-Hindi-English-18032026.6a940651.jpeg`
  - Type: `image/jpeg`
  - Size: `7460570` bytes
  - Resolution: `12286 x 9136`
- Network map (PDF):
  - `https://delhimetrorail.com/static/media/DMRC-Network-Map-Hindi-English-VA-23032026.00317293.pdf`
  - Type: `application/pdf`
  - Size: `270558` bytes

Airport/Rapid specific images in current build:

- Airport Express image:
  - `https://delhimetrorail.com/static/media/AIRPORT-EXPRESS.8b991cc0.jpg`
  - Resolution: `1000 x 667`
- Rapid Metro image:
  - `https://delhimetrorail.com/static/media/RAPID-METRO.741fc16a.jpg`
  - Resolution: `1000 x 667`

Note: in this deployment, only one map PDF is exposed in `asset-manifest.json`, and it is the full network map PDF.

### Download commands

```bash
curl -L "https://delhimetrorail.com/static/media/DMRC-Network-Map-Hindi-English-18032026.6a940651.jpeg" -o dmrc-network-map-hd.jpeg
curl -L "https://delhimetrorail.com/static/media/DMRC-Network-Map-Hindi-English-VA-23032026.00317293.pdf" -o dmrc-network-map.pdf
curl -L "https://delhimetrorail.com/static/media/AIRPORT-EXPRESS.8b991cc0.jpg" -o dmrc-airport-express.jpg
curl -L "https://delhimetrorail.com/static/media/RAPID-METRO.741fc16a.jpg" -o dmrc-rapid-metro.jpg
```

### Programmatic way to always get latest map files

1. Fetch `asset-manifest.json`.
2. Parse `files` object.
3. Filter by names containing `Network-Map`, `AIRPORT-EXPRESS`, `RAPID-METRO` and extensions `jpg|jpeg|png|pdf`.
4. Download resolved hashed URLs.

This avoids hardcoding hash names that change on deploy.

## 2) DMRC API base and headers

### Base URL

- `https://backend.delhimetrorail.com/api/v2/{lang}`
- Example language: `en`

### Request headers (working set)

```http
User-Agent: Mozilla/5.0 ...
Accept: application/json, text/plain, */*
Accept-Language: en-US,en;q=0.9
Referer: https://delhimetrorail.com/
Origin: https://delhimetrorail.com
content-type: application/json
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-site
```

Important: some curl builds fail on `zstd` if you force `Accept-Encoding: gzip, deflate, br, zstd`. Use `gzip, deflate`, or omit this header.

## 3) Endpoint documentation (from live calls)

## `GET /passengers/notification/`

Purpose: passenger notices/notifications feed.

Response: array of notifications.

Top-level fields:

- `id`
- `title`
- `notification_type` (object with `name`, `image`)
- `image`
- `video_url`
- `link_to`
- `link_to_file`
- `link_to_internal_page`
- `link_to_outside_url`
- `date`

## `GET /line_list`

Purpose: all metro lines with metadata.

Response: array.

Top-level fields:

- `id`
- `name`
- `line_color`
- `line_code` (example: `LN3`, `LN10`, `LN11`)
- `primary_color_code`, `secondary_color_code`
- `start_station`, `end_station`
- `show_in_frontend`
- `status`

Examples from response:

- `LN10` => Airport Express
- `LN11` => Rapid Metro

## `GET /station_by_line/{line_code}`

Purpose: ordered station list for a line.

Examples tested:

- `LN3` (Blue): 50 stations
- `LN10` (Airport Express): 7 stations
- `LN11` (Rapid Metro): 11 stations

Item fields:

- `id`
- `station_name`
- `station_code`
- `station_facility`
- `interchange`
- `status`

## `GET /station/{station_code}`

Purpose: rich station details.

Example tested: `RG`.

Top-level fields include:

- station metadata: `station_code`, `station_name`, `station_type`, `interchange`
- geo/layout: `latitude`, `longitude`, `x_coords`, `y_coords`
- line context: `metro_lines`, `prev_next_stations`
- facilities: `station_facility`, `stations_facilities`, `parkings`, `feeder`, `nearby_places`
- movement details: `gates`, `lifts`, `platforms`
- train info: `first_last_train`

## `GET /station_by_keyword/{filter}/{keyword}`

Purpose: station search/autocomplete.

Filters tested:

- `least-distance`
- `minimum-interchange`
- `all`

Examples:

- `/station_by_keyword/all/RAJOURI%20GARDEN`
- `/station_by_keyword/all/VAISHALI`

Response: array of station matches with basic facility information.

## `GET /new_fare_with_route/{from_code}/{to_code}/{strategy}/`

Purpose: route plan + fare calculation.

Strategies tested:

- `least-distance`
- `minimum-interchange`

Examples:

- `/new_fare_with_route/RG/VASI/least-distance/`
- `/new_fare_with_route/RG/VASI/minimum-interchange/`

Response fields:

- `stations`
- `from`, `to`
- `total_time`
- `weekday_fare`, `weekend_fare`
- `route` (array)

Route segment fields:

- `line`, `line_no`
- `path` (station sequence)
- `path_time`
- `map-path` (edge identifiers)
- `station_interchange_time`
- `start`, `end`

## `GET /first_and_last_train_with_filter/{from_code}/{to_code}/{strategy}/`

Purpose: first/last train timing for selected route strategy.

Examples:

- `/first_and_last_train_with_filter/RG/MVE/least-distance/`
- `/first_and_last_train_with_filter/RG/MVE/minimum-interchange/`

Response:

- `first_train`
  - `endstation_from_first_train_estimated_time`
  - `first_train_route_detail[]`
- `last_train`
  - `endstation_from_last_train_estimated_time`
  - `last_train_route_detail[]`

Train detail item fields:

- `start_st`, `start_time`
- `end_st`, `end_time`
- `interchange_time`
- `start_station_name`, `end_station_name`

## 4) Complete product flow using these APIs

### A. App bootstrap

1. Call `GET /line_list`.
2. Call `GET /passengers/notification/`.
3. Build line chips, status badges, and alerts feed.

### B. Search/select stations

1. On input change, call `GET /station_by_keyword/all/{keyword}`.
2. Resolve to station objects (`station_code`, `station_name`).

### C. Route planning (two strategy tabs)

For selected `from_code` and `to_code`, call in parallel:

1. `GET /new_fare_with_route/{from}/{to}/least-distance/`
2. `GET /new_fare_with_route/{from}/{to}/minimum-interchange/`

Render:

- fare cards (weekday/weekend)
- total time
- route segments and interchanges

### D. First/last train timings

For same pair, call in parallel:

1. `GET /first_and_last_train_with_filter/{from}/{to}/least-distance/`
2. `GET /first_and_last_train_with_filter/{from}/{to}/minimum-interchange/`

Render start/end timing chains per strategy.

### E. Station details view

When user opens station details:

1. Call `GET /station/{station_code}`.
2. Render gates/lifts/platforms, parking, feeder, nearby places.

### F. Line explorer

1. User picks line (from `line_list`).
2. Call `GET /station_by_line/{line_code}`.
3. Render ordered station timeline with interchange badges.

## 5) Building high-definition Airport/Rapid maps via API data

If official high-res image/PDF is not published for Airport/Rapid pages, generate your own HD exports from API data:

1. Get line station order:
   - `GET /station_by_line/LN10`
   - `GET /station_by_line/LN11`
2. For each station code, call `GET /station/{code}` to obtain:
   - `latitude`, `longitude`
   - `x_coords`, `y_coords` (diagram coordinates)
3. Plot the polyline in station order.
4. Label stations and interchanges.
5. Export as:
   - PNG at 300+ DPI
   - PDF (vector preferred)

This gives print-quality line maps independent of frontend static images.

## 6) Practical curl examples

```bash
# line list
curl -sS "https://backend.delhimetrorail.com/api/v2/en/line_list" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Accept-Language: en-US,en;q=0.9" \
  -H "Referer: https://delhimetrorail.com/" \
  -H "Origin: https://delhimetrorail.com" \
  -H "content-type: application/json"

# station search
curl -sS "https://backend.delhimetrorail.com/api/v2/en/station_by_keyword/all/RAJOURI%20GARDEN" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Referer: https://delhimetrorail.com/" \
  -H "Origin: https://delhimetrorail.com" \
  -H "content-type: application/json"

# fare + route
curl -sS "https://backend.delhimetrorail.com/api/v2/en/new_fare_with_route/RG/VASI/least-distance/" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Referer: https://delhimetrorail.com/" \
  -H "Origin: https://delhimetrorail.com" \
  -H "content-type: application/json"

# first/last train
curl -sS "https://backend.delhimetrorail.com/api/v2/en/first_and_last_train_with_filter/RG/MVE/minimum-interchange/" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Referer: https://delhimetrorail.com/" \
  -H "Origin: https://delhimetrorail.com" \
  -H "content-type: application/json"
```

## 7) Notes and caveats

- Backend is protected by Cloudflare; requests without browser-like headers may be blocked.
- Keep retries and exponential backoff in your API client.
- Cache static-like responses (`line_list`, `station_by_line`) to reduce load.
- URL hash names for static assets change across deployments; always resolve from `asset-manifest.json`.
