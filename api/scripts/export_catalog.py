"""Collect station records and ordered line catalogs through the API services."""

import asyncio
import json
from pathlib import Path

from core.catalog import get_catalog
from core.errors import UpstreamApiError
from schemas.planner import MetroNetwork
from schemas.station import StationDetail
from services.dmrc import line as dmrc_line
from services.dmrc import station as dmrc_station
from services.ncrtc import catalog as ncrtc_catalog
from services.ncrtc import station as ncrtc_station
from services.nmrc import catalog as nmrc_catalog
from services.nmrc import station as nmrc_station
from services.nmrc.data import STATIONS as NMRC_STATIONS
from scripts.build_network_map import PLACEHOLDER, interpolate_aqua


def as_json(model):
    return model.model_dump(mode="json", by_alias=True)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False))
    temporary.replace(path)


async def _lines():
    result = []
    for network, lines, list_stations in (
        (
            MetroNetwork.DMRC,
            await dmrc_line.list_lines(),
            dmrc_station.stations_by_line,
        ),
        (
            MetroNetwork.NMRC,
            await nmrc_catalog.list_lines(),
            nmrc_station.stations_by_line,
        ),
        (MetroNetwork.NCRTC, ncrtc_catalog.LINES, ncrtc_catalog.stations_by_line),
    ):
        items = await asyncio.gather(*(list_stations(line.line_code) for line in lines))
        result.extend(
            {
                "network": network.value,
                **as_json(line),
                "stations": [station.station_code for station in stations],
            }
            for line, stations in zip(lines, items, strict=True)
        )
    return result


async def _station(network: str, code: str, checkpoint: Path) -> dict:
    detail_path = checkpoint / "station" / network / f"{code}.json"
    try:
        detail = StationDetail.model_validate_json(detail_path.read_bytes())
    except FileNotFoundError:
        source = {
            "dmrc": dmrc_station.get_station_detail,
            "nmrc": nmrc_station.get_station_detail,
            "ncrtc": ncrtc_station.get_station_detail,
        }[network]
        for attempt in range(2):
            try:
                detail = await source(code)
                break
            except UpstreamApiError:
                if attempt or network == "ncrtc":
                    raise
        write_json(detail_path, as_json(detail))

    codes: dict[str, list[str]] = {network: [code]}
    ids = {network: [str(detail.id)]}
    latitude, longitude = detail.latitude, detail.longitude
    if network == "dmrc" and (canonical := get_catalog().resolve(code)):
        codes["sarthi"] = [record.code for record in canonical.sarthi]
        ids["sarthi"] = [record.id for record in canonical.sarthi]
        position = next(
            (
                record
                for record in canonical.sarthi
                if record.latitude is not None and record.longitude is not None
            ),
            None,
        )
        if position and (not latitude or not longitude):
            latitude, longitude = position.latitude, position.longitude
    return {
        "network": network,
        "code": code,
        "name": detail.station_name,
        "codes": codes,
        "ids": ids,
        "latitude": latitude,
        "longitude": longitude,
        "detail": as_json(detail),
    }


def _coordinates(stations: list[dict]) -> None:
    fallback_path = Path(__file__).resolve().parents[2] / "app/src/data/networkMap.json"
    fallback = {
        row["code"]: row for row in json.loads(fallback_path.read_bytes())["stations"]
    }
    aqua = dict(
        zip(
            (station.code for station in NMRC_STATIONS),
            interpolate_aqua(len(NMRC_STATIONS)),
            strict=True,
        )
    )
    for station in stations:
        lat, lng = station["latitude"], station["longitude"]
        if lat and lng and (round(lat, 4), round(lng, 4)) != PLACEHOLDER:
            station["coordinates_approximate"] = False
        elif station["code"] in aqua:
            station["latitude"], station["longitude"] = aqua[station["code"]]
            station["coordinates_approximate"] = True
        elif (
            (point := fallback.get(station["code"]))
            and point.get("lat")
            and point.get("lng")
        ):
            station["latitude"], station["longitude"] = point["lat"], point["lng"]
            station["coordinates_approximate"] = point.get("approx", False)
        else:
            station["latitude"] = station["longitude"] = None
            station["coordinates_approximate"] = False


async def collect_catalog(checkpoint: Path) -> tuple[list[dict], list[dict]]:
    line_checkpoint = checkpoint / "lines.json"
    try:
        lines = json.loads(line_checkpoint.read_bytes())
    except FileNotFoundError:
        lines = await _lines()
        write_json(line_checkpoint, lines)

    station_keys = sorted(
        {(line["network"], code) for line in lines for code in line["stations"]}
    )
    print(f"Collecting {len(station_keys)} stations on {len(lines)} lines", flush=True)
    stations = []
    failures = []
    for start in range(0, len(station_keys), 12):
        batch = station_keys[start : start + 12]
        results = await asyncio.gather(
            *(_station(network, code, checkpoint) for network, code in batch),
            return_exceptions=True,
        )
        for pair, result in zip(batch, results, strict=True):
            if isinstance(result, (UpstreamApiError, ValueError)):
                failures.append(pair)
                print(
                    f"Station detail {pair} failed: {result.__cause__ or result}",
                    flush=True,
                )
            elif isinstance(result, BaseException):
                raise result
            else:
                stations.append(result)
        if start % 48 == 0:
            print(f"Collected {len(stations)} station records", flush=True)
    if failures:
        raise UpstreamApiError(f"Station details missing for {failures}")
    _coordinates(stations)
    return lines, stations
