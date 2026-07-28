"""Client for DMRC frontend build artifacts (asset-manifest + static files)."""

from __future__ import annotations

import asyncio
import re
import time
from collections.abc import Mapping
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

import httpx

from core.config import settings
from core.errors import UpstreamApiError


class DmrcFrontendClient:
    """HTTP client for non-API frontend resources hosted on delhimetrorail.com."""

    _asset_cache_ttl_seconds = 15 * 60
    _static_asset_pattern = re.compile(
        r"""static/media/[^"'\\?]+?\.(?:jpe?g|png|svg|pdf)""",
        flags=re.IGNORECASE,
    )

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._loop_id: int | None = None
        self._asset_files_cache: dict[str, str] | None = None
        self._asset_files_cached_at = 0.0

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

    @staticmethod
    def _normalize_relative_path(path: str) -> str:
        """Return a safe same-origin path and reject absolute/traversing URLs."""

        candidate = path.strip()
        parsed = urlsplit(candidate)
        if (
            not candidate
            or parsed.scheme
            or parsed.netloc
            or parsed.query
            or parsed.fragment
        ):
            raise UpstreamApiError("DMRC frontend supplied an unsafe asset URL")

        decoded_path = unquote(parsed.path).replace("\\", "/")
        if decoded_path.startswith("//"):
            raise UpstreamApiError("DMRC frontend supplied an unsafe asset path")
        segments = decoded_path.split("/")
        if any(segment in {".", ".."} for segment in segments):
            raise UpstreamApiError("DMRC frontend supplied a traversing asset path")

        clean_path = parsed.path.lstrip("/")
        if not clean_path:
            raise UpstreamApiError("DMRC frontend supplied an empty asset path")
        return clean_path

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
                try:
                    self._normalize_relative_path(value)
                except UpstreamApiError:
                    continue
                normalized[key] = value
        return normalized

    async def _get_text(self, path: str) -> str:
        """Download a frontend text asset."""

        client = await self._get_client()
        clean_path = self._normalize_relative_path(path)
        try:
            response = await client.get(clean_path)
        except httpx.TimeoutException as exc:
            raise UpstreamApiError("DMRC frontend bundle request timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamApiError("DMRC frontend bundle transport failure") from exc

        if response.status_code >= 400:
            raise UpstreamApiError(
                message="DMRC frontend bundle request failed",
                status_code=response.status_code,
            )
        return response.text

    @classmethod
    def _extract_static_asset_paths(cls, bundle: str) -> set[str]:
        """Extract static image/PDF paths embedded in a compiled JS bundle."""

        return {f"/{match}" for match in cls._static_asset_pattern.findall(bundle)}

    async def get_asset_files(self) -> dict[str, str]:
        """Return manifest assets plus files referenced by the main JS bundle.

        DMRC's current React build does not include every imported media file in
        ``asset-manifest.json``. In particular, the full network map and its PDF
        are emitted as module references inside the main bundle, while the
        manifest only exposes a small ``mapimg`` preview.
        """

        now = time.monotonic()
        if (
            self._asset_files_cache is not None
            and now - self._asset_files_cached_at < self._asset_cache_ttl_seconds
        ):
            return dict(self._asset_files_cache)

        files = await self.get_manifest_files()
        discovered = dict(files)
        main_bundles = [
            value
            for key, value in files.items()
            if value.lower().endswith(".js")
            and (
                key.lower() == "main.js"
                or PurePosixPath(value).name.lower().startswith("main.")
            )
        ]

        # Bundle inspection is an enhancement over the manifest. If DMRC
        # temporarily blocks a bundle request, keep serving manifest assets.
        for bundle_path in main_bundles:
            try:
                bundle = await self._get_text(bundle_path)
            except UpstreamApiError:
                continue
            for asset_path in self._extract_static_asset_paths(bundle):
                discovered.setdefault(f"bundle:{asset_path}", asset_path)

        self._asset_files_cache = discovered
        self._asset_files_cached_at = now
        return dict(discovered)

    async def head(self, path: str) -> tuple[int, dict[str, str], str]:
        """Run a HEAD request against a static asset path."""

        client = await self._get_client()
        clean_path = self._normalize_relative_path(path)
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
        clean_path = self._normalize_relative_path(path)
        try:
            async with client.stream("GET", clean_path) as response:
                if response.status_code >= 400:
                    raise UpstreamApiError(
                        message="DMRC frontend static asset request failed",
                        status_code=response.status_code,
                    )

                declared_size = response.headers.get("content-length")
                if (
                    declared_size
                    and declared_size.isdigit()
                    and int(declared_size) > settings.map_download_max_bytes
                ):
                    raise UpstreamApiError("DMRC frontend map asset is too large")

                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > settings.map_download_max_bytes:
                        raise UpstreamApiError("DMRC frontend map asset is too large")

                return (
                    bytes(content),
                    dict(response.headers),
                    str(response.url),
                    response.status_code,
                )
        except httpx.TimeoutException as exc:
            raise UpstreamApiError("DMRC frontend download timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamApiError("DMRC frontend download failed") from exc


# Application-wide client instance, shared by the map asset service.
frontend_client = DmrcFrontendClient()
