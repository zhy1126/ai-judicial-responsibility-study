# Two-case participant session implementation plan

**Goal:** Every participant completes both supplied cases, with a separate evaluation for each, before the final debrief.

**Architecture:** Keep the screened role and assigned AI condition fixed. Interpret the existing randomly assigned case as the first case, with the other second; preview case selection also sets the first case. Add a pure session module for ordered answers, completion, migration and export rows. Keep active-case controls in app.js and fully reset them between cases. Store one participant envelope containing two case answers, with partial sessions explicitly marked incomplete.

**Tech Stack:** Existing static JavaScript/HTML/CSS, Node tests, Playwright, GitHub Pages.

- [x] Add failing session tests for both orders, sequential completion, duplicate rejection, legacy single-case continuation, and separate export rows.
- [x] Implement study-session.js: create/restore/submit/advance/complete/record/rows; require two distinct cases in the fixed order and common participant identity/condition.
- [x] Add a first-case completion screen and second-case action; reset dossier confirmations, replay, survey, ranking, audio and speech metadata. Preserve the session, first answer and assignment across refreshes.
- [x] Save one participant envelope after each case; count completed people separately from per-case ratings; export one row per case with case order and session completion. Download/delete/retention apply to the whole session. Preserve legacy records until the second answer is saved, then retain their original first-case content inside the envelope.
- [x] Update introduction, progress, preview labels, study design and debrief to state that both cases are required. Show the full debrief only after both evaluations.
- [x] Extend browser tests to cover all 24 role/condition/order paths (48 case evaluations), first-case transition, fresh second-case controls, first/second-case refresh, legacy continuation, deletion, JSON and CSV.
- [x] Run unit and focused browser tests, review and build.
- [ ] Publish and verify the live site. Keep audio scripts unchanged.

Old single-case completed drafts continue through an explicit transition screen to the missing case, retaining their earlier answer and marking the session as migrated. Deleted sessions stay deleted. No existing answer is fabricated or relabelled as the other case.
