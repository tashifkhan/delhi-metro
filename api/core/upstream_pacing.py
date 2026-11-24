"""Optional process-local pacing for batch jobs that use the service layer."""

import asyncio
from contextlib import contextmanager
from contextvars import ContextVar
from time import monotonic


class RequestPacer:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._next_start = 0.0

    async def wait(self) -> None:
        async with self._lock:
            remaining = self._next_start - monotonic()
            if remaining > 0:
                await asyncio.sleep(remaining)
            self._next_start = monotonic() + 1.0


_pacer: ContextVar[RequestPacer | None] = ContextVar(
    "upstream_request_pacer", default=None
)


@contextmanager
def paced_requests():
    token = _pacer.set(RequestPacer())
    try:
        yield
    finally:
        _pacer.reset(token)


async def pace_request() -> None:
    if (pacer := _pacer.get()) is not None:
        await pacer.wait()
