#!/usr/bin/env python3
"""Find artists whose monthly listeners jumped, from the real readings in history.json, and keep them in jumps.json.

A jump = latest reading is at least +50% (+30% once past 20k) AND at least +2,000 AND at least 3x the artist's own
usual week-to-week wobble, over the median of the readings 5-10 days earlier (the one nearest 7 days if only one). Entries stay for 14 days after the jump is seen. Prints the artists that are NEW today.
Usage: jumps.py [YYYY-MM-DD]   (default: today)
"""
import datetime, json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
today = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat()
D = datetime.date.fromisoformat
hist = json.load(open(os.path.join(here, "history.json")))["artists"]
jp = os.path.join(here, "jumps.json")
old = json.load(open(jp)) if os.path.exists(jp) else {}
keep = {k: v for k, v in old.items() if (D(today) - D(v["seen"])).days <= 14}
new = []
for k, e in hist.items():
    pts = [p for p in e["pts"] if D(p[0]) <= D(today)]
    if len(pts) < 2:
        continue
    d1, l = pts[-1]
    if (D(today) - D(d1)).days > 2:
        continue
    prev = [p for p in pts[:-1] if (D(d1) - D(p[0])).days >= 5]
    if not prev:
        continue
    base = [p for p in prev if (D(d1) - D(p[0])).days <= 10] or [min(prev, key=lambda p: abs((D(d1) - D(p[0])).days - 7))]
    vals = sorted(p[1] for p in base)
    f = vals[len(vals) // 2]
    d0 = min(base, key=lambda p: abs((D(d1) - D(p[0])).days - 7))[0]
    diffs = [abs(b[1] - a[1]) for a, b in zip(pts[:-2], pts[1:-1])]  # day-to-day moves before the latest reading
    noise = sum(diffs) / len(diffs) if diffs else 0
    need_pct = 0.5 if f <= 20000 else 0.3
    if f and l - f >= max(2000, 3 * noise) and (l - f) / f >= need_pct:
        if k not in keep:
            new.append({"name": e["name"], "from": f, "to": l, "pct": round((l - f) / f * 100), "d0": d0, "d1": d1})
        keep[k] = {"name": e["name"], "from": f, "to": l, "d0": d0, "d1": d1, "seen": keep.get(k, {}).get("seen", today)}
json.dump(keep, open(jp, "w"), indent=1, ensure_ascii=False)
print(json.dumps({"new": new, "active": len(keep)}))
