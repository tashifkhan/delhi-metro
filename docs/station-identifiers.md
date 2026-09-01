# DMRC station identifiers and canonical slugs

Two APIs, two different ideas of what a station code should be. This doc explains the crosswalk I built to make them agree.

This project keeps a crosswalk between the two read-only catalogs:

- legacy DMRC website API at `https://backend.delhimetrorail.com/api/v2/en/`
- Delhi Metro Sarthi API at `https://dmrc.autope.in/metro/v4/`

Neither publishes a common station id or a slug. So the generated catalog keeps both native ids and adds one stable canonical slug per physical station. That way the API can accept either vocabulary and call the upstream with the right one.

## Generated station lists

- `api/data/stations.normalized.json` is the app friendly catalog with lookup indexes. This is what the API loads.
- `api/data/stations.normalized.csv` is the same crosswalk as a spreadsheet. Easier to scan in a PR.

Snapshot from 27 July 2026:

| Catalog result | Count |
| --- | ---: |
| Legacy station records | 254 |
| Sarthi station records | 254 |
| Canonical physical stations | 254 |
| Matched canonical stations | 253 |
| Legacy only stations | 1 |
| Sarthi only stations | 0 |

The one unmatched record is `SOORGHAT`, `SOOG` on legacy line `LN7`. It was not in the live Sarthi response when I generated the snapshot, so it stays legacy only.

## Record shape

Each JSON station looks like this:

```json
{
  "slug": "jharoda-majra",
  "name": "JHARODA MAJRA",
  "aliases": [],
  "match": {
    "status": "matched",
    "method": "name"
  },
  "legacy": {
    "id": 270,
    "code": "JRMR",
    "name": "JHARODA MAJRA",
    "lines": ["LN7"]
  },
  "sarthi": [
    {
      "id": "69ad8de4c162e4b8ee086e1a",
      "code": "JRMJ",
      "name": "JHARODA MAJRA",
      "commercial_name": "JHARODA MAJRA",
      "search_key": "JHARODA MAJRA",
      "lines": ["LN7"],
      "latitude": 28.5703764,
      "longitude": 77.1843847,
      "status": "active"
    }
  ]
}
```

`sarthi` is always an array. Most stations map one to one, but Sikanderpur breaks that:

- legacy `SKRP` with `LN2` and `LN11`
- Sarthi Yellow Line record `SKY`
- Sarthi Rapid Metro record `SKRP`
- canonical slug for all three ids is `sikanderpur`

I kept it as an array so the odd case does not need a special shape.

## Lookup indexes

The JSON has three indexes at the top:

- `indexes.by_legacy_code` maps legacy code to canonical slug
- `indexes.by_sarthi_code` maps Sarthi code to canonical slug
- `indexes.by_slug` maps slug to its position in `stations`

Example:

```python
import json
from pathlib import Path

catalog = json.loads(
    Path("api/data/stations.normalized.json").read_text(encoding="utf-8")
)

slug = catalog["indexes"]["by_sarthi_code"]["JRMJ"]
station = catalog["stations"][catalog["indexes"]["by_slug"][slug]]

assert slug == "jharoda-majra"
assert station["legacy"]["code"] == "JRMR"
```

That is the whole trick. Take a code from either side, get the slug, then pick the native code the target API wants.

## Use in the API

`api/core/catalog.py` loads the catalog once per process and exposes helpers the services use:

```python
from core.catalog import resolve_station, to_legacy_code, to_sarthi_code

to_sarthi_code("KPEN")   # "KPE"
to_legacy_code("JRMJ")   # "JRMR"
to_sarthi_code("SOOG")   # None, legacy only, so the planner falls back
resolve_station("SKRP").slug  # "sikanderpur"
```

For Sikanderpur the one to many case, `CanonicalStation.sarthi_code` prefers the Sarthi record whose name matches the canonical name, which is `SKY` on the Yellow Line, rather than the Rapid Metro `SKRP`. The `/api/v2` planner uses these helpers before calling either upstream, and it echoes `slug`, `legacy_code`, and `sarthi_code` back in the journey `origin` and `destination` so callers can see the translation.

## Refreshing the catalog

Run the normalizer from the `api` package:

```bash
cd api
uv run python scripts/normalize_station_catalogs.py \
  --json-output data/stations.normalized.json \
  --csv-output data/stations.normalized.csv
```

To make CI fail if either API adds an unmatched station:

```bash
uv run python scripts/normalize_station_catalogs.py \
  --json-output /tmp/stations.normalized.json \
  --fail-on-unmatched
```

The current snapshot fails that strict check on purpose because Soorghat is legacy only. That is expected, not a bug.

## Matching rules

The script is conservative and deterministic:

1. exact native station code
2. unique punctuation insensitive station name
3. explicit rename aliases that I reviewed by hand
4. unique physical name variant for split records like Sikanderpur

Fuzzy similarity is only printed as a suggestion for you to review. The script never accepts it automatically. That avoids quietly mapping two similar sounding stations to each other, which would be worse than leaving one unmatched.

The canonical display name prefers the current Sarthi name, strips `Formerly` or `earlier` qualifiers from the slug, and keeps the raw upstream names in the native records and in `aliases` so nothing is lost.
