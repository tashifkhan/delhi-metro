"""Async-compatible client for NMRC's public HTML pages.

NMRC currently emits a malformed response header (whitespace before a colon).
Strict HTTP/1.1 parsers such as ``httpx``/``h11`` reject the entire response,
while browsers, curl, and Python's standard HTTP client tolerate it. The
blocking standard-library request is therefore isolated in ``asyncio.to_thread``
so it cannot stall FastAPI's event loop.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, ClassVar
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

from core.config import settings
from core.errors import UpstreamApiError


@dataclass(frozen=True, slots=True)
class _Response:
    content: bytes
    headers: dict[str, str]
    url: str
    status: int


class NmrcWebsiteClient:
    """Tolerant transport for NMRC HTML, JSON-string, and image responses."""

    _headers: ClassVar[dict[str, str]] = {
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 15; Pixel 9) "
            "AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36"
        ),
        "Accept-Language": "en-IN,en;q=0.9",
        "Referer": str(settings.nmrc_base_url),
    }

    @staticmethod
    def _build_url(path: str, params: dict[str, str] | None) -> str:
        url = urljoin(str(settings.nmrc_base_url), path.lstrip("/"))
        if params:
            url = f"{url}?{urlencode(params)}"
        return url

    @classmethod
    def _get_sync(
        cls,
        path: str,
        params: dict[str, str] | None,
        max_bytes: int | None = None,
    ) -> _Response:
        url = cls._build_url(path, params)
        request = Request(url, headers=cls._headers, method="GET")
        try:
            with urlopen(request, timeout=settings.nmrc_timeout_seconds) as response:
                status = response.status
                content = response.read(None if max_bytes is None else max_bytes + 1)
                if max_bytes is not None and len(content) > max_bytes:
                    raise UpstreamApiError("NMRC map asset is too large")
                headers = {
                    key.lower(): value for key, value in response.headers.items()
                }
                final_url = response.geturl()
        except HTTPError as exc:
            raise UpstreamApiError(
                message=f"NMRC website returned an error for '{path}'",
                status_code=exc.code,
            ) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise UpstreamApiError("NMRC website transport failure") from exc

        if status >= 400:
            raise UpstreamApiError(
                message=f"NMRC website returned an error for '{path}'",
                status_code=status,
            )
        return _Response(
            content=content,
            headers=headers,
            url=final_url,
            status=status,
        )

    async def _get(
        self,
        path: str,
        *,
        params: dict[str, str] | None = None,
        max_bytes: int | None = None,
    ) -> _Response:
        return await asyncio.to_thread(self._get_sync, path, params, max_bytes)

    async def close(self) -> None:
        """Match the lifecycle interface of the other clients."""

    async def get_text(
        self,
        path: str,
        *,
        params: dict[str, str] | None = None,
    ) -> str:
        response = await self._get(path, params=params)
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type and "text/plain" not in content_type:
            raise UpstreamApiError(
                f"Unexpected NMRC content-type '{content_type}' for '{path}'"
            )
        return response.content.decode("utf-8", errors="replace")

    async def get_json_value(
        self,
        path: str,
        *,
        params: dict[str, str],
    ) -> Any:
        response = await self._get(path, params=params)
        try:
            return json.loads(response.content)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise UpstreamApiError(
                "Invalid JSON from NMRC encryption endpoint"
            ) from exc

    async def get_bytes(self, path: str) -> tuple[bytes, dict[str, str], str]:
        response = await self._get(path, max_bytes=settings.map_download_max_bytes)
        return response.content, response.headers, response.url


nmrc_client = NmrcWebsiteClient()
