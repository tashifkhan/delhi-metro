"""Custom exception types for request, service, and transport layers."""

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


@dataclass(slots=True)
class ApiRequestError(Exception):
    """A caller-visible request or API-resource error.

    This is deliberately separate from :class:`UpstreamApiError`: an upstream
    401/403/404 is a gateway failure, while a locally validated bad request or
    missing wrapper resource should retain its 4xx meaning.
    """

    message: str
    status_code: int = 400

    def __str__(self) -> str:
        return self.message
