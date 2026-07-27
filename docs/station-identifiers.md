# DMRC station identifiers and canonical slugs

This project keeps a crosswalk between the two read-only station catalogs:

- Legacy DMRC website API:
  `https://backend.delhimetrorail.com/api/v2/en/`
- Delhi Metro Sarthi API:
  `https://dmrc.autope.in/metro/v4/`

The APIs do not publish a common station ID or a URL slug. The generated
catalog therefore preserves both APIs' native identifiers and adds one stable
canonical slug per physical station.

## Generated station lists

- [`api/data/stations.normalized.json`](../api/data/stations.normalized.json)
  is the application-friendly catalog with direct lookup indexes.
- [`api/data/stations.normalized.csv`](../api/data/stations.normalized.csv)
  is the same crosswalk in spreadsheet-friendly form.

Snapshot generated on 27 July 2026:

| Catalog result | Count |
| --- | ---: |
| Legacy station records | 254 |
| Sarthi station records | 254 |
| Canonical physical stations | 254 |
| Matched canonical stations | 253 |
| Legacy-only stations | 1 |
| Sarthi-only stations | 0 |

The unmatched record is `SOORGHAT` (`SOOG`, legacy line `LN7`). It was not
present in the live Sarthi station response at generation time.

## Record shape

Each JSON station has this structure:

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

`sarthi` is always an array because the relationship is not strictly
one-to-one. Sikanderpur is the known example:

- Legacy: `SKRP`, with `LN2` and `LN11`
- Sarthi Yellow Line record: `SKY`
- Sarthi Rapid Metro record: `SKRP`
- Canonical slug for all three identifiers: `sikanderpur`

## Lookup indexes

The JSON document has three indexes:

- `indexes.by_legacy_code`: legacy station code to canonical slug
- `indexes.by_sarthi_code`: Sarthi station code to canonical slug
- `indexes.by_slug`: canonical slug to its position in `stations`

For example:

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

This lets an application accept a code from either upstream, resolve it to a
canonical slug, and then choose the native code required by the target API.

## Use in the API

`api/core/catalog.py` loads this document once per process and exposes that
translation to the services:

```python
from core.catalog import resolve_station, to_legacy_code, to_sarthi_code

to_sarthi_code("KPEN")   # "KPE"
to_legacy_code("JRMJ")   # "JRMR"
to_sarthi_code("SOOG")   # None - legacy only, so the planner falls back
resolve_station("SKRP").slug  # "sikanderpur"
```

For Sikanderpur's one-to-many mapping, `CanonicalStation.sarthi_code` prefers
the Sarthi record whose name matches the canonical name (`SKY`, Yellow Line)
over the Rapid Metro record (`SKRP`). The `/api/v2` planner uses these helpers
to translate station codes before calling either upstream, and echoes `slug`,
`legacy_code`, and `sarthi_code` back in the journey's `origin`/`destination`.

## Refreshing the catalog

Run the normalizer from the API package:

```bash
cd api
uv run python scripts/normalize_station_catalogs.py \
  --json-output data/stations.normalized.json \
  --csv-output data/stations.normalized.csv
```

To make CI fail when either API adds an unmatched station:

```bash
uv run python scripts/normalize_station_catalogs.py \
  --json-output /tmp/stations.normalized.json \
  --fail-on-unmatched
```

The current snapshot intentionally fails that strict check because Soorghat is
legacy-only.

## Matching rules

The script uses conservative, deterministic matching:

1. Exact native station code
2. Unique punctuation-insensitive station name
3. Explicit reviewed rename aliases
4. Unique physical-name variant, used for split records such as Sikanderpur

Fuzzy similarity is only emitted as a suggestion for review. It is never
accepted automatically. This avoids silently mapping two similarly named
stations to each other.

The canonical display name prefers the current Sarthi name, removes
`Formerly`/`earlier` qualifiers from the slug, and retains raw upstream names
in the native records and `aliases`.
