#!/usr/bin/env python3
"""Weekly full rescan list: EVERY artist in data.json (SP + MP, all dates), with Spotify artist ids kept in history.json.

Run with the superplaylist venv:  ~/Downloads/superplaylist/.venv/bin/python all_ids.py
Prints JSON {"listeners":[{name,id}]}. Ids missing from history.json are resolved from each artist's song link
(single /tracks/{id} calls); if Spotify rate-limits partway, the rest are resolved on the next run and
whoever has no id yet is simply left out of today's list.
"""
import json, os, re, sys, time
sys.path.insert(0, os.path.expanduser("~/Downloads/superplaylist"))
import auth, superplaylist as sp

here = os.path.dirname(os.path.abspath(__file__))
hp = os.path.join(here, "history.json")
hist = json.load(open(hp))
songs = json.load(open(os.path.join(here, "data.json")))["songs"]


def prim(a):
    return re.split(r",| & | feat\.? | x ", a, 1)[0].strip()


need, names = {}, {}
for s in songs:
    if not s.get("track"):
        continue
    name = prim(s["artist"])
    k = name.lower()
    names[k] = name
    e = hist["artists"].setdefault(k, {"name": name, "pts": []})
    if not e.get("id"):
        need.setdefault(k, s["track"].rsplit("/", 1)[1])

if need:
    api = sp.Spotify(auth.get_access_token())
    for k, tid in need.items():
        try:
            r = api.get("https://api.spotify.com/v1/tracks/" + tid)
        except Exception as ex:
            print("id lookup stopped:", ex, file=sys.stderr)
            break
        hit = next((x for x in r["artists"] if x["name"].lower() == k), r["artists"][0])
        hist["artists"][k]["id"] = hit["id"]
        time.sleep(0.15)

json.dump(hist, open(hp, "w"), indent=1, ensure_ascii=False)
print(json.dumps({"listeners": [{"name": names[k], "id": hist["artists"][k]["id"]} for k in names if hist["artists"][k].get("id")]}))
