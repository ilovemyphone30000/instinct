#!/usr/bin/env python3
"""Compare a saved get_spreadsheet result for the MUSIC tab with data.json and list every difference.

Usage: mirror_check.py <get_spreadsheet_result.json> [data.json]
Checks each sheet row against the site row with the same artist + song: date, FLAG, listeners, IG followers,
press link count and playlist count; and lists rows present on only one side. Rows that exist only on the site
because of the team layer (src WL watchlist, PR press finds, rec rows) are counted separately, not as drift.
Exits 1 when the sheet and the site disagree.
"""
import json, re, sys, datetime

fv = lambda c: (c.get("formattedValue") or "").strip()
num = lambda s: int(re.sub(r"\D", "", s) or 0)
g = json.load(open(sys.argv[1]))
d = json.load(open(sys.argv[2] if len(sys.argv) > 2 else "data.json"))
sh = next(s for s in g["sheets"] if s["properties"]["title"] == "MUSIC")
rows = sh["data"][0]["rowData"]
head = [fv(c) for c in rows[0]["values"]]
ix = {n: head.index(n) for n in ["FLAG", "DATE", "ARTIST", "SONG", "LISTENERS", "IG FOLLOWERS", "NOTABLE PRESS LINKS", "SPOTIFY PLAYLISTS"]}
sheet = {}
for r in rows[1:]:
    v = r.get("values", []) + [{}] * 10
    a, s = fv(v[ix["ARTIST"]]), fv(v[ix["SONG"]])
    if a or s:
        sheet[(a.lower(), s.lower())] = {k: fv(v[i]) for k, i in ix.items()}
site = {(s["artist"].lower(), s.get("song", "").lower()): s for s in d["songs"] if s["src"] in ("SP", "MP")}
team_only = sum(1 for s in d["songs"] if s["src"] not in ("SP", "MP"))
bad = []
for k in sorted(set(sheet) | set(site)):
    a, b = sheet.get(k), site.get(k)
    if not a: bad.append((k, "on the site, not in the sheet")); continue
    if not b: bad.append((k, "in the sheet, not on the site")); continue
    m = re.match(r"(\d+)/(\d+)/(\d{4})", a["DATE"])
    if m and datetime.date(int(m[3]), int(m[1]), int(m[2])).isoformat() != b.get("date"): bad.append((k, "date"))
    if (a["FLAG"].upper() == "TRUE") != bool(b.get("flag")) and not any(x["artist"].lower() == k[0] and x.get("flag") for x in d["songs"]): bad.append((k, "flag"))
    if b.get("listeners") is not None and num(a["LISTENERS"]) != b["listeners"]: bad.append((k, "listeners"))
    if num(a["IG FOLLOWERS"]) != (b.get("ig") or 0): bad.append((k, "ig followers"))
    if len([p for p in a["NOTABLE PRESS LINKS"].split(" | ") if p]) != len(b.get("press") or []): bad.append((k, "press count"))
    if len([p for p in a["SPOTIFY PLAYLISTS"].split(" | ") if p]) != len(b.get("playlists") or []): bad.append((k, "playlist count"))
print(f"sheet rows {len(sheet)}, site sheet-rows {len(site)}, team-layer rows on the site {team_only}, differences {len(bad)}")
for k, why in bad[:40]: print("  ", k, why)
sys.exit(1 if bad else 0)
