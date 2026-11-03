// instinct team log: appends events to a "TEAM LOG" tab of the sheet. Nothing else in the sheet is touched.
// Paste into a standalone Apps Script project, replace the two placeholders, deploy as a web app
// (Execute as: Me, Who has access: Anyone). Every request must carry the key; only people who can
// unlock the site ever receive it (it rides inside the encrypted data file).
const KEY = '__KEY__';
const SHEET_ID = '__SHEET_ID__';
const TAB = 'TEAM LOG';
// event types the site may write. flag/unflag/note/del/edit: notes + flags; ig: team-entered instagram;
// sign: manual signed/unsigned override; rwrong: wrong ROSTR match; view/delview: shared saved views;
// watch/unwatch: artists to track that are not on the sheet; rec/unrec: tracks added to the REC list from the
// intake page (x = trackUrl|song|YYYY-MM-DD; unrec's x is the rec's id and removes that rec only); press/unpress:
// press finds from the intake page, kept apart from recs (x = JSON {d: date, l: listeners, s: song, t: track url,
// u: article links}; unpress's x is the press find's id and removes that find only).
const TYPES = ['flag', 'unflag', 'note', 'del', 'edit', 'ig', 'sign', 'rwrong', 'view', 'delview', 'watch', 'unwatch', 'rec', 'unrec', 'press', 'unpress'];
const LIMIT_PER_NAME = 40;   // writes per minute per person name
const LIMIT_TOTAL = 240;     // writes per minute overall
const MAX_X = 1500;          // longest note / payload accepted
const MAX_FIELD = 200;       // longest artist name / song title on a rec
const TRACK_RE = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2,5}\/)?track\/([A-Za-z0-9]{22})(?:\?[^\s|]*)?$/;

function tab_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let s = ss.getSheetByName(TAB);
  if (!s) {
    s = ss.insertSheet(TAB);
    s.appendRow(['TIME', 'ARTIST KEY', 'ARTIST', 'TYPE', 'NAME', 'NOTE', 'ID']);
    s.setFrozenRows(1);
  }
  return s;
}
const out_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
// cut to length, and neutralise anything a spreadsheet would run as a formula
const clean_ = (v, n) => { v = String(v == null ? '' : v).slice(0, n); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };

// fixed one-minute window counters; returns false when a limit is hit
function allow_(name) {
  const c = CacheService.getScriptCache();
  const bucket = Math.floor(Date.now() / 60000);
  const keys = ['t:' + bucket, 'n:' + bucket + ':' + String(name).toLowerCase().slice(0, 24)];
  const lim = [LIMIT_TOTAL, LIMIT_PER_NAME];
  for (let i = 0; i < keys.length; i++) {
    const n = Number(c.get(keys[i]) || 0) + 1;
    if (n > lim[i]) return false;
    c.put(keys[i], String(n), 120);
  }
  return true;
}

function doGet(e) {
  if (!e || !e.parameter || e.parameter.k !== KEY) return out_({ error: 'auth' });
  const v = tab_().getDataRange().getValues();
  v.shift();
  return out_({ log: v.map(r => ({ t: r[0] instanceof Date ? r[0].toISOString() : r[0], a: r[1], n: r[2], y: r[3], i: r[4], x: r[5], id: r[6] })) });
}

// rec payload -> {url, song, date} (url canonical or ''), or an error string
function parseRec_(b) {
  const x = String(b.x == null ? '' : b.x), i1 = x.indexOf('|'), i2 = x.lastIndexOf('|');
  if (i1 < 0 || i2 <= i1) return 'bad';
  let url = x.slice(0, i1).trim();
  const song = x.slice(i1 + 1, i2).trim(), date = x.slice(i2 + 1).trim();
  if (!b.a || !String(b.n || '').trim() || !String(b.i || '').trim() || !song) return 'bad';
  if (String(b.a).length > MAX_FIELD || String(b.n).length > MAX_FIELD || song.length > MAX_FIELD) return 'too long';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00Z')) ||
      new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) return 'bad';
  if (url) {
    const m = TRACK_RE.exec(url);
    if (!m) return 'bad';
    url = 'https://open.spotify.com/track/' + m[1];
  }
  return { url: url, song: song, date: date };
}
const songKey_ = v => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const validDate_ = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z')) &&
                        new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
const urlKey_ = u => String(u).replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();

// press payload -> {d, l, s, t, u:[...]} or an error string
function parsePress_(b) {
  let p;
  try { p = JSON.parse(String(b.x == null ? '' : b.x)); } catch (err) { return 'bad'; }
  if (!p || typeof p !== 'object' || !b.a || !String(b.n || '').trim() || !String(b.i || '').trim()) return 'bad';
  if (String(b.a).length > MAX_FIELD || String(b.n).length > MAX_FIELD) return 'too long';
  const d = String(p.d || '').trim(), s = String(p.s || '').trim();
  let t = String(p.t || '').trim(), l = p.l;
  if (s.length > MAX_FIELD) return 'too long';
  if (!validDate_(d)) return 'bad';
  if (l === '' || l === undefined) l = null;
  if (l !== null && !(typeof l === 'number' && isFinite(l) && l >= 0 && l <= 2e9 && Math.floor(l) === l)) return 'bad';
  if (t) { const m = TRACK_RE.exec(t); if (!m) return 'bad'; t = 'https://open.spotify.com/track/' + m[1]; }
  if (!Array.isArray(p.u) || p.u.length < 1 || p.u.length > 5) return 'bad';
  const u = [];
  for (let i = 0; i < p.u.length; i++) {
    const v = String(p.u[i] || '').trim();
    if (!/^https:\/\/[^\s|"\\]{4,240}$/.test(v)) return 'bad';
    if (u.indexOf(v) < 0) u.push(v);
  }
  const out = { d: d, l: l, s: s, t: t, u: u };
  return JSON.stringify(out).length > MAX_X ? 'too long' : out;
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out_({ error: 'bad' }); }
  if (b.k !== KEY) return out_({ error: 'auth' });
  if (TYPES.indexOf(b.type) < 0 || !b.a) return out_({ error: 'bad' });
  if (String(b.x == null ? '' : b.x).length > MAX_X) return out_({ error: 'too long' });
  let rec = null, press = null;
  if (b.type === 'rec') {
    rec = parseRec_(b);
    if (typeof rec === 'string') return out_({ error: rec });
  } else if (b.type === 'press') {
    press = parsePress_(b);
    if (typeof press === 'string') return out_({ error: press });
  }
  const undo = b.type === 'unrec' || b.type === 'unpress';
  if (undo && !String(b.x || '').trim()) return out_({ error: 'bad' });
  if (!allow_(b.i || '?')) return out_({ error: 'slow down' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const t = tab_();
    if (rec || press || undo) {
      // live rows of a kind = its rows not removed by a later undo row. Checked under the lock so a retry never doubles a row.
      const kind = b.type.replace(/^un/, ''), undoType = 'un' + kind;
      const rows = t.getDataRange().getValues();
      rows.shift();
      const dead = {}, live = [];
      rows.forEach(r => { if (r[3] === undoType) dead[String(r[5])] = true; });
      rows.forEach(r => { if (r[3] === kind && !dead[String(r[6])]) live.push(r); });
      if (undo) {
        const hit = rows.filter(r => String(r[6]) === String(b.x));
        if (hit.length && hit[0][3] !== kind) return out_({ error: 'bad' });      // only that kind of row can be removed
        if (!live.some(r => String(r[6]) === String(b.x))) return out_({ ok: true, noop: true });
      } else if (rec) {
        const a = clean_(b.a, MAX_FIELD).toLowerCase();
        for (let i = 0; i < live.length; i++) {
          const p = String(live[i][5]).split('|'), u = p[0], s = p.slice(1, -1).join('|');
          if (rec.url ? u === rec.url : (!u && live[i][1] === a && songKey_(s) === songKey_(rec.song)))
            return out_({ ok: true, deduped: true, id: live[i][6] });
        }
      } else {
        const a = clean_(b.a, MAX_FIELD).toLowerCase(), mine = press.u.map(urlKey_);
        for (let i = 0; i < live.length; i++) {
          let old = [];
          try { old = (JSON.parse(String(live[i][5])).u || []).map(urlKey_); } catch (err) {}
          if (live[i][1] === a && old.some(v => mine.indexOf(v) >= 0))
            return out_({ ok: true, deduped: true, id: live[i][6] });
        }
      }
    }
    const id = Utilities.getUuid().slice(0, 8);
    if (rec) {
      t.appendRow([new Date(), clean_(b.a, MAX_FIELD).toLowerCase(), clean_(b.n, MAX_FIELD), 'rec', clean_(b.i, 24),
                   rec.url + '|' + rec.song + '|' + rec.date, id]);
    } else if (press) {
      t.appendRow([new Date(), clean_(b.a, MAX_FIELD).toLowerCase(), clean_(b.n, MAX_FIELD), 'press', clean_(b.i, 24),
                   JSON.stringify(press), id]);
    } else {
      t.appendRow([new Date(), clean_(b.a, 120).toLowerCase(), clean_(b.n, 120), b.type, clean_(b.i, 24), clean_(b.x, MAX_X), id]);
    }
    return out_({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
}
