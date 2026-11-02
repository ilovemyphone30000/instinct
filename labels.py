"""Release label from Spotify's copyright lines, classified against the label map (label_index.json).

labels.json (git-ignored): {track id: [P line, C line, album, album type]}, filled by labels_add.py from the web player's
getTrack query. classify() -> [display name, kind, group]; kind M owned by a major, D distributed by a major,
I independent group (BMG, Beggars...), O any other label, S self-released (the holder is the artist).
"""
import json, os, re

here = os.path.dirname(os.path.abspath(__file__))
STRIP = r"(records|recordings|recording|music|entertainment|group|inc|llc|ltd|limited|co|company|label|labels|the|corporation|corp|productions|publishing)"
LIC = re.compile(r"(?:under\s+(?:exclusive\s+)?licen[cs]e\s+to|exclusively\s+licen[cs]ed\s+to|licen[cs]ed\s+to|distributed\s+by)\s+(.+)$", re.I)
MAJOR = re.compile(r"arista|alamo records|parlophone|universal music|umg recordings|sony music|warner (music|records|chappell)|atlantic recording|capitol (records|music)|columbia records|rca records|republic records|interscope|epic records|def jam|island records", re.I)


def norm(s):
    s = re.sub(r"[^a-z0-9 ]", "", s.lower().replace("&", " and ").replace("’", "'"))
    return "".join(w for w in s.split() if not re.fullmatch(STRIP, w))


def short(g):
    g = g or ""
    return "UMG" if "universal" in g.lower() else "Sony" if "sony" in g.lower() else "Warner" if "warner" in g.lower() else g


DIST = re.compile(r"awal|unitedmasters|virgin music|create music|fader distribution|distribution|distro|believe|tunecore|distrokid|cd baby|ditto|symphonic|\bada\b|altafonte|\[pias\]|the orchard|community music|apollo|apolo|rose garden|backboard|venice music|\blab\b|g\.y\.r\.o|soundly|mendel|d\.a\.p|platoon|stem disintermedia", re.I)
JUNK = re.compile(r"^(independent|-|none|n/?a|im not signed|self[- ]released|unsigned|source)$|^\d+ records dk$", re.I)


def classify(artist, p, c, idx):
    t = (p or c or "").strip()
    t = re.sub(r"^(?:℗|©|\(P\)|\(C\)|P:|C:)\s*", "", t)
    t = re.sub(r"^\d{4}(\s*[,&/-]\s*\d{4})*\s+", "", t).strip(" ,.;")
    if not t:
        return None
    a = norm(re.split(r",| & | feat\.? | x ", artist, 1)[0])
    via = ""
    m = LIC.search(t)
    if m and not re.match(r"^from\b", m.group(1), re.I):
        holder = re.split(r"\.\s+distributed by|,\s*℗|\s+&\s+| and ", m.group(1), 1, flags=re.I)[0]
    else:
        parts = re.split(r",?\s+(?:marketed and distributed by|distributed by|via)\s+", t, 1, flags=re.I)
        holder = parts[0]
        if len(parts) > 1:
            via = parts[1].strip(" .")
        holder = re.split(r"\s+and Many Hats", holder)[0]
        holder = re.split(r"\s+(?:under (?:exclusive )?licen[cs]e from)\s+", holder, 1, flags=re.I)[0]
        holder = re.split(r"\s+/\s+| & ", holder, 1)[0] if not re.search(r"\b(records|recordings)\b.*&", holder, re.I) else re.split(r"\s+&\s+", holder, 1)[0]
    holder = re.sub(r",?\s*(inc|llc|ltd|limited|lp)\.?$", "", holder.strip(" ,.;"), flags=re.I).strip(" ,.;")
    if re.fullmatch(r"(?i)(.+?) in .*", holder) and False:
        pass
    n = norm(holder)
    if not holder or JUNK.match(holder):
        return [artist, "S", ""]
    if DIST.search(holder):
        return [artist, "S", re.sub(r"\s+(distribution|distro)$", "", holder, flags=re.I)]
    hit = idx.get(n)
    if not hit:
        best = None
        for k, v in idx.items():
            if len(k) >= 9 and n.startswith(k) and (best is None or len(k) > len(best[0])):
                best = (k, v)
        hit = best[1] if best else None
    if hit:
        return [hit[0], hit[1], short(hit[2])]
    if MAJOR.search(holder) or re.search(r"umg|sony music|warner music", holder, re.I):
        g = "UMG" if re.search(r"universal|umg|interscope|republic|island|def jam", holder, re.I) else "Sony" if re.search(r"sony|columbia|rca|epic|arista|alamo", holder, re.I) else "Warner"
        return [re.sub(r",? a division of .*$", "", holder), "M", g]
    if a and len(a) >= 3 and (a in n or n in a):
        return [artist, "S", via and re.sub(r"\s+(distribution|distro)$", "", via, flags=re.I)]
    return [holder, "O", ""]


def load_index():
    p = os.path.join(here, "label_index.json")
    return json.load(open(p)) if os.path.exists(p) else {}
