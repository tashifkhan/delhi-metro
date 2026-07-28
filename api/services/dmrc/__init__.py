"""DMRC (Delhi Metro) services.

One module per domain over the two Delhi Metro upstreams:

- `line`, `station`, `journey`, `notification`, `map_asset`: the legacy
  delhimetrorail.com backend
- `sarthi`: the Delhi Metro Sarthi journey API, the preferred planner

`services.planner` selects between `sarthi` and `journey` for a v2 plan;
`services/nmrc/` mirrors this shape for Noida Metro.
"""
