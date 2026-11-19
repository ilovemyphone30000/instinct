#!/usr/bin/env python3
"""
Weekly Superplaylist scan.

Reads a fixed set of curated playlists, finds tracks added in the last N days
that appear on 2+ of them, drops anything already published in a previous
Superplaylist, and writes the result to a new playlist.

Usage:
    python superplaylist.py              # full run, creates the playlist
    python superplaylist.py --dry-run    # scan + report, create nothing
    python superplaylist.py --csv out.csv

Auth: see auth.py. Requires a Spotify app client ID/secret in .env.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
from collections import OrderedDict
from datetime import datetime, timedelta, timezone

import requests

from auth import get_access_token

API = "https://api.spotify.com/v1"
HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- http

class Spotify:
    def __init__(self, token):
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {token}"

    def get(self, url, **params):
        """GET with retry on 429/5xx. Spotify's Retry-After is in seconds."""
        for attempt in range(6):
            r = self.s.get(url, params=params or None, timeout=30)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 2)) + 1
                print(f"  rate limited, sleeping {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            if r.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            r.raise_for_status()
            return r.json()
        raise RuntimeError(f"giving up on {url}")

    def post(self, url, payload):
        for attempt in range(6):
            r = self.s.post(url, json=payload, timeout=30)
            if r.status_code == 429:
                time.sleep(int(r.headers.get("Retry-After", 2)) + 1)
                continue
            if r.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            r.raise_for_status()
            return r.json()
        raise RuntimeError(f"giving up on {url}")

    def playlist_tracks(self, pid):
        """All tracks with their added_at, following pagination."""
        out = []
        url = f"{API}/playlists/{pid}/items"
        params = {
            "limit": 100,
            "fields": "next,items(added_at,item(id,uri,name,artists(id,name)))",
        }
        while url:
            page = self.get(url, **params) if params else self.get(url)
            params = None
            for it in page.get("items", []):
                t = it.get("item")
                if not t or not t.get("id"):
                    continue  # local files, podcasts, unavailable tracks
                out.append({
                    "added_at": it.get("added_at"),
                    "uri": t["uri"],
                    "title": t["name"],
                    "artist": t["artists"][0]["name"] if t.get("artists") else "",
                    "artist_id": t["artists"][0]["id"] if t.get("artists") else "",
                })
            url = page.get("next")
        return out

    def playlist_name(self, pid):
        return self.get(f"{API}/playlists/{pid}", fields="name")["name"]

    def my_playlists(self):
        out, url = [], f"{API}/me/playlists"
        params = {"limit": 50}
        while url:
            page = self.get(url, **params) if params else self.get(url)
            params = None
            out.extend(page.get("items", []))
            url = page.get("next")
        return out

    def create_playlist(self, user_id, name, description=""):
        return self.post(f"{API}/users/{user_id}/playlists",
                         {"name": name, "public": False, "description": description})

    def add_tracks(self, pid, uris):
        for i in range(0, len(uris), 100):
            self.post(f"{API}/playlists/{pid}/items", {"uris": uris[i:i + 100]})


# ------------------------------------------------------------ matching

FEAT = re.compile(r"\((?:feat|ft|with)\.?[^)]*\)|\[(?:feat|ft|with)\.?[^\]]*\]", re.I)
TRAIL = re.compile(r"\s-\s.*(remaster|version|edit|mix).*$", re.I)
FEAT_BARE = re.compile(r"\b(?:feat|ft)\.?\s.*$", re.I)
PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


def norm(s):
    """Normalize a title or artist for cross-playlist matching.

    Curly vs straight quotes, feat. credits and remaster suffixes all vary
    between playlists for the same recording, so they get stripped.
    """
    s = unicodedata.normalize("NFKC", s or "")
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    s = s.lower()
    s = FEAT.sub(" ", s)
    s = TRAIL.sub(" ", s)
    s = FEAT_BARE.sub(" ", s)
    s = PUNCT.sub(" ", s)
    return " ".join(s.split())


def primary_artist(a):
    return re.split(r",|&|\sx\s", a or "")[0].strip()


def key(t):
    return f"{norm(t['title'])}|{norm(primary_artist(t['artist']))}"


# ---------------------------------------------------------------- main

def next_number(playlists):
    """Superplaylist and Playlist Scout Sheet share one sequence."""
    pat = re.compile(r"^(?:Superplaylist|Playlist Scout Sheet)\s*#(\d+)", re.I)
    ns = [int(m.group(1)) for p in playlists
          if (m := pat.match(p.get("name", "") or ""))]
    return (max(ns) + 1 if ns else 1), ns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--csv", default="out.csv")
    ap.add_argument("--days", type=int)
    ap.add_argument("--rostr", action="store_true",
                    help="look up booking agencies for the top 20 (needs a "
                         "logged-in ROSTR profile; read rostr_notes.md first)")
    ap.add_argument("--rostr-top", type=int, default=20)
    ap.add_argument("--no-move", action="store_true",
                    help="skip filing the playlist into the folder")
    ap.add_argument("--headed", action="store_true",
                    help="show the browser for the two browser steps")
    args = ap.parse_args()

    cfg = json.load(open(os.path.join(HERE, "config.json"), encoding="utf-8"))
    days = args.days or cfg["window_days"]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    sp = Spotify(get_access_token())
    excluded = {pid for pid, _ in cfg["excluded"]}
    bl_id = cfg["always_include"]["id"]

    scan = [(pid, name) for pid, name in cfg["scan"] if pid not in excluded]
    # The always-include list is fetched alongside the rest but handled
    # differently below (whole tracklist, not just the window).
    fetch = scan + [(bl_id, cfg["always_include"]["label"])]
    print(f"window: {cutoff[:10]} -> today ({days}d), {len(fetch)} playlists")

    # --- gather -----------------------------------------------------
    recent, bl_all, failures = {}, [], []
    for pid, name in fetch:
        try:
            tracks = sp.playlist_tracks(pid)
        except Exception as e:
            failures.append((name, pid, str(e)))
            print(f"  FAILED {name}: {e}", file=sys.stderr)
            continue
        if pid == bl_id:
            bl_all = tracks  # entire tracklist is a candidate, not just recent
            continue
        hits = [t for t in tracks if t["added_at"] and t["added_at"] >= cutoff]
        recent[pid] = {"name": name, "tracks": hits}
        print(f"  {name}: {len(hits)} recent / {len(tracks)} total")

    # --- duplicates across 2+ playlists -----------------------------
    groups = OrderedDict()
    for pid, v in recent.items():
        for t in v["tracks"]:
            g = groups.setdefault(key(t), {"track": t, "on": []})
            if v["name"] not in g["on"]:
                g["on"].append(v["name"])
    dups = sorted((g for g in groups.values() if len(g["on"]) >= 2),
                  key=lambda g: -len(g["on"]))
    print(f"{len(groups)} unique recent, {len(dups)} on 2+ playlists")

    # --- drop anything already published ----------------------------
    # Union of EVERY prior Superplaylist, not just last week's. Diffing
    # against only the previous one lets a track that was filtered out of
    # it come back the week after.
    mine = sp.my_playlists()
    n, existing = next_number(mine)
    pat = re.compile(r"^(?:Superplaylist|Playlist Scout Sheet)\s*#\d+", re.I)
    prior = [p for p in mine if pat.match(p.get("name", "") or "")]
    rng = f"#{min(existing)}-#{max(existing)}" if existing else "none"
    print(f"{len(prior)} prior outputs ({rng}), this run is #{n}")

    seen_uri, seen_key = set(), set()
    for p in prior:
        for t in sp.playlist_tracks(p["id"]):
            seen_uri.add(t["uri"])
            seen_key.add(key(t))
    print(f"{len(seen_uri)} tracks already published")

    def is_new(t):
        return t["uri"] not in seen_uri and key(t) not in seen_key

    final = [g for g in dups if is_new(g["track"])]
    bl_new = [t for t in bl_all
              if is_new(t) and key(t) not in {key(g["track"]) for g in final}]

    rows = [{"track": g["track"], "on": g["on"], "source": "duplicate"}
            for g in final]
    rows += [{"track": t, "on": [cfg["always_include"]["label"]],
              "source": "always-include"} for t in bl_new]

    print(f"\n{len(dups) - len(final)} duplicates already published, "
          f"{len(final)} new")
    print(f"always-include: {len(bl_all)} total, {len(bl_new)} new")
    print(f"TOTAL: {len(rows)}")

    if failures:
        print(f"\n!! {len(failures)} playlists failed to load — "
              f"results are incomplete:", file=sys.stderr)
        for name, pid, err in failures:
            print(f"   {name} ({pid}): {err}", file=sys.stderr)

    # --- ROSTR (opt-in) ---------------------------------------------
    agency = {}
    if args.rostr and rows:
        import rostr as rostr_mod
        names, seen_names = [], set()
        for r in rows[:args.rostr_top]:
            a = r["track"]["artist"]
            if a and a not in seen_names:
                seen_names.add(a)
                names.append(a)
        print(f"\nROSTR: looking up {len(names)} artists")
        try:
            for res in rostr_mod.lookup(names, headless=not args.headed):
                agency[res["query"]] = res
                label = res["agencies"] or res.get("note", "")
                print(f"  {res['query']}: {label}")
        except Exception as e:
            print(f"  ROSTR pass failed ({e}) — columns left blank",
                  file=sys.stderr)

    # --- write ------------------------------------------------------
    with open(args.csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Rank", "Song", "Artist", "# Playlists", "Playlist names",
                    "Source", "Spotify track", "Spotify artist",
                    "Agency", "Lead agents", "ROSTR profile"])
        for i, r in enumerate(rows, 1):
            t = r["track"]
            a = agency.get(t["artist"])
            if a and a["status"] == "ok":
                ag, ld, pf = a["agencies"], a["agents"], a["profile"]
            elif a:
                ag = ld = pf = a.get("note") or "not found on ROSTR"
            else:
                ag = ld = pf = ""
            w.writerow([i, t["title"], t["artist"], len(r["on"]),
                        ", ".join(r["on"]), r["source"],
                        f"https://open.spotify.com/track/{t['uri'].split(':')[-1]}",
                        f"https://open.spotify.com/artist/{t['artist_id']}",
                        ag, ld, pf])
    print(f"\nwrote {args.csv}")

    json.dump({"rows": rows, "rostr": agency},
              open("last_run.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    if args.dry_run:
        print("\n--dry-run: no playlist created")
        return

    date = datetime.now().strftime(cfg["date_format"])
    name = cfg["playlist_name_template"].format(n=n, date=date)
    pl = sp.create_playlist(cfg["spotify_user_id"], name,
                            f"Weekly new-only scan, {days}d window")
    sp.add_tracks(pl["id"], [r["track"]["uri"] for r in rows])

    # Verify: Spotify silently relinks some track URIs to regional
    # equivalents, so check the count rather than assuming the POST took.
    got = sp.playlist_tracks(pl["id"])
    print(f"\ncreated {name}")
    print(f"  https://open.spotify.com/playlist/{pl['id']}")
    print(f"  {len(got)} tracks (expected {len(rows)})")
    if len(got) != len(rows):
        print("  !! count mismatch — check the playlist", file=sys.stderr)

    # The Web API can't touch folders, so this last step drives a browser.
    # It's cosmetic: a failure here never invalidates the run above.
    if not args.no_move:
        import move_to_folder
        print("\nfiling into folder...")
        move_to_folder.move(pl["id"], headless=not args.headed)


if __name__ == "__main__":
    main()
