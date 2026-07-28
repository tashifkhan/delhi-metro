"""Checked-in NMRC reference data used when the public website is unavailable.

The live service refreshes names, journeys, notices, and map links from NMRC.
This small catalog keeps the core planner usable during upstream maintenance.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class NmrcStation:
    upstream_id: int
    code: str
    name: str
    first_mon_sat_depot: str | None
    first_mon_sat_sector_51: str | None
    first_sunday_depot: str | None
    first_sunday_sector_51: str | None
    last_depot: str | None
    last_sector_51: str | None


STATIONS: tuple[NmrcStation, ...] = (
    NmrcStation(
        1, "NM01", "Noida Sector 51", "06:00", None, "08:00", None, "22:00", None
    ),
    NmrcStation(
        2,
        "NM02",
        "Noida Sector 50",
        "06:02",
        "06:25",
        "08:02",
        "08:25",
        "22:02",
        "22:45",
    ),
    NmrcStation(
        3,
        "NM03",
        "Noida Sector 76",
        "06:04",
        "06:23",
        "08:04",
        "08:23",
        "22:03",
        "22:43",
    ),
    NmrcStation(
        4,
        "NM04",
        "Noida Sector 101",
        "06:07",
        "06:20",
        "08:07",
        "08:20",
        "22:05",
        "22:41",
    ),
    NmrcStation(
        5,
        "NM05",
        "Noida Sector 81",
        "06:09",
        "06:18",
        "08:09",
        "08:18",
        "22:07",
        "22:39",
    ),
    NmrcStation(
        6, "NM06", "NSEZ", "06:12", "06:14", "08:12", "08:14", "22:09", "22:35"
    ),
    NmrcStation(
        7,
        "NM07",
        "Noida Sector 83",
        "06:15",
        "06:11",
        "08:15",
        "08:11",
        "22:12",
        "22:33",
    ),
    NmrcStation(
        8,
        "NM08",
        "Noida Sector 137",
        "06:17",
        "06:08",
        "08:17",
        "08:08",
        "22:14",
        "22:31",
    ),
    NmrcStation(
        9,
        "NM09",
        "Noida Sector 142",
        "06:00",
        "06:05",
        "08:00",
        "08:05",
        "22:17",
        "22:28",
    ),
    NmrcStation(
        10,
        "NM10",
        "Noida Sector 143",
        "06:02",
        "06:02",
        "08:02",
        "08:02",
        "22:19",
        "22:26",
    ),
    NmrcStation(
        11,
        "NM11",
        "Noida Sector 144",
        "06:05",
        "06:00",
        "08:05",
        "08:00",
        "22:22",
        "22:24",
    ),
    NmrcStation(
        12,
        "NM12",
        "Noida Sector 145",
        "06:08",
        "06:27",
        "08:08",
        "08:27",
        "22:24",
        "22:21",
    ),
    NmrcStation(
        13,
        "NM13",
        "Noida Sector 146",
        "06:12",
        "06:24",
        "08:12",
        "08:24",
        "22:27",
        "22:19",
    ),
    NmrcStation(
        14,
        "NM14",
        "Noida Sector 147",
        "06:14",
        "06:21",
        "08:14",
        "08:21",
        "22:29",
        "22:16",
    ),
    NmrcStation(
        15,
        "NM15",
        "Noida Sector 148",
        "06:17",
        "06:17",
        "08:17",
        "08:17",
        "22:31",
        "22:14",
    ),
    NmrcStation(
        16,
        "NM16",
        "Knowledge Park",
        "06:21",
        "06:13",
        "08:21",
        "08:13",
        "22:35",
        "22:10",
    ),
    NmrcStation(
        17, "NM17", "Pari Chowk", "06:24", "06:10", "08:24", "08:10", "22:37", "22:08"
    ),
    NmrcStation(
        18, "NM18", "Alpha 1", "06:27", "06:07", "08:27", "08:07", "22:39", "22:06"
    ),
    NmrcStation(
        19, "NM19", "Delta 1", "06:29", "06:04", "08:29", "08:04", "22:42", "22:03"
    ),
    NmrcStation(
        20, "NM20", "GNIDA Office", "06:32", "06:02", "08:32", "08:02", "22:44", "22:01"
    ),
    NmrcStation(
        21, "NM21", "Depot Station", None, "06:00", None, "08:00", None, "22:00"
    ),
)

# Adjacent journey distances currently rendered by NMRC's planner. The zero
# between NSEZ and Sector 83 is an upstream data issue, so the whole-route live
# value is preferred whenever available.
ADJACENT_DISTANCE_KM: tuple[float, ...] = (
    1.27,
    1.00,
    1.16,
    0.91,
    1.19,
    0.00,
    1.46,
    1.68,
    1.10,
    1.39,
    1.21,
    1.73,
    1.50,
    1.62,
    2.97,
    1.10,
    1.12,
    1.52,
    1.27,
    0.86,
)

AQUA_COLOR = "#00AEEF"
AQUA_LINE_CODE = "AQUA"
AQUA_LINE_ID = 1001
AQUA_LINE_NAME = "Aqua Line"
NETWORK_MAP_PATH = "/assets/images/Route-Map-aqua-line.jpg"
