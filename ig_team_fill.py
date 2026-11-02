#!/usr/bin/env python3
"""Fill in the follower count for Instagram handles a teammate typed in on the site without a count.

Reads the team log, finds artists whose latest 'ig' event has a handle but no count, reads the count from the PUBLIC,
LOGGED-OUT profile preview (ig_public.fetch: plain HTTP, no cookies, never a signed-in session), then writes it back as a
new 'ig' event (name 'auto') so every browser shows it, and records the reading in history.json for growth.
Usage: ig_team_fill.py [--dry]      Prints {"filled":n,"waiting":n,"failed":n}.
Run it every daily run, and any time after a teammate adds a handle.
"""
import datetime, json, os, re, sys, time, urllib.request
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import ig_public

api = json.load(open(os.path.join(here, "team_api.json")))
log = json.load(urllib.request.urlopen(api["url"] + "?k=" + api["key"], timeout=30)).get("log", [])
latest = {}
for e in log:
    if e["y"] == "ig" and e.get("x"):
        u, _, c = str(e["x"]).partition("|")
        latest[e["a"]] = (u, c, e.get("n") or e["a"])
todo = [(k, v) for k, v in latest.items() if v[0] and not v[1].strip() and ig_public.handle(v[0])]
res = {"filled": 0, "waiting": len(todo), "failed": 0}
if "--dry" in sys.argv:
    print(json.dumps(res)); sys.exit()
hp = os.path.join(here, "history.json")
H = json.load(open(hp))
today = datetime.date.today().isoformat()
for k, (u, _, name) in todo:
    h = ig_public.handle(u)
    st, v = ig_public.fetch(h)
    if st != "ok" or not v:
        res["failed"] += 1
        continue
    body = json.dumps({"k": api["key"], "type": "ig", "a": k, "n": name, "i": "auto", "x": "https://www.instagram.com/%s/|%d" % (h, v)}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request(api["url"], data=body, headers={"Content-Type": "text/plain"}), timeout=30))
    if r.get("ok"):
        e = H["artists"].setdefault(k, {"name": name, "pts": []})
        e["igUrl"] = "https://www.instagram.com/%s/" % h
        if not e.get("ig") or e["ig"][-1][0] != today:
            e.setdefault("ig", []).append([today, v])
        res["filled"] += 1
        res["waiting"] -= 1
    time.sleep(3)
json.dump(H, open(hp, "w"), indent=1, ensure_ascii=False)
print(json.dumps(res))
