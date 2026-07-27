"""Health endpoints for liveness/readiness checks."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    summary="Health check",
    description=(
        "Simple liveness probe for deployment platforms and local development."
    ),
)
async def health() -> dict[str, str]:
    """Return service liveness status.

    Returns:
        A minimal status payload indicating this API process is reachable.
    """

    return {"status": "ok"}
