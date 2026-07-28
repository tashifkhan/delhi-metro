"""NMRC (Noida Metro) routes, split by domain like the DMRC routes.

Every endpoint returns the same schemas as its DMRC counterpart, so a client
can switch networks without a second response contract.
"""

from fastapi import APIRouter

from routes.nmrc import lines, maps, notifications, stations

router = APIRouter(prefix="/nmrc")
router.include_router(lines.router)
router.include_router(stations.router)
router.include_router(notifications.router)
router.include_router(maps.router)

__all__ = ["router"]
