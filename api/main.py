"""Local entry script.

Run the API using:

    uv run uvicorn app.main:app --reload
"""

from app.main import app

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app=app,
        port=8080,
        reload=True
    )
`
