"""Observe which Meerut stations each NCRTC train appears to call at."""

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.errors import UpstreamApiError
from services.ncrtc.catalog import MEERUT_CODES
from services.ncrtc.live import next_trains


async def capture(duration_minutes: float) -> dict:
    started = datetime.now(UTC)
    deadline = monotonic() + duration_minutes * 60
    observations: dict[tuple[str, str, str], set[str]] = {}
    polls = []
    while True:
        cycle_started = monotonic()
        for code in sorted(MEERUT_CODES):
            polled_at = datetime.now(UTC).isoformat()
            try:
                result = await next_trains(code)
                if result.stale:
                    raise UpstreamApiError("NCRTC frequency result was stale")
                for train in result.data["trains"]:
                    key = (
                        train["source"]["code"],
                        train["destination"]["code"],
                        train["trainId"],
                    )
                    observations.setdefault(key, set()).add(code)
                polls.append({"station": code, "at": polled_at, "error": None})
            except UpstreamApiError as exc:
                polls.append({"station": code, "at": polled_at, "error": exc.message})
            await asyncio.sleep(1)
        next_cycle = cycle_started + 120
        if next_cycle >= deadline:
            break
        await asyncio.sleep(max(0, next_cycle - monotonic()))
    return {
        "schema_version": 1,
        "started_at": started.isoformat(),
        "finished_at": datetime.now(UTC).isoformat(),
        "polls": polls,
        "services": [
            {
                "source": source,
                "destination": destination,
                "train_id": train_id,
                "observed_stops": sorted(stops),
            }
            for (source, destination, train_id), stops in sorted(observations.items())
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--duration-minutes", type=float, default=1440)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.duration_minutes <= 0:
        parser.error("--duration-minutes must be positive")
    args.output.write_text(
        json.dumps(asyncio.run(capture(args.duration_minutes)), indent=2) + "\n"
    )
