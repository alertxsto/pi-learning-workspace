---
name: learning-environment
description: Resolve missing prerequisites for a learning task using injected environment memory, targeted probes and an interactive setup shell. Use before practice when readiness is uncertain or setup fails.
---

# Memory-first learning environment

Entry prerequisite: read `../learning-preflight/SKILL.md` and its referenced protocol before a new session. This skill handles setup after workspace/memory/requirements reconciliation; it is not permission to skip that preflight or begin lessons from unknown facts.

1. Identify execution scope and the chosen target from injected memory or the learner. Laptop OS, WSL, container and remote Pi are not interchangeable. Do not scan at startup.
2. Compare task requirements with observed facts. A missing PATH entry is not proof of no installation. Unknown versions remain unknown.
3. Define requirements for the actual outcome/target in lesson data. `/doctor [requirement-key]` reports current requirements from memory without probing. `/env probe <key>` shows a configured executable+argv command and requires explicit user approval. Do not invent default probes or assume a particular database/topic is supported by a dictionary.
4. Supply scoped probe definitions only where a safe, necessary check is known. No credentials in args or stored lesson data. Configured commands have account permissions, not a sandbox; explain any effects. A successful process exit yields an observation, not a universal readiness claim. Use private shell/manual scoped evidence for credential-bearing checks.
5. For databases, ask whether the target is local, a dedicated container, or a specified remote endpoint. Never network-scan. Ask before connecting to a remote service.
6. `pg_isready` measures server readiness, not authenticated access. `mysqladmin ping` can succeed with Access denied. Follow with a credential-safe authenticated read query, then evaluate permissions needed by the exercise.
7. Never request passwords in chat or command arguments. The current preflight uses a real shell with capture disabled. Learners may enter password prompts there, but explain that separate screen/session recorders are outside our control.
8. Explain setup choices and changes in the right panel by calling `learning_workspace` with phase `preflight`, free-form topic, material, tasks, package notes, requirements and exercise.path/starter. Derive package/setup advice from relevant observed OS/target facts, not an engine-level OS mapping. Ask approval before installs, image downloads, service starts, roles/databases, or writes to system files. Do not give only a text checklist instead of opening the UI. The tool does not execute an install automatically.
9. `/preflight` now opens the three-panel UI IN Pi: editor/Nvim upper-left, embedded private PTY shell lower-left, and requirements/material/task checklist right. Ctrl+T changes focus; R in the guide reviews lesson-defined probes, Y explicitly approves them, N cancels, L in preflight checks the gate and returns for lesson preparation; L in a prepared learning phase starts the chosen duration, Ctrl+G explicitly shares/checks the public buffer inline without save/exit. TUTOR has free-form questions and streamed hints with lesson/current-step/public-history context; Nvim/PTY stay alive. Inline tutor is tool-free: main agent still owns setup changes, web research and new-lesson authoring. Preflight-to-new-lesson handoff still leaves the UI, so do not promise full in-place phase transition. No shell transcript is sent to the model.
10. Save sanitized observations through `/env record <key> <status> <evidence>` or validated snapshot updates. Keep host/target scope explicit. Runtime readiness may need rechecking after failures or a target change.
11. Mark task ready only when actual requirements are verified. A read query is not proof of write privileges. Write probes must use an approved disposable learning database, never production.
12. On failure/cancellation report what changed. Never reset/drop volumes as automatic cleanup. Offer concept-only learning if setup is declined.

Snapshots contain no passwords, access tokens or credential-bearing connection URLs. Record facts, provenance and honest uncertainty, not command-output dumps.
