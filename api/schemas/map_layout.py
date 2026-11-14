"""Station positions read off an operator's official map image."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from schemas.planner import MetroNetwork


class LayoutStatus(str, Enum):
    READY = "ready"
    DISABLED = "disabled"
    UNAVAILABLE = "unavailable"


class LayoutImage(BaseModel):
    """The official image the positions were read from."""

    url: str = Field(description="Where the operator publishes the image.")
    sha256: str = Field(description="Hash of the image bytes the layout was read from.")
    width: int = Field(description="Image width in pixels.")
    height: int = Field(description="Image height in pixels.")


class LayoutCoverage(BaseModel):
    expected: int = Field(description="Stations in this network's catalogue.")
    found: int = Field(description="Stations Gemini placed on the image.")


class LayoutStation(BaseModel):
    code: str = Field(description="Station code, the same one the station endpoints use.")
    name: str
    x: float = Field(ge=0.0, le=1.0, description="Marker centre, fraction of image width from the left.")
    y: float = Field(ge=0.0, le=1.0, description="Marker centre, fraction of image height from the top.")


class MapLayout(BaseModel):
    """Where each station sits on the official map image."""

    network: MetroNetwork
    status: LayoutStatus
    detail: str | None = Field(
        default=None,
        description="Why the layout is disabled, unavailable, or older than the current image.",
    )
    image: LayoutImage | None = None
    model: str | None = Field(default=None, description="Gemini model that read the image.")
    extracted_at: datetime | None = None
    coverage: LayoutCoverage = Field(default_factory=lambda: LayoutCoverage(expected=0, found=0))
    stations: list[LayoutStation] = Field(default_factory=list)
    dropped: list[str] = Field(
        default_factory=list,
        description=(
            "Codes Gemini placed far off their own line. They are left out of "
            "`stations`, so a client keeps its own position for them."
        ),
    )


class LayoutStage(str, Enum):
    CHECKING = "checking"
    UNCHANGED = "unchanged"
    EXTRACTING = "extracting"
    PROGRESS = "progress"
    SAVED = "saved"


class LayoutStatusEvent(BaseModel):
    """Progress report sent as an SSE `status` event."""

    stage: LayoutStage
    message: str = Field(description="Text meant for the person waiting.")
    done: int | None = None
    total: int | None = None
