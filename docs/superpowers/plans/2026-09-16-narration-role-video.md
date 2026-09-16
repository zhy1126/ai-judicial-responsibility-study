# Shared narration and role immersion implementation plan

Goal: Apply the user's confirmed three-group, two-case study design, with one shared narration per case and AI participation manipulated only by a visible disclosure line. Add matched role-immersion clips where all three assets are available.

Architecture: Keep the existing static site and two-case session engine. Add a condition-independent narration module, a media manifest, and a small exposure gate for role introduction and reading. Keep all participant data local as before; preserve old records and identify new stimulus versions explicitly.

Tech stack: Vanilla JavaScript, HTML/CSS, Node test runner, Playwright, generated images and FFmpeg camera motion.

The design and execution are already authorized by the preceding conversation and the September 16 request. Execute inline; no additional design approval is required. User confirmed harmed-party / rightsholder framing and AI stills with camera motion. Latest duration decision: 18 seconds (three 6-second shots), with an exploratory involvement check after outcome questions.

- [x] Rules tests first: current self-reported lawyers do not need a license-validity answer; nonlawyers randomize regardless of degree or litigation history; all conditions share four ranking actors; minimum reading exposure is required.
- [x] Add `study-narration.js` from the two Word drafts' exact paragraph source. Its only condition-dependent value is `conditionLine`. Audio URLs are keyed by case only, and text stays visible with audio.
- [x] Update `app.js`, `index.html`, and `styles.css`: role dialog with at least five visible seconds; explicit sequential three-section reading instructions; static transcript with reading gate while recordings are absent; mandatory full ranking; same rating UI for all conditions; upfront research consent and voluntary withdrawal.
- [x] Retain role/AI assignment and both-case order across refresh. Old saved answers stay unchanged. Old incomplete stimuli reset exposure and unsubmitted responses; capture consent for the new wording and record media/narration versions.
- [x] Create 18-second silent role clips from AI images with identical encoding, pacing, and no AI-condition cues. Keep generated masters outside the repository; publish optimized MP4 and poster assets only. If any role asset is absent, use the same text-only orientation mode for all roles.
- [x] Add browser checks for all roles/conditions, both case orders, required ranking, all reading gates, shared narration/audio, refresh, old records, consent, withdrawal, optional speech, and mobile overflow. Inspect media frames and webpage screenshots.
- [ ] Update build, deployment checks, researcher overview and audio handoff instructions. Run relevant checks and build; publish through the existing GitHub Pages workflow; verify the deployed page and assets.

Constraints: no new backend, no invented audio recording, no prosecutor/judge recruitment group, no additional AI-role clues inside narration/video/decision cards. All participant-facing scenes are fictional and generalized; avoid violence, restraints, emotional music, recognizable people, case spoilers, and institutional claims.

Verification: 47 rule/session/speech/narration tests passed; 24 two-case browser paths (48 answers) passed before the final video-duration refinement, then all three roles in both case orders (12 answers) and shared audio rechecked with the 18-second videos and involvement field. Legacy migration, updated consent, partial audio configuration, persistent video-error messaging and preserved submitted answers passed. Encoded clips checked: H.264, 1280×720, 30fps, 540 frames, 18 seconds, no audio; all three scenes visually inspected.
