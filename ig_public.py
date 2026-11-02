#!/usr/bin/env python3
"""Instagram follower counts from the PUBLIC, LOGGED-OUT profile preview only.

Plain HTTPS GET with no cookies, no session and no browser: the same page anyone sees without signing in. The
count is read from the page's og:description ("1,235 Followers, 220 Following, ..."). Nothing here ever touches a
signed-in Instagram session - never point this at a browser profile or pass cookies.

Usage: ig_public.py [--cap N] [--dry]   |   ig_public.py --one <handle>  (print one count, writes nothing)
  handles come from history.json (igUrl) and data.json (igUrl, sheet column + teammate-entered)
  order: flagged / team-flagged / jumped / added in the last 14 days first (daily), everyone else once a week
  results are appended to history.json  artists[k].ig  as [date, followers]  (one point per day)
Backs off and stops the run after 3 failures in a row (rate limit or login wall) rather than pushing.
Prints JSON {"read":n,"failed":n,"skipped":n,"stopped":bool}.
"""
import datetime, html, json, os, random, re, sys, time, urllib.request

here = os.path.dirname(os.path.abspath(__file__))
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
TODAY = datetime.date.today().isoformat()
WEEK = 7
cap = int(sys.argv[sys.argv.index("--cap") + 1]) if "--cap" in sys.argv else 200
dry = "--dry" in sys.argv


def prim(a):
    return re.split(r",| & | feat\.? | x ", a, 1)[0].strip().lower()


def handle(u):
    h = re.sub(r"^https?://(www\.)?instagram\.com/", "", str(u or "")).split("/")[0].split("?")[0].lstrip("@")
    return h if re.fullmatch(r"[A-Za-z0-9._]{1,30}", h) else None


def count(s):
    s = s.replace(",", "").strip()
    m = re.fullmatch(r"([\d.]+)\s*([KMB])?", s, re.I)
    if not m:
        return None
    return int(round(float(m[1]) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9}[(m[2] or "").upper()]))


def fetch(h):
    """-> ('ok', followers) | ('gone', None) | ('fail', reason)"""
    req = urllib.request.Request("https://www.instagram.com/%s/" % h,
                                 headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    try:
        r = urllib.request.urlopen(req, timeout=25)
        b = r.read(120000).decode("utf8", "ignore")
    except urllib.error.HTTPError as e:
        return ("gone", None) if e.code == 404 else ("fail", "http %d" % e.code)
    except Exception as e:
        return "fail", str(e)[:60]
    m = re.search(r'og:description" content="([^"]*)"', b)
    if not m:
        return ("gone", None) if re.search(r"<title>[^<]*(not found|isn.t available)", b, re.I) else ("fail", "no preview")
    mm = re.match(r"\s*([\d.,]+\s*[KMB]?)\s+Followers", html.unescape(m[1]), re.I)
    return ("ok", count(mm[1])) if mm else ("fail", "no count")


def one(handle):
    """Print the logged-out follower count for one handle: {"handle":..,"status":"ok|gone|fail","followers":n|null}"""
    h = re.sub(r"^https?://(www\.)?instagram\.com/", "", handle).split("/")[0].split("?")[0].lstrip("@")
    st, v = fetch(h)
    print(json.dumps({"handle": h, "status": st, "followers": v if st == "ok" else None}))


def main():
    hp = os.path.join(here, "history.json")
    H = json.load(open(hp))
    A = H["artists"]
    songs = json.load(open(os.path.join(here, "data.json")))["songs"]
    jp = os.path.join(here, "jumps.json")
    jumps = json.load(open(jp)) if os.path.exists(jp) else {}
    cut = (datetime.date.today() - datetime.timedelta(days=14)).isoformat()
    prio, hand = set(), {}
    for s in songs:
        k = prim(s["artist"])
        if s.get("igUrl") and handle(s["igUrl"]):
            hand[k] = handle(s["igUrl"])
        if s.get("flag") or s.get("tf") or s.get("jp") or s["date"] >= cut or k in jumps:
            prio.add(k)
    for k, e in A.items():
        if e.get("igUrl") and handle(e["igUrl"]):
            hand.setdefault(k, handle(e["igUrl"]))
    todo = []
    for k, h in hand.items():
        e = A.setdefault(k, {"name": k, "pts": []})
        last = (e.get("ig") or [[""]])[-1][0]
        if e.get("igx") == "gone" and e.get("igh") == h:
            continue  # profile does not exist under this handle; retry only if the handle changes
        if last == TODAY:
            continue
        age = (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(last)).days if last else 999
        if k in prio or age >= WEEK:
            todo.append((0 if k in prio else 1, last, k, h))
    todo.sort()
    skipped = len(hand) - len(todo)
    res = {"read": 0, "failed": 0, "gone": 0, "skipped": skipped, "stopped": False, "queued": len(todo)}
    if dry:
        print(json.dumps(res))
        return
    streak = 0
    for _, _, k, h in todo[:cap]:
        st, v = fetch(h)
        e = A[k]
        if st == "ok" and v is not None:
            e.setdefault("ig", [])
            if not e["ig"] or e["ig"][-1][0] != TODAY:
                e["ig"].append([TODAY, v])
            e.pop("igx", None)
            res["read"] += 1
            streak = 0
        elif st == "gone":
            e["igx"], e["igh"] = "gone", h
            res["gone"] += 1
            streak = 0
        else:
            res["failed"] += 1
            streak += 1
            if streak >= 3:
                res["stopped"] = True
                break
            time.sleep(30 * streak)
        if (res["read"] + res["gone"]) % 25 == 0:
            json.dump(H, open(hp, "w"), indent=1, ensure_ascii=False)
        time.sleep(2.5 + random.random() * 2)
    json.dump(H, open(hp, "w"), indent=1, ensure_ascii=False)
    print(json.dumps(res))


if __name__ == "__main__":
    if "--one" in sys.argv:
        one(sys.argv[sys.argv.index("--one") + 1])
    else:
        main()
