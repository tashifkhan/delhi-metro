# Offline metro export

The API serves an archive built ahead of time. `GET /api/v1/export/manifest` returns metadata. `GET /api/v1/export` returns UTF-8 JSON with `Content-Encoding: gzip`. Send the `ETag` from a previous download as `If-None-Match` to get a bodyless `304` while that version remains current.

## Manifest

| Field | JSON type | Meaning |
| --- | --- | --- |
| `version` | string | Schema version, a hyphen, and the first 16 hex digits of the bundle hash. Compare this as an opaque string. |
| `generated_at` | string | UTC timestamp in ISO 8601. |
| `sha256` | string | Lowercase hex SHA-256 of the **decompressed UTF-8 bytes**. HTTP clients that decompress gzip can hash the received body before parsing it. The download uses the same hash in a quoted ETag. |
| `size_bytes` | integer | Gzip size in bytes. Use this for the download size shown in settings. |
| `sections` | object | Keys below. Each value is `{count: integer, sha256: string}`. |
| `router_agreement` | number or null | Fraction between 0 and 1. Null before sampling. |

A section's count is its array length or number of top-level object keys. Each section hash covers its exact JSON value in the bundle, excluding its property name and surrounding punctuation. The writer sorts object keys, uses compact separators, and writes Unicode as UTF-8. Hash the original bytes, since reserializing parsed numbers or strings can change their representation.

## Bundle schema v1

The root is `{schema_version: 1, sections: {…}}`. Each station key is `network:code`, for example `dmrc:AIIMS`, `nmrc:NM01`, or `ncrtc:Z00`. Network values are `dmrc`, `nmrc`, and `ncrtc`. Station codes within a line catalog or station detail do not have the prefix.

| Section | JSON shape |
| --- | --- |
| `lines` | Array of `MetroLine` objects with `network: string` and `stations: string[]` added. Stations are in catalog order. Use the graph for train stopping patterns, branches, and loop edges. |
| `stations` | Array of station records. See below. |
| `first_last_trains` | Array of directional timetable records. See below. |
| `notices` | Array of `{network, notice: PassengerNotification, detail: PassengerNotificationDetail \| null}`. The detail preserves HTML in `content` and provides `body_blocks` for native rendering. The builder takes up to 12 notices per operator. |
| `map_layout` | Object keyed by network, with saved `MapLayout` responses as values. A missing key means no saved layout. |
| `official_map` | Object keyed by network with embeddable images. A missing key means the builder could not retrieve an image. |
| `terrain_detail` | The object from `app/src/data/terrainDetail.json`, with `interval`, `chunkSize`, and `chunks`. Use it with the same terrain decoder as the bundled map. |
| `fares` | Object with the three fare tables below. |
| `routing_graph` | Object with `patterns`, `changes`, and `walks` arrays. |
| `overrides` | Array of sampled Sarthi route skeletons, empty before sampling. |

`MetroLine`, `StationDetail`, `PassengerNotification`, `PassengerNotificationDetail`, and `MapLayout` are the existing API schemas, including any optional operator fields. The [line](../api/schemas/line.py), [station](../api/schemas/station.py), [notice](../api/schemas/notification.py), and [map layout](../api/schemas/map_layout.py) definitions list their fields.

### Stations, schedules, and images

A station contains:

```ts
{
  network: "dmrc" | "nmrc" | "ncrtc",
  code: string,
  name: string,
  codes: Record<string, string[]>,
  ids: Record<string, string[]>,
  latitude: number | null,
  longitude: number | null,
  coordinates_approximate: boolean,
  detail: StationDetail
}
```

The station's own network appears as a key in `codes` and `ids`. DMRC entries also have `sarthi` arrays with alternate codes and IDs. A station on two lines still has one record. NMRC's schematic coordinates come from the app's existing interpolation. DMRC stations with missing or placeholder coordinates use the closest available catalog or checked-in map coordinate. NCRTC parking availability in station detail is a snapshot and carries its fetch timestamp.

A timetable entry contains:

```ts
{
  station: string,
  pattern: string | null,
  line_code: string | null,
  direction: "forward" | "reverse" | null,
  next: string | null,
  towards: string | null,
  days: string,
  source: "dmrc" | "sarthi" | "nmrc" | "ncrtc",
  first: string | null,
  last: string | null
}
```

`station` and `next` are qualified station keys. `towards` can be a qualified station key or the operator's heading text. Display `first` and `last` as local India time. `days` is `published` when DMRC supplies its default timetable, `sampled` for a Sarthi result, `mon-sat` or `sun` for Noida, and normally `everyday` for NCRTC. If the operator omits a service or a time, the corresponding entry or value is absent. The station detail also keeps operator timetable fields as published.

An official image contains:

```ts
{
  content_type: "image/webp",
  data_base64: string,
  sha256: string,
  size_bytes: number,
  source_url: string | null,
  source_sha256: string | null,
  width: number,
  height: number
}
```

The image hash covers its decoded WebP bytes. Map positions from a saved layout match an image when `MapLayout.image.sha256` equals `source_sha256`. A null source hash marks the checked-in DMRC fallback image.

### Fares and notices

`fares.dmrc_distance_slabs` is an array of `{max_km: number | null, normal: number, special: number}`. Caps are inclusive and null is unbounded. The slabs estimate the ordinary DMRC fare. Airport Express uses distinct fares, so prefer a cached online quote when available.

`fares.nmrc_station_count_slabs` is an array of `{max_stations: number, normal: number, special: number}`. Count hops, excluding the station of origin. Caps are inclusive.

`fares.ncrtc_fare_matrix` is an array of `{from: string, to: string, class: "standard" | "premium", amount: number}`. Keys are qualified stations. Look up the ordered origin and destination. Offer Premium only if the trip includes a Namo Bharat leg. Amounts are in rupees.

Each `body_blocks` item has `type` equal to `paragraph`, `heading`, `list_item`, or `link`, plus `text` and an optional `href`. Link blocks use absolute HTTP or HTTPS URLs. NMRC's detail links to the operator's release file.

### Routing graph

```ts
type Hop = {
  minutes: number,
  reverse_minutes: number | null,
  km: number,
  source: "sarthi" | "sarthi-partial" | "estimated" | "ncrtc" | "nmrc-estimate"
}
type Pattern = {
  id: string,
  network: "dmrc" | "nmrc" | "ncrtc",
  line_code: string,
  line_number: number,
  name: string,
  color: string,
  stops: string[],
  loop: boolean,
  loop_start: number | null,
  hops: Hop[]
}
type Change = {station: string, minutes: number, source: "sarthi" | "estimated"}
type Walk = {from: string, to: string, minutes: number, metres: number | null, note: string}
type Override = {
  from: string,
  to: string,
  strategy: "least-distance" | "minimum-interchange",
  legs: Array<{
    kind: "metro" | "transfer",
    pattern: string | null,
    origin: string,
    destination: string,
    stops: string[]
  }>
}
```

For `loop: false`, hop `i` connects stops `i` and `i + 1`. For a loop, the last hop connects the last stop back to the index in `loop_start`. `minutes` is the time in listed order. A null `reverse_minutes` means that hop operates one way, as on Rapid Metro’s Cyber City loop. Walks are bidirectional. The graph counts each pattern change or walk as one change. Use all patterns at the origin as zero-cost starting states and take the cheapest state at the destination. For a trip within one network, restrict the search to that network. The reference router orders costs by distance, time, then changes for `least-distance`. It orders costs by changes, time, then distance for `minimum-interchange`.

Check for a matching override before searching the graph. A metro leg's `pattern` points to `Pattern.id`. A transfer has `pattern: null`. Each leg lists qualified stops in travel order, including both ends. When the passenger excludes Airport Express, skip pattern `dmrc:LN10` and any override that rides it.

DMRC timing probes allocate each Sarthi leg's time and distance to its hops in proportion to straight-line distance. A missing direction uses the reported opposite direction when available. Estimates cover hops where neither direction is available. NCRTC ride times come from `routes/info`. The Namo Bharat pattern uses provisional Meerut stops. NMRC distances come from the existing fare and route tables and hop times use the two-minute estimate from the existing fallback planner.

The sampler fetches Sarthi's two strategies for 300 ordered station pairs by default. It repeats a fixed set of popular pairs and advances the rest with a saved cursor. Agreement requires the same leg paths and a total time within two minutes. The sampler scores Sarthi responses with a usable duration and itinerary, including responses that cannot be mapped to the graph as disagreements. It stores valid alternate paths as overrides and fails the job if agreement falls on the fixed pairs with the same number of scored results.

## Build and publish

From `api/`:

```bash
uv run python scripts/build_export.py --output data/offline-export.zip
uv run python scripts/sample_routes.py --bundle data/offline-export.zip --state /tmp/metro-route-sample.json
```

Use `--checkpoint` to resume either command after an interruption. For a new snapshot, use a fresh checkpoint directory. Each job spaces passenger requests at least one second apart. The API reads `api/data/offline-export.zip` by default and can use `DMRC_OFFLINE_EXPORT_PATH` to point at another local archive.

The daily GitHub Action writes the archive and sampling cursor to the `offline-export` data branch. A single archive pairs the manifest with the gzip body, so a request can never combine metadata and content from different published versions. The job publishes only after the build, sampler, and tests pass. It is gated by the repository variable `OFFLINE_EXPORT_ENABLED` and uses the Actions token for that branch, with no production secrets. The first successful run creates the branch.

For Vercel, set `DMRC_OFFLINE_EXPORT_URL` to the data branch's public archive URL, for example `https://raw.githubusercontent.com/tashifkhan/delhi-metro/offline-export/offline-export.zip`. A process checks the archive periodically and verifies its hash before serving it. It can fall back to the checked-in archive when the data branch is unavailable. Export requests never ask a metro operator to build the pack.

Any incompatible change to a section increments `schema_version`. A data refresh updates the content digest. Use `size_bytes` for a current download size because station detail, notices, and images change over time.

## Measured snapshot

Version `1-e92dd83f34e53db3` downloads in 1,687,536 gzip bytes. It contains 298 stations, 777 timetables, 28 notices, three official images, and 127 route overrides. The sampler scored 339 of 600 comparisons as matches, for agreement of 56.5%. Two Sarthi itineraries had disconnected legs and could not produce valid overrides.
