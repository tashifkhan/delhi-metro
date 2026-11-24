# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "numpy",
#   "scipy",
#   "shapely>=2",
#   "contourpy",
#   "mapbox-vector-tile",
#   "pillow",
# ]
# ///
"""Build the map's background: real contours, lakes and rivers.

Writes two files the network map draws behind the lines:

- app/src/data/terrain.json, bundled with the app and drawn when the whole
  city is in view: 10 m contours from a heavily smoothed height grid, lakes
  larger than 0.05 km², rivers and canals, and two shaded bands for the
  highest ground.
- api/data/terrainDetail.json, shipped in the offline pack and loaded from it
  the first time the map zooms in:
  5 m contours and every lake, pond, river and stream, cut into square
  chunks so the canvas only draws what is on screen.

Coordinates are in the app's map space (metres from ORIGIN in
networkData.ts, x east, y south), so the app never projects anything.

Sources, both free with no key:

- Elevation: AWS Terrain Tiles (Terrarium PNGs, from SRTM and others),
  https://registry.opendata.aws/terrain-tiles
- Water: OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data,
  ODbL), https://openfreemap.org

Tiles are cached in api/scripts/.tile-cache, so reruns don't download again.
The first run fetches a few hundred tiles, one at a time.

Run from the repo root:

    uv run api/scripts/build_terrain.py
"""

from __future__ import annotations

import gzip
import io
import json
import math
import re
import sys
import time
import urllib.request
from pathlib import Path

import contourpy
import mapbox_vector_tile
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
from shapely import affinity, box, make_valid, simplify, union_all
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, shape

ROOT = Path(__file__).resolve().parents[2]
NETWORK_MAP = ROOT / "app" / "src" / "data" / "networkMap.json"
NETWORK_DATA = ROOT / "app" / "src" / "components" / "map" / "networkData.ts"
OUT_PATH = ROOT / "app" / "src" / "data" / "terrain.json"
DETAIL_PATH = ROOT / "api" / "data" / "terrainDetail.json"
CACHE = Path(__file__).resolve().parent / ".tile-cache"

USER_AGENT = "metro-map-terrain-builder"
ELEVATION_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
VECTOR_TILEJSON = "https://tiles.openfreemap.org/planet"

ELEVATION_ZOOM = 12  # about 30 m a pixel, the resolution of the SRTM source
VECTOR_ZOOM = 13  # has every lake and pond; 14 only adds names and buildings
MARGIN = 6_000  # metres past the outermost station

COARSE_CELL = 200
COARSE_SMOOTH = 450  # metres, Gaussian sigma
COARSE_INTERVAL = 10
COARSE_INDEX = 5  # every 5th contour (50 m) drawn heavier
COARSE_LAKE_AREA = 50_000  # m²

FINE_CELL = 60
FINE_SMOOTH = 150
FINE_INTERVAL = 5
FINE_INDEX = 5  # 25 m
CHUNK = 4_000

# Contours are wiggly at source; these keep the files small without visible loss.
COARSE_TOLERANCE = 40
FINE_TOLERANCE = 18
WATER_TOLERANCE = 6

LAKE_CLASSES = {"lake", "pond", "river", "dock"}
RIVER_LINES_COARSE = {"river", "canal"}
RIVER_LINES_FINE = {"river", "canal", "stream"}


# Projection, matching networkData.ts.

def read_origin() -> tuple[float, float]:
    source = NETWORK_DATA.read_text()
    match = re.search(r"ORIGIN\s*=\s*\{\s*lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)", source)
    if not match:
        sys.exit(f"Couldn't find ORIGIN in {NETWORK_DATA}")
    return float(match.group(1)), float(match.group(2))


ORIGIN_LAT, ORIGIN_LNG = read_origin()
METRES_PER_DEGREE = 111_320
COS_LAT = math.cos(math.radians(ORIGIN_LAT))


def project(lat, lng):
    return (lng - ORIGIN_LNG) * METRES_PER_DEGREE * COS_LAT, -(lat - ORIGIN_LAT) * METRES_PER_DEGREE


def unproject(x, y):
    return ORIGIN_LAT - y / METRES_PER_DEGREE, ORIGIN_LNG + x / (METRES_PER_DEGREE * COS_LAT)


# Web Mercator tiles.

def tile_of(lat: float, lng: float, z: int) -> tuple[float, float]:
    n = 2**z
    x = (lng + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def lnglat_of(tx: float, ty: float, z: int) -> tuple[float, float]:
    n = 2**z
    lng = tx / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / n))))
    return lat, lng


def fetch(url: str, cache_name: str) -> bytes:
    path = CACHE / cache_name
    if path.exists():
        return path.read_bytes()
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read()
            break
        except Exception as error:  # noqa: BLE001
            if attempt == 3:
                raise
            print(f"  retrying {url}: {error}", file=sys.stderr)
            time.sleep(2 * 2**attempt)
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    time.sleep(0.05)  # be gentle with free, donation-run servers
    return data


def tile_range(bounds, z):
    """Tiles covering map-space bounds (minX, minY, maxX, maxY)."""
    min_x, min_y, max_x, max_y = bounds
    north, west = unproject(min_x, min_y)
    south, east = unproject(max_x, max_y)
    x0, y0 = tile_of(north, west, z)
    x1, y1 = tile_of(south, east, z)
    return range(int(x0), int(x1) + 1), range(int(y0), int(y1) + 1)


# Elevation.

def elevation_grid(bounds, cell):
    """Heights in metres on a regular map-space grid, from Terrarium tiles."""
    z = ELEVATION_ZOOM
    xs, ys = tile_range(bounds, z)
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), dtype=np.float32)
    total = len(xs) * len(ys)
    done = 0
    for j, ty in enumerate(ys):
        for i, tx in enumerate(xs):
            data = fetch(ELEVATION_URL.format(z=z, x=tx, y=ty), f"terrarium/{z}/{tx}/{ty}.png")
            rgb = np.asarray(Image.open(io.BytesIO(data)).convert("RGB"), dtype=np.float32)
            mosaic[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
            done += 1
            print(f"\r  elevation tiles {done}/{total}", end="", file=sys.stderr)
    print(file=sys.stderr)

    min_x, min_y, max_x, max_y = bounds
    gx = np.arange(min_x, max_x + cell, cell)
    gy = np.arange(min_y, max_y + cell, cell)
    mx, my = np.meshgrid(gx, gy)
    lat, lng = unproject(mx, my)
    n = 2**z
    px = ((lng + 180) / 360 * n - xs.start) * 256 - 0.5
    py = ((1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n - ys.start) * 256 - 0.5
    heights = map_coordinates(mosaic, [py, px], order=1, mode="nearest")
    return gx, gy, heights


# Water.

def vector_tile_url() -> str:
    data = fetch(VECTOR_TILEJSON, "openfreemap-tilejson.json")
    tiles = json.loads(data)["tiles"][0]
    return tiles


def water(bounds):
    """Lake and river polygons, and waterway lines with their class."""
    template = vector_tile_url()
    version = template.split("/")[-4]
    z = VECTOR_ZOOM
    xs, ys = tile_range(bounds, z)
    polygons: list[tuple[str, Polygon | MultiPolygon]] = []
    lines: list[tuple[str, LineString | MultiLineString]] = []
    total = len(xs) * len(ys)
    done = 0
    for ty in ys:
        for tx in xs:
            data = fetch(template.format(z=z, x=tx, y=ty), f"openfreemap/{version}/{z}/{tx}/{ty}.pbf")
            tile = mapbox_vector_tile.decode(data, default_options={"y_coord_down": True})
            done += 1
            print(f"\r  vector tiles {done}/{total}", end="", file=sys.stderr)

            def to_map(geom, extent):
                # Tile pixels to lat/lng to map metres. Mercator is not linear in
                # latitude, but across one tile at zoom 13 the error is far below
                # a metre, so an affine map between the tile corners is enough.
                north, west = lnglat_of(tx, ty, z)
                south, east = lnglat_of(tx + 1, ty + 1, z)
                x0, y0 = project(north, west)
                x1, y1 = project(south, east)
                sx = (x1 - x0) / extent
                sy = (y1 - y0) / extent
                return affinity.affine_transform(geom, [sx, 0, 0, sy, x0, y0])

            for layer, sink in (("water", polygons), ("waterway", lines)):
                if layer not in tile:
                    continue
                extent = tile[layer]["extent"]
                # Tiles carry a buffer past their edge; cut it off so
                # neighbouring tiles don't overlap and double the fill.
                clip = box(0, 0, extent, extent)
                for feature in tile[layer]["features"]:
                    kind = feature["properties"].get("class")
                    if layer == "water" and kind not in LAKE_CLASSES:
                        continue
                    if layer == "waterway" and kind not in RIVER_LINES_FINE:
                        continue
                    geom = make_valid(shape(feature["geometry"]))
                    geom = geom.intersection(clip)
                    if geom.is_empty:
                        continue
                    sink.append((kind, to_map(geom, extent)))
    print(file=sys.stderr)
    return polygons, lines


# Output helpers.

def path_d(geom, precision: int) -> str:
    """SVG path data: absolute moves, relative line steps, rounded to `precision` metres."""
    out: list[str] = []

    def ring(coords, closed):
        pts = [(round(x / precision) * precision, round(y / precision) * precision) for x, y in coords]
        if len(pts) < 2:
            return
        px, py = pts[0]
        parts = [f"M{px} {py}l"]
        steps = 0
        for x, y in pts[1:]:
            if x == px and y == py:
                continue
            parts.append(f"{x - px} {y - py} ")
            px, py = x, y
            steps += 1
        if steps == 0:
            return
        out.append("".join(parts).rstrip() + ("z" if closed else ""))

    def walk(g):
        if g.is_empty:
            return
        if isinstance(g, Polygon):
            ring(g.exterior.coords, True)
            for hole in g.interiors:
                ring(hole.coords, True)
        elif isinstance(g, LineString):
            ring(g.coords, False)
        elif hasattr(g, "geoms"):
            for part in g.geoms:
                walk(part)

    walk(geom)
    return "".join(out)


def contour_lines(gx, gy, heights, interval, index_every, tolerance):
    """Contours as (minor, major) MultiLineStrings in map space."""
    generator = contourpy.contour_generator(gx, gy, heights, line_type="Separate")
    lo = math.ceil(float(heights.min()) / interval) * interval
    hi = float(heights.max())
    minor: list[LineString] = []
    major: list[LineString] = []
    level = lo
    while level < hi:
        for segment in generator.lines(level):
            if len(segment) < 4:
                continue
            line = simplify(LineString(segment), tolerance)
            # Specks of a contour around a single bump read as dust.
            if line.length < tolerance * 6:
                continue
            (major if round(level / interval) % index_every == 0 else minor).append(line)
        level += interval
    return MultiLineString(minor), MultiLineString(major)


def high_ground(gx, gy, heights, network_bounds):
    """The top of the land, as two filled bands from the height quantiles inside the network."""
    min_x, min_y, max_x, max_y = network_bounds
    inside = heights[(gy >= min_y)[:, None] & (gy <= max_y)[:, None] & (gx >= min_x)[None, :] & (gx <= max_x)[None, :]]
    bands = []
    generator = contourpy.contour_generator(gx, gy, heights, fill_type="OuterOffset")
    for q in (0.75, 0.92):
        level = float(np.quantile(inside, q))
        polys = []
        points, offsets = generator.filled(level, float(heights.max()) + 1)
        for pts, offs in zip(points, offsets):
            rings = [pts[offs[k]:offs[k + 1]] for k in range(len(offs) - 1)]
            if not rings or len(rings[0]) < 4:
                continue
            poly = Polygon(rings[0], [r for r in rings[1:] if len(r) >= 4])
            if poly.area > 400_000:
                polys.append(simplify(poly, COARSE_TOLERANCE))
        bands.append(path_d(union_all(polys), 10) if polys else "")
    return bands


def main():
    network = json.loads(NETWORK_MAP.read_text())
    pts = [project(s["lat"], s["lng"]) for s in network["stations"]]
    network_bounds = (
        min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts),
    )
    bounds = (
        math.floor((network_bounds[0] - MARGIN) / CHUNK) * CHUNK,
        math.floor((network_bounds[1] - MARGIN) / CHUNK) * CHUNK,
        math.ceil((network_bounds[2] + MARGIN) / CHUNK) * CHUNK,
        math.ceil((network_bounds[3] + MARGIN) / CHUNK) * CHUNK,
    )
    print(f"Origin {ORIGIN_LAT}, {ORIGIN_LNG}; area {(bounds[2] - bounds[0]) / 1000:.0f} x {(bounds[3] - bounds[1]) / 1000:.0f} km", file=sys.stderr)

    print("Coarse contours", file=sys.stderr)
    gx, gy, raw = elevation_grid(bounds, COARSE_CELL)
    coarse_h = gaussian_filter(raw, COARSE_SMOOTH / COARSE_CELL)
    c_minor, c_major = contour_lines(gx, gy, coarse_h, COARSE_INTERVAL, COARSE_INDEX, COARSE_TOLERANCE)
    high = high_ground(gx, gy, coarse_h, network_bounds)

    print("Fine contours", file=sys.stderr)
    fx, fy, fraw = elevation_grid(bounds, FINE_CELL)
    fine_h = gaussian_filter(fraw, FINE_SMOOTH / FINE_CELL)
    f_minor, f_major = contour_lines(fx, fy, fine_h, FINE_INTERVAL, FINE_INDEX, FINE_TOLERANCE)

    print("Water", file=sys.stderr)
    polygons, lines = water(bounds)
    all_water = make_valid(union_all([g for _, g in polygons]))
    all_water = simplify(all_water, WATER_TOLERANCE)
    big_water = [p for p in getattr(all_water, "geoms", [all_water]) if isinstance(p, Polygon) and p.area >= COARSE_LAKE_AREA]
    coarse_water = simplify(MultiPolygon(big_water), 20) if big_water else Polygon()
    river_lines = union_all([g for kind, g in lines if kind in RIVER_LINES_COARSE])
    stream_lines = union_all([g for kind, g in lines if kind not in RIVER_LINES_COARSE])

    coarse = {
        "minor": path_d(c_minor, 10),
        "major": path_d(c_major, 10),
        "water": path_d(coarse_water, 10),
        "rivers": path_d(simplify(river_lines, 30), 10),
        "high": high,
    }

    chunks = []
    for y in range(bounds[1], bounds[3], CHUNK):
        for x in range(bounds[0], bounds[2], CHUNK):
            cell = box(x, y, x + CHUNK, y + CHUNK)
            entry = {
                "x": x,
                "y": y,
                "minor": path_d(f_minor.intersection(cell), 5),
                "major": path_d(f_major.intersection(cell), 5),
                "water": path_d(all_water.intersection(cell), 3),
                "rivers": path_d(simplify(river_lines, 8).intersection(cell), 2),
                "streams": path_d(simplify(stream_lines, 8).intersection(cell), 2),
            }
            if any(entry[k] for k in ("minor", "major", "water", "rivers", "streams")):
                chunks.append(entry)

    OUT_PATH.write_text(json.dumps({"interval": COARSE_INTERVAL, **coarse}, separators=(",", ":")))
    DETAIL_PATH.write_text(
        json.dumps({"interval": FINE_INTERVAL, "chunkSize": CHUNK, "chunks": chunks}, separators=(",", ":"))
    )
    for path in (OUT_PATH, DETAIL_PATH):
        print(f"Wrote {path.relative_to(ROOT)}: {path.stat().st_size / 1024:.0f} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
