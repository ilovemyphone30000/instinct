// usage: node decrypt.js <data.enc.json> <password-file>   -> prints the plain JSON (used by check_data.py and verify_deploy.py)
const fs = require('fs'), c = require('crypto');
const [, , inp, pwf] = process.argv;
const e = JSON.parse(fs.readFileSync(inp, 'utf8')), pw = fs.readFileSync(pwf, 'utf8').trim();
const key = c.pbkdf2Sync(pw, Buffer.from(e.s, 'base64'), e.i, 32, 'sha256');
const ct = Buffer.from(e.c, 'base64'), tag = ct.subarray(ct.length - 16);
const d = c.createDecipheriv('aes-256-gcm', key, Buffer.from(e.v, 'base64'));
d.setAuthTag(tag);
process.stdout.write(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]));
