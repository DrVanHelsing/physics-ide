# Vendored GlowScript / jQuery runtime files

GlowScript 3.2 / jQuery 2.1.4; MIT-licensed; vendored byte-identical, no
modifications.

Download date: 2026-08-21

Downloaded with `curl --compressed` (some of these URLs are served gzip-encoded
by the origin regardless of the request's Accept-Encoding; `--compressed` makes
curl decode the transfer so the file saved to disk is the actual JS text, not
raw gzip bytes — this was verified: without `--compressed`, `glow.3.2.min.js`,
`jquery-ui.custom.min.js`, and `RScompiler.3.2.min.js` were silently saved as
gzip binaries).

| File | Source URL | Bytes | SHA-256 |
|---|---|---|---|
| `jquery.min.js` | https://cdn.jsdelivr.net/npm/jquery@2.1.4/dist/jquery.min.js | 84380 | `22642f202577f0ba2f22cbe56b6cf291a09374487567cd3563e0d2a29f75c0c5` |
| `jquery.textchange.custom.js` | https://www.glowscript.org/lib/jquery/IDE/jquery.textchange.custom.js | 2076 | `2de112cea1aa5c95eb164312aedf1301e9292da9757509db9a72aa32a79b802b` |
| `jquery-ui.custom.min.js` | https://www.glowscript.org/lib/jquery/IDE/jquery-ui.custom.min.js | 240427 | `c4d8dbe77feb63e5a61bee0bead4e5f66e8fa6a927599bd1b74aced52467273c` |
| `glow.3.2.min.js` | https://www.glowscript.org/package/glow.3.2.min.js | 4411470 | `38bad505bacff92e15068851ca145e7fb1cb2a943bc141071e0d730aa4df1796` |
| `RScompiler.3.2.min.js` | https://www.glowscript.org/package/RScompiler.3.2.min.js | 1390275 | `4fc76f1d6ab7d9b15d118fac2aa3f7c237a216f779b829801fb623b26d2c207c` |
| `RSrun.3.2.min.js` | https://www.glowscript.org/package/RSrun.3.2.min.js | 109984 | `2735844b615f87b4147e9cb2b90bf8a7a15da208fc8876eae469fc98861e429d` |

Hashes computed with PowerShell `Get-FileHash -Algorithm SHA256`.

These six files are the complete GlowScript 3.2 VPython runtime dependency
chain used by `frontend/src/utils/runner/glowRunner.js`. They are served
same-origin from `/vendor/glowscript/` (this directory, under
`frontend/public/`) instead of fetched from `glowscript.org`/`jsdelivr.net` at
run time.

Do not edit these files. If GlowScript ships a new 3.2 patch release or the
project moves to a different GlowScript version, re-download with the same
`curl --compressed` procedure, recompute hashes, and update this table.
