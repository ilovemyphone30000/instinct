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
- `rostr_label_add.py` - record label per artist from ROSTR (RECORD_LABEL team: indie / major / distribution; the site shows only the label names ROSTR lists - self-released entries and "no label" are not displayed), in git-ignored `rostr_labels.json`; rides inside the encrypted data.
- `digest.py` - plain-text weekly digest for pasting (sends nothing).
- `team_log.gs` - the Apps Script backend (appends to the TEAM LOG tab only; rate-limited, size-capped).
- `set_password.py` - change the password (prompts; never put it in chat or a commit).

## Git-ignored (local only)
`rostr_labels.json`, `agency_seen.json` (agency changes), `.password`, `data.json`, `history.json`, `superplaylists.json`, `press_dates.json`, `team_api.json`, `rostr.json`, `jumps.json`.

## Team features (need the Apps Script backend)
Shared flags, notes (edit/delete, @mentions), activity feed, saved views, manual signed/unsigned and wrong-ROSTR-match
overrides, typed-in Instagram, and a watchlist for artists that are not on the sheet. Everything else is read-only.

## Search operators and other newer features
Search box: `listeners:<20k  ig:>5k  ig:none  growth:>20  added:<7  agency:none|signed|<name>  label:self|indie|major|none|<name>  flagged:yes  new:yes  press:>0  pl:>3  signed:yes  passed:yes`, mixed with plain words.
- Pass: a teammate marks an artist "pass" with a reason; it is stored as a note beginning `[pass] ` (so the Apps Script needs no change), hides the artist for everyone,
  and View > show passed brings it back. Undo deletes that note.
- ROSTR near-matches: rostr.json entries may carry `cand` ([name, slug]); the site shows "maybe X ✓ ✕". Confirm/reject are `sign` events with x `match|slug|name` / `nomatch`.
- Signed-since-flagged banner: build_data.py compares ROSTR agencies with agency_seen.json (the first build is a baseline and never alerts).
- Scorecard: flagged artists, listeners/Instagram when flagged vs now, agency since. New-for-me: rows dated after the newest date seen at your previous session (per browser).
- Possible duplicate artists (same Spotify id, or names one letter apart) get a ≈ badge and a note in the popup.
- My list (tab, key `m`): a board of the artists you flagged or added, each with a status (heating up / moving / holding / cooling / new), a 0-100 momentum score
  (listener growth 40, Instagram growth 20, playlists 20, press 10, jump 10), 7-14 day changes, sparklines, agency/label/OPEN chip and the latest note.
  Paste a Spotify artist link to follow someone not on the sheet (name via Spotify oEmbed; becomes a watch + flag). Compare up to 7 artists, copy a weekly report.
  OPEN = ROSTR has a profile but lists no agency and no label (or self-released). Search: `open:yes momentum:>60 status:heating`.

## REC intake (unlisted)
`intake.html` (not linked anywhere, noindex) adds tracks to the REC list: unlock with the site password, paste one track per
line (`open.spotify.com/track/...` link, `Artist - Song`, or `Artist - Song - YYYY-MM-DD`), preview, add. A bare link needs the
artist typed in (Spotify's oEmbed returns the song title only). Each line posts a `rec` event to the same log API; the backend
(`team_log.gs`) validates it, dedupes on track URL (or artist+song when there is no URL) and returns `deduped:true` on a repeat,
so re-running a list is safe. `unrec` (x = the rec's id) removes that rec only. The site renders recs as `MP` ("REC") rows with
no counts until the daily build carries them, and skips any rec the base data already has. The log key is a shared secret that
rides inside the encrypted data; initials are self-asserted, so this is not per-user login. After editing `team_log.gs`, paste it
into the Apps Script project (keep KEY and SHEET_ID) and redeploy a new version.

PRESS mode on the same page posts `press` events (x = JSON `{d,l,s,t,u}`: date, listeners, song, track url, article links); `unpress`
removes one. The backend dedupes on artist + any shared article link. The site renders them as `PRESS` rows (src `PR`) with the
article links in the press column and the listener count as of the find date. Backend now accepts rec, unrec, press, unpress.
