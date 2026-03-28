"""Local entry script.

Run the API using:

    uv run uvicorn app.main:app --reload
"""

from app.main import app

__all__ = ["app"]
