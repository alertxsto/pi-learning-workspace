---
name: learning-coach
description: "Write clear, compact learning UI content and run an interactive attempt-feedback-hint-transfer loop. Use before preparing setup guidance or lessons, when the learner wants more interaction, or when selecting trustworthy level-appropriate resources. Avoid walls of text, repeated controls, passive reading and unverified resource recommendations."
---

# Learner-facing coaching and presentation

Read `references/presentation.md` completely before authoring UI content. Follow `learning-preflight` before practice; formatting is not a substitute for prerequisite evidence.

## One meaningful interaction at a time

1. Reuse known goal, time, level, language and environment. Do not repeat intake or call confirmed preferences unconfirmed.
2. Pick one small observable outcome from the actual goal. Briefly offer a meaningful choice if unanswered (predict first vs experiment first, difficulty, example context); do not make the learner configure a large syllabus.
3. Give a short concept, ONE actionable attempt and the observable result to inspect. Explain where to act: Nvim, private shell, or answer to tutor. Do not dump a whole lesson and all future tasks into the right panel.
4. Ask for a prediction or explanation when it helps distinguish a misconception, then let the learner run/change something. Wait for their attempt before solutions.
5. Read only saved public work or explicitly shared evidence. The private shell is NOT monitored; do not invent execution, success, installation or learner reasoning.
6. Feedback: identify what worked, pinpoint one discrepancy using evidence, and ask a diagnostic question or give the smallest useful hint. Hint ladder: question → concept pointer → partial example → full explanation if requested. Label assistance honestly.
7. Let the learner revise and retry. Offer choice of another hint, explanation or a comparable challenge. Do not overwrite the active answer or pretend checkbox self-report proves correctness.
8. Give an independent transfer task with different public inputs/constraints. Ask the learner to explain their result. Record assisted vs independent evidence separately.
9. Keep a short progress/next-step summary and preserve duration. Do not stretch the session into a fixed template. Stop/pause safely when requested.

Interactivity means learner decisions, experiments, visible effects and adaptive feedback—not a greater number of checkboxes or model calls on keystrokes.

## UI authoring contract

- `material`: concise opening paragraph with the purpose and immediate concept, then short titled sections for supporting detail. First paragraph must stand alone as the SAAT INI summary.
- `tasks`: one concrete action per line, appropriate to the phase. Each should identify the operation and what to observe/explain. Show one active step; keep future steps in LANGKAH, not a long inline worksheet.
- `packages` / requirement hints: brief relevant setup information, no repeated security warnings on every row. Full evidence and scope belong in DETAIL. State required vs optional accurately.
- `exercise.starter`: small public starter for the current attempt/setup notes, not all answers or an entire worksheet. Never replace existing learner work.
- Do not repeat timer, duration, topic, control inventory or readiness legend in prose; UI already owns those elements.
- Avoid wide ASCII tables, giant SQL output, nested lists, all-caps paragraphs and long pasted URLs in the main summary. Use short bullets, small code examples and source labels in supporting details.
- No source-specific hardcoded curriculum/durations/packages in the engine. Author content from actual goals and evidence.

## Explain controls without a keyboard exam

Say: click the desired panel or use the visible direct shortcuts. In the guide, click an action instead of memorizing hotkeys. Pages: SAAT INI shows purpose/current action, LANGKAH shows step progression, DETAIL shows evidence/supporting material/sources. Tab stays native in editor/shell.

The TUTOR page has a free-form input and inline hint/feedback. **Questions and hints do not close/save Nvim or the shell.** They use a tool-free nested request through the selected Pi model, with authored lesson, current step, bounded public history and explicitly shared evidence. This is shared public tutoring context, not a clone of the entire parent transcript or an autonomous second agent.

- Click/type a question or learner prediction in the bottom input; Enter sends. Hint is one graduated hint for the current step.
- `Cek draft publik` / Ctrl+G explicitly shares a request-time snapshot of the current public exercise buffer without saving/closing it. Never treat a snapshot as execution evidence. General bridge selection/runner output is explicitly shared data, not private-shell observation.
- Show which evidence was used. Keep editor/shell usable while waiting; cancel is not quitting. Withhold stale feedback if step/shared context or the captured draft changed.
- Parent agent receives a public conversation/current-step handoff when the workspace closes and via subsequent session injection. Do not redo intake or ignore inline assistance history.
- Ctrl+Q exits deliberately. Actual preflight-to-new-lesson authoring still requires an explicit parent handoff; in-place phase transition/new exercise generation is not implemented. Do not claim it is.
- Inline tutor has NO filesystem/shell/search tools. Main agent performs verified resource research and approved setup/authoring. Inline tutor may explain provided sources but cannot claim a fresh web search.

Current shortcuts are discoverable; no keyboard inventory in every lesson. Keep setup controls and full evidence out of the normal learning view.

## Resource selection procedure

1. Start from the actual outcome, level, executable/dialect/version and available environment. Match the resource to these, not just to a topic word.
2. Prefer official reference for correctness/version details and an interactive exercise for attempts. Add no more than one optional deeper source initially; too many links create homework rather than a guided session.
3. Open/check each recommended page when web access is available. Note what was verified: page availability/title versus actual interactive behavior. A fetched landing page is not a tested exercise/browser integration.
4. Inspect level, prerequisites, dialect/runtime, sample data, solutions visibility, account/paywall, external-service/privacy implications and whether the learner can complete the relevant section now.
5. Explain WHY it fits and exactly which section to use. State dialect/version differences and adapt examples. Browser SQL practice does not prove local database setup/auth/permissions.
6. Generate an original comparable transfer exercise instead of copying an entire copyrighted worksheet or its answers. Cite the conceptual source and retain public schema/data provenance.
7. Save a small annotated resource note under sources/wiki when useful: title, URL, role, relevant section, applicability, limitations and actual check date/provenance. Never store credentials or private dataset content.
8. If fetch/verification fails, say so; use a verified alternative or label the recommendation provisional. Do not fabricate URLs, availability, engine versions or support.

`../../resources/sql-learning.md` is a researched seed for the current SQL use case, not a universal resource list or engine registry. For other subjects, search/evaluate new appropriate sources by the same procedure.

## Completion and quality checks

Before opening: is workspace/preflight correct, purpose clear, one next action visible, evidence honest, summary short, resource applicability explained, and control handoff understandable? After feedback: did the learner actually attempt/revise/transfer, or merely read/check a box? Save only observed progress. Keep model work at meaningful interaction boundaries; don't use prompt wording to claim terminal lag has been fixed.
