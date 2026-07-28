"""Helpers for validating upstream payloads into typed models.

DMRC is an external, undocumented upstream, so a schema mismatch is an upstream
failure rather than a bug in a caller's request. These helpers keep that
translation in one place instead of repeating it in every service.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, TypeAdapter, ValidationError

from core.errors import ApiRequestError, UpstreamApiError

_DMRC_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9]+$")


def normalize_dmrc_identifier(
    value: str,
    *,
    label: str = "DMRC identifier",
    min_length: int = 2,
    max_length: int = 16,
) -> str:
    """Validate a value before interpolating it into an upstream URL path."""

    normalized = value.strip().upper()
    if (
        not min_length <= len(normalized) <= max_length
        or _DMRC_IDENTIFIER_PATTERN.fullmatch(normalized) is None
    ):
        raise ApiRequestError(
            f"{label} must be {min_length}-{max_length} alphanumeric characters"
        )
    return normalized


def validate_model[ModelT: BaseModel](
    model_type: type[ModelT], payload: object
) -> ModelT:
    """Validate a payload into a model, mapping schema drift to upstream errors."""

    try:
        return model_type.model_validate(payload)
    except ValidationError as exc:
        raise UpstreamApiError("Upstream payload validation failed") from exc


def validate_with_adapter[T](adapter: TypeAdapter[T], payload: object) -> T:
    """Validate a payload with a `TypeAdapter` (for list/union roots)."""

    try:
        return adapter.validate_python(payload)
    except ValidationError as exc:
        raise UpstreamApiError("Upstream payload validation failed") from exc
