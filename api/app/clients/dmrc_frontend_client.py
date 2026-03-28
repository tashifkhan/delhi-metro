"""Client for DMRC frontend build artifacts (asset-manifest + static files)."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping

import httpx

from app.core.config import settings
from app.core.errors import UpstreamApiError


class DmrcFrontendClient:
    """HTTP client for non-API frontend resources hosted on delhimetrorail.com."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._loop_id: int | None = None

    def _build_client(self) -> httpx.AsyncClient:
        """Create a configured async HTTP client."""

        return httpx.AsyncClient(
            base_url=str(settings.dmrc_frontend_base_url),
            timeout=settings.dmrc_frontend_timeout_seconds,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) "
                    "Gecko/20100101 Firefox/148.0"
                ),
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://delhimetrorail.com/",
            },
        )

    async def _get_client(self) -> httpx.AsyncClient:
        """Return a client bound to current running event loop."""

        current_loop_id = id(asyncio.get_running_loop())
        if self._client is not None and self._loop_id == current_loop_id:
            return self._client

        if self._client is not None:
            try:
                await self._client.aclose()
            except RuntimeError:
                pass

        self._client = self._build_client()
        self._loop_id = current_loop_id
        return self._client

    async def close(self) -> None:
        """Close underlying async client transport."""

        if self._client is not None:
            try:
                await self._client.aclose()
            except RuntimeError:
                pass
        self._client = None
        self._loop_id = None

    async def get_manifest_files(self) -> dict[str, str]:
        """Fetch and validate `asset-manifest.json` files mapping."""

        client = await self._get_client()
        try:
            response = await client.get("asset-manifest.json")
        except httpx.TimeoutException as exc:
            raise UpstreamApiError("DMRC frontend request timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamApiError("DMRC frontend transport failure") from exc

        if response.status_code >= 400:
            raise UpstreamApiError(
                message="DMRC frontend manifest request failed",
                status_code=response.status_code,
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise UpstreamApiError("Invalid JSON in DMRC frontend manifest") from exc

        if not isinstance(payload, Mapping):
            raise UpstreamApiError("Unexpected manifest payload type")

        files = payload.get("files")
        if not isinstance(files, Mapping):
            raise UpstreamApiError("Manifest is missing files mapping")

        normalized: dict[str, str] = {}
        for key, value in files.items():
            if isinstance(key, str) and isinstance(value, str):
                normalized[key] = value
        return normalized

    async def head(self, path: str) -> tuple[int, dict[str, str], str]:
        """Run a HEAD request against a static asset path."""

        client = await self._get_client()
        clean_path = path.lstrip("/")
        try:
            response = await client.head(clean_path)
        except httpx.TimeoutException as exc:
            raise UpstreamApiError("DMRC frontend HEAD request timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamApiError("DMRC frontend HEAD transport failure") from exc

        return (
            response.status_code,
            dict(response.headers),
            str(response.url),
        )

    async def get_bytes(self, path: str) -> tuple[bytes, dict[str, str], str, int]:
        """Download static file bytes from DMRC frontend host."""

        client = await self._get_client()
        clean_path = path.lstrip("/")
        try:
            response = await client.get(clean_path)
        except httpx.TimeoutException as exc:
            raise UpstreamApiError("DMRC frontend download timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamApiError("DMRC frontend download failed") from exc

        if response.status_code >= 400:
            raise UpstreamApiError(
                message="DMRC frontend static asset request failed",
                status_code=response.status_code,
            )

        return (
            response.content,
            dict(response.headers),
            str(response.url),
            response.status_code,
        )
