#!/usr/bin/env python3
"""Append one day's monthly-listener readings to history.json.

Usage: add_points.py YYYY-MM-DD '{"Artist": listeners, ...}' ['{"Artist": ig_followers, ...}']   (null values are skipped)
One point per artist per day; re-running a day overwrites that day's point.
"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
hp = os.path.join(here, "history.json")
hist = json.load(open(hp))
day, vals = sys.argv[1], json.loads(sys.argv[2])
n = 0
for name, v in vals.items():
    e = hist["artists"].get(name.lower())
    if not e or v is None:
        continue
    e["pts"] = [p for p in e["pts"] if p[0] != day] + [[day, int(v)]]
    e["pts"].sort()
    n += 1
ig = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
for name, v in ig.items():
    e = hist["artists"].get(name.lower())
    if not e or v is None:
        continue
    e["ig"] = [p for p in e.get("ig", []) if p[0] != day] + [[day, int(v)]]
    e["ig"].sort()
json.dump(hist, open(hp, "w"), indent=1, ensure_ascii=False)
print(n, "points added for", day)
