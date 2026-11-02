#!/usr/bin/env python3
"""Record Instagram handles found on Spotify artist pages (externalLinks, entry INSTAGRAM) in history.json.

Usage: ig_handles_add.py '{"Artist Name": "https://instagram.com/handle?utm=..."}'
Always record a handle the moment Spotify lists one, even when no follower count is available: the site shows the
@handle straight away and ig_public.py (public, logged-out preview) fills the count. Query strings and trailing
slashes are stripped. Never touches Instagram itself.
"""
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
hp = os.path.join(here, "history.json")
H = json.load(open(hp))
n = 0
for name, url in json.loads(sys.argv[1]).items():
    h = re.sub(r"^https?://(www\.)?instagram\.com/", "", str(url or "")).split("/")[0].split("?")[0].lstrip("@")
    if not re.fullmatch(r"[A-Za-z0-9._]{1,30}", h):
        print("skipped (not a profile handle):", name, url)
        continue
    k = re.split(r",| & | feat\.? | x ", name, 1, flags=re.I)[0].strip().lower()
    e = H["artists"].setdefault(k, {"name": name, "pts": []})
    e["igUrl"] = "https://www.instagram.com/%s/" % h
    e.pop("igx", None)
    n += 1
json.dump(H, open(hp, "w"), indent=1, ensure_ascii=False)
print(n, "handles recorded")
