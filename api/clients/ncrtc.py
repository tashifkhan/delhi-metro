"""Anonymous NCRTC reads with per-resource refresh and stale fallback."""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from time import monotonic

import httpx
from pydantic import ValidationError

from core.errors import UpstreamApiError
from core.upstream_pacing import pace_request

ROOT = "https://namobharat.ncrtc.in"
STATIC_TTL = 86400
LIVE_TTL = 60


@dataclass
class Snapshot:
    data: object
    fetched_at: datetime
    stale: bool = False

    def envelope(self):
        return vars(self)


class NCRTCClient:
    def __init__(self):
        self.cache = {}
        self.expiry = {}
        self.locks = {}

    async def get(self, path, validate, *, params=None, ttl=STATIC_TTL, retry=False):
        key = (path, tuple(sorted((params or {}).items())))
        async with self.locks.setdefault(key, asyncio.Lock()):
            previous = self.cache.get(key)
            if monotonic() < self.expiry.get(key, 0):
                if previous:
                    return previous
                raise UpstreamApiError(f"NCRTC {path} is temporarily unavailable")

            for attempt in range(2 if retry else 1):
                try:
                    async with httpx.AsyncClient(
                        base_url=ROOT,
                        timeout=15,
                        headers={
                            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
                            "Accept-Language": "en",
                            "Accept": "application/json",
                        },
                    ) as client:
                        await pace_request()
                        response = await client.get(path, params=params)
                        response.raise_for_status()
                        payload = response.json()
                    if isinstance(payload, dict) and "data" in payload:
                        if payload.get("status", 200) not in (200, "200", "SUCCESS"):
                            raise ValueError("Unexpected NCRTC envelope status")
                        payload = payload["data"]
                    snapshot = Snapshot(validate(payload), datetime.now(UTC))
                    self.cache[key] = snapshot
                    self.expiry[key] = monotonic() + ttl
                    return snapshot
                except (
                    httpx.HTTPError,
                    ValidationError,
                    ValueError,
                    KeyError,
                    TypeError,
                ) as exc:
                    failure = exc

            self.expiry[key] = monotonic() + LIVE_TTL
            if previous:
                stale = Snapshot(previous.data, previous.fetched_at, stale=True)
                self.cache[key] = stale
                return stale
            raise UpstreamApiError(f"NCRTC {path} returned no usable data") from failure


ncrtc_client = NCRTCClient()
