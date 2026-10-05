# Operational preflight protocol

This is a decision procedure for the tutor, not a canned curriculum, automatic install script or permission boundary. Subject requirements and setup commands are authored from current goals and evidence.

## 1. Workspace and scope first

Use the `learning_preflight` memory-only tool before launching any learning UI. It returns the actual Pi workspace path, snapshot presence, observation keys/status/provenance, duration, and gaps. Reading known state is not permission to scan the system.

Check three identities:
1. Where Pi is running and where its extension stores `.learning/`.
2. The learner-confirmed workspace, notes/drafts and environment memory.
3. Where the command will execute: host, WSL, container or remote target.

Do not mix these. Shell `cd` changes that child shell, not Pi's ctx.cwd. A missing local snapshot is not proof of missing packages. No auto-discovery of every sibling directory/home. Consult only learner-confirmed paths. If the wrong Pi cwd is confirmed, preserve current drafts, explain how to restart Pi in the chosen directory and resume; don't silently move/copy state or claim a shell cd repaired it.

A user reporting "Nvim installed" warrants an explicit single editor probe if no scoped evidence exists, not reinstalling Nvim or scanning every dependency. Cached positive facts can be reused unless stale, contradicted, scoped to another host/target, or insufficient for the proposed action. A historical binary PATH fact is not a current version/readiness claim.

## 2. Intake without repetition

Read authoritative session minutes and confirmed preferences. Ask only for missing goal/outcome, prior knowledge, time or target. "Twenty minutes" stated earlier is confirmed duration, not a tutor estimate. No default duration. Keep setup time separate; ask explicitly before charging it against learning time. A separate setup-time budget UI is not implemented: explain that limitation rather than pretending P/resume can bypass the learning gate.

A topic name alone is not enough to define exercise permissions. Clarify the smallest intended runnable outcome and its execution target, not every possible future setup choice. If the learner has already chosen these, reuse them.

## 3. Requirements are evidence questions

Construct a small dependency/evidence map for the intended action:

| Role | Question | Evidence needed |
|---|---|---|
| Editor | Can the learner use their chosen Nvim in this scope? | Scoped executable/version plus actual start if needed |
| Client/tool | Is the intended executable/version available? | Version/discovery evidence under the existing canonical key |
| Runtime | Can the runtime execute the intended operation? | Bounded operational check, not binary presence |
| Target | Is this the approved endpoint/workspace/data set? | Learner choice and scoped reachability/readiness |
| Authentication | Can this learner identity access the chosen target? | Credential-safe actual login/read operation |
| Permission | Can the exercise operation run safely? | Read/write/create rights needed by this exercise, checked in approved disposable scope |
| Fixture | Is the agreed public exercise data present? | Actual fixture/check output; never an invented table |

Only include relevant roles; not every lesson needs a server. Editor is required in this hands-on workspace. An optional runtime for a future exercise must be explicitly optional, not a blocker for today's outcome. An essential target cannot be marked optional to force the UI into learning.

Keys identify evidence, not display names. Map existing facts deliberately: a client key already in memory should not be replaced by a new invented alias that reads as unknown. A new target/login/permission key may legitimately be unknown despite installed tools. Keep targets distinct: a prior login to target A doesn't prove access to target B.

Return a short learner-facing table: capability, evidence/status/scope, blocking gap, next action. Say "not checked" instead of "not installed" when that's all the evidence supports.

## 4. Checks versus changes

Read-only version/discovery checks need explicit approval of shown executable/argv. Describe the scope and expected interpretation. Use R in the preflight guide to review configured probes and Y to approve. No action occurs on merely opening the screen. CLI `/env probe <key>` also asks approval.

A probe returning exit zero is `observed`; do not promote it to a different semantic fact. `acceptedStatuses` for a required binary can include `observed`. Operational/auth/access requirements should require `ready` backed by relevant evidence, usually recorded from a private/manual check. Checkbox completion never updates readiness.

Install/image pull/service start/database or user creation/write/drop/reset are changes, not discovery probes. Before them show:
- exact change and why needed;
- local versus container versus approved remote scope;
- admin rights, downloads and resource estimates if known;
- affected path/data/port;
- known persistence/cleanup and alternatives;
- what refusing or cancelling means.

Ask explicit approval before execution. No automatic install buttons or hidden scripts. Reuse existing resources when appropriate; don't install a second server because a client/version check succeeded or failed. Do not infer package manager from a vague host label: use trusted OS memory or an approved minimal relevant check, then consult applicable documentation.

## 5. Actual preflight screen

Open `learning_workspace` with phase `preflight`. Content must reflect the current blockers:
- `material`: why the dependency is needed, scope/target choices, steps and interpretation of success/failure;
- `tasks`: setup and verification steps, not assessed practice questions;
- `packages`: relevant package choices and explicit no-install-until-approved status;
- `requirements`: the actual evidence map, with blocking semantics;
- `exercise`: a public setup-notes/decision record, no credentials or learner-answer overwrite.

Do not generate a SQL quiz, reading assignment or table fixture just to fill the editor during setup. It is fine for setup notes to be sparse while one necessary decision is pending. Say what to do next before opening, and give the direct panel shortcuts/return control. Preflight is not just a phase label on a complete lesson.

Fallback editor is a temporary means to take setup notes when Nvim is unavailable. It does not change the learner's Nvim choice, make Nvim optional, or meet the hands-on exit gate. If the learner explicitly chooses a concept-only alternative, offer a separately agreed chat/concept outcome and explain what's not verified; this does not clear the Nvim-required hands-on UI gate. Don't auto-downgrade.

## 6. Private setup and credentials

Use the real private shell for credential prompts. Never request secrets in chat, inline argv, lesson content, shell runner capture or environment memory. Explain that external terminal/screen recorders and commands that echo secrets are outside the extension's control. Do not send private command input/output to the model.

TUTOR supports inline questions/hints using the selected model and shared public context without closing the workspace. Ask there for ordinary setup help; supply only public/sanitized observations. Ctrl+G shares the public exercise-buffer snapshot, NOT private shell output. The inline tutor has no execution/search tools; actual new-lesson authoring still uses an explicit parent handoff. The tutor has not watched the private shell. Never fabricate command results, installations, login success, fixture creation or package versions.

Record minimal sanitized facts using `/env record <key> <status> <evidence>` or validated state updates. Include actual provenance/time, target/scope and what the operation established. Manual evidence remains manual evidence, not independently observed stdout. Never use shell `--share` for setup/authentication.

## 7. Failure and recovery

- PATH missing: check known installation location/alias or an approved alternative scope before suggesting installation. Do not broad-find every file.
- Runtime failure: distinguish service stopped, daemon/socket permissions and wrong scope; ask before starts or privilege changes.
- Connection failure: check only the approved target. No port/subnet scanning.
- Login failure: use private prompts and explain account/target mismatch; don't paste passwords or reset accounts automatically.
- Permission failure: adapt exercise to approved existing capabilities or ask for minimal approved training privileges. Never operate on production to prove readiness.
- Cancelled setup: stop further changes; describe known completed effects. Cancellation is not rollback. Destructive cleanup needs separate approval.
- Save/UI failure: preserve learner draft and state; don't regenerate/overwrite answers to recover.
- Changed target/config/scope: invalidate relevant facts before reuse; freshness/scope automation is incomplete, so the tutor must perform this reasoning explicitly.

## 8. Database worked example — reasoning, not registry

For a requested database exercise, the tutor derives actual requirements from the requested dialect/action/target. Do not assume MySQL and MariaDB are the same because the executable is named mysql. An installed client, live server, successful login and permission to create/write a training table are four different facts.

Examples of misleading evidence:
- `pg_isready` reports readiness, not learner login.
- `mysqladmin ping` may return success on Access denied.
- `SELECT 1` establishes a query on one authenticated connection, not create-table rights or exercise fixture existence.
- An illustrated table in material is not a table created in the database.

Ask whether to use an existing approved local server, dedicated disposable container or specified remote training target. Explain downloads/ports/storage and obtain approval if provisioning. Verify identity/version, actual connection, learner access, exercise-specific permissions and fixture separately. Use passwords only via private prompts or appropriate existing credential mechanisms, never saved lesson argv.

These examples do not register commands or install packages. Requirements for other subjects follow the same evidence reasoning, authored as data.

## 9. Exit gate and learner handoff

Before learning:
1. Workspace and execution scope are reconciled.
2. Required capabilities have relevant evidence matching their accepted status.
3. The configured Nvim has positive availability evidence; fallback doesn't waive it.
4. Intended target, required login/permission and fixture are established if relevant.
5. Remaining optional gaps are explained as optional.
6. Known changes are summarized, with safe stop/cleanup instructions where relevant.
7. Exact learner minutes remain unchanged; learning timer is still paused.
8. Learner explicitly chooses to start.

Then prepare the lesson/attempt/checks without overwriting prior work, and open phase `learning`. Runtime guard rejects required gaps for phase changes and starting learning timer. A model can still author an incomplete requirement map; the skill must not omit prerequisites to evade this gate. This is a correctness guard, not a sandbox or a universal automated semantic verifier.

## 10. Acceptance checklist for the tutor

- Correct workspace reported, not assumed from a shell prompt.
- Cached package/editor facts reused under consistent keys.
- Only necessary unknown/stale facts probed, with approval.
- Real setup screen before exercises, with a concrete next step.
- No Nvim opt-out, unapproved downgrade or fictitious ready status.
- Credential-safe private shell workflow; no imagined monitoring.
- Learning blocked until required evidence exists.
- Duration choice preserved and setup time separated.
- Direct focus controls explained; native Tab preserved.
- Learner drafts and memory preserved on failure/restart.
