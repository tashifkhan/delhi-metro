"""Public NCRTC contacts, frequently asked questions, and found items."""

import asyncio

from pydantic import BaseModel, ConfigDict, TypeAdapter

from clients.ncrtc import ncrtc_client
from services.ncrtc.catalog import JOURNEY


class HelpContact(BaseModel):
    model_config = ConfigDict(extra="allow")

    title: str


class FAQ(BaseModel):
    model_config = ConfigDict(extra="allow")

    question: str
    answer: str


class FAQCategory(BaseModel):
    model_config = ConfigDict(extra="allow")

    category: str
    faqList: list[FAQ]


class FoundItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    station: str


_FEEDS = {
    "contacts": ("helpandsupport", TypeAdapter(list[HelpContact])),
    "faqs": ("faqs", TypeAdapter(list[FAQCategory])),
    "found_items": ("lostitems", TypeAdapter(list[FoundItem])),
}


async def passenger_help() -> dict:
    snapshots = await asyncio.gather(
        *(
            ncrtc_client.get(f"{JOURNEY}/{path}", adapter.validate_python)
            for path, adapter in _FEEDS.values()
        )
    )
    stale = [item for item in snapshots if item.stale]
    return {
        "data": {key: item.data for key, item in zip(_FEEDS, snapshots, strict=True)},
        "stale": bool(stale),
        "fetched_at": min(item.fetched_at for item in stale or snapshots),
    }
