#!/usr/bin/env python3
"""Pick today's tracked artists and make sure each has a Spotify artist id in history.json.

Tracked = artists with a FLAG ticked, or any song added in the last 14 days (SP or MP).
Run with the superplaylist venv:  ~/Downloads/superplaylist/.venv/bin/python track_ids.py
Prints JSON {"listeners":[{name,id}], "ig":[{name,igUrl}]} for the daily lookups.
IG list = flagged artists first, then the tracked artists whose Instagram was read longest ago (never-read first),
capped at IG_CAP profiles a run, so every tracked artist is re-read every few days and growth builds for all of them.
"""
import datetime, json, os, re, sys
sys.path.insert(0, os.path.expanduser("~/Downloads/superplaylist"))
import auth, superplaylist as sp

WINDOW = 14
IG_CAP = 30
here = os.path.dirname(os.path.abspath(__file__))
hp = os.path.join(here, "history.json")
hist = json.load(open(hp)) if os.path.exists(hp) else {"artists": {}}
songs = json.load(open(os.path.join(here, "data.json")))["songs"]
cut = (datetime.date.today() - datetime.timedelta(days=WINDOW)).isoformat()


def prim(a):
    return re.split(r",| & | feat\.? | x ", a, 1)[0].strip()


active, need = {}, {}
for s in songs:
    if not s.get("track") or not (s.get("flag") or s.get("tf") or s["date"] >= cut):
        continue
    name = prim(s["artist"])
    k = name.lower()
    a = active.setdefault(k, {"name": name, "flag": False, "ig": None})
    a["flag"] = a["flag"] or bool(s.get("flag") or s.get("tf"))
    a["ig"] = a["ig"] or s.get("igUrl")
    e = hist["artists"].setdefault(k, {"name": name, "pts": []})
    if not e.get("id"):
        need.setdefault(k, s["track"].rsplit("/", 1)[1])

if need:
    api = sp.Spotify(auth.get_access_token())
    for k, tid in need.items():
        r = api.get("https://api.spotify.com/v1/tracks/" + tid)  # the batch endpoint is forbidden for this app
        hit = next((x for x in r["artists"] if x["name"].lower() == k), r["artists"][0])
        hist["artists"][k]["id"] = hit["id"]

json.dump(hist, open(hp, "w"), indent=1, ensure_ascii=False)
def last_ig(k):
    pts = hist["artists"][k].get("ig") or []
    return pts[-1][0] if pts else ""
cands = [(0 if a["flag"] else 1, last_ig(k), a) for k, a in active.items() if a["ig"]]
cands.sort(key=lambda c: (c[0], c[1]))
ig_pick = [{"name": a["name"], "igUrl": a["ig"]} for _, _, a in cands[:IG_CAP]]
out = {"listeners": [{"name": a["name"], "id": hist["artists"][k].get("id")} for k, a in active.items() if hist["artists"][k].get("id")],
       "ig": ig_pick}
print(json.dumps(out))
