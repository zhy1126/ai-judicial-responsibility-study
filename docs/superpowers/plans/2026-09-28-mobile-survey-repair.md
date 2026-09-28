# Mobile questionnaire repair

User-authorized repair of confusing responsibility transition, mobile video feedback, and blocked submission. Preserve two independent measurements, role/condition assignment, case order, consent and all saved records.

## Evidence
- The current toggle hides independent scores and replaces them with blank allocation fields; allocation is mandatory but the submit button is silently disabled until the hidden task is completed.
- Browser native required validation intercepts submission before the custom error handler. Hidden rating inputs are not natively validated; their missing-answer errors have no question location.
- Video play updates the button on `play`, before frames actually advance. No loading timeout, retry feedback or native playback controls. All eight MP4s are H.264/yuv420p/faststart, about 1.7–2 MB; encoding does not explain the reported failure.

## Design and acceptance
1. Keep both responsibility questions visible in sequence. Enable allocation after valid independent scores, retain scores visibly above it, remove manual transition buttons. Never copy or normalize independent scores into allocations. Maintain both answer fields and 100-total validation.
2. Submit stays actionable unless a request is in flight. Validate in page, name the first missing/invalid question and scroll/focus it; preserve all input. Keep immutable pending answers and retries. User clarified submission means a grey disabled button; preserve the already verified network retry flow.
3. Separate video status from the three-second text gate. Set muted/inline properties, expose native controls, show loading/playing/paused/unavailable statuses and a retry action. Treat canceled play as canceled, not a media error. Guard late asynchronous results when leaving or switching case. Record video exposure without making playback mandatory.
4. Keep pilot central collection and private backup configuration unchanged.

## Execution
- [x] Add regression tests: responsibility values preserved, no hidden transition needed, field-specific submit errors, pending retry protection, video pending/stall/pause/retry/close lifecycle.
- [x] Run new tests against old behavior to confirm failures.
- [x] Implement app/index/styles and isolated role-video player; include build asset and CI tests.
- [x] Run regression suite, build, and browser-test via normal controls at mobile width; verify incomplete submission, independent-vs-allocation, refresh, both cases, video progress.
- [ ] Independent code review per requesting-code-review skill, fix findings, PR, deploy and live smoke test. Save evidence in outputs.

The existing repair and deployment authorization covers these changes; no experimental factor or data-access expansion is introduced.
