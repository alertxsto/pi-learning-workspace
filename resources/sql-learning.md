# SQL learning resources — researched seed, not a fixed course

Checked 2026-10-04 by fetching public pages with curl. HTTP/page-title checks and selected page text were inspected; interactive browser execution, account/paywall flows and full course contents were not tested. Choose sections from the learner's actual goal and client/server identity; do not load all resources into every lesson or regard these as local readiness evidence.

## Recommended starting pair

### Official correctness reference: MySQL tutorial
- URL: https://dev.mysql.com/doc/refman/8.4/en/tutorial.html
- Checked: HTTP 200; title `MySQL :: MySQL 8.4 Reference Manual :: 5 Tutorial`.
- Role: source-backed MySQL concepts and database/table/query behavior; use the relevant small section, not the entire chapter as homework.
- Fit: learner specifically targeting MySQL, especially connecting and working with actual tables before progressively richer queries.
- Limitation: reference targets MySQL 8.4. Identify the real server/client first; a binary named mysql can be MariaDB. This is not an interactive substitute for the workspace or proof that a server/account is ready.

### Official reference if the actual target is MariaDB
- URL: https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/select
- Checked: HTTP 200; title `SELECT | Server | MariaDB Documentation`.
- Role: dialect-correct SELECT syntax/reference if identity checks establish MariaDB rather than MySQL.
- Limitation: reference material, not a novice interactive course or proof of the installed server version. Select only the relevant syntax/concept and verify version applicability.

### Interactive basic attempts: SQLBolt
- URL: https://sqlbolt.com/
- Initial SELECT section: https://sqlbolt.com/lesson/select_queries_introduction
- Checked: landing and SELECT lesson pages available; lesson page includes SELECT instruction and interactive-exercise navigation.
- Role: small concept/attempt units, useful for SELECT, constraints/filtering and subsequent progression.
- Fit: novice who benefits from trying a query and seeing a result before a larger local exercise.
- Limitation: not a guarantee of exact MySQL dialect/version behavior. Verify the site's execution environment where relevant; adapt dialect-specific syntax to the actual local target. Do not copy the whole exercise set/answers into the learner's starter.
- Suggested workflow: use one relevant section, ask learner prediction/attempt, then generate a comparable ORIGINAL local transfer task with approved public data. Browser success does not clear local preflight.

## Alternatives, selected only when appropriate

### SQLZoo SELECT basics
- URL: https://sqlzoo.net/wiki/SELECT_basics
- Checked: HTTP 200; title `SELECT basics - SQLZoo`.
- Role: further SELECT practice and comparison with a different exercise source.
- Fit: transfer/retrieval after an initial explanation rather than another large reading list.
- Limitation: verify the selected engine and current exercise behavior in the browser. Do not assume the page exactly matches the learner's MySQL/MariaDB version or local fixture.

### SQL Practice
- URL: https://www.sql-practice.com/
- Checked: HTTP 200; title advertises an online SQL terminal/practice site. The browser application itself was not exercised; later content inspection did not establish engine/version.
- Role: possible additional data/query practice after basic attempts.
- Limitation: engine, exact feature availability, account/paywall conditions and compatibility must be verified before relying on it for a lesson. Keep recommendation provisional for these properties; use only public example data.

### DB Fiddle
- URL: https://www.db-fiddle.com/
- Checked: HTTP 200; title `DB Fiddle - SQL Database Playground`.
- Role: candidate browser playground for a small public schema/query comparison when a local target is deliberately unavailable.
- Limitation: supported engine/version selections and sharing/persistence behavior were not tested. Confirm these in browser before recommending a specific dialect. Never upload credentials, private database dumps or production data. This requires explicit agreement if replacing local hands-on practice.

## Verification failure recorded

A candidate MariaDB SELECT-guide URL returned HTTP 404 during this research. That failed URL is not recommended. A replacement official SELECT-reference URL above was subsequently verified with HTTP 200/title. Do not pretend the MySQL 8.4 reference is identical to MariaDB.

## Tutor selection rubric

For the current beginner SQL goal, start with one official reference section and one small interactive exercise. Choose a different reference if actual identity/version differs. Explain prerequisites, dialect differences, public-data/privacy constraints and the expected learner action. Keep an optional alternative for transfer, not a wall of five links. For non-SQL topics, research new resources: this file is knowledge/provenance outside the generic engine, not a hardcoded topic registry.
