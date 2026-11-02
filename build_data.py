"""Turn a saved get_spreadsheet result for the SP and MP tabs into data.json.

Usage: build_data.py <get_spreadsheet_result.json> [out=data.json]

Writes plain data.json (git-ignored, local preview) and data.enc.json (the only data file that is committed;
AES-GCM with the password in .password, decrypted in the browser). Needs node.

Request: ranges ["SP!A1:I1000","MP!A1:I1000"], includeGridData true, fields
sheets.properties.title, sheets.data.rowData.values.formattedValue / .hyperlink / .textFormatRuns.
Columns are found by header name (FLAG, DATE, ARTIST, SONG, LISTENERS, IG FOLLOWERS,
NOTABLE PRESS LINKS, SPOTIFY PLAYLISTS, RECENT PLAYS). NOTES is never read.
"""
import json, sys, re, datetime

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "data.json"
d = json.load(open(src))
NEED = ["FLAG", "DATE", "ARTIST", "SONG", "LISTENERS", "IG FOLLOWERS",
        "NOTABLE PRESS LINKS", "SPOTIFY PLAYLISTS", "RECENT PLAYS"]


def num(s):
    s = re.sub(r"[^0-9.]", "", s or "")
    return int(float(s)) if s else None


def links(c):
    """Split ' | '-joined text into [{t, u?}], taking each part's link from the rich-text runs."""
    text = c.get("formattedValue") or ""
    if not text:
        return []
    half = len(text.encode("utf-16-le")) // 2
    runs = c.get("textFormatRuns") or []
    spans = []
    for k, r in enumerate(runs):
        a = r.get("startIndex", 0)
        b = runs[k + 1].get("startIndex", half) if k + 1 < len(runs) else half
        spans.append((a, b, (r.get("format", {}).get("link") or {}).get("uri")))
    res, pos = [], 0
    for part in text.split(" | "):
        if part:
            off = len(text[:pos].encode("utf-16-le")) // 2
            if spans:
                url = next((u for a, b, u in spans if a <= off < b), None)
            else:
                url = c.get("hyperlink")
            if not url and re.fullmatch(r"[\w-]+(\.[\w-]+)+(/\S*)?", part):
                url = "https://" + part
            res.append({"t": part, **({"u": url} if url else {})})
        pos += len(part) + 3
    return res


songs = []
for sh in d["sheets"]:
    tab = sh["properties"]["title"]
    if tab not in ("SP", "MP"):
        continue
    rows = sh["data"][0]["rowData"]
    head = [(c.get("formattedValue") or "").strip() for c in rows[0].get("values", [])]
    ix = {}
    for n in NEED:
        assert n in head, f"{tab}: header {n} missing: {head}"
        ix[n] = head.index(n)

    def cell(r, n):
        v = r.get("values", [])
        return v[ix[n]] if ix[n] < len(v) else {}

    for r in rows[1:]:
        artist = (cell(r, "ARTIST").get("formattedValue") or "").strip()
        song = (cell(r, "SONG").get("formattedValue") or "").strip()
        if not artist and not song:
            continue
        m = re.match(r"(\d+)/(\d+)/(\d{4})", cell(r, "DATE").get("formattedValue") or "")
        date = datetime.date(int(m[3]), int(m[1]), int(m[2])).isoformat() if m else None
        if not date:
            continue
        s = {
            "src": tab,
            "flag": (cell(r, "FLAG").get("formattedValue") or "").upper() == "TRUE",
            "date": date,
            "artist": artist,
            "song": song,
            "track": cell(r, "LISTENERS").get("hyperlink"),
            "listeners": num(cell(r, "LISTENERS").get("formattedValue")),
            "ig": num(cell(r, "IG FOLLOWERS").get("formattedValue")),
            "igUrl": cell(r, "IG FOLLOWERS").get("hyperlink"),
            "press": links(cell(r, "NOTABLE PRESS LINKS")),
            "playlists": links(cell(r, "SPOTIFY PLAYLISTS")),
            "plays": (cell(r, "RECENT PLAYS").get("formattedValue") or "").strip(),
        }
        songs.append({k: v for k, v in s.items() if v not in (None, "", [], False)})

import os, subprocess

# growth: history.json (git-ignored) holds daily monthly-listener readings for tracked artists.
# Each tracked artist's series = those readings + the listeners value stored on its own sheet rows.
def _pk(a):
    return re.split(r",| & | feat\.? | x ", a, 1)[0].strip().lower()
# a flag belongs to the artist: ticking FLAG on any one row flags all of that artist's rows
_fl = {_pk(s["artist"]) for s in songs if s.get("flag")}
for s in songs:
    if _pk(s["artist"]) in _fl:
        s["flag"] = True


def prim(a):
    return re.split(r",| & | feat\.? | x ", a, 1)[0].strip().lower()
hpath = os.path.join(os.path.dirname(os.path.abspath(out)), "history.json")
if os.path.exists(hpath):
    H = json.load(open(hpath))["artists"]
    for k, e in H.items():
        pts = {d: n for d, n in e["pts"]}
        for s in songs:
            if prim(s["artist"]) == k and s.get("listeners") is not None:
                pts.setdefault(s["date"], s["listeners"])
        ipts = {d: n for d, n in e.get("ig", [])}
        for s in songs:
            if prim(s["artist"]) == k and s.get("ig") is not None:
                ipts.setdefault(s["date"], s["ig"])
        iseries = sorted(ipts.items())
        if len(iseries) >= 2:
            for s in songs:
                if prim(s["artist"]) == k:
                    s["igh"] = [list(p) for p in iseries]
        series = sorted(pts.items())
        if len(series) >= 2:
            for s in songs:
                if prim(s["artist"]) == k:
                    s["hist"] = [list(p) for p in series]
here = os.path.dirname(os.path.abspath(out))
spl = []
if os.path.exists(os.path.join(here, "superplaylists.json")):
    spl = json.load(open(os.path.join(here, "superplaylists.json")))
MEGA = "0OVY358Cwc384gprqTiuNB"  # Superplaylist Recap
EXTRA = [{"name": "superplaylist recap", "id": MEGA, "note": "all songs, jul 20 – oct 19"},
         {"name": "too big", "id": "7wc5ryf4gemNhXFZCVCRgv", "note": "cut at 100k, private"}]
# venue_caps.json: {"venue|city" (lowercase): {"cap": int|null, "src": url, "note": str}} - only the numbers ship
caps = {}
cp = os.path.join(here, "venue_caps.json")
if os.path.exists(cp):
    caps = {k: v["cap"] for k, v in json.load(open(cp)).items() if v.get("cap")}
# press dates: press_dates.py fills press_dates.json (git-ignored) for any new link, then each press item gets d
json.dump({"songs": songs}, open(os.path.join(here, "data.json"), "w"), ensure_ascii=False, separators=(",", ":"))
subprocess.run([sys.executable, os.path.join(here, "press_dates.py")], check=False)
pdp = os.path.join(here, "press_dates.json")
pdates = json.load(open(pdp)) if os.path.exists(pdp) else {}
for s in songs:
    for pr in s.get("press", []):
        if pdates.get(pr.get("u")):
            pr["d"] = pdates[pr["u"]]
# team notes backend (Apps Script web app): url+key live in team_api.json (git-ignored) and ride inside the encrypted payload.
# Team-flagged artists are also marked tf so tracking treats them like sheet-flagged ones.
api = None
tp = os.path.join(here, "team_api.json")
if os.path.exists(tp):
    api = json.load(open(tp))
    if api.get("url"):
        try:
            import urllib.request, urllib.parse
            log = json.load(urllib.request.urlopen(api["url"] + "?k=" + urllib.parse.quote(api["key"]), timeout=30)).get("log", [])
            on = {}
            for e in log:
                if e["y"] == "flag": on[e["a"]] = True
                elif e["y"] == "unflag": on.pop(e["a"], None)
            igs = {}
            for e in log:
                if e["y"] == "ig" and e.get("x"):
                    u, _, c = str(e["x"]).partition("|")
                    igs[e["a"]] = (u, int(c) if c.isdigit() else None)
            for s in songs:
                k = _pk(s["artist"])
                if k in on:
                    s["tf"] = True
                if k in igs and not s.get("igUrl"):  # an Instagram a teammate added by hand
                    s["igUrl"] = igs[k][0]
                    if igs[k][1] and not s.get("ig"):
                        s["ig"] = igs[k][1]
        except Exception as ex:
            print("team log not read:", ex)
    else:
        api = None
# ROSTR agency/agent (rostr.json, filled by the daily routine): attached to every row of the artist
rjp = os.path.join(here, "rostr.json")
rj = json.load(open(rjp)) if os.path.exists(rjp) else {}
for s in songs:
    r = rj.get(_pk(s["artist"]))
    if r and r.get("agency"):
        s["ag"] = r["agency"]
        if r.get("agent"):
            s["agt"] = r["agent"]
        if r.get("slug"):
            s["rs"] = r["slug"]
# listener jumps found by jumps.py (git-ignored jumps.json): attached to every row of the artist
jpp = os.path.join(here, "jumps.json")
jmp = json.load(open(jpp)) if os.path.exists(jpp) else {}
for s in songs:
    j = jmp.get(_pk(s["artist"]))
    if j:
        s["jp"] = {"f": j["from"], "t": j["to"], "d0": j["d0"], "d1": j["d1"]}
payload = {"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "songs": songs, "spl": spl, "caps": caps, "api": api, "mega": MEGA, "extra": EXTRA}
json.dump(payload, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
enc = os.path.join(here, "data.enc.json")
subprocess.run(["node", os.path.join(here, "encrypt.js"), out, enc, os.path.join(here, ".password")], check=True)
print(len(songs), "songs ->", out, "and", enc)
