"""DMRC (Delhi Metro) routes, split by domain.

Mounted as one router so `main.py` composes networks rather than individual
domains; `routes/nmrc/` mirrors this shape for Noida Metro.
"""

from fastapi import APIRouter

from routes.dmrc import journeys, lines, maps, notifications, stations

router = APIRouter(prefix="/dmrc")
router.include_router(lines.router)
router.include_router(stations.router)
router.include_router(journeys.router)
router.include_router(notifications.router)
router.include_router(maps.router)

__all__ = ["router"]
