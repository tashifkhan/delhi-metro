"""Anonymous Namo Bharat and Meerut Metro passenger routes."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from schemas.line import MetroLine
from schemas.map_asset import (
    MapAsset,
    MapAssetByFormatResponse,
    MapAssetListResponse,
    MapFamily,
    MapFormat,
)
from schemas.notification import NCRTCPassengerNotification, PassengerNotificationDetail
from schemas.station import StationDetail
from services.ncrtc import catalog, help, live, map_asset, notification, station
from services.ncrtc.catalog import NCRTCStationByLineItem

router = APIRouter(prefix="/ncrtc", tags=["ncrtc"])


class SnapshotResponse(BaseModel):
    data: dict[str, Any]
    stale: bool
    fetched_at: datetime


@router.get("/lines")
async def list_lines() -> list[MetroLine]:
    return list(catalog.LINES)


@router.get("/lines/{line_code}/stations")
async def stations_by_line(
    line_code: str, response: Response
) -> list[NCRTCStationByLineItem]:
    return await catalog.search(line_code=line_code, response_headers=response.headers)


@router.get("/stations")
@router.get("/stations/search")
async def list_stations(
    response: Response, query: str = ""
) -> list[NCRTCStationByLineItem]:
    return await catalog.search(query=query, response_headers=response.headers)


@router.get("/stations/{code}/next-trains")
async def next_trains(code: str) -> SnapshotResponse:
    return SnapshotResponse(**(await live.next_trains(code)).envelope())


@router.get("/stations/{code}")
async def station_detail(code: str) -> StationDetail:
    return await station.get_station_detail(code)


@router.get("/trains/live")
async def live_trains() -> SnapshotResponse:
    return SnapshotResponse(**(await live.live_trains()).envelope())


@router.get("/parking")
async def live_parking() -> SnapshotResponse:
    return SnapshotResponse(**(await live.parking()))


@router.get("/help")
async def passenger_help() -> SnapshotResponse:
    return SnapshotResponse(**(await help.passenger_help()))


@router.get("/notifications")
async def notices() -> list[NCRTCPassengerNotification]:
    return await notification.list_notifications()


@router.get("/notifications/{page_slug}")
async def notice_detail(page_slug: str) -> PassengerNotificationDetail:
    return await notification.get_notification_detail(page_slug)


@router.get("/maps/assets")
async def map_assets() -> MapAssetListResponse:
    return await map_asset.list_map_assets()


@router.get("/maps/assets/{asset_id}")
async def map_metadata(asset_id: str) -> MapAsset:
    return await map_asset.get_asset_by_id(asset_id)


@router.get("/maps/{family}/assets")
async def family_assets(
    family: MapFamily, format: MapFormat = MapFormat.ANY
) -> MapAssetListResponse:
    return await map_asset.list_map_assets(family, format)


@router.get("/maps/{family}")
async def primary_maps(family: MapFamily) -> MapAssetByFormatResponse:
    return await map_asset.resolve_primary_assets(family)


@router.get("/maps/{family}/download", response_class=RedirectResponse, status_code=307)
async def redirect_map(
    family: MapFamily, format: MapFormat = MapFormat.ANY
) -> RedirectResponse:
    asset = await map_asset.resolve_asset_for_family(family, format)
    return RedirectResponse(
        str(asset.url),
        headers={
            "X-NCRTC-Stale": str(asset.stale).lower(),
            "X-NCRTC-Fetched-At": asset.fetched_at.isoformat(),
        },
    )


@router.get("/maps/{family}/file", response_class=Response)
async def map_file(family: MapFamily, format: MapFormat = MapFormat.ANY) -> Response:
    asset = await map_asset.resolve_asset_for_family(family, format)
    content, _ = await map_asset.download_asset(asset)
    return Response(
        content,
        media_type=asset.content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'attachment; filename="{asset.id}.{asset.source_path.rsplit(".", 1)[-1]}"',
            "X-Content-Type-Options": "nosniff",
            "X-NCRTC-Stale": str(asset.stale).lower(),
            "X-NCRTC-Fetched-At": asset.fetched_at.isoformat(),
        },
    )
