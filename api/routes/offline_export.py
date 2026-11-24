"""Serve an offline bundle without planning or contacting metro operators."""

from fastapi import APIRouter, Request, Response

from schemas.offline_export import ExportManifest
from services.offline_export import export_store

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/manifest")
async def manifest(response: Response) -> ExportManifest:
    artifact = await export_store.get()
    response.headers["Cache-Control"] = "public, max-age=300"
    return artifact.manifest


@router.get("", response_class=Response)
async def download(request: Request) -> Response:
    artifact = await export_store.get()
    etag = f'"{artifact.manifest.sha256}"'
    headers = {"ETag": etag, "Cache-Control": "public, max-age=300, no-transform"}
    matches = (
        item.strip().removeprefix("W/")
        for item in request.headers.get("if-none-match", "").split(",")
    )
    if any(item in {etag, "*"} for item in matches):
        return Response(status_code=304, headers=headers)
    return Response(
        artifact.compressed,
        media_type="application/json",
        headers={**headers, "Content-Encoding": "gzip"},
    )
