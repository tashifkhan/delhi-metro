"""Service for discovering and serving DMRC map assets."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath

from app.clients.dmrc_frontend_client import DmrcFrontendClient
from app.core.errors import UpstreamApiError
from app.schemas.map_assets import (
    MapAsset,
    MapAssetByFormatResponse,
    MapAssetListResponse,
    MapAssetType,
    MapFamily,
    MapFormat,
)


@dataclass(frozen=True, slots=True)
class _MapPattern:
    family: MapFamily
    label: str
    tokens: tuple[str, ...]


class MapService:
    """Discovers map assets from DMRC frontend manifest and serves metadata."""

    _patterns: tuple[_MapPattern, ...] = (
        _MapPattern(
            family=MapFamily.NETWORK,
            label="DMRC Network Map",
            tokens=("network-map", "dmrc-network-map", "mapimg"),
        ),
        _MapPattern(
            family=MapFamily.AIRPORT_EXPRESS,
            label="Airport Express Map",
            tokens=("airport-express",),
        ),
        _MapPattern(
            family=MapFamily.RAPID_METRO,
            label="Rapid Metro Map",
            tokens=("rapid-metro",),
        ),
    )

    def __init__(self, frontend_client: DmrcFrontendClient) -> None:
        self._frontend_client = frontend_client

    @staticmethod
    def _pick_file_type(path: str) -> MapAssetType | None:
        ext = PurePosixPath(path).suffix.lower()
        if ext in {".jpg", ".jpeg", ".png", ".svg"}:
            return MapAssetType.IMAGE
        if ext == ".pdf":
            return MapAssetType.PDF
        return None

    @staticmethod
    def _clean_name(path: str) -> str:
        name = PurePosixPath(path).name
        stem = name.rsplit(".", maxsplit=1)[0]
        return stem.replace("-", " ").replace("_", " ").strip()

    @staticmethod
    def _stable_rank(path: str) -> int:
        lowered = path.lower()
        rank = 0
        if "dmrc-network-map" in lowered:
            rank -= 40
        if lowered.endswith(".pdf"):
            rank -= 20
        if lowered.endswith((".jpeg", ".jpg", ".png")):
            rank -= 10
        if "mapimg" in lowered:
            rank += 50
        return rank

    async def list_map_assets(self) -> MapAssetListResponse:
        """Return all discovered map assets from the current manifest."""

        files = await self._frontend_client.get_manifest_files()
        assets: list[MapAsset] = []
        seen_paths: set[str] = set()

        for source_key, source_path in files.items():
            lowered_blob = f"{source_key} {source_path}".lower()
            file_type = self._pick_file_type(source_path)
            if file_type is None:
                continue

            for pattern in self._patterns:
                if not any(token in lowered_blob for token in pattern.tokens):
                    continue

                if source_path in seen_paths:
                    continue

                status, headers, url = await self._frontend_client.head(source_path)
                if status >= 400:
                    continue

                size_raw = headers.get("content-length")
                size_value = int(size_raw) if size_raw and size_raw.isdigit() else None

                asset_id = f"{pattern.family.value}:{file_type.value}:{PurePosixPath(source_path).name}"
                assets.append(
                    MapAsset(
                        id=asset_id,
                        family=pattern.family,
                        file_type=file_type,
                        display_name=f"{pattern.label} - {self._clean_name(source_path)}",
                        source_path=source_path,
                        url=url,
                        content_type=headers.get("content-type"),
                        content_length=size_value,
                    )
                )
                seen_paths.add(source_path)

        assets.sort(
            key=lambda item: (
                item.family.value,
                item.file_type.value,
                self._stable_rank(item.source_path),
                item.source_path,
            )
        )
        return MapAssetListResponse(assets=assets)

    async def list_map_assets_by_family(
        self,
        *,
        family: MapFamily,
        format_filter: MapFormat,
    ) -> MapAssetListResponse:
        """List map assets filtered by family and file type format."""

        all_assets = await self.list_map_assets()
        filtered = [asset for asset in all_assets.assets if asset.family == family]
        if format_filter == MapFormat.IMAGE:
            filtered = [
                asset for asset in filtered if asset.file_type == MapAssetType.IMAGE
            ]
        elif format_filter == MapFormat.PDF:
            filtered = [
                asset for asset in filtered if asset.file_type == MapAssetType.PDF
            ]
        return MapAssetListResponse(assets=filtered)

    async def resolve_primary_assets(
        self, family: MapFamily
    ) -> MapAssetByFormatResponse:
        """Resolve primary image/pdf asset for one map family."""

        assets = await self.list_map_assets_by_family(
            family=family,
            format_filter=MapFormat.ANY,
        )
        image = next(
            (a for a in assets.assets if a.file_type == MapAssetType.IMAGE), None
        )
        pdf = next((a for a in assets.assets if a.file_type == MapAssetType.PDF), None)
        return MapAssetByFormatResponse(family=family, image=image, pdf=pdf)

    async def resolve_asset_for_family(
        self,
        *,
        family: MapFamily,
        format_filter: MapFormat,
    ) -> MapAsset:
        """Resolve one preferred asset for a family and requested format."""

        if format_filter == MapFormat.ANY:
            assets = await self.list_map_assets_by_family(
                family=family,
                format_filter=MapFormat.ANY,
            )
            if assets.assets:
                return assets.assets[0]
            raise UpstreamApiError(
                message=f"No map assets found for family '{family.value}'",
                status_code=404,
            )

        expected_file_type = (
            MapAssetType.IMAGE if format_filter == MapFormat.IMAGE else MapAssetType.PDF
        )
        assets = await self.list_map_assets_by_family(
            family=family,
            format_filter=format_filter,
        )
        for asset in assets.assets:
            if asset.file_type == expected_file_type:
                return asset

        raise UpstreamApiError(
            message=(
                f"No {format_filter.value} map asset found for family '{family.value}'"
            ),
            status_code=404,
        )

    async def get_asset_by_id(self, asset_id: str) -> MapAsset:
        """Find a discovered asset by stable identifier."""

        assets = await self.list_map_assets()
        for asset in assets.assets:
            if asset.id == asset_id:
                return asset
        raise UpstreamApiError(
            message=f"Map asset not found: {asset_id}", status_code=404
        )

    async def download_asset_by_id(
        self,
        asset_id: str,
    ) -> tuple[MapAsset, bytes, dict[str, str], str]:
        """Download a map asset and return metadata + raw bytes."""

        asset = await self.get_asset_by_id(asset_id)
        content, headers, url, _ = await self._frontend_client.get_bytes(
            asset.source_path
        )
        return asset, content, headers, url
