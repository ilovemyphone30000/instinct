// instinct team log: appends events to a "TEAM LOG" tab of the sheet. Nothing else in the sheet is touched.
// Paste into a standalone Apps Script project, replace the two placeholders, deploy as a web app
// (Execute as: Me, Who has access: Anyone). Every request must carry the key; only people who can
// unlock the site ever receive it (it rides inside the encrypted data file).
const KEY = '__KEY__';
const SHEET_ID = '__SHEET_ID__';
const TAB = 'TEAM LOG';
// event types the site may write. flag/unflag/note/del/edit: notes + flags; ig: team-entered instagram;
// sign: manual signed/unsigned override; rwrong: wrong ROSTR match; view/delview: shared saved views;
// watch/unwatch: artists to track that are not on the sheet.
const TYPES = ['flag', 'unflag', 'note', 'del', 'edit', 'ig', 'sign', 'rwrong', 'view', 'delview', 'watch', 'unwatch'];
const LIMIT_PER_NAME = 40;   // writes per minute per person name
const LIMIT_TOTAL = 240;     // writes per minute overall
const MAX_X = 1500;          // longest note / payload accepted

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

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out_({ error: 'bad' }); }
  if (b.k !== KEY) return out_({ error: 'auth' });
  if (TYPES.indexOf(b.type) < 0 || !b.a) return out_({ error: 'bad' });
  if (String(b.x == null ? '' : b.x).length > MAX_X) return out_({ error: 'too long' });
  if (!allow_(b.i || '?')) return out_({ error: 'slow down' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = Utilities.getUuid().slice(0, 8);
    tab_().appendRow([new Date(), clean_(b.a, 120).toLowerCase(), clean_(b.n, 120), b.type, clean_(b.i, 24), clean_(b.x, MAX_X), id]);
    return out_({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
}
