# Superplaylist

Weekly Spotify scan, ported out of chat into a script you run yourself.

Scans ~41 curated playlists for tracks added in the last 7 days, keeps the ones
appearing on 2+ of them, drops anything published in any previous
Superplaylist, writes the rest to a new numbered playlist, files it into the
SUPERPLAYLIST! folder, and optionally looks up booking agencies for the top 20.

## One-time setup (~20 min)

**1. Spotify app.** https://developer.spotify.com/dashboard -> Create app. Name
and description don't matter. Under **Redirect URIs** add exactly:

```
http://127.0.0.1:8888/callback
```

Save, then copy the Client ID and Secret from Settings.

**2. Install.**

```bash
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env        # paste the two values in
```

**3. Authorize Spotify's API.**

```bash
python auth.py
```

Browser opens, you approve, it writes `.tokens.json`. The refresh token keeps
working indefinitely.

**4. Sign in for the browser steps.**

```bash
python browser.py --login
```

Opens a real window against a dedicated profile in `.browser/`. Log into
Spotify and ROSTR, close the window. Nothing is copied out of your real Chrome
and no passwords touch this code. Check it later with `python browser.py --check`.

## Weekly

```bash
python superplaylist.py --dry-run          # scan + CSV, creates nothing
python superplaylist.py                    # create + file into the folder
python superplaylist.py --rostr            # ...and look up agencies
python superplaylist.py --rostr --headed   # watch the browser work
```

Use `--headed` the first time so you can see the browser steps actually happen.

Output: `out.csv`, `last_run.json`, the playlist, and a line telling you
whether filing into the folder worked.

Cron, if you want it unattended:

```
0 9 * * 2  cd /path/to/superplaylist && /usr/bin/python3 superplaylist.py --rostr >> run.log 2>&1
```

## The two browser steps, and why they exist

The Spotify Web API has no concept of **folders** - it can't read your
Editorials folder and can't file a playlist into SUPERPLAYLIST!. ROSTR has no
public API at all. Both gaps are covered by one persistent Chromium profile.

- **`move_to_folder.py`** walks More options -> Move to folder -> SUPERPLAYLIST!,
  addressing elements by role and name rather than pixel coordinates. If
  Spotify's DOM shifts, it prints a link and tells you to drag it yourself - a
  cosmetic filing step never fails a run that already produced a correct
  playlist.
- **`rostr.py`** is opt-in behind `--rostr`. **Read `rostr_notes.md` before
  using it**, particularly about your Pro account's terms.

The one thing still not automated: the scan list in `config.json` is a snapshot
taken 2026-09-22, because the API can't enumerate your Editorials folder. Edit
it when you follow or unfollow a curator, or the scan quietly drifts from your
library.

## Files

| file | what |
|---|---|
| `superplaylist.py` | the pipeline |
| `auth.py` | Spotify OAuth; run once |
| `browser.py` | persistent browser profile; `--login`, `--check` |
| `move_to_folder.py` | files the playlist into the folder |
| `rostr.py` | agency lookups (opt-in) |
| `config.json` | playlist IDs, exclusions, window |
| `CLAUDE.md` | context for Claude Code - the non-obvious rules |
| `rostr_notes.md` | endpoints, matching rule, the terms question |

## Untested

I wrote this in an environment with no browser and no network access to
Spotify, so **none of it has been executed end to end**. The logic mirrors runs
that worked, and everything compiles, but first contact is on your machine.
Start with `--dry-run --headed`.
