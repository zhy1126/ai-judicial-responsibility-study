# Background and AI Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (optional). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify screening into four choices, add AI participation markers and a review path, and set each dossier section's minimum reading time to eight seconds.

**Architecture:** Keep the existing local assignment/session model and add a normalized screening choice to `StudyCore.assignParticipant`. Render condition-specific AI node annotations from `StudyNarration`, while keeping the supplied narration paragraphs unchanged. Add a survey review button that returns to the existing replay screen and preserves form state.

**Tech Stack:** Vanilla JavaScript, HTML, CSS, Node test runner, Playwright browser tests, GitHub Pages static build.

---

### Task 1: Lock behavior with failing tests

**Files:**
- Modify: `tests/legal-background.test.cjs`
- Modify: `tests/narration-design.test.cjs`
- Modify: `tests/mobile-flow.test.cjs`
- Modify: `tests/playback-progress.test.cjs`

- [ ] Add tests for the four-choice screening API, 8-second `MIN_READING_MS`, condition-specific AI node annotations, and the survey review button.
- [ ] Run the focused tests and confirm they fail because the new choice API, annotations, and UI do not exist.

### Task 2: Implement normalized four-choice screening

**Files:**
- Modify: `study-core.js`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

- [ ] Add `SCREENING_CHOICES` and accept `backgroundChoice` values `judge`, `legal_other`, `lawyer`, and `other` in `assignParticipant`.
- [ ] Map `judge` to the judge background, `lawyer` to lawyer, and `legal_other`/`other` to public background with randomized litigant/public role; retain compatibility for old saved assignments.
- [ ] Replace the old conditional screening form with four unchecked radio cards and collect only that value for new assignments.
- [ ] Persist the choice and label in the assignment/response/export without deleting old background fields.

### Task 3: Add 8-second dossier gate

**Files:**
- Modify: `study-core.js`
- Modify: `index.html`
- Modify: `tests/legal-background.test.cjs`

- [ ] Set `MIN_READING_MS` to `8000` and update participant copy to say eight seconds.
- [ ] Keep the existing end-of-content and explicit confirmation requirements.

### Task 4: Add AI nodes and review path

**Files:**
- Modify: `study-narration.js`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/narration-design.test.cjs`
- Modify: `tests/mobile-flow.test.cjs`

- [ ] Add `participationNodesFor(condition, caseType)` returning non-empty, condition-specific node labels and a no-AI label.
- [ ] Render a node after its paragraph only when that paragraph has been progressively revealed; escape paragraph text as today.
- [ ] Add a clear legend and color classes for no AI, procedural, substantive, and decisional participation.
- [ ] Add a “返回裁判形成记录，重新确认 AI 参与方式” button in the survey material-understanding block; return to replay without resetting answer fields, and allow the normal back path to return to survey.

### Task 5: Verify and publish

**Files:**
- Regenerate: `_site/*` through the existing build.

- [ ] Run the focused unit tests and full browser flow tests.
- [ ] Run `git diff --check` and the static build.
- [ ] Verify the deployed Pages assets against `_site` with the live checker.
- [ ] Commit, push, and publish the updated Pages build.
