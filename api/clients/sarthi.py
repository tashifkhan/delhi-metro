"""Async client for the Delhi Metro Sarthi journey API.

This upstream is vendor-operated and undocumented (see
`docs/dmrc-sarthi-api-research.md`). It answers anonymously, but it reports
invalid input as a generic HTTP 500, so failures here are never retried — the
planner falls back to the legacy DMRC API instead.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

import httpx

from core.config import settings
from core.errors import UpstreamApiError


class SarthiApiClient:
    """Thin typed wrapper over `httpx.AsyncClient` for Sarthi endpoints."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._loop_id: int | None = None

    def _build_client(self) -> httpx.AsyncClient:
        """Create a configured async HTTP client."""

        return httpx.AsyncClient(
            base_url=str(settings.sarthi_base_url),
            timeout=settings.sarthi_timeout_seconds,
            follow_redirects=True,
            headers={"Accept": "application/json"},
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

    async def get_json_dict(
        self,
        path: str,
        *,
        params: Mapping[str, str | int] | None = None,
    ) -> dict[str, Any]:
        """Send GET request and decode a JSON object payload.

        Raises:
            UpstreamApiError: On transport failure, non-2xx status, or a
                payload that is not a JSON object.
        """

        client = await self._get_client()
        try:
            response = await client.get(path, params=params)
        except httpx.TimeoutException as exc:
            raise UpstreamApiError("Sarthi upstream request timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamApiError("Sarthi upstream transport failure") from exc

        if response.status_code >= 400:
            # Sarthi answers unknown station codes, unknown strategies, and
            # same-origin journeys with a generic 500, so the status carries no
            # actionable detail for the caller.
            raise UpstreamApiError(
                message=f"Sarthi upstream returned error for path '{path}'",
                status_code=response.status_code,
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise UpstreamApiError("Invalid JSON from Sarthi upstream") from exc

        if not isinstance(payload, Mapping):
            raise UpstreamApiError(f"Expected object payload for path '{path}'")

        return dict(payload)


# Application-wide client instance, shared by the Sarthi journey service.
sarthi_client = SarthiApiClient()
