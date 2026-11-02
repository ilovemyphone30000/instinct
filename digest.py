#!/usr/bin/env python3
"""Plain-text weekly digest from the local data.json, for pasting into Slack or an email. Prints to stdout; sends nothing.
Usage: digest.py [days=7]
"""
import datetime, json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
d = json.load(open(os.path.join(here, "data.json")))
S, HS = d["songs"], d.get("hs", {})
since = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
key = lambda a: re.split(r",| & | feat\.? | x ", a, 1, flags=re.I)[0].strip().lower()
cur = lambda s: (HS.get(key(s["artist"]), {}).get("h") or [[0, s.get("listeners")]])[-1][1]
def growth(s):
    h = HS.get(key(s["artist"]), {}).get("h") or []
    return (h[-1][1] - h[0][1]) / h[0][1] if len(h) > 1 and h[0][1] else None
new = [s for s in S if s["date"] >= since and s["src"] != "WL"]
out = ["A&R INSTINCT - since " + since, "", "%d new songs from %d artists" % (len(new), len({key(s["artist"]) for s in new}))]
seen = set()
jp = [s for s in S if s.get("jp") and not (key(s["artist"]) in seen or seen.add(key(s["artist"])))]
if jp:
    out += ["", "JUMPED"] + ["- %s: %s -> %s monthly listeners" % (s["artist"], format(s["jp"]["f"], ","), format(s["jp"]["t"], ",")) for s in jp]
seen = set()
op = sorted([s for s in new if not s.get("ag") and (cur(s) or 0) < 50000 and not s.get("flag")], key=lambda s: -(cur(s) or 0))
op = [s for s in op if not (key(s["artist"]) in seen or seen.add(key(s["artist"])))][:10]
if op:
    out += ["", "NEW AND UNSIGNED, UNDER 50K"] + ["- %s (%s) %s" % (s["artist"], format(cur(s), ","), s.get("track", "")) for s in op]
seen = set()
fl = sorted([s for s in S if s.get("flag") and growth(s) is not None], key=lambda s: -growth(s))
fl = [s for s in fl if not (key(s["artist"]) in seen or seen.add(key(s["artist"])))][:6]
if fl:
    out += ["", "FLAGGED ARTISTS MOVING"] + ["- %s: %+d%%" % (s["artist"], round(growth(s) * 100)) for s in fl]
print("\n".join(out))
