# Inline tutor — behavior and runtime limits

The inline tutor provides questions, hints and explicit public-buffer feedback inside the learning workspace without closing the editor or private shell.

## Available now

- Persistent Nvim/private PTY while learner asks, requests one hint, shares/checks an unsaved public exercise buffer, cancels and retries.
- TUTOR input accepts questions/predictions/explanations. Enter sends, Escape leaves input, no exit-to-chat for normal help.
- Tool-free nested request via **the selected Pi model and its ModelRegistry authentication**. No second agent session, no extra filesystem/shell/search permissions, no direct auth-file reading.
- Shared packet: authored goal/material/steps, current stable step ID, confirmed minutes/phase, requirement observations, bounded public question/hint/feedback history and explicitly shared evidence.
- `Cek draft publik`/Ctrl+G requests `LearningSnapshot` from the embedded Lua bridge, correlates request ID and checks the active file matches the public exercise. No `:w`, `:wqa` or disk save for feedback. Snapshot is bounded, redacted best-effort, and explicitly NOT execution evidence.
- Classroom owns inbox consumption while open; Nvim selection and opted-in runner events can be included without closing. Runner events are timestamped/unlinked until relevance is established; no fabricated current-step run identity.
- Bounded public state under `.learning/tutoring/`, request-time evidence digest/provenance, assistance, busy/cancel/error/interrupted and stale-response states. Parent agent receives public summary/current step on tool return or manual command close, and subsequent injected session state.
- Provider usage is recorded as `learning-tutor-usage` custom entries and included in this package's cost calculation. On-demand classroom help (`?`) labels nested tutor usage and separate context instead of repeating telemetry under every panel. Pi's own native totals may not count those custom entries; don't claim native billing coverage.
- Normal learning view removes always-on packages/setup controls; details remains available. No model calls while simply typing in editor/shell.
- Terminal chrome is compact: topic/timer header, short editor/shell labels and one-line Tutor/Langkah/Detail/help tabs. Help preserves the previous page/scroll; pending probe approval remains visible and cannot be hidden behind help. Learning status/widgets are suspended only while the classroom is open; the built-in Pi footer stays enabled.

## Important limits

- This is not a clone of the parent's entire model transcript. The inline tutor has the explicit shared packet, not arbitrary private state or unseen terminal activity. Initial/main agent tool still waits until the workspace exits; the nested provider request is what makes inline conversation possible during that wait.
- **Preflight → newly authored lesson, new exercise/transfer-task creation and approved setup/search execution still use the main-agent handoff.** The inline tutor cannot commit them. That handoff still closes/reopens the workspace. Full in-place phase/new-lesson transition remains outstanding.
- Teaching material is still authored lesson text plus step strings, not a fully typed concept/success-criteria curriculum model. Tutor can discuss/review in place but doesn't automatically advance based on verified mastery.
- Explicit public buffer sharing is not a guarantee arbitrary secrets can be sanitized. Do not put credentials in questions/public files/captured runner. Private shell stays unshared. Hard abort/shutdown may still require Nvim recovery; ordinary hint/feedback does not.
- Current technical bounds: 12 persisted public turns, last 6 replies in request history (clipped), reply capped at 8K characters/1600 output tokens, request timeout 120 seconds, snapshot timeout 5 seconds. These are resource bounds, not learning choices or curriculum presets.
- Input is single-line (can carry short pasted text). Full Markdown/long answer UI, automatic source search and background tutoring without user action are not implemented.

## Verification

`npm run check`: unit/integration coverage includes shared lesson/step/history, independent vs assisted labeling, persistence, explicit unsaved capture without file mutation, no duplicate request while busy, cancel, stale step/draft responses, capture failure, nested no-tools model call and cost inclusion.

`npm run smoke:tutor`: real isolated Pi 1.0.2 + actual clean Nvim + private bash, with an **offline deterministic provider fixture**. Checks in-place question/hint/unsaved feedback/cancel, Nvim PID unchanged, unsaved code not implicitly saved, shell cwd/variable persistence, parent-authored goal/current step/duration/history in packets, private shell sentinel absent, resize/save/exit and timer pause.

`npm run smoke:ui`, `npm run smoke:nvim`, `npm run smoke:pi` retain basic fallback/readiness/navigation/registration coverage. No database connection, real provider request, package install or credentials used in smoke.

Live selected-provider behavior, actual pedagogical quality and learner typing latency remain to be validated with approval/user use. Fixture correctness is not a paid-model teaching-session claim.
