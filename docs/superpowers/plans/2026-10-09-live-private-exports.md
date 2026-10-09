# Automatically refreshed private survey exports

Goal: make the owner's CSV view reflect retained database answers immediately
after submissions, while preserving the experiment, existing records and access.

The database remains authoritative. Maintain formal-latest.csv, test-latest.csv
and a readable status file beside it, outside all public static paths. Refresh
after successful committed answers/withdrawals and on startup. A filesystem lock
taken before a consistent SQLite snapshot serializes WSGI workers. Replace files
atomically with private permissions; update status last. Failed exports never
undo saved answers. Invalidate stale managed files on failure and allow a manual
repair command. Preserve dated manual snapshots and warn that downloaded copies
do not update themselves.

Implementation and checks:

- Add failing tests for current exports, both cases, test/formal separation,
  duplicates, withdrawal, restart backfill, failure recovery and concurrent writes.
- Reuse the existing validated export/CSV converter; add locked atomic refresh.
- Hook refresh after transactions and at startup; document owner access.
- Run all backend tests locally and under the server's Python 3.10 environment.
- Back up the deployed source, deploy the verified commit, reload the web app.
- Verify original answer hashes/settings are unchanged, run test-only live
  submissions and withdrawal, and compare live CSV rows with database counts.
- Check public export paths remain inaccessible and show the owner the latest files.

No schema, allocation, participant UI, consent, backup encryption or public
permissions change. No participant data or credentials belong in source control.
