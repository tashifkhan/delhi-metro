"""Async client for communicating with DMRC upstream APIs."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import UpstreamApiError


class DmrcApiClient:
    """Thin typed wrapper over `httpx.AsyncClient` for DMRC endpoints."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._loop_id: int | None = None

    def _build_client(self) -> httpx.AsyncClient:
        """Create a configured async HTTP client."""

        return httpx.AsyncClient(
            base_url=str(settings.dmrc_base_url),
            timeout=settings.dmrc_timeout_seconds,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) "
                    "Gecko/20100101 Firefox/148.0"
                ),
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://delhimetrorail.com/",
                "Origin": "https://delhimetrorail.com",
                "content-type": "application/json",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
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
        """Close underlying httpx client resources."""

        if self._client is not None:
            try:
                await self._client.aclose()
            except RuntimeError:
                pass
        self._client = None
        self._loop_id = None

    async def get_json(self, path: str) -> list[Any] | dict[str, Any]:
        """Send GET request and decode validated JSON payload.

        Args:
            path: Relative API path from configured DMRC base URL.

        Returns:
            Parsed JSON payload.

        Raises:
            UpstreamApiError: If response is non-2xx or payload is not JSON.
        """

        client = await self._get_client()
        try:
            response = await client.get(path)
        except httpx.TimeoutException as exc:
            raise UpstreamApiError("DMRC upstream request timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamApiError("DMRC upstream transport failure") from exc

        if response.status_code >= 400:
            raise UpstreamApiError(
                message=f"DMRC upstream returned error for path '{path}'",
                status_code=response.status_code,
            )

        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            raise UpstreamApiError(
                message=(
                    f"Unexpected DMRC response content-type '{content_type}' "
                    f"for path '{path}'"
                ),
                status_code=response.status_code,
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise UpstreamApiError("Invalid JSON from DMRC upstream") from exc

        if isinstance(payload, (list, dict)):
            return payload

        raise UpstreamApiError(
            message=f"Unexpected JSON root type for path '{path}'",
            status_code=response.status_code,
        )

    async def get_json_dict(self, path: str) -> dict[str, Any]:
        """Fetch JSON and ensure top-level payload is an object."""

        payload = await self.get_json(path)
        if not isinstance(payload, Mapping):
            raise UpstreamApiError(f"Expected object payload for path '{path}'")
        return dict(payload)

    async def get_json_list(self, path: str) -> list[Any]:
        """Fetch JSON and ensure top-level payload is an array."""

        payload = await self.get_json(path)
        if not isinstance(payload, list):
            raise UpstreamApiError(f"Expected list payload for path '{path}'")
        return payload
