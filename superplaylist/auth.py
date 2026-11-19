#!/usr/bin/env python3
"""
Spotify OAuth. Run `python auth.py` once to authorize; after that the
refresh token in .tokens.json keeps working and you never see a browser again.

Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env, and
http://127.0.0.1:8888/callback registered as a redirect URI on the app.
"""

import base64
import http.server
import json
import os
import secrets
import threading
import time
import urllib.parse
import webbrowser

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
TOKENS = os.path.join(HERE, ".tokens.json")
REDIRECT = "http://127.0.0.1:8888/callback"
SCOPES = "playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public"


def _env():
    path = os.path.join(HERE, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    cid = os.environ.get("SPOTIFY_CLIENT_ID")
    sec = os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not cid or not sec:
        raise SystemExit("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET "
                         "(put them in .env — see README)")
    return cid, sec


def _basic(cid, sec):
    return base64.b64encode(f"{cid}:{sec}".encode()).decode()


def authorize():
    cid, sec = _env()
    state = secrets.token_urlsafe(16)
    got = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            got.update({k: v[0] for k, v in q.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h3>Done. You can close this tab.</h3>")

        def log_message(self, *a):
            pass

    srv = http.server.HTTPServer(("127.0.0.1", 8888), Handler)
    threading.Thread(target=srv.handle_request, daemon=True).start()

    url = "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode({
        "client_id": cid, "response_type": "code",
        "redirect_uri": REDIRECT, "scope": SCOPES, "state": state,
    })
    print("Opening browser to authorize...")
    print(url)
    webbrowser.open(url)

    while "code" not in got and "error" not in got:
        time.sleep(0.2)
    if got.get("error"):
        raise SystemExit(f"Authorization failed: {got['error']}")
    if got.get("state") != state:
        raise SystemExit("State mismatch — aborting")

    r = requests.post("https://accounts.spotify.com/api/token",
                      data={"grant_type": "authorization_code",
                            "code": got["code"], "redirect_uri": REDIRECT},
                      headers={"Authorization": f"Basic {_basic(cid, sec)}"},
                      timeout=30)
    r.raise_for_status()
    json.dump(r.json(), open(TOKENS, "w"))
    os.chmod(TOKENS, 0o600)
    print(f"Saved {TOKENS}. You won't need to do this again.")


def get_access_token():
    cid, sec = _env()
    if not os.path.exists(TOKENS):
        raise SystemExit("No .tokens.json — run `python auth.py` first")
    tok = json.load(open(TOKENS))
    r = requests.post("https://accounts.spotify.com/api/token",
                      data={"grant_type": "refresh_token",
                            "refresh_token": tok["refresh_token"]},
                      headers={"Authorization": f"Basic {_basic(cid, sec)}"},
                      timeout=30)
    if r.status_code != 200:
        raise SystemExit("Refresh failed — re-run `python auth.py`")
    fresh = r.json()
    tok.update(fresh)
    tok.setdefault("refresh_token", fresh.get("refresh_token"))
    json.dump(tok, open(TOKENS, "w"))
    return tok["access_token"]


if __name__ == "__main__":
    authorize()
