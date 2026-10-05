---
name: learning-preflight
description: "Mandatory preflight before hands-on learning: establish the actual workspace and execution scope, reconcile environment memory, determine topic-specific prerequisites, verify only gaps, obtain setup approval, and hand off to practice only with readiness evidence. Use before opening any new learning workspace or when packages, editor, target, login, permissions or environment scope are uncertain."
---

# Real learning preflight — not a label on a lesson

Read [the operational protocol](references/protocol.md) completely before preparing a new session. Follow it with `learning-environment` for setup and `learning-session` only after the exit criteria are met.

## Non-negotiable order

1. **Locate the learning workspace and authoritative memory.** Read injected environment/session/learner facts first. CALL `learning_preflight` to obtain Pi's actual cwd, memory presence, existing observations and readiness gaps without executing anything. A shell `cd` does not change Pi's cwd. If current cwd is not the learner's confirmed workspace, stop and resolve that mismatch before generating files or opening the UI. Do not silently copy or merge snapshots from other workspaces.
2. **Preserve the learner's choice.** Reuse known topic, goal, minutes, Nvim preference and target. Never call confirmed minutes a tutor proposal. Ask only unanswered questions; explain a genuine conflicting state rather than starting intake over.
3. **Define the actual prerequisites from the intended outcome.** Use a free-form topic and data-driven requirements, not a built-in topic/package registry. Identify tool, runtime, target, authentication, task permissions, and any agreed exercise fixture separately. Nvim is required for this learner's hands-on workspace, not optional. Do not create a second invented editor key: use the configured editor key returned by the report.
4. **Reconcile requirements with facts before writing `unverified`.** CALL `learning_preflight` with the proposed requirements. Reuse canonical observation keys already present in that workspace: adding `mysql-client` does not make existing `mysql` evidence disappear. If an alias really needs changing, reconcile it explicitly with provenance. An absent snapshot is missing memory, not evidence that every package is absent.
5. **Explain a short readiness table.** For each requirement: known evidence/scope, gap, and the next action. Distinguish installed executable from usable runtime and authenticated exercise access. Do not infer installation failure from an unverified row.
6. **Resolve relevant gaps with the user.** Propose bounded, read-only checks for facts that are unknown/stale, or ask about an unknown target. Show exactly what will run and why. Obtain explicit approval. No startup/full-machine/network scan. Do not install packages or start services just because a check fails.
7. **If setup is needed, open the real preflight UI.** CALL `learning_workspace` with phase `preflight`. Right panel content must be setup guidance and verification tasks, not SELECT exercises or a lesson masquerading as setup. Use a public setup-notes file as `exercise.path`; do not overwrite learner drafts. Give a specific next action and explain panel controls before opening. Keep the learning timer paused.
8. **Perform approved setup and verify effects.** Commands needing credentials belong in the private PTY shell. Shell transcript is not visible to the tutor: ask in the TUTOR input without exiting; share only sanitized public evidence explicitly; never pretend to have observed uncaptured commands. Version probes can be approved via R/Y; they do not establish login or permissions. Record factual scoped results, not checkbox claims.
9. **Evaluate exit criteria.** Required tools/runtime and the agreed target/access/fixture must have relevant evidence; Nvim cannot be waived through an automatic fallback. Resolve failures or remain in preflight. If setup is declined, ask whether the learner wants a separately defined concept-only session. Never downgrade hands-on learning to paper queries without consent.
10. **Hand off to practice explicitly.** Present what is ready, what changed, what remains optional and the exact learner-selected duration. Ask to start. Only now prepare source-backed lesson/attempt/test content and call `learning_workspace` with phase `learning`. The runtime rejects required gaps. Setup time does not consume the lesson budget unless the learner explicitly chooses otherwise.

## Requirement data contract

Use `key`, `label`, optional `kind`, `description`, `packageName`, `setupHint`, `probe`, `required`, and `acceptedStatuses`.
- `required` defaults true; false is only for genuinely optional capabilities, never a trick to pass preflight.
- `acceptedStatuses` contains `observed` and/or `ready`. Use `observed` for executable/version facts; require `ready` for actual runtime/access/permission evidence. Explain how each fact was established.
- A successful generic probe records `observed`, not authenticated/full readiness. Credential-safe manual checks need a sanitized, scoped `ready` record with actual evidence.
- Prefer existing keys. Do not label client presence as server readiness, or use task completion checkboxes as verification.
- Probe argv contains no passwords/tokens or credential-bearing URLs. Do not write inline installation scripts disguised as probes.
- Keys and contents are authored for this session; there is no topic enum, fixed installer mapping, fixed exercise filename or fixed duration template.

## UI handoff script

Before opening, explain in casual Indonesian: what the screen is for, which single action comes next, and how to return for feedback. Say that the setup shell has account permissions, is not a sandbox and is not captured by the tutor.

Use the configured direct panel shortcuts listed in help (`?` in the tutor panel), or click a panel in Pi fullscreen. The navigation bar is no longer always visible; do not fill the lesson with shortcut legends. Tab remains native editor indentation/shell completion. Ctrl+T is a compatibility cycle; do not make the learner cycle blindly. R reviews probes, Y approves, N cancels. Ctrl+G checks an explicitly shared public buffer snapshot inline without save/exit; Ctrl+Q saves/exits. Neither means "environment is ready". L checks the gate in preflight and returns to the tutor for a real lesson; in a prepared learning session it starts the timer only after required gaps are resolved.

## Stop conditions

- Wrong/unknown workspace or execution scope: resolve identity, not reinstall tools.
- Snapshot absent while user reports prior verification: explain memory mismatch, consult confirmed workspace facts with permission or propose one relevant check; do not declare all packages missing.
- Missing executable: distinguish PATH/alias/container availability from absence; offer setup choices with approval.
- Unknown database or remote target: ask before connections or creating a second server.
- Auth/permission failure: stay in preflight, don't ask for secrets in chat and don't reset/drop anything.
- Unexpected user configuration or save failure: preserve work and explain recovery.
- Timer contradiction: preserve authoritative chosen minutes, don't make them "unconfirmed" again.
- Learner frustration navigating: explain direct selection and focused-panel cues, not a larger chat checklist.

## Completion evidence

Report the workspace/scope, outcome, required facts with provenance, approved changes and any remaining gaps. Mark preflight complete only from these facts. In-place question/hint/unsaved-snapshot feedback is implemented and tested with an offline fixture, not yet a verified paid-model lesson. Do not claim live-provider pedagogy, full external bridge, database login, exercise permissions or in-place phase transition have been tested when they have not.
