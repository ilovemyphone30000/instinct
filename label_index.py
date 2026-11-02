#!/usr/bin/env python3
"""Build label_index.json from the label map (../labelmap/index.html): normalized company name -> [display name, kind, group].

kind: M = owned by a major, D = distributed by a major (dashed branch in the map), I = independent group member.
group: UMG / Sony / Warner for M and D, the group name (BMG, Beggars, ...) for I.
Run again whenever the label map changes. Reads the map's T and INDIE declarations by bracket matching.
"""
import json, os, re, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, "..", "labelmap", "index.html")
h = open(src, encoding="utf8").read()


def grab(name, op, cl):
    i = h.index("const " + name + "=") + len("const " + name + "=")
    # brace matching that respects strings
    d, j, instr = 0, i, None
    while True:
        c = h[j]
        if instr:
            if c == "\\":
                j += 1
            elif c == instr:
                instr = None
        elif c in '"\'`':
            instr = c
        elif c == op:
            d += 1
        elif c == cl:
            d -= 1
            if d == 0:
                return h[i:j + 1]
        j += 1


js = "const T=%s;const INDIE=%s;process.stdout.write(JSON.stringify({T,INDIE}))" % (grab("T", "{", "}"), grab("INDIE", "[", "]"))
out = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
m = json.loads(out)
GROUP = {"umg": "UMG", "sony": "Sony", "warner": "Warner"}
STRIP = r"(records|recordings|recording|music|entertainment|group|inc|llc|ltd|limited|co|company|label|the)"


def norm(s):
    s = re.sub(r"[^a-z0-9 ]", "", re.sub(r"&", " and ", s.lower().replace("’", "'")))
    s = " ".join(w for w in s.split() if not re.fullmatch(STRIP, w))
    return s.replace(" ", "")


idx = {}


def add(name, kind, group):
    k = norm(name)
    if k and (k not in idx or kind == "M"):
        idx[k] = [name, kind, group]


def walk(nodes, g, dist):
    for n in nodes:
        if n.get("lbl"):
            walk(n.get("c", []), g, dist)
            continue
        d = dist or bool(n.get("aff"))
        add(n["n"], "D" if d else "M", g)
        walk(n.get("c", []), g, d)


for k, mj in m["T"].items():
    g = GROUP.get(k, mj["name"])
    walk(mj.get("b", []), g, False)
for grp in m["INDIE"]:
    for c in grp["c"]:
        add(c, "I", grp["n"])
    add(grp["n"], "I", grp["n"])
json.dump(idx, open(os.path.join(here, "label_index.json"), "w"), indent=0, ensure_ascii=False)
print(len(idx), "names;", sum(1 for v in idx.values() if v[1] == "M"), "owned,", sum(1 for v in idx.values() if v[1] == "D"), "distributed,", sum(1 for v in idx.values() if v[1] == "I"), "independent")
