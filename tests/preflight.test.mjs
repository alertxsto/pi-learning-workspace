import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configureSession, preflightReport, preflightBlockers } from '../src/session.mjs';
import { recordObservation, loadTimer, timerAction, atomicJSON } from '../src/core.mjs';
import { loadRuntime } from '../src/runtime.mjs';
function temporary(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-preflight-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
function editorReady(root) { recordObservation(root, loadRuntime(root).editor.key, 'observed', 'Test fixture editor version', 'test-fixture'); }

test('wrong workspace reports missing memory, never assumes missing packages or imports sibling state', t => {
  const correct = temporary(t), wrong = temporary(t);
  editorReady(correct);
  const report = preflightReport(wrong);
  assert.equal(report.workspace, fs.realpathSync(wrong));
  assert.equal(report.memoryPresent, false);
  assert.equal(report.requirements[0].status, 'unverified');
  assert.match(report.warning, /Missing memory is not missing packages/);
  assert.deepEqual(fs.readdirSync(wrong), []);
  assert.equal(preflightReport(correct).requirements[0].status, 'observed');
});
test('canonical keys reuse scoped evidence instead of turning installed tools into invented unknown aliases', t => {
  const root = temporary(t); editorReady(root);
  recordObservation(root, 'known-client', 'observed', 'Scoped client version', 'test-fixture');
  configureSession(root, { topic: 'Free subject', minutes: 20 });
  const req = { key: 'known-client', label: 'Required client', required: true, acceptedStatuses: ['observed'] };
  const report = preflightReport(root, [req]);
  assert.equal(report.minutes, 20);
  assert.equal(report.requirements.find(row => row.key === req.key).status, 'observed');
  assert.equal(report.blockers.length, 0);
  assert.equal(preflightReport(root, [{ ...req, key: 'invented-client' }]).blockers[0].status, 'unverified');
});
test('Nvim cannot be waived as optional to start a hands-on lesson through fallback', t => {
  const root = temporary(t), editor = loadRuntime(root).editor;
  const session = configureSession(root, { topic: 'Anything', minutes: 20, requirements: [{ key: editor.key, label: 'Optional editor', required: false }] });
  assert.equal(preflightBlockers(root, session)[0].required, true);
  assert.throws(() => configureSession(root, { phase: 'learning' }), /Preflight belum selesai/);
  assert.equal(loadTimer(root).running, false);
});
test('version-level observed evidence cannot satisfy authenticated/task readiness', t => {
  const root = temporary(t); editorReady(root);
  configureSession(root, { topic: 'Target operation', minutes: 20, requirements: [{ key: 'target-access', label: 'Approved target access', required: true, acceptedStatuses: ['ready'], probe: { executable: process.execPath, args: ['--version'] } }] });
  recordObservation(root, 'target-access', 'observed', 'Client version only', 'test-fixture');
  assert.throws(() => configureSession(root, { phase: 'learning' }), /target-access/);
  recordObservation(root, 'target-access', 'ready', 'Fixture: approved target operation succeeded, no credentials', 'test-fixture');
  assert.equal(configureSession(root, { phase: 'learning' }).phase, 'learning');
  assert.equal(loadTimer(root).running, false); // readiness doesn't consume learning time
});
test('implicit preflight configuration pauses an existing timer, not just explicit phase selection', t => {
  const root = temporary(t);
  configureSession(root, { topic: 'Setup', minutes: 20 });
  atomicJSON(path.join(root, '.learning/timer.json'), timerAction(undefined, 'start', 20));
  configureSession(root, { packages: 'Setup not complete' });
  assert.equal(loadTimer(root).running, false);
});

test('explicit optional future capability is not a blocker, but unknown mandatory capability is', t => {
  const root = temporary(t); editorReady(root);
  let session = configureSession(root, { topic: 'Task', minutes: 17, requirements: [{ key: 'future-runtime', label: 'Future optional runtime', required: false }] });
  assert.deepEqual(preflightBlockers(root, session), []);
  session = configureSession(root, { requirements: [{ key: 'needed-runtime', label: 'Runtime for current task', required: true }] });
  assert.equal(preflightBlockers(root, session)[0].key, 'needed-runtime');
});
