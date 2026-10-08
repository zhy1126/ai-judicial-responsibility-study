# PythonAnywhere Migration Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the backend port and review; controller handles account UI, data preservation and deployment.

**Goal:** Publish the existing two-case study at the user's PythonAnywhere account without losing answers, assignments, assets or the existing card annotation project.

**Architecture:** Serve the built study at `/study/`, mount a Flask/SQLite equivalent of the existing `/api/study/` API alongside the existing WSGI application. Store the SQLite database, per-session encryption keys and settings outside the public directory. Preserve the old service and take a verified migration snapshot before switching entry points.

**Tech Stack:** Python 3.10, Flask, SQLite, cryptography AES-GCM, existing vanilla JS frontend, PythonAnywhere WSGI, private GitHub encrypted backups.

## Tasks and verification

- [ ] Preserve PythonAnywhere's current `/home/zhy031126/mysite` and WSGI config in a timestamped private backup; retain the existing root application. Verify archive checksum and file count.
- [ ] Probe `zhy031126.pythonanywhere.com` from China Mobile, Unicom, Telecom and a control network. Repeat using the actual participant and health paths after deployment.
- [ ] Port the exact protocol from `work/collection-site/lib/rules.mjs` and `collection.mjs` to `deployment/pythonanywhere/study_rules.py` and `study_service.py`. Use an injected absolute DB path, explicit transactions and the same schema. Keep formal/test blocks separate, fixed condition across both cases, idempotent writes and withdrawal semantics. Public admin endpoints must reject requests; owner exports run through the authenticated PythonAnywhere Files/console, not a new public credential.
- [ ] Write `deployment/pythonanywhere/test_service.py` first, see it fail, then verify assignment/retry/concurrent balance, correct two-case order, invalid answer rejection, test isolation, unauthorized exports, encrypted backup decryption and withdrawal. Run `python3 -m unittest discover -s deployment/pythonanywhere -p 'test_*.py' -v`.
- [ ] Add `study_admin.py` for private JSON/CSV export, counts and portable SQLite backup; never serve its directory. Keep GitHub's encrypted backup/ack protocol compatible.
- [ ] Export original sessions, blocks, service metadata and answer hashes with the Sites connector. Recover complete answer payloads from the private AES-GCM backup using original keys. Verify IDs, timestamps, hashes, response counts and SQLite integrity before upload. No data/keys in the public source repository.
- [ ] Build the existing allowlisted `_site` assets; package Flask source + static assets separately from the private database/config. Set the deployed frontend base URL to `https://zhy031126.pythonanywhere.com` and research data management to the owner's PythonAnywhere files page.
- [ ] Upload through the authenticated Safari Files UI; run checksum verification, install and smoke tests in the authenticated remote console. Mount study routes with DispatcherMiddleware while preserving `card_annotation_flask_app.app` at root. Reload and reactivate the expired web app.
- [ ] Run spec and quality review of the port and deployment. Resolve findings before publication.
- [ ] Test four pilot conditions with two cases each, duplicate retry and persistent readback; verify zero new formal QA answers. Verify byte-range audio/video and private paths return no data. Check the owner export and encrypted backup round trip.
- [ ] Switch the existing GitHub frontend API only after new data is safely imported and tested; retain browser credentials and draft keys so current participants can resume. Update private backup workflow destination and test durable backup.
- [ ] Save a concise owner handover with participant link, preserved counts/settings, private export location, rollback instructions, expiry date and measured network limitations.
