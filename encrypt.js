// usage: node encrypt.js <plain.json> <out.json> <password-file>
// AES-256-GCM, key = PBKDF2-SHA256(password, salt, 600k). Ciphertext has the GCM tag appended (WebCrypto layout).
const fs = require('fs'), c = require('crypto');
const [, , inp, out, pwf] = process.argv;
const pw = fs.readFileSync(pwf, 'utf8').trim(), I = 600000;
const salt = c.randomBytes(16), iv = c.randomBytes(12);
const key = c.pbkdf2Sync(pw, salt, I, 32, 'sha256');
const ci = c.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([ci.update(fs.readFileSync(inp)), ci.final(), ci.getAuthTag()]);
// b = build stamp in the clear (not secret): lets the page skip the slow key derivation when nothing changed
const b = (JSON.parse(fs.readFileSync(inp, 'utf8')).updated) || '';
fs.writeFileSync(out, JSON.stringify({ b, i: I, s: salt.toString('base64'), v: iv.toString('base64'), c: ct.toString('base64') }));
