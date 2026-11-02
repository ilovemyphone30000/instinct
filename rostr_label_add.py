#!/usr/bin/env python3
"""Record ROSTR record-label lookups in rostr_labels.json (git-ignored; rides inside the encrypted site data).

Usage: rostr_label_add.py '{"<rostr slug>": [["Label name", "I"], ...], ...}'
Source: GET https://api.rostr.cc/v1/artist/<slug>/team/RECORD_LABEL (signed-in ROSTR tab); each item's company.name and
company.recordLabelType. Kind letters: M MAJOR, I INDEPENDENT, D DISTRIBUTION (services/distributors), S the company named "Self-released".
An empty list means the profile exists and lists no label.
"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(here, "rostr_labels.json")
db = json.load(open(p)) if os.path.exists(p) else {}
new = json.loads(sys.argv[1])
db.update(new)
json.dump(db, open(p, "w"), indent=0, ensure_ascii=False)
print(len(new), "recorded;", len(db), "slugs in rostr_labels.json")
