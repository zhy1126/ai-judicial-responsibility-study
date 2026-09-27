# Demo flow and collection fixes

**Goal:** Apply the user's approved three-second scenario gate, explicit AI participation at relevant narration stages, reliable audio resume, and centrally balanced collection.

**Architecture:** Keep the existing static participant UI. Narration audio/transcripts stay verbatim; separately labelled stage notes explain the same condition at the corresponding paragraphs, using identical emphasis across conditions. The scenario gate uses foreground reading time independently of video completion. Collection must be enabled only after a real backend is deployed and verified; local data must not be presented as uploaded.

**Tech stack:** Existing vanilla JavaScript, Node test runner, Playwright; backend host awaiting user choice.

- [x] Add failing browser assertions: three seconds unlocks the scenario with paused or failed media, two cases preserve identity, and each condition displays stage-specific participation notes in both cases.
- [x] Change `study-narration.js`, `app.js`, `styles.css`, and `index.html`; preserve verbatim narration and audio compatibility. Stage notes appear alongside the appropriate streamed paragraphs, not as unrecorded spoken words.
- [x] Review and reproduce the audio resume defect, then add a targeted regression test and minimal fix. Keep speed and independent reading progress.
- [x] Update collection plan to balanced random blocks within each final role; keep assigned / first case / completed counts separate. Repeated starts must reuse assignment.
- [ ] Implement backend and integration once a hosting environment is selected; no client-side shared tokens, public answers, or false successful upload state.
- [ ] Run relevant rule tests, real browser flow, build, review the diff, publish authorised frontend changes and verify deployed assets. Report any backend hosting dependency distinctly.

Acceptance: `orientationReady()` is false before 3000 foreground ms and true afterwards with consent even if video is unplayed or failed. AI-stage notes cover material handling, evidence/law analysis, and result formation; substantive explicitly excludes result recommendations. The case facts, verdicts, and spoken paragraphs stay unchanged. Tests distinguish actual successful upload from browser-only retention.
