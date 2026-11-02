#!/usr/bin/env python3
"""Canary: fetch the LIVE site's data.enc.json, decrypt it with the local .password and sanity-check it.
Run after every push. Exit 1 (and prints why) if the live site is stale, undecryptable, or lost rows.
Usage: verify_deploy.py [expected_rows]
"""
import json, os, subprocess, sys, tempfile, time, urllib.request, datetime
here = os.path.dirname(os.path.abspath(__file__))
URL = "https://ilovemyphone30000.github.io/instinct/data.enc.json?" + str(int(time.time()))
want = int(sys.argv[1]) if len(sys.argv) > 1 else None
f = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
try:
    f.write(urllib.request.urlopen(URL, timeout=30).read()); f.close()
    out = subprocess.run(["node", os.path.join(here, "decrypt.js"), f.name, os.path.join(here, ".password")], capture_output=True, text=True, timeout=90)
    if out.returncode:
        sys.exit("LIVE SITE DOES NOT DECRYPT with the current .password")
    d = json.loads(out.stdout)
finally:
    os.unlink(f.name)
n = len(d["songs"])
age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.strptime(d["updated"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)).total_seconds() / 3600
msg = "live: %d rows, built %.1fh ago" % (n, age)
if want and n != want:
    sys.exit(msg + " - expected %d rows (Pages may still be deploying; retry in a minute)" % want)
if age > 30:
    sys.exit(msg + " - STALE (over 30h)")
print(msg, "- ok")
