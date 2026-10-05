# Compact presentation protocol

## Main summary

The first material paragraph should answer: what are we doing now, why, and what should the learner inspect? Prefer a few short sentences, not a syllabus. The UI shows only a bounded introduction in SAAT INI; complete supporting text remains in DETAIL.

Good structure (author content for the actual goal, do not copy as a fixed lesson):

```text
Purpose and the current idea in a few short sentences.

How it works
- One necessary distinction.
- One relevant caveat.

Observe
Expected property of the result, not the answer to the exercise.

Sources
Named official section and applicability.
Optional interactive practice section, with dialect/privacy caveat.
```

No duplicate DURATION/CONTROLS/STATUS boilerplate. No repeated package warnings between concept paragraphs. Setup phase explains decisions, verification and failure interpretation; learning phase explains the current concept/attempt.

## Tasks

Each task is a bounded operation plus an observable question. An incomplete instruction like "learn SQL" or "understand tables" has no testable learner action. A complete answer embedded in the starter removes the attempt. Write public initial data and constraints separately from reference solutions. The UI presents one active step and previous/next controls; future tasks may exist but should not dominate the current view.

Ask for a prediction, comparison or explanation only where it improves understanding. Do not require the learner to bounce panels for every sentence. Questions, learner reasoning, hints and feedback occur inline in TUTOR without closing editor/shell. The learner controls when to share a public snapshot; no mandatory save or exit for ordinary help. Preserve their attempt across help requests; a hint is not a completed task.

## Detail and sources

Use short headings, small examples and named links with a one-line explanation. Avoid wide tables that wrap into unreadable columns. Put full evidence, setup caveats and supporting reading in DETAIL. Do not hide essential approval effects or full command argv in a summary: probe review is its own explicit approval view, scrollable without truncating the command into a misleading snippet.

A resource recommendation names a particular section and a reason, not merely a home-page link. Explain engine/version differences; illustrative data is not an existing local fixture. Check availability and distinguish fetched content from tested browser interaction.

## Interaction rhythm

Concept → learner predicts/tries → inspect public evidence → one focused feedback/hint → revise → independent transfer. Stop and wait at attempt boundaries. A long monologue followed by "any questions?" is not the intended workflow. Adapt from the learner's actual mistakes and chosen pace, not assumed mastery or a fixed pass percentage.

## Limits to state honestly

The current tutor streams tool-free nested responses with shared lesson/current-step/public-history context. It cannot run tools, browse, or commit a new lesson. Preflight-to-new-lesson authoring still uses the parent handoff. Private shell output is not model evidence. Mouse focuses a panel/actions, not full Nvim mouse cursor placement. UI/terminal performance requires code measurements and user retesting, not a skill promise.
