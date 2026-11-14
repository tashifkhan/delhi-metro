"""Official-map station layout, mounted under each network's `/maps` router."""

from __future__ import annotations

import asyncio
import contextlib
import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Header, Query
from fastapi.responses import StreamingResponse

from schemas.map_layout import MapLayout
from schemas.planner import MetroNetwork
from services import map_layout

HEARTBEAT_SECONDS = 15.0

_DESCRIPTION = """
Where each station sits on the operator's official map image, as fractions of
the image's width and height.

**How it stays current.** On each request the API fetches the official image
and hashes it (at most every few hours per server process). If the hash matches
the layout it already holds, that layout comes back straight away. If the image
changed, Gemini reads the new one: large images are cut into overlapping tiles,
each tile returns the stations it can see, and the result replaces the old
layout only if enough of the network's stations were found.

**Waiting.** Reading a changed map takes about a minute. Ask for
`text/event-stream` (send `Accept: text/event-stream` or add `?stream=true`) to
get progress as Server-Sent Events:

- `status`: `{"stage", "message", "done", "total"}`. `stage` is `checking`,
  `unchanged`, `extracting`, `progress` or `saved`. `message` is ready to show
  to the person waiting.
- `error`: `{"detail"}` when the image can't be fetched or read. A `layout`
  event with the last good layout still follows.
- `layout`: the final `MapLayout`, always the last event.

Without the stream the request simply waits and returns the final layout.

**Switches.** Each network has its own setting: `MAP_LAYOUT_NMRC_ENABLED`
(on by default) and `MAP_LAYOUT_DMRC_ENABLED` (off, since Delhi coordinates come
from DMRC's own data). A switched-off network answers `status: "disabled"`.
Without `GEMINI_API_KEY` the API serves the last saved layout and reports why.
""".strip()


def _sse(name: str, data: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


async def _stream(network: MetroNetwork) -> AsyncIterator[str]:
    """Format layout events as SSE, with comment pings while Gemini works."""

    events = map_layout.layout_events(network).__aiter__()
    pending = asyncio.ensure_future(events.__anext__())
    try:
        while True:
            done, _ = await asyncio.wait({pending}, timeout=HEARTBEAT_SECONDS)
            if not done:
                # Keeps proxies and the browser from closing a quiet connection.
                yield ": still working\n\n"
                continue
            try:
                name, data = pending.result()
            except StopAsyncIteration:
                return
            yield _sse(name, data)
            pending = asyncio.ensure_future(events.__anext__())
    finally:
        pending.cancel()
        with contextlib.suppress(BaseException):
            await events.aclose()


def mount_map_layout(router: APIRouter, network: MetroNetwork) -> None:
    """Add `GET /layout` to a network's `/maps` router.

    Call it before the router declares `/{family}`, or that path would capture
    `layout` as a map family.
    """

    @router.get(
        "/layout",
        response_model=MapLayout,
        summary=f"Station positions on the official {network.value.upper()} map",
        description=_DESCRIPTION,
        responses={
            200: {
                "content": {
                    "text/event-stream": {
                        "schema": {"type": "string"},
                        "example": (
                            'event: status\ndata: {"stage":"extracting","message":"The official '
                            'Noida Metro map changed. Reading it again, this takes about a '
                            'minute.","done":null,"total":null}\n\n'
                            'event: layout\ndata: {"network":"nmrc","status":"ready",...}\n\n'
                        ),
                    }
                }
            }
        },
    )
    async def get_map_layout(
        stream: Annotated[
            bool,
            Query(description="Return Server-Sent Events instead of waiting for JSON."),
        ] = False,
        accept: Annotated[str | None, Header()] = None,
    ):
        wants_stream = stream or "text/event-stream" in (accept or "")
        if not wants_stream:
            return await map_layout.resolve_layout(network)
        return StreamingResponse(
            _stream(network),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )
