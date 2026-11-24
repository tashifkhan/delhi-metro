"""Package an offline snapshot and load the latest verified artifact."""

import asyncio
import gzip
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from time import monotonic
from zipfile import ZIP_STORED, BadZipFile, ZipFile

import httpx

from core.config import settings
from core.errors import ApiRequestError
from schemas.offline_export import ExportManifest

ARCHIVE_NAME = "offline-export.zip"
_MANIFEST_NAME = "manifest.json"
_BUNDLE_NAME = "bundle.json.gz"
_MAX_COMPRESSED = 4_000_000
_MAX_JSON = 32_000_000
_MAX_ARCHIVE = _MAX_COMPRESSED + 32_000
_REFRESH_SECONDS = 900
logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ExportArtifact:
    manifest: ExportManifest
    compressed: bytes

    def read_bundle(self) -> dict:
        return json.loads(gzip.decompress(self.compressed))


def json_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _section_count(section: object) -> int:
    if isinstance(section, (dict, list)):
        return len(section)
    raise TypeError("Offline export sections must be objects or arrays")


def write_artifact(
    bundle: dict, target: Path, *, router_agreement: float | None = None
) -> ExportManifest:
    raw = json_bytes(bundle)
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    if len(raw) > _MAX_JSON or len(compressed) > _MAX_COMPRESSED:
        raise ValueError("Offline bundle exceeds its size limit")
    digest = sha256(raw).hexdigest()
    manifest = ExportManifest(
        version=f"{bundle['schema_version']}-{digest[:16]}",
        generated_at=datetime.now(UTC),
        sha256=digest,
        size_bytes=len(compressed),
        sections={
            name: {
                "count": _section_count(section),
                "sha256": sha256(json_bytes(section)).hexdigest(),
            }
            for name, section in bundle["sections"].items()
        },
        router_agreement=router_agreement,
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        try:
            with ZipFile(temporary, "w", compression=ZIP_STORED) as archive:
                archive.writestr(_MANIFEST_NAME, manifest.model_dump_json())
                archive.writestr(_BUNDLE_NAME, compressed)
            temporary.flush()
            os.replace(temporary_path, target)
        finally:
            temporary_path.unlink(missing_ok=True)
    return manifest


def read_artifact(source: Path | bytes) -> ExportArtifact:
    if isinstance(source, Path):
        if source.stat().st_size > _MAX_ARCHIVE:
            raise ValueError("Offline export archive exceeds size limit")
        source = source.read_bytes()
    if len(source) > _MAX_ARCHIVE:
        raise ValueError("Offline export archive exceeds size limit")
    with ZipFile(BytesIO(source)) as archive:
        if sorted(archive.namelist()) != sorted((_MANIFEST_NAME, _BUNDLE_NAME)):
            raise ValueError("Unexpected files in offline export archive")
        if archive.getinfo(_MANIFEST_NAME).file_size > 30_000:
            raise ValueError("Offline export manifest exceeds size limit")
        manifest = ExportManifest.model_validate_json(archive.read(_MANIFEST_NAME))
        size = archive.getinfo(_BUNDLE_NAME).file_size
        if size != manifest.size_bytes or size > _MAX_COMPRESSED:
            raise ValueError("Invalid offline export bundle size")
        compressed = archive.read(_BUNDLE_NAME)

    with gzip.GzipFile(fileobj=BytesIO(compressed)) as decoded:
        raw = decoded.read(_MAX_JSON + 1)
    if len(raw) > _MAX_JSON or sha256(raw).hexdigest() != manifest.sha256:
        raise ValueError("Offline export bundle failed its hash check")
    return ExportArtifact(manifest, compressed)


async def _download(url: str) -> ExportArtifact:
    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            data = bytearray()
            async for part in response.aiter_bytes():
                data.extend(part)
                if len(data) > _MAX_ARCHIVE:
                    raise ValueError("Offline export archive exceeds size limit")
    return await asyncio.to_thread(read_artifact, bytes(data))


class ExportStore:
    def __init__(self) -> None:
        self._artifact: ExportArtifact | None = None
        self._refresh_at = 0.0
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock: asyncio.Lock | None = None

    async def get(self) -> ExportArtifact:
        loop = asyncio.get_running_loop()
        if self._loop is not loop:
            self._lock = asyncio.Lock()
            self._loop = loop
        async with self._lock:
            if monotonic() >= self._refresh_at:
                await self._refresh()
            if self._artifact is None:
                raise ApiRequestError("The offline export has not been built yet", 503)
            return self._artifact

    async def _refresh(self) -> None:
        url = settings.offline_export_url
        if url is not None:
            try:
                self._artifact = await _download(str(url))
                self._refresh_at = monotonic() + _REFRESH_SECONDS
                return
            except (httpx.HTTPError, OSError, ValueError, BadZipFile, EOFError) as exc:
                logger.warning("Published offline export unavailable: %s", exc)

        if url is None or self._artifact is None:
            try:
                self._artifact = await asyncio.to_thread(
                    read_artifact, settings.offline_export_path
                )
            except (OSError, ValueError, BadZipFile, EOFError) as exc:
                logger.warning("Local offline export unavailable: %s", exc)
        self._refresh_at = monotonic() + (
            _REFRESH_SECONDS if url is None and self._artifact else 60
        )


export_store = ExportStore()
