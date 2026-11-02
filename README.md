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
- `labels.py`, `labels_add.py`, `label_index.py` - release label per song: Spotify's copyright (P) line, read with the web player's
  getTrack query, classified against the label map (major / major-distributed / indie label / other label / self-released).
  `labels.json` and `label_index.json` are git-ignored; labels ride inside the encrypted data.
- `digest.py` - plain-text weekly digest for pasting (sends nothing).
- `team_log.gs` - the Apps Script backend (appends to the TEAM LOG tab only; rate-limited, size-capped).
- `set_password.py` - change the password (prompts; never put it in chat or a commit).

## Git-ignored (local only)
`labels.json`, `label_index.json`, `agency_seen.json` (agency changes), `.password`, `data.json`, `history.json`, `superplaylists.json`, `press_dates.json`, `team_api.json`, `rostr.json`, `jumps.json`.

## Team features (need the Apps Script backend)
Shared flags, notes (edit/delete, @mentions), activity feed, saved views, manual signed/unsigned and wrong-ROSTR-match
overrides, typed-in Instagram, and a watchlist for artists that are not on the sheet. Everything else is read-only.

## Search operators and other newer features
Search box: `listeners:<20k  ig:>5k  ig:none  growth:>20  added:<7  agency:none|signed|<name>  label:self|indie|major|<name>  flagged:yes  new:yes  press:>0  pl:>3  signed:yes  passed:yes`, mixed with plain words.
- Pass: a teammate marks an artist "pass" with a reason; it is stored as a note beginning `[pass] ` (so the Apps Script needs no change), hides the artist for everyone,
  and View > show passed brings it back. Undo deletes that note.
- ROSTR near-matches: rostr.json entries may carry `cand` ([name, slug]); the site shows "maybe X ✓ ✕". Confirm/reject are `sign` events with x `match|slug|name` / `nomatch`.
- Signed-since-flagged banner: build_data.py compares ROSTR agencies with agency_seen.json (the first build is a baseline and never alerts).
- Scorecard: flagged artists, listeners/Instagram when flagged vs now, agency since. New-for-me: rows dated after the newest date seen at your previous session (per browser).
- Possible duplicate artists (same Spotify id, or names one letter apart) get a ≈ badge and a note in the popup.
