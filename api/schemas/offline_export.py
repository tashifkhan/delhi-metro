"""Manifest for the prebuilt offline export."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

Digest = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]


class ExportSection(BaseModel):
    count: int = Field(ge=0)
    sha256: Digest


class ExportManifest(BaseModel):
    version: str
    generated_at: datetime
    sha256: Digest
    size_bytes: int = Field(gt=0)
    sections: dict[str, ExportSection]
    router_agreement: float | None = Field(default=None, ge=0, le=1)
