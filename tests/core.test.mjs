import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atomicJSON, loadSnapshot, validateSnapshot, environmentPrompt, recordObservation, doctor, probe, safeWorkspaceFile, redact, enqueueEvent, drainEvents, MAX_QUEUE, timerAction, telemetryLabels } from '../src/core.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function temporary(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-learning-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }

test('memory absent stays unknown and does not create files', t => {
  const root = temporary(t);
  assert.equal(loadSnapshot(root), undefined);
  assert.match(environmentPrompt(undefined), /do NOT full-scan/);
  assert.deepEqual(fs.readdirSync(root), []);
  assert.equal(doctor(undefined, [{ key: 'custom-tool', label: 'Custom tool' }])[0].status, 'unverified');
});
test('snapshot preserves honest historical timestamp and scoped evidence', t => {
  const root = temporary(t);
  recordObservation(root, 'nvim', 'missing-from-path', 'not in PATH', 'prior-session', null);
  const snapshot = loadSnapshot(root);
  assert.equal(snapshot.observations.nvim.observedAt, null);
  assert.equal(doctor(snapshot, [{ key: 'nvim', label: 'Editor' }])[0].status, 'missing-from-path');
  assert.match(environmentPrompt(snapshot), /not live truth/);
});
test('invalid snapshot/schema cannot be injected', () => {
  assert.throws(() => validateSnapshot({ schemaVersion: 2, observations: {} }));
  assert.throws(() => validateSnapshot({ schemaVersion: 1, scope: 'local', observations: { x: { status: 'installed' } } }));
});
test('redacts common credentials and terminal escape sequences', () => {
  const output = redact('password=abc token: xyz postgresql://user:pass@host/db ghp_abcdef\x1b[31mred\x1b[0m');
  assert.ok(!output.includes('abc')); assert.ok(!output.includes('xyz')); assert.ok(!output.includes('user:pass'));
  assert.ok(!output.includes('ghp_')); assert.ok(!output.includes('\x1b'));
});
test('private files, traversal and symlink escapes excluded', t => {
  const root = temporary(t); const external = temporary(t);
  fs.writeFileSync(path.join(root, 'exercise.sql'), 'SELECT 1;');
  fs.writeFileSync(path.join(root, '.env'), 'password');
  fs.writeFileSync(path.join(external, 'other.sql'), 'SELECT 2;');
  fs.symlinkSync(path.join(external, 'other.sql'), path.join(root, 'escape.sql'));
  assert.throws(() => safeWorkspaceFile(root, '.env'));
  assert.throws(() => safeWorkspaceFile(root, '../exercise.sql'));
  assert.throws(() => safeWorkspaceFile(root, 'escape.sql'));
});
test('bounded bridge queue redacts content and rejects invalid events', t => {
  const root = temporary(t);
  const event = { schemaVersion: 1, kind: 'runner', text: 'token=abc', createdAt: new Date().toISOString() };
  for (let i = 0; i < MAX_QUEUE; i++) enqueueEvent(root, event);
  assert.throws(() => enqueueEvent(root, event), /full/);
  const result = drainEvents(root);
  assert.equal(result.events.length, MAX_QUEUE);
  assert.ok(result.events.every(e => !e.text.includes('abc')));
  assert.equal(drainEvents(root).events.length, 0);
  assert.throws(() => enqueueEvent(root, { ...event, kind: 'execute' }));
  atomicJSON(path.join(root, '.learning/inbox/123-abcdef.json'), { schemaVersion: 1 });
  assert.equal(drainEvents(root).rejected, 1);
});
test('timer pause/resume preserves remaining time, expiration is nondestructive', () => {
  let timer = timerAction(undefined, 'start', 1, 1000);
  timer = timerAction(timer, 'pause', undefined, 11000);
  assert.equal(timer.remainingMs, 50000);
  timer = timerAction(timer, 'resume', undefined, 50000);
  assert.equal(timerAction(timer, 'status', undefined, 100001).remainingMs, 0);
  assert.equal(timerAction(timer, 'status', undefined, 100001).running, false);
  assert.throws(() => timerAction(timer, 'start', 0));
});
test('telemetry labels unknown and partial cost without claiming actual billing', () => {
  const unknown = telemetryLabels([], { tokens: null, contextWindow: 200000 });
  assert.match(unknown[0], /belum ada/);
  assert.match(unknown[1], /belum diketahui/);
  const labels = telemetryLabels([
    { type: 'message', message: { role: 'assistant', usage: { cost: { total: 0.12 } } } },
    { type: 'message', message: { role: 'assistant' } },
  ], { tokens: 24000, contextWindow: 200000 });
  assert.match(labels[0], /\$0\.1200 \(parsial\)/);
  assert.match(labels[0], /bukan tagihan aktual/);
  assert.match(labels[1], /12\.0%/);
});

test('unsupported probe does not execute arbitrary commands', async () => {
  await assert.rejects(probe('uname; rm -rf /'), /Unsupported/);
});
test('workspace init is idempotent, no probes or overwrites of learner work', t => {
  const root = path.join(temporary(t), "learner's workspace");
  const run = () => spawnSync(process.execPath, [path.join(repo, 'scripts/learn.mjs'), 'init', root], { encoding: 'utf8' });
  assert.equal(run().status, 0);
  assert.deepEqual(loadSnapshot(root).observations, {});
  fs.writeFileSync(path.join(root, 'progress.md'), 'my progress');
  fs.writeFileSync(path.join(root, 'learner.md'), 'my goals');
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'my instructions');
  fs.writeFileSync(path.join(root, '.learning/workspace.json'), '{"editor":{"executable":"my-nvim"}}');
  recordObservation(root, 'nvim', 'observed', 'learner-confirmed version', 'my-workspace');
  const memory = fs.readFileSync(path.join(root, '.learning/environment.json'), 'utf8');
  assert.equal(run().status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'progress.md'), 'utf8'), 'my progress');
  assert.equal(fs.readFileSync(path.join(root, 'learner.md'), 'utf8'), 'my goals');
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), 'my instructions');
  assert.equal(fs.readFileSync(path.join(root, '.learning/workspace.json'), 'utf8'), '{"editor":{"executable":"my-nvim"}}');
  assert.equal(fs.readFileSync(path.join(root, '.learning/environment.json'), 'utf8'), memory);
  assert.equal(fs.existsSync(path.join(root, '.learning-source')), false);
});
test('runner opt-in emits public evidence but omits argv and credentials', t => {
  const root = temporary(t);
  const result = spawnSync(process.execPath, [path.join(repo, 'scripts/run.mjs'), root, '--share', '--', process.execPath, '-e', 'console.log("password=abc");'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const event = drainEvents(root).events[0];
  assert.ok(!event.text.includes('abc')); assert.match(event.text, /exit=0/);
  assert.ok(!event.text.includes('console.log'));
});
test('runner without share never queues output', t => {
  const root = temporary(t);
  const result = spawnSync(process.execPath, [path.join(repo, 'scripts/run.mjs'), root, '--', process.execPath, '-e', 'console.log("hello")'], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(drainEvents(root).events.length, 0);
});
test('runner timeout is recorded as timeout, not success', t => {
  const root = temporary(t);
  const result = spawnSync(process.execPath, [path.join(repo, 'scripts/run.mjs'), root, '--share', '--timeout=1', '--', process.execPath, '-e', 'setInterval(()=>{}, 100)'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 124);
  assert.match(drainEvents(root).events[0].text, /timeout=true/);
});
