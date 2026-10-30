#!/usr/bin/env python3
"""Make sure every flagged artist in data.json has a Spotify artist id in history.json.

Run with the superplaylist venv:  ~/Downloads/superplaylist/.venv/bin/python track_ids.py
Prints the tracked artists as JSON [{name,id}] for the daily Pathfinder lookup.
"""
import json, os, re, sys
sys.path.insert(0, os.path.expanduser("~/Downloads/superplaylist"))
import auth, superplaylist as sp

here = os.path.dirname(os.path.abspath(__file__))
hp = os.path.join(here, "history.json")
hist = json.load(open(hp)) if os.path.exists(hp) else {"artists": {}}
songs = json.load(open(os.path.join(here, "data.json")))["songs"]
api = None


def prim(a):
    return re.split(r",| & | feat\\.? | x ", a, 1)[0].strip()


for s in songs:
    if not s.get("flag") or not s.get("track"):
        continue
    name = prim(s["artist"])
    e = hist["artists"].setdefault(name.lower(), {"name": name, "pts": []})
    if e.get("id"):
        continue
    api = api or sp.Spotify(auth.get_access_token())
    t = api.get("https://api.spotify.com/v1/tracks/" + s["track"].rsplit("/", 1)[1])
    arts = t["artists"]
    hit = next((a for a in arts if a["name"].lower() == name.lower()), arts[0])
    e["id"] = hit["id"]

json.dump(hist, open(hp, "w"), indent=1, ensure_ascii=False)
print(json.dumps([{"name": v["name"], "id": v["id"]} for v in hist["artists"].values() if v.get("id")]))
