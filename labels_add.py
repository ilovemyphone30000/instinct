#!/usr/bin/env python3
"""Merge Spotify copyright data into labels.json (git-ignored).

Usage: labels_add.py '<json>'   or   labels_add.py -   (reads stdin)
json = {"<track id>": ["<P line>", "<C line>", "<album name>", "<album type>"], ...}
Collected in the Spotify web player with the Pathfinder query getTrack (persisted hash fe16b8083eec2305854db612ca75589bcb71e009dc7a4d014f29bd534a4c01f5,
variables {uri: "spotify:track:<id>"}): data.trackUnion.albumOfTrack.copyright.items[type P / C].text, .name, .type.
`labels_add.py --missing` prints the track ids in data.json that have no entry yet.
"""
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
lp = os.path.join(here, "labels.json")
db = json.load(open(lp)) if os.path.exists(lp) else {}
if sys.argv[1] == "--missing":
    d = json.load(open(os.path.join(here, "data.json")))["songs"]
    ids = sorted({re.search(r"track/(\w{22})", s["track"]).group(1) for s in d if s.get("track") and "track/" in s["track"] and s.get("src") != "WL"})
    print(json.dumps([i for i in ids if i not in db]))
else:
    new = json.loads(sys.stdin.read() if sys.argv[1] == "-" else sys.argv[1])
    db.update(new)
    json.dump(db, open(lp, "w"), ensure_ascii=False)
    print(len(new), "added;", len(db), "tracks in labels.json")
