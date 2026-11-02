"""Fill press_dates.json {url: 'YYYY-MM-DD' | null} for every press link in data.json that isn't cached yet.
Date comes from the page itself: JSON-LD datePublished, article:published_time / og / other meta, <time datetime>,
then a /YYYY/MM/DD/ pattern in the URL. null = no date found (kept, shown without a date).
Usage: press_dates.py [--retry]   (--retry re-fetches the nulls)"""
import json, re, sys, os, datetime, concurrent.futures as cf, urllib.request
here = os.path.dirname(os.path.abspath(__file__))
cp = os.path.join(here, "press_dates.json")
cache = json.load(open(cp)) if os.path.exists(cp) else {}
songs = json.load(open(os.path.join(here, "data.json")))["songs"]
urls = sorted({p["u"] for s in songs for p in s.get("press", []) if p.get("u")})
todo = [u for u in urls if u not in cache or (cache[u] is None and "--retry" in sys.argv)]
META = r'(?:article:published_time|og:article:published_time|datePublished|date|pubdate|publishdate|DC\.date\.issued|sailthru\.date|parsely-pub-date)'
PATS = [r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', r'<meta[^>]+(?:property|name|itemprop)=["\']' + META + r'["\'][^>]+content=["\'](\d{4}-\d{2}-\d{2})',
        r'<meta[^>]+content=["\'](\d{4}-\d{2}-\d{2})[^>]+(?:property|name|itemprop)=["\']' + META + r'["\']',
        r'<time[^>]+datetime=["\'](\d{4}-\d{2}-\d{2})', r'"dateCreated"\s*:\s*"(\d{4}-\d{2}-\d{2})']

def get(u):
    try:
        r = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "en"})
        h = urllib.request.urlopen(r, timeout=20).read(400000).decode("utf-8", "ignore")
        for p in PATS:
            m = re.search(p, h)
            if m:
                return u, m[1]
    except Exception:
        pass
    m = re.search(r"/(20\d\d)/(\d\d)/(\d\d)/", u)
    return u, f"{m[1]}-{m[2]}-{m[3]}" if m else None

with cf.ThreadPoolExecutor(8) as ex:
    for u, d in ex.map(get, todo):
        if d:
            try: datetime.date.fromisoformat(d)
            except ValueError: d = None
        cache[u] = d
json.dump(cache, open(cp, "w"), indent=0)
print(len(todo), "fetched;", sum(1 for u in urls if cache.get(u)), "of", len(urls), "dated")
