# A&R Instinct (Superplaylist dashboard)

Password-protected static view of the Superplaylist Google Sheet (SP = SCAN, MP = REC) on GitHub Pages.
Live: https://ilovemyphone30000.github.io/instinct/

## Files
- `index.html`, `styles.css`, `app.js` - the page. `playlists.html` - the Playlists page.
- `data.enc.json` - the ONLY data file committed (AES-256-GCM, key = PBKDF2 of the password, 600k rounds). A plaintext
  build stamp `b` sits beside it so the page can tell whether anything changed without decrypting.
- `build_data.py <get_spreadsheet result> data.json` - reads SP/MP by header, merges listener + Instagram series
  (`history.json`), ROSTR (`rostr.json`), jumps, press dates, venue caps, and the team log (flags/notes/views/watchlist),
  runs `check_data.py` (refuses a broken build), then encrypts.
- `check_data.py` - build gate: row count vs the published build, required fields, ordered series, no duplicate watch rows.
- `verify_deploy.py [rows]` - canary: decrypts the LIVE site's data and checks rows and age. Run after every push.
- `ig_public.py` - Instagram follower counts from the PUBLIC, LOGGED-OUT profile preview (plain HTTP, no cookies, no
  browser, never a signed-in session). Daily for flagged/new/jumped, weekly for the rest.
- `jumps.py`, `track_ids.py`, `all_ids.py`, `add_points.py`, `rostr_add.py`, `press_dates.py` - daily-routine helpers.
- `digest.py` - plain-text weekly digest for pasting (sends nothing).
- `team_log.gs` - the Apps Script backend (appends to the TEAM LOG tab only; rate-limited, size-capped).
- `set_password.py` - change the password (prompts; never put it in chat or a commit).

## Git-ignored (local only)
`.password`, `data.json`, `history.json`, `superplaylists.json`, `press_dates.json`, `team_api.json`, `rostr.json`, `jumps.json`.

## Team features (need the Apps Script backend)
Shared flags, notes (edit/delete, @mentions), activity feed, saved views, manual signed/unsigned and wrong-ROSTR-match
overrides, typed-in Instagram, and a watchlist for artists that are not on the sheet. Everything else is read-only.
