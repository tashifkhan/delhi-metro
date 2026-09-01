# DMRC maps and API docs

DMRC does not publish API docs. I got this by hitting the live site and its backend directly and writing down what actually worked. Everything below is from real requests in July 2026, so treat it as observed behavior, not a contract.

Checked against:

- `https://delhimetrorail.com/network_map`
- `https://delhimetrorail.com/airport-express-line`
- `https://delhimetrorail.com/rapid-metro`
- `https://backend.delhimetrorail.com/api/v2/en/*`

## 1. How to get metro maps (HD image and PDF)

### What you can actually download today

The frontend is a React SPA. The route pages do not contain plain image links. Some assets appear in:

- `https://delhimetrorail.com/asset-manifest.json`

The full resolution network map and PDF are not in the manifest. They are referenced inside the compiled `main.js` bundle. The manifest's `mapimgEng` is only a 550 by 332 preview. Do not pick it as the primary map. I made that mistake once and the image looked terrible on a real screen.

Assets I verified on 27 July 2026:

- Network map image: `DMRC-NMRC-NCRTC-MAP-16.07.2026.3bd317f6.jpg`
  - type `image/jpeg`
  - size `9565911` bytes
  - resolution `17250 x 15750`
- Network map PDF: `DMRC-NMRC-NCRTC-MAP-16.07.2026.14a605a6.pdf`
  - type `application/pdf`
  - size `2743904` bytes

Airport and Rapid specific images in the same build:

- Airport Express image
  - `https://delhimetrorail.com/static/media/AIRPORT-EXPRESS.8b991cc0.jpg`
  - resolution `1000 x 667`
- Rapid Metro image
  - `https://delhimetrorail.com/static/media/RAPID-METRO.741fc16a.jpg`
  - resolution `1000 x 667`

Those hashed names change every time DMRC publishes a new frontend build, so do not hardcode them. Resolve them through the map API in this repo which already does the scanning.

### Download commands

```bash
curl -L "https://dmrc-rest-api.vercel.app/api/v1/dmrc/maps/network/download?format=image" -o dmrc-network-map-hd.jpg
curl -L "https://dmrc-rest-api.vercel.app/api/v1/dmrc/maps/network/download?format=pdf" -o dmrc-network-map.pdf
curl -L "https://delhimetrorail.com/static/media/AIRPORT-EXPRESS.8b991cc0.jpg" -o dmrc-airport-express.jpg
curl -L "https://delhimetrorail.com/static/media/RAPID-METRO.741fc16a.jpg" -o dmrc-rapid-metro.jpg
```

### How to always get the latest map files programmatically

1. Fetch `asset-manifest.json`.
2. Parse its `files` object and find the compiled `main.js` path.
3. Pull every `static/media/*.(jpg|jpeg|png|svg|pdf)` reference out of that bundle.
4. Merge those bundle refs with the manifest files.
5. Filter and rank. Prefer full `DMRC-NMRC-NCRTC-MAP` or `DMRC-Network-Map` assets and ignore the small `mapimg` preview.
6. Download the resolved hashed URL.

That covers both DMRC build layouts and avoids chasing a hash that changed overnight.

## 2. DMRC API base and headers

### Base URL

- `https://backend.delhimetrorail.com/api/v2/{lang}`
- used language is `en`

### Request headers that worked

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

A note on compression. Some curl builds break on `zstd` if you force `Accept-Encoding: gzip, deflate, br, zstd`. Stick to `gzip, deflate` or leave the header out. I lost an afternoon to that.

## 3. Endpoint documentation from live calls

### `GET /passengers/notification/`

Passenger notices and notification feed.

Response is an array of notifications. Top level fields on each item:

- `id`
- `title`
- `notification_type` which is an object with `name` and `image`
- `image`
- `video_url`
- `link_to`
- `link_to_file`
- `link_to_internal_page`
- `link_to_outside_url`
- `date`

### Notification detail endpoints

DMRC keeps two resources for detail:

- `GET /corporate/{page_slug}/` for normal corporate pages
- `GET /pressrelease_details/{page_slug}` for press releases

Corporate returns a one item array. Press release returns an object with `english_title` and `body_english`. The wrapper at `GET /api/v1/dmrc/notifications/{page_slug}` checks both and normalizes to:

- `page_id` which is null for press releases
- `title`
- `content` which is raw HTML
- `page_slug`
- `cover_photo`
- `seo_title`
- `search_description`

I kept both because the feed mixes them and the app wants one shape.

### `GET /line_list`

All metro lines with metadata. Response is an array. Fields include:

- `id`
- `name`
- `line_color`
- `line_code` like `LN3`, `LN10`, `LN11`
- `primary_color_code`, `secondary_color_code`
- `start_station`, `end_station`
- `show_in_frontend`
- `status`

Examples seen:

- `LN10` is Airport Express
- `LN11` is Rapid Metro

### `GET /station_by_line/{line_code}`

Ordered station list for a line. I tested:

- `LN3` Blue with 50 stations
- `LN10` Airport Express with 7 stations
- `LN11` Rapid Metro with 11 stations

Each item has:

- `id`
- `station_name`
- `station_code`
- `station_facility`
- `interchange`
- `status`

### `GET /station/{station_code}`

Rich detail for one station. Example I checked was `RG`.

Fields include station metadata `station_code`, `station_name`, `station_type`, `interchange`, geo and layout `latitude`, `longitude`, `x_coords`, `y_coords`, line context `metro_lines`, `prev_next_stations`, facilities `station_facility`, `stations_facilities`, `parkings`, `feeder`, `nearby_places`, movement details `gates`, `lifts`, `platforms`, and train info `first_last_train`.

It is a big payload. Useful for the station detail screen.

### `GET /station_by_keyword/{filter}/{keyword}`

Station search and autocomplete.

Filters I tried:

- `least-distance`
- `minimum-interchange`
- `all`

Examples:

- `/station_by_keyword/all/RAJOURI%20GARDEN`
- `/station_by_keyword/all/VAISHALI`

Response is an array of station matches with basic facility info.

### `GET /new_fare_with_route/{from_code}/{to_code}/{strategy}/`

Route plus fare. Strategies that worked:

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
- `route` which is an array

Each route segment has `line`, `line_no`, `path` which is the station sequence, `path_time`, `map-path` for edge ids, `station_interchange_time`, `start`, `end`.

### `GET /first_and_last_train_with_filter/{from_code}/{to_code}/{strategy}/`

First and last train timing for a strategy.

Examples:

- `/first_and_last_train_with_filter/RG/MVE/least-distance/`
- `/first_and_last_train_with_filter/RG/MVE/minimum-interchange/`

Response shape:

- `first_train` with `endstation_from_first_train_estimated_time` and `first_train_route_detail[]`
- `last_train` with `endstation_from_last_train_estimated_time` and `last_train_route_detail[]`

Each timing detail has `start_st`, `start_time`, `end_st`, `end_time`, `interchange_time`, `start_station_name`, `end_station_name`.

## 4. Complete product flow using these APIs

### A. App bootstrap

1. Call `GET /line_list`.
2. Call `GET /passengers/notification/`.
3. Build line chips, status badges, and the alerts feed from those two.

### B. Search and pick stations

1. On input change call `GET /station_by_keyword/all/{keyword}` with debounce.
2. Turn the results into station objects with `station_code` and `station_name`.

### C. Route planning for two strategies

For the chosen `from_code` and `to_code`, call in parallel:

1. `GET /new_fare_with_route/{from}/{to}/least-distance/`
2. `GET /new_fare_with_route/{from}/{to}/minimum-interchange/`

Then show fare cards for weekday and weekend, total time, and the route segments with interchanges.

### D. First and last train timings

For the same pair, call in parallel:

1. `GET /first_and_last_train_with_filter/{from}/{to}/least-distance/`
2. `GET /first_and_last_train_with_filter/{from}/{to}/minimum-interchange/`

Render the start and end timing chains per strategy.

### E. Station details

When someone opens station detail:

1. Call `GET /station/{station_code}`.
2. Show gates and lifts and platforms, parking, feeder, nearby places.

### F. Line explorer

1. User picks a line from `line_list`.
2. Call `GET /station_by_line/{line_code}`.
3. Show the ordered timeline with interchange badges.

## 5. Building high definition Airport and Rapid maps from API data

If no official high res image or PDF is published for Airport or Rapid, you can build your own export from API data:

1. Get line order via `GET /station_by_line/LN10` and `GET /station_by_line/LN11`.
2. For each station code call `GET /station/{code}` to get `latitude`, `longitude` and the diagram coords `x_coords`, `y_coords`.
3. Plot the polyline in station order.
4. Label stations and mark interchanges.
5. Export as PNG at 300 DPI or better and as PDF, vector if you can.

That gives you a print quality line map without waiting on frontend static images.

## 6. Practical curl examples

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

# fare and route
curl -sS "https://backend.delhimetrorail.com/api/v2/en/new_fare_with_route/RG/VASI/least-distance/" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Referer: https://delhimetrorail.com/" \
  -H "Origin: https://delhimetrorail.com" \
  -H "content-type: application/json"

# first and last train
curl -sS "https://backend.delhimetrorail.com/api/v2/en/first_and_last_train_with_filter/RG/MVE/minimum-interchange/" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Referer: https://delhimetrorail.com/" \
  -H "Origin: https://delhimetrorail.com" \
  -H "content-type: application/json"
```

## 7. Notes and caveats

- The backend sits behind Cloudflare. Requests without browser like headers can get blocked. The clients in this repo already set them.
- Add retries with backoff in your API client. Upstream can be slow at peak.
- Cache static like responses `line_list` and `station_by_line` locally. No need to refetch every screen open.
- Hashed names for static assets change on each deploy. Always resolve from `asset-manifest.json` and the bundle, do not hardcode.
