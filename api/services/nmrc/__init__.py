"""NMRC (Noida Metro) services, scraped from the operator's public website.

NMRC has no JSON API, so these modules parse its server-rendered pages and
normalize them into the same schemas the DMRC services return:

- `catalog`: line metadata and the cached station catalog
- `station`: station search, line listings, and station detail
- `journey`: journey planning into the shared `PlannedJourney` shape
- `notification`: press releases as passenger notifications
- `map_asset`: the Aqua Line network map
- `parsing`: pure HTML parsers shared by the above
- `data`: checked-in reference data used when the site is unavailable

`plan_journey` is re-exported so `services.planner` can treat this package like
the other planner services.
"""

from services.nmrc.journey import plan_journey

__all__ = ["plan_journey"]
