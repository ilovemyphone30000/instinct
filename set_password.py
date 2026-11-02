#!/usr/bin/env python3
"""Change the site password. Prompts (hidden input, never echoed or logged), re-encrypts data.json, rewrites .password.
Usage: python3 set_password.py   then commit + push data.enc.json.
Use a long passphrase (4+ random words, 20+ characters). The data file is public on GitHub, so the password is the only
lock: a short one can be guessed offline. Older commits stay readable with the OLD password, so if the old one was weak,
also rotate the team-log KEY (see team_log.gs) and redeploy.
"""
import getpass, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
a = getpass.getpass("new password: ")
if len(a) < 16:
    sys.exit("too short - use at least 16 characters (a passphrase of 4+ words)")
if a != getpass.getpass("again: "):
    sys.exit("did not match")
pf = os.path.join(here, ".password")
fd = os.open(pf, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    f.write(a)
subprocess.run(["node", os.path.join(here, "encrypt.js"), os.path.join(here, "data.json"), os.path.join(here, "data.enc.json"), pf], check=True)
print("done. data.enc.json re-encrypted. Commit and push it, then give the team the new password.")
