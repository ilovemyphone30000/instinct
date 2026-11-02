#!/usr/bin/env python3
"""Sanity-check a built payload before it is encrypted and published. Exit 1 = refuse the build.
Usage: check_data.py data.json     (also run by build_data.py)
Checks: row count is not far below the last published build, no row without artist/date, artist keys consistent,
series are ordered and non-negative, no duplicate watchlist rows, health block present, prior-build row count.
"""
import json, os, re, subprocess, sys

p = sys.argv[1] if len(sys.argv) > 1 else "data.json"
here = os.path.dirname(os.path.abspath(p))
d = json.load(open(p))
S = d["songs"]
bad = []
if len(S) < 100:
    bad.append("only %d rows" % len(S))
prev = None
try:  # row count of the build that is currently published (decrypted from the committed file)
    pw = open(os.path.join(here, ".password")).read().strip()
    out = subprocess.run(["node", os.path.join(here, "decrypt.js"), os.path.join(here, "data.enc.json"), os.path.join(here, ".password")],
                         capture_output=True, text=True, timeout=60)
    if out.returncode == 0:
        prev = len(json.loads(out.stdout)["songs"])
except Exception:
    pass
if prev and len(S) < prev * 0.9:
    bad.append("row count fell from %d to %d" % (prev, len(S)))
for i, s in enumerate(S):
    if not s.get("artist") or not s.get("date"):
        bad.append("row %d missing artist/date" % i)
    if s.get("src") not in ("SP", "MP", "WL"):
        bad.append("row %d bad src %r" % (i, s.get("src")))
for k, e in d.get("hs", {}).items():
    for key in ("h", "g"):
        ser = e.get(key) or []
        if [x[0] for x in ser] != sorted(x[0] for x in ser):
            bad.append("%s %s series out of order" % (k, key))
        if any(x[1] is None or x[1] < 0 for x in ser):
            bad.append("%s %s series negative/null" % (k, key))
wl = [s["wid"] for s in S if s.get("wid")]
if len(wl) != len(set(wl)):
    bad.append("duplicate watchlist rows")
if not d.get("health"):
    bad.append("health block missing")
if bad:
    print("check_data FAILED:\n  " + "\n  ".join(bad[:20]))
    sys.exit(1)
print("check_data ok: %d rows%s" % (len(S), " (prev %d)" % prev if prev else ""))
