"""Minimal client for Gemini's generateContent REST endpoint.

Only what the map layout reader needs: one image, one prompt, a JSON reply
constrained by a response schema. No SDK, to keep the deploy small.
"""

from __future__ import annotations

import base64
import json
from typing import Any

import httpx

from core.config import settings
from core.errors import UpstreamApiError

_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiNotConfigured(RuntimeError):
    """No API key is set, so Gemini can't be called."""


def is_configured() -> bool:
    key = settings.gemini_api_key
    return key is not None and bool(key.get_secret_value())


async def generate_json(
    *,
    image: bytes,
    mime_type: str,
    prompt: str,
    schema: dict[str, Any],
) -> Any:
    """Send one image with a prompt and return the parsed JSON reply."""

    key = settings.gemini_api_key
    if key is None or not key.get_secret_value():
        raise GeminiNotConfigured("GEMINI_API_KEY is not set")

    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image).decode()}},
                    {"text": prompt},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }

    level = (settings.gemini_thinking_level or "").strip()
    if level:
        body["generationConfig"]["thinkingConfig"] = {"thinkingLevel": level}

    url = f"{_BASE}/{settings.gemini_model}:generateContent"
    try:
        async with httpx.AsyncClient(timeout=settings.gemini_timeout_seconds) as client:
            response = await client.post(
                url,
                json=body,
                headers={"x-goog-api-key": key.get_secret_value()},
            )
    except httpx.HTTPError as exc:
        raise UpstreamApiError(f"Gemini request failed: {exc.__class__.__name__}") from exc

    if response.status_code >= 400:
        try:
            reason = response.json().get("error", {}).get("message", "")
        except ValueError:
            reason = ""
        raise UpstreamApiError(
            message=f"Gemini rejected the map layout request: {reason[:200]}".rstrip(": "),
            status_code=response.status_code,
        )

    payload = response.json()
    try:
        parts = payload["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts)
        return json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise UpstreamApiError("Gemini returned no readable layout") from exc
