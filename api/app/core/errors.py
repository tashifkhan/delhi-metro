"""Custom exception types for service and transport layers."""

from dataclasses import dataclass


@dataclass(slots=True)
class UpstreamApiError(Exception):
    """Raised when DMRC upstream returns an unexpected response."""

    message: str
    status_code: int | None = None

    def __str__(self) -> str:
        if self.status_code is None:
            return self.message
        return f"{self.message} (status={self.status_code})"
