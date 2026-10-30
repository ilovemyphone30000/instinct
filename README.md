# instinct (Superplaylist dashboard)

Static, read-only view of the Superplaylist Google Sheet (SP tab). `index.html` loads `data.json`.

Refresh: the daily Superplaylist task reads SP!B1:I1000 with get_spreadsheet (includeGridData, fields
formattedValue / hyperlink / textFormatRuns), runs `python3 build_data.py <saved result>`, then commits and
pushes `data.json`. FLAG and NOTES are never exported. Pages redeploys in about a minute.

Access: the data is encrypted (data.enc.json, AES-GCM). The page asks for the password and decrypts in the browser.
The password lives in the git-ignored `.password` file next to build_data.py (needs `node`). Only data.enc.json is committed.
