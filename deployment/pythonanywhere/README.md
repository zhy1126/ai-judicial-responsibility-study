# PythonAnywhere study collection service

This Python 3.10-compatible Flask service preserves the original study protocol,
assignment fields, four SQLite tables and legacy payloads. Formal and test
participants occupy independent shuffled blocks. Writes use `BEGIN IMMEDIATE`;
saved answers cannot be replaced. Both cases retain the assigned AI condition.

## Install and mount

The target PythonAnywhere environment already provides Flask 3.0.3,
Werkzeug 3.0.4 and cryptography 43.0.3. For another environment, install
`requirements.txt` inside a virtual environment.

Keep this code, the database and configuration outside the built public bundle.
For example:

```
/home/OWNER/study/code/study_app.py
/home/OWNER/study/code/study_admin.py
/home/OWNER/study/private/study.sqlite3
/home/OWNER/study/private/config.json
/home/OWNER/study/public/index.html
/home/OWNER/study/public/assets/...
```

Create a private `config.json` with `collectionOpen` as a Boolean and
`backupToken` as a random 64-character lowercase hexadecimal secret. Preserve an
existing backup token during migration. Optional `allowLocal: true` enables
`http://127.0.0.1:<port>` development origins; the default is disabled. Restrict
private files to mode 0600 and the private directory to mode 0700.

```python
from study_app import create_app

study_application = create_app(
    '/home/OWNER/study/private/study.sqlite3',
    '/home/OWNER/study/public',
    '/home/OWNER/study/private/config.json',
)
```

The WSGI router must forward `/study/` and `/api/study/` requests with the complete
original `PATH_INFO`; do not strip those prefixes. Preserve the existing
application as the fallback. Reload the web app after replacing the public build
or backend source. Configuration is re-read on each API request, so changing
`collectionOpen` does not require a code change.

Static requests only serve a frozen allowlist from the public directory: HTML,
JavaScript, CSS, images, fonts and media. Dotfiles, symlinks, private JSON,
SQLite databases, Python files, source maps and later-added files are excluded.
Audio supports range requests. Do not add PythonAnywhere static-directory
mappings for the code directory, its parents or the private directory.

## Protocol and migration

Supported API endpoints under `/api/study/`: `health`, `start`, `session`,
`answer`, `withdraw`, `backup`, and `backup/ack`. Session requests use the existing
64-character token in the Authorization header; only its SHA-256 hash is stored.
Backups require the independent configured backup token. CORS permits the same
origin and `https://zhy1126.github.io`. All HTTP admin routes return 403.

Import the original `sessions`, `answers`, `blocks` and `service_meta` without
changing their values. The application creates missing tables but never replaces
existing data. It does not import or copy data automatically. Legacy answer
digests remain untouched: a retry is accepted when the normalized semantic input
matches the stored payload, even if Node and Python number serialization differs.
The comparison distinguishes Booleans from numbers. New inputs enforce UTF-16
length limits and finite JSON numbers; malformed and excessive bodies fail safely.

AES-GCM backups use the original `aes-gcm-per-session-v1` envelope: 12-byte IV,
32-byte base64 stored session key, UTF-8 session ID as authenticated additional
data, and base64 ciphertext with the 16-byte authentication tag appended. Backups
contain no keys. Pagination remains 25 responding, non-withdrawn sessions.

Withdrawal atomically deletes both answers, erases the session key and completion
time, and keeps the minimal withdrawn assignment row to prevent reuse. SQLite
secure deletion is enabled; rollback journals are deleted after transactions.
No periodic plaintext database snapshots or recovery-key copies are created.

## Owner-only administration

Use the authenticated PythonAnywhere console and Files UI. There is no public
admin login or data export endpoint.

The database directory now contains three automatically maintained owner-only
files (mode 0600):

- `formal-latest.csv`: current formal case answers, including incomplete studies.
- `test-latest.csv`: current pilot case answers, kept separate from formal data.
- `data-status.txt`: refresh time in Beijing time, case counts and complete/partial
  participant counts for both files.

They refresh at application startup and after every successfully committed answer
or withdrawal, including an idempotent retry. One completed participant has two
CSV rows; filter `study_completed=true` for completed studies. Participants who
have only started and have not submitted a case are not answer rows.

The process locks exports before taking one SQLite snapshot, serializing multiple
workers so an older request cannot overwrite a newer view. Each file is replaced
atomically; the status is published last. An export failure is logged, removes
obsolete managed files where possible, and does not undo a committed answer or
misreport submission failure. Repair the filesystem issue and run
`refresh-exports` to regenerate from SQLite. These full exports cost time
proportional to the retained dataset; monitor request latency as collection grows.

Refresh the PythonAnywhere Files page and download the fixed filename again to
see new answers. A copy already downloaded or opened in Excel is not a live
connection. Old dated exports remain historical snapshots and are not refreshed
or removed automatically. No new public route or static mapping exposes exports.

Run these commands from the code directory,
using the deployed Python environment:

```sh
python3.10 study_admin.py --db /home/OWNER/study/private/study.sqlite3 summary
python3.10 study_admin.py --db /home/OWNER/study/private/study.sqlite3 --test summary
python3.10 study_admin.py --db /home/OWNER/study/private/study.sqlite3 refresh-exports
python3.10 study_admin.py --db /home/OWNER/study/private/study.sqlite3 export --format json --out /home/OWNER/study/private/responses.json
python3.10 study_admin.py --db /home/OWNER/study/private/study.sqlite3 export --format csv --out /home/OWNER/study/private/responses.csv
python3.10 study_admin.py --db /home/OWNER/study/private/study.sqlite3 sqlite-backup --out /home/OWNER/study/private/manual-snapshot.sqlite3
```

Exports default to formal participants; `--test` selects test participants.
Only retained participants with at least one answer are exported. JSON includes
all record fields. CSV protects cells beginning with spreadsheet formula markers.
Manual export/snapshot commands create files with mode 0600 and refuse to
overwrite existing files. Only `refresh-exports` replaces the managed latest files.

SQLite snapshots contain plaintext answers and decryption keys. Use the snapshot
command only for an explicit manual need. Remove obsolete snapshots and exports
after migration or withdrawal; an old copy can otherwise preserve withdrawn
answers or keys. Existing provider backups and user-downloaded copies are outside
the live application's deletion control. Prefer the encrypted backup API for
routine off-server copies, retaining the recovery key only in the live database.

## Verification

```sh
python3.10 -m unittest -v test_study_app
```

Tests use temporary synthetic databases and cover consent, background immutability,
formal/test separation, concurrent balanced blocks, duplicate concurrent starts
and answers, random public roles, all validation and reading gates, both cases,
legacy retry equality, a withdrawal/write race, AES-GCM decryption, pagination,
private administration, CSV formula protection, private paths, media ranges,
configuration changes, malformed bodies and size limits. Live export tests also
cover startup backfill, both-case completion, withdrawal,
concurrent workers, failed exports without lost answers, retry recovery and
preservation of historical manual files. The checked-in
`node_contract_fixture.json` contains eight synthetic oracle cases generated by
the original Node `assignment` and `checkedAnswer` functions, including Unicode,
numeric metadata and expected SHA-256 digests. It contains no participant data.
