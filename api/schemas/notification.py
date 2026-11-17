"""Pydantic models for DMRC passenger notification payloads."""

from __future__ import annotations

from collections.abc import Mapping

from pydantic import BaseModel, ConfigDict, field_validator

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

    @field_validator("link_to_file", mode="before")
    @classmethod
    def _flatten_attachment(cls, value: object) -> object:
        """Flatten a media object to its file path.

        DMRC used to publish `link_to_file` as a relative path, and newer
        notices publish the media object (`{title, file}`) instead. Both
        point at the same document, so the path stays the API contract.
        """

        if isinstance(value, Mapping):
            file = value.get("file")
            return file if isinstance(file, str) else None
        return value


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
