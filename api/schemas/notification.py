"""Pydantic models for DMRC passenger notification payloads."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from schemas.common import AssetImage


class NotificationType(BaseModel):
    """Notification category object."""

    name: str
    image: AssetImage


class PassengerNotification(BaseModel):
    """Passenger notification item."""

    id: int
    title: str
    notification_type: NotificationType | None = None
    image: AssetImage | None = None
    video_url: str | None = None
    link_to: str | None = None
    link_to_file: str | None = None
    link_to_internal_page: str | None = None
    link_to_outside_url: str | None = None
    date: str


class PassengerNotificationDetail(BaseModel):
    """Normalized detail page linked from a passenger notification."""

    model_config = ConfigDict(extra="allow")

    page_id: int | None = None
    title: str
    content: str
    page_slug: str
    cover_photo: AssetImage | None = None
    seo_title: str | None = None
    search_description: str | None = None


class PassengerPressReleaseDetail(BaseModel):
    """Press-release payload returned by DMRC's separate detail endpoint."""

    model_config = ConfigDict(extra="allow")

    page_slug: str
    english_title: str | None = None
    hindi_title: str | None = None
    body_english: str | None = None
    body_hindi: str | None = None
    date: str | None = None
