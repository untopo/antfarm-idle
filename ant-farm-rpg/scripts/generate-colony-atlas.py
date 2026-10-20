#!/usr/bin/env python3
"""Build ANT FARM's deterministic pixel/voxel colony-object texture atlas.

The game consumes the transparent PNG through the generated JS manifest.  The
JSON copy is the human/tooling contract.  Add a SpriteSpec below, rerun this
script, and use its stable name in Canvas code; callers never hard-code atlas
coordinates.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "textures"
PNG_PATH = OUT / "colony-atlas.png"
JSON_PATH = OUT / "colony-atlas.json"
JS_PATH = OUT / "colony-atlas.manifest.js"
CELL = 32
COLS = 8


@dataclass(frozen=True)
class SpriteSpec:
    name: str
    category: str
    draw: Callable[[ImageDraw.ImageDraw], None]
    pivot: tuple[int, int] = (16, 27)
    native: tuple[int, int] = (32, 32)
    note: str = ""


def rect(d, box, fill):
    d.rectangle(box, fill=fill)


def px(d, x, y, color, w=1, h=1):
    d.rectangle((x, y, x + w - 1, y + h - 1), fill=color)


def voxel_block(d, x, y, w, h, main, light, dark, outline="#21140d"):
    rect(d, (x - 1, y - 1, x + w, y + h), outline)
    rect(d, (x, y, x + w - 1, y + h - 1), main)
    px(d, x, y, light, w, 2)
    px(d, x, y + 2, light, 2, max(1, h - 3))
    px(d, x, y + h - 2, dark, w, 2)
    px(d, x + w - 2, y + 2, dark, 2, max(1, h - 3))


def shadow(d, x0=5, y=27, x1=27, color=(23, 12, 8, 120)):
    rect(d, (x0, y, x1, y + 2), color)
    rect(d, (x0 + 3, y + 3, x1 - 3, y + 3), (23, 12, 8, 70))


def jar(d, x, y, main="#bd744d", light="#e8ae7d", dark="#71391f", filled=None, scale=1):
    # y is lid top; deliberately stepped rather than antialiased.
    s = scale
    rect(d, (x + 2*s, y, x + 7*s, y + 2*s-1), "#2a160e")
    rect(d, (x + 3*s, y, x + 6*s, y), "#805033")
    rect(d, (x + s, y + 2*s, x + 8*s, y + 4*s-1), "#2a160e")
    rect(d, (x, y + 4*s, x + 9*s, y + 10*s-1), "#2a160e")
    rect(d, (x + s, y + 3*s, x + 8*s, y + 9*s-1), main)
    rect(d, (x + 2*s, y + 3*s, x + 7*s, y + 4*s-1), light)
    rect(d, (x + 2*s, y + 5*s, x + 2*s, y + 8*s-1), light)
    rect(d, (x + 2*s, y + 8*s, x + 7*s, y + 9*s-1), dark)
    rect(d, (x + 7*s, y + 5*s, x + 8*s, y + 8*s-1), dark)
    if filled:
        rect(d, (x + 3*s, y + 5*s, x + 6*s, y + 7*s), filled)
        px(d, x + 3*s, y + 5*s, "#fff0a0", max(1, s), max(1, s))


def draw_clay_jars(d):
    shadow(d, 3, 27, 29)
    jar(d, 3, 12, filled="#f1a900")
    jar(d, 12, 8, main="#c98258", light="#f3bc8b", dark="#774229", filled="#ffc42e")
    jar(d, 21, 13, main="#a96142", light="#d88e68", dark="#61311f", filled="#7d4fa3")
    px(d, 7, 10, "#dac09a", 3, 2); px(d, 25, 11, "#dac09a", 2, 2)


def draw_clay_jars_full(d):
    draw_clay_jars(d)
    rect(d, (12, 17, 19, 20), "#f0a400"); px(d, 13, 17, "#fff3a1", 3, 1)
    px(d, 6, 21, "#f5b815", 3, 2); px(d, 24, 22, "#805db5", 2, 2)


def draw_cache(d, open_lid=False):
    shadow(d, 2, 27, 29)
    if open_lid:
        rect(d, (4, 5, 27, 8), "#2a170c"); rect(d, (5, 4, 26, 6), "#b27636")
        rect(d, (7, 5, 24, 5), "#e2a85b")
    else:
        voxel_block(d, 3, 8, 26, 6, "#9a612b", "#d39a4f", "#5f3518")
    voxel_block(d, 4, 13, 24, 13, "#8b5425", "#c58b42", "#4f2a13")
    px(d, 7, 15, "#d09a52", 2, 8); px(d, 23, 15, "#5e3217", 2, 8)
    rect(d, (14, 15, 18, 20), "#2a170c"); rect(d, (15, 16, 17, 18), "#e0b75d")
    if open_lid:
        px(d, 8, 14, "#ffbf20", 5, 4); px(d, 19, 15, "#80543a", 5, 3)


def draw_braces(d):
    shadow(d, 1, 28, 30)
    # Three chunky frames; highlights face upper-left, deep joints read at game scale.
    for x in (3, 14, 25):
        rect(d, (x - 2, 7, x + 3, 28), "#2c190d")
        rect(d, (x - 1, 8, x + 2, 27), "#8a5428")
        px(d, x - 1, 8, "#c18a49", 1, 17); px(d, x + 2, 11, "#503018", 1, 15)
        px(d, x - 1, 13, "#4c2b15", 4, 2); px(d, x, 14, "#d19a54", 1, 1)
    rect(d, (1, 4, 30, 10), "#29170b"); rect(d, (2, 5, 29, 8), "#996031")
    px(d, 3, 5, "#d39a58", 24, 1); px(d, 4, 8, "#553019", 25, 2)
    for x in (5, 16, 27): px(d, x, 6, "#ddd0a8", 2, 2)


def draw_fungus_bed(d, health="healthy"):
    shadow(d, 3, 28, 29)
    voxel_block(d, 3, 19, 26, 8, "#75462d", "#b5744f", "#3d2417")
    rect(d, (5, 16, 27, 21), "#403224")
    palette = {
        "healthy": ("#9cbd58", "#dbe88a", "#58753a"),
        "dry": ("#88735b", "#b69a76", "#554638"),
    }[health]
    for x, y, sz in ((7, 14, 5), (13, 10, 7), (21, 13, 6), (25, 16, 4)):
        stem = "#d8c6a2" if health == "healthy" else "#9a826a"
        rect(d, (x + sz//2 - 1, y + 3, x + sz//2, 20), stem)
        rect(d, (x, y, x + sz, y + 3), palette[2])
        rect(d, (x + 1, y - 1, x + sz - 1, y + 2), palette[0])
        px(d, x + 1, y, palette[1], max(1, sz//3), 1)
    px(d, 8, 23, "#d9ad70", 3, 1); px(d, 20, 22, "#322016", 4, 2)


def draw_worksite(d):
    shadow(d, 2, 28, 29)
    rect(d, (3, 21, 28, 26), "#302116"); rect(d, (4, 20, 27, 23), "#76573b")
    # Stakes and taut survey cord.
    for x in (5, 26):
        rect(d, (x, 7, x + 2, 25), "#2b190d"); rect(d, (x + 1, 8, x + 1, 23), "#b47c3e")
    rect(d, (6, 10, 27, 11), "#f0c34e"); px(d, 10, 9, "#fff0a0", 4, 1)
    # Delivered bundles.
    voxel_block(d, 9, 17, 6, 6, "#bd744d", "#e9ad7b", "#71391f")
    voxel_block(d, 16, 16, 6, 7, "#719347", "#b0ca72", "#3e5b2c")
    px(d, 18, 12, "#e6d3a6", 2, 4)


def draw_store_shelf(d):
    shadow(d, 2, 28, 30)
    rect(d, (2, 5, 29, 9), "#2b190e"); rect(d, (3, 5, 28, 7), "#a86b34"); px(d, 4, 5, "#dca05c", 22, 1)
    for x in (4, 26):
        rect(d, (x, 7, x + 3, 27), "#2b190e"); rect(d, (x + 1, 8, x + 2, 26), "#895129")
    for y in (15, 23):
        rect(d, (4, y, 28, y + 3), "#2b190e"); rect(d, (5, y, 27, y + 1), "#bd7c3e")
    jar(d, 8, 11, scale=1, filled="#f1ad12")
    px(d, 20, 17, "#b39a6d", 5, 4); px(d, 21, 17, "#e0cf9a", 3, 1)


def draw_overflow(d, kind, color, light, dark, motif="round"):
    shadow(d, 3, 28, 29)
    # Reed mat says "outside protected shelves" at a glance.
    rect(d, (4, 23, 28, 27), "#342215"); rect(d, (5, 23, 27, 25), "#987343")
    for x in range(7, 27, 5): px(d, x, 23, "#d1aa68", 1, 3)
    coords = ((7, 18, 7), (13, 13, 9), (21, 17, 7), (17, 20, 6))
    for x, y, s in coords:
        if motif == "drop":
            rect(d, (x + 2, y - 2, x + s - 3, y), dark); rect(d, (x, y + 1, x + s, y + s), "#47270a")
            rect(d, (x + 1, y, x + s - 1, y + s - 1), color); px(d, x + 2, y + 1, light, 2, 2); px(d, x + 2, y + s - 2, dark, s - 3, 1)
        elif motif == "cap":
            rect(d, (x + 2, y + 3, x + 4, y + s), "#d7c7a8")
            rect(d, (x, y, x + s, y + 4), dark); rect(d, (x + 1, y - 1, x + s - 1, y + 2), color); px(d, x + 2, y, light, 2, 1)
        elif motif == "seed":
            rect(d, (x, y + 1, x + s, y + 4), dark); rect(d, (x + 1, y, x + s - 1, y + 3), color); px(d, x + 2, y, light, 2, 1)
        else:
            rect(d, (x, y, x + s, y + s), "#32141f"); rect(d, (x + 1, y - 1, x + s - 1, y + s - 1), color)
            px(d, x + 2, y, light, 2, 1); px(d, x + s - 2, y + 3, dark, 2, 2)
    # Unprotected warning peg, not a UI label.
    rect(d, (28, 8, 29, 24), "#2b190e"); rect(d, (25, 7, 31, 13), "#542219"); px(d, 27, 8, "#efc34d", 2, 3)


def draw_spoilage(d):
    shadow(d, 3, 28, 29)
    rect(d, (5, 18, 27, 26), "#2d2017"); rect(d, (7, 15, 25, 24), "#58452e")
    for x, y, c in ((8, 15, "#788843"), (13, 12, "#66783a"), (18, 16, "#8e6c35"), (23, 13, "#6f7f42")):
        rect(d, (x, y, x + 5, y + 5), "#291d16"); rect(d, (x + 1, y, x + 4, y + 4), c); px(d, x + 2, y + 1, "#b4c46e", 1, 1)
    for x, y in ((10, 8), (19, 7), (25, 10)):
        px(d, x, y, (148, 183, 104, 120), 2, 2); px(d, x + 1, y - 3, (148, 183, 104, 70), 2, 2)


def draw_material(d, main, light, dark, form="pile"):
    shadow(d, 4, 28, 28)
    if form == "bundle":
        for y in (13, 18, 23):
            rect(d, (5, y, 27, y + 4), "#27170d"); rect(d, (6, y, 26, y + 2), main); px(d, 7, y, light, 8, 1); px(d, 22, y + 2, dark, 4, 1)
        rect(d, (14, 11, 17, 28), "#6b4a26"); px(d, 15, 12, "#d2af72", 1, 13)
    elif form == "fibres":
        for x, y, h in ((5, 14, 12), (9, 10, 16), (13, 13, 13), (17, 8, 18), (21, 12, 14), (25, 15, 11)):
            rect(d, (x, y, x + 2, y + h), dark); rect(d, (x + 1, y, x + 2, y + h - 2), main); px(d, x + 1, y, light, 1, 4)
        rect(d, (4, 21, 28, 24), "#49321c"); px(d, 5, 21, "#c39b59", 21, 1)
    elif form == "bricks":
        for x, y, w in ((4, 21, 9), (14, 21, 10), (24, 21, 5), (8, 15, 10), (19, 15, 9), (13, 9, 10)):
            voxel_block(d, x, y, w, 6, main, light, dark)
    else:
        for x, y, s in ((4, 20, 8), (10, 15, 10), (18, 18, 9), (13, 9, 8), (23, 13, 6)):
            rect(d, (x, y, x + s, y + s - 1), "#241711"); rect(d, (x + 1, y - 1, x + s - 1, y + s - 2), main)
            px(d, x + 2, y, light, max(1, s//2), 2); px(d, x + s - 2, y + 3, dark, 2, max(1, s - 5))


def draw_basket(d):
    shadow(d, 4, 28, 28)
    rect(d, (7, 12, 25, 27), "#2b1b10"); rect(d, (8, 13, 24, 25), "#9b6d38")
    for y in (15, 20, 24): px(d, 8, y, "#d1a05a", 17, 2)
    for x in (11, 17, 22): px(d, x, 13, "#694321", 2, 12)
    rect(d, (10, 7, 22, 9), "#2b1b10"); rect(d, (8, 9, 10, 17), "#2b1b10"); rect(d, (22, 9, 24, 17), "#2b1b10")
    px(d, 11, 8, "#b78243", 10, 1)


def draw_tool(d, kind):
    shadow(d, 5, 28, 27)
    # Common diagonal handle.
    for i in range(15): px(d, 8 + i, 24 - i, "#2a190e", 4, 4)
    for i in range(15): px(d, 9 + i, 23 - i, "#a86f35", 2, 2)
    if kind == "pick":
        rect(d, (17, 5, 30, 10), "#22252a"); rect(d, (18, 6, 28, 8), "#a9b0b8"); px(d, 18, 6, "#eef3f5", 5, 1); px(d, 27, 8, "#626a72", 2, 2)
    elif kind == "trowel":
        rect(d, (20, 3, 30, 12), "#22252a"); rect(d, (21, 4, 28, 10), "#a9b0b8"); rect(d, (24, 10, 27, 14), "#6a7178"); px(d, 22, 4, "#eef3f5", 3, 1)
    elif kind == "hammer":
        rect(d, (17, 4, 29, 12), "#26180f"); rect(d, (18, 5, 27, 10), "#777c82"); px(d, 19, 5, "#c9ced3", 6, 2); px(d, 26, 8, "#464b51", 2, 2)
    elif kind == "shovel":
        rect(d, (19, 3, 28, 12), "#22252a"); rect(d, (20, 4, 27, 10), "#91999f"); px(d, 21, 4, "#e1e6e8", 3, 1)
    else:
        draw_basket(d)


def draw_small_food(d, kind, color, light, dark):
    shadow(d, 7, 27, 25)
    if kind == "mushroom":
        rect(d, (14, 14, 18, 26), "#2b1a11"); rect(d, (15, 14, 17, 25), "#d9c8ac")
        rect(d, (8, 10, 24, 17), "#2b1a11"); rect(d, (9, 8, 23, 15), color); px(d, 11, 9, light, 5, 2); px(d, 19, 13, dark, 4, 2)
    elif kind in ("seed", "grain"):
        for x, y in ((8, 20), (13, 15), (19, 19), (16, 23), (23, 14)):
            rect(d, (x, y, x + 6, y + 4), "#291a10"); rect(d, (x + 1, y - 1, x + 5, y + 2), color); px(d, x + 2, y - 1, light, 2, 1)
    else:
        rect(d, (8, 12, 25, 27), "#2b1412"); rect(d, (9, 10, 24, 25), color)
        px(d, 11, 11, light, 5, 3); px(d, 21, 17, dark, 3, 6)
        if kind == "honey": rect(d, (14, 5, 19, 11), dark)
        else: rect(d, (15, 6, 18, 10), "#5d7f32")


def draw_brood(d, kind):
    shadow(d, 6, 28, 26)
    if kind == "egg":
        rect(d, (10, 7, 22, 27), "#5e5140"); rect(d, (9, 10, 23, 24), "#fff5d8"); rect(d, (11, 7, 21, 27), "#fff9e7")
        px(d, 12, 9, "#ffffff", 5, 3); px(d, 18, 23, "#d7c9a8", 3, 3)
    elif kind == "larva":
        for x, y in ((5, 19), (9, 15), (14, 13), (19, 15), (23, 19)):
            rect(d, (x, y, x + 6, y + 7), "#5a4938"); rect(d, (x + 1, y - 1, x + 5, y + 5), "#f0dfbd"); px(d, x + 2, y, "#fff7dc", 2, 2)
        px(d, 25, 20, "#3a2416", 1, 1)
    else:
        rect(d, (8, 8, 24, 27), "#392316"); rect(d, (9, 7, 23, 25), "#a56b3f")
        px(d, 11, 8, "#dca06c", 7, 2); px(d, 11, 14, "#704126", 11, 2); px(d, 12, 20, "#674027", 9, 2)


def draw_ant(d, caste="worker"):
    shadow(d, 3, 27, 29)
    scale = 1 if caste != "queen" else 2
    body = "#4b2817" if caste != "queen" else "#6f3d27"
    light = "#9a5b34" if caste != "queen" else "#c27b4e"
    # Legs and antennae first.
    for a, b, c, e in ((14,16,5,10),(14,19,4,23),(18,16,27,10),(18,19,28,23),(15,21,9,27),(18,21,24,28)):
        d.line((a,b,c,e), fill="#27150d", width=2)
    d.line((15,11,10,5), fill="#27150d", width=1); d.line((18,11,23,5), fill="#27150d", width=1)
    if caste == "queen":
        rect(d, (5, 14, 16, 24), "#28150d"); rect(d, (6, 13, 15, 22), body); px(d, 7, 14, light, 4, 2)
        rect(d, (14, 12, 23, 22), "#28150d"); rect(d, (15, 11, 22, 20), body)
        rect(d, (21, 10, 29, 18), "#28150d"); rect(d, (22, 9, 28, 16), light); px(d, 24, 11, "#17100c", 2, 2)
        px(d, 20, 5, "#f0c34e", 2, 5); px(d, 24, 4, "#f0c34e", 2, 5); px(d, 28, 6, "#f0c34e", 2, 4); rect(d, (20, 8, 29, 10), "#b07f23")
    else:
        s = 1 if caste == "minim" else 2 if caste == "major" else 1
        rect(d, (6, 15, 14 + s, 23 + s), "#28150d"); rect(d, (7, 14, 13 + s, 21 + s), body); px(d, 8, 15, light, 3, 2)
        rect(d, (14, 14, 21 + s, 21 + s), "#28150d"); rect(d, (15, 13, 20 + s, 19 + s), body)
        rect(d, (20, 11, 27 + s, 18 + s), "#28150d"); rect(d, (21, 10, 26 + s, 16 + s), light); px(d, 23, 12, "#17100c", 1, 1)


def draw_waste(d):
    shadow(d, 4, 28, 28)
    for x, y, c in ((5,20,"#55402d"),(10,15,"#6b4b2c"),(16,18,"#3f3828"),(20,12,"#73543a"),(24,20,"#4d3925")):
        rect(d, (x, y, x + 7, y + 7), "#231912"); rect(d, (x + 1, y - 1, x + 6, y + 5), c); px(d, x + 2, y, "#99805a", 2, 1)
    for x, y in ((12,10),(22,7)):
        px(d, x, y, (141,180,102,120), 2, 2); px(d, x+1, y-3, (141,180,102,70), 2, 2)


def draw_status_cache(d, state):
    draw_cache(d, open_lid=False)
    if state == "disabled":
        rect(d, (3, 4, 29, 7), "#39171a");
        for i in range(0, 24, 4): px(d, 5+i, 4, "#e65d57", 2, 3)
        d.line((7,10,25,25), fill="#ff5a52", width=3); d.line((24,10,8,25), fill="#7f2626", width=2)
    elif state == "flooded":
        rect(d, (1, 19, 30, 28), (50,137,181,170)); px(d, 2, 20, "#8ed9ef", 10, 2); px(d, 18, 23, "#8ed9ef", 11, 1)


def draw_damaged_brace(d):
    draw_braces(d)
    rect(d, (14, 4, 18, 13), (0,0,0,0)); rect(d, (14, 12, 17, 17), "#382014")
    px(d, 18, 13, "#e2a35d", 2, 2); px(d, 12, 15, "#6e4022", 3, 2)


def draw_pressure_marker(d):
    shadow(d, 5, 28, 27)
    rect(d, (8, 4, 24, 27), "#32140f"); rect(d, (9, 5, 23, 25), "#c84f3f")
    px(d, 11, 7, "#ff9b63", 10, 3); rect(d, (14, 11, 18, 19), "#fff0bb"); rect(d, (14, 22, 18, 25), "#fff0bb")


def draw_rope(d):
    shadow(d, 4, 28, 28)
    for box in ((6,8,25,27),(9,11,22,24),(12,14,19,21)):
        d.ellipse(box, outline="#332116", width=4)
        d.ellipse(tuple(v+1 if i<2 else v-1 for i,v in enumerate(box)), outline="#c49a58", width=2)
    px(d, 22, 21, "#e1bd76", 5, 3)


def draw_beam(d): draw_material(d, "#885126", "#c88949", "#4b2a15", "bundle")
def draw_brick(d): draw_material(d, "#b96f49", "#e0a176", "#71391f", "bricks")


def draw_lid(d):
    shadow(d, 7, 26, 25)
    rect(d, (7, 13, 25, 23), "#2a180f"); rect(d, (8, 11, 24, 21), "#a86442"); px(d, 10, 12, "#dc976c", 11, 2); px(d, 10, 19, "#6b3624", 13, 2)
    rect(d, (13, 7, 19, 12), "#2a180f"); rect(d, (14, 8, 18, 11), "#8f5538")


def draw_water(d):
    shadow(d, 7, 28, 25)
    rect(d, (10, 11, 22, 26), "#1f3342"); rect(d, (8, 16, 24, 24), "#1f3342"); rect(d, (11, 8, 21, 24), "#399bc2")
    rect(d, (9, 16, 23, 23), "#399bc2"); px(d, 12, 10, "#a4e7f5", 4, 7); px(d, 10, 18, "#72cde8", 3, 3); px(d, 19, 20, "#236b91", 3, 4)


def draw_peg(d):
    shadow(d, 9, 28, 23)
    rect(d, (13, 5, 19, 27), "#29180d"); rect(d, (14, 6, 18, 25), "#986034"); px(d, 15, 7, "#d29755", 2, 14); rect(d, (9, 7, 23, 12), "#29180d"); rect(d, (10, 8, 22, 10), "#b1763d")


def S(name, category, fn, note="", pivot=(16,27), native=(32,32)):
    return SpriteSpec(name, category, fn, pivot, native, note)


SPECS = [
    S("project.clay_jars", "projects", draw_clay_jars, "Three sealed clay vessels at the nest store."),
    S("project.clay_jars_full", "projects", draw_clay_jars_full, "Filled jar variant for high protected reserve."),
    S("project.forward_cache", "projects", lambda d: draw_cache(d, False), "Closed operational forward cache."),
    S("project.forward_cache_open", "projects", lambda d: draw_cache(d, True), "Cache being loaded or unloaded."),
    S("project.tunnel_braces", "projects", draw_braces, "Three-frame timber tunnel support."),
    S("project.fungus_bed", "projects", lambda d: draw_fungus_bed(d, "healthy"), "Tended fungus-growing bed."),
    S("project.worksite", "projects", draw_worksite, "Survey stakes and delivered construction bundles."),
    S("project.store_shelf", "projects", draw_store_shelf, "Founding-store shelving module."),

    S("overflow.honey", "overflow", lambda d: draw_overflow(d,"honey","#f0ad12","#fff09a","#b35d08","drop"), "Unprotected honey on a reed mat."),
    S("overflow.berry", "overflow", lambda d: draw_overflow(d,"berry","#7a277f","#d37bdd","#421340","round"), "Unprotected berry pile."),
    S("overflow.mushroom", "overflow", lambda d: draw_overflow(d,"mushroom","#bd7042","#efc08f","#6b3d25","cap"), "Unprotected fungus pile."),
    S("overflow.apple", "overflow", lambda d: draw_overflow(d,"apple","#c73531","#ff8b6f","#721d1d","round"), "Unprotected apple pile."),
    S("overflow.seed", "overflow", lambda d: draw_overflow(d,"seed","#b89461","#ead19b","#715333","seed"), "Dry unprotected seeds."),
    S("overflow.grain", "overflow", lambda d: draw_overflow(d,"grain","#88a846","#d9e77d","#53682e","seed"), "Dry unprotected grain."),
    S("overflow.mixed", "overflow", lambda d: draw_overflow(d,"mixed","#a56545","#e5b179","#563426","round"), "Legacy mixed ration pile."),
    S("overflow.spoilage", "overflow", draw_spoilage, "Fully spoiled overflow/waste transition."),

    S("material.clay", "materials", lambda d: draw_material(d,"#b96f49","#e0a176","#71391f","bricks")),
    S("material.fiber", "materials", lambda d: draw_material(d,"#78984b","#b8cc77","#425e2f","fibres")),
    S("material.wood", "materials", lambda d: draw_material(d,"#885126","#c88949","#4b2a15","bundle")),
    S("material.stone", "materials", lambda d: draw_material(d,"#85878b","#c7cbd0","#4a4c52")),
    S("material.sand", "materials", lambda d: draw_material(d,"#c1a56c","#ead79e","#77633e")),
    S("material.copper", "materials", lambda d: draw_material(d,"#b8663e","#f0aa73","#6f3727")),
    S("material.iron", "materials", lambda d: draw_material(d,"#777d86","#d3dae0","#40454d")),
    S("material.gold", "materials", lambda d: draw_material(d,"#c99a24","#ffe47a","#765311")),

    S("material.quartz", "materials", lambda d: draw_material(d,"#a8d3d6","#efffff","#537d86")),
    S("material.gem", "materials", lambda d: draw_material(d,"#6f46a8","#cf9cff","#3b245f")),
    S("material.obsidian", "materials", lambda d: draw_material(d,"#322442","#80639d","#16101f")),
    S("material.meteorite", "materials", lambda d: draw_material(d,"#40505a","#8ad0ce","#202830")),
    S("cargo.basket", "cargo", draw_basket),
    S("cargo.rope", "cargo", draw_rope),
    S("cargo.beam", "cargo", draw_beam),
    S("cargo.clay_brick", "cargo", draw_brick),

    S("food.honey", "food", lambda d: draw_small_food(d,"honey","#e9a915","#fff09a","#9c5108")),
    S("food.berry", "food", lambda d: draw_small_food(d,"berry","#792479","#d577d9","#431342")),
    S("food.mushroom", "food", lambda d: draw_small_food(d,"mushroom","#bd7042","#efc08f","#6b3d25")),
    S("food.apple", "food", lambda d: draw_small_food(d,"apple","#c93632","#ff8c70","#741c1c")),
    S("food.seed", "food", lambda d: draw_small_food(d,"seed","#b89461","#ecd19b","#715333")),
    S("food.grain", "food", lambda d: draw_small_food(d,"grain","#86a746","#d9e77d","#51672c")),
    S("food.fungus_chunk", "food", lambda d: draw_small_food(d,"mushroom","#75994a","#c4db7d","#405e2e")),
    S("food.nectar", "food", lambda d: draw_small_food(d,"honey","#e26f9f","#ffc2dd","#87335a")),

    S("tool.basket", "tools", draw_basket),
    S("tool.pick", "tools", lambda d: draw_tool(d,"pick")),
    S("tool.trowel", "tools", lambda d: draw_tool(d,"trowel")),
    S("tool.hammer", "tools", lambda d: draw_tool(d,"hammer")),
    S("tool.shovel", "tools", lambda d: draw_tool(d,"shovel")),
    S("utility.water", "tools", draw_water),
    S("utility.brace_peg", "tools", draw_peg),
    S("utility.jar_lid", "tools", draw_lid),

    S("brood.egg", "colony", lambda d: draw_brood(d,"egg")),
    S("brood.larva", "colony", lambda d: draw_brood(d,"larva")),
    S("brood.pupa", "colony", lambda d: draw_brood(d,"pupa")),
    S("ant.worker", "colony", lambda d: draw_ant(d,"worker")),
    S("ant.minim", "colony", lambda d: draw_ant(d,"minim")),
    S("ant.major", "colony", lambda d: draw_ant(d,"major")),
    S("ant.queen", "colony", lambda d: draw_ant(d,"queen")),
    S("colony.waste", "colony", draw_waste),

    S("structure.store", "states", draw_store_shelf),
    S("state.cache_disabled", "states", lambda d: draw_status_cache(d,"disabled")),
    S("state.cache_flooded", "states", lambda d: draw_status_cache(d,"flooded")),
    S("state.brace_damaged", "states", draw_damaged_brace),
    S("state.fungus_dry", "states", lambda d: draw_fungus_bed(d,"dry")),
    S("state.fungus_healthy", "states", lambda d: draw_fungus_bed(d,"healthy")),
    S("state.storage_pressure", "states", draw_pressure_marker),
    S("state.reserved", "states", lambda d: None, "Reserved transparent slot for a compatible future sprite."),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = (len(SPECS) + COLS - 1) // COLS
    atlas = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    sprites = {}
    for index, spec in enumerate(SPECS):
        tile = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        spec.draw(ImageDraw.Draw(tile))
        col, row = index % COLS, index // COLS
        x, y = col * CELL, row * CELL
        atlas.alpha_composite(tile, (x, y))
        sprites[spec.name] = {
            "x": x, "y": y, "w": CELL, "h": CELL,
            "pivot": {"x": spec.pivot[0], "y": spec.pivot[1]},
            "native": {"w": spec.native[0], "h": spec.native[1]},
            "category": spec.category,
            "note": spec.note,
        }

    manifest = {
        "meta": {
            "name": "ANT FARM · COLONY OBJECTS",
            "version": "20261020h",
            "image": "colony-atlas.png",
            "width": atlas.width,
            "height": atlas.height,
            "cell": CELL,
            "columns": COLS,
            "rows": rows,
            "filtering": "nearest",
            "premultipliedAlpha": False,
            "generator": "scripts/generate-colony-atlas.py",
            "license": "Game asset · TOPO STUDIOS",
        },
        "sprites": sprites,
    }
    atlas.save(PNG_PATH, format="PNG", optimize=True)
    raw = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    JSON_PATH.write_text(raw, encoding="utf-8")
    JS_PATH.write_text(
        "/* Generated by scripts/generate-colony-atlas.py; edit the generator, not coordinates. */\n"
        "globalThis.COLONY_TEXTURE_MANIFEST=" + json.dumps(manifest, separators=(",", ":"), ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {PNG_PATH.relative_to(ROOT)} · {atlas.width}x{atlas.height} · {len(SPECS)} sprites")
    print(f"wrote {JSON_PATH.relative_to(ROOT)}")
    print(f"wrote {JS_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
