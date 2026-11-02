#!/usr/bin/env python3
"""Record ROSTR agency lookups in rostr.json (git-ignored; it rides inside the encrypted site data).

Usage: rostr_add.py YYYY-MM-DD '{"Artist": {"agency": "CAA"|null, "agent": "Name"|null, "slug": "artistslug"|null, "state": "ok"|"none"|"nomatch"}, ...}'
state: ok = agency found, none = ROSTR profile but no agency listed, nomatch = no exact name match (not looked up again for 60 days).
"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
rp = os.path.join(here, "rostr.json")
db = json.load(open(rp)) if os.path.exists(rp) else {}
day, vals = sys.argv[1], json.loads(sys.argv[2])
for name, v in vals.items():
    db[name.lower()] = {"agency": v.get("agency"), "agent": v.get("agent"), "slug": v.get("slug"), "state": v.get("state", "ok"), "checked": day}
json.dump(db, open(rp, "w"), indent=1, ensure_ascii=False)
print(len(vals), "recorded;", len(db), "artists in rostr.json")
