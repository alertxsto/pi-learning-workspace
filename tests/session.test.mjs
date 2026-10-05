import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { durationFromText, parseClassroomArgs, configureSession, rememberRequest, loadSession, sessionPrompt, ensureExercise, requirementsView, resolveProbe } from '../src/session.mjs';
import { loadTimer, timerLabel, atomicJSON, probe } from '../src/core.mjs';
import { loadRuntime } from '../src/runtime.mjs';
function temporary(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-classroom-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }

test('natural language duration preserves learner choice including correction', () => {
  assert.equal(durationFromText('gw mau belajar mysql 20 menit'), 20);
  assert.equal(durationFromText('gw suruh 20 menit tapi dia tetep ngasih 30 menit'), 20);
  assert.equal(durationFromText('ubah dari 30 menit jadi 20 menit'), 20);
  assert.equal(durationFromText('jangan 30 menit'), undefined);
  assert.equal(durationFromText('belajar mysql'), undefined);
  assert.deepEqual(parseClassroomArgs('Transport Layer 9 17'), { topic: 'Transport Layer 9', minutes: 17 });
});
test('no duration or lesson is invented', t => {
  const root = temporary(t);
  assert.match(timerLabel(root), /belum diatur/);
  assert.throws(() => configureSession(root, { topic: 'arbitrary subject' }), /tidak ada default/);
  rememberRequest(root, 'belajar Rust 23 menit');
  assert.equal(loadSession(root).topic, null); // agent chooses topic from user, not a code-level dictionary
  assert.equal(loadSession(root).material, undefined);
  assert.equal(loadSession(root).tasks, undefined);
  assert.equal(loadSession(root).exercise, undefined);
  assert.throws(() => ensureExercise(root, loadSession(root)), /belum disiapkan/);
});
test('free-form subjects, lesson data and arbitrary duration survive switches', t => {
  const root = temporary(t);
  rememberRequest(root, 'belajar selama 23 menit');
  configureSession(root, { topic: 'Transport Layer 9', material: 'User-specific explanation', tasks: 'Attempt experiment', exercise: { path: 'labs/transport/experiment.conf', starter: 'starter data' }, requirements: [{ key: 'transport-cli', label: 'Chosen experiment tool', packageName: 'user-selected-package', probe: { executable: process.execPath, args: ['--version'] } }] });
  assert.equal(loadSession(root).minutes, 23);
  assert.equal(loadTimer(root).durationMs, 23 * 60000);
  assert.equal(loadTimer(root).running, false);
  assert.match(sessionPrompt(root), /23 minutes/);
  configureSession(root, { topic: 'Bahasa Jepang — percakapan' });
  assert.equal(loadSession(root).material, undefined);
  configureSession(root, { topic: 'Transport Layer 9' });
  assert.equal(loadSession(root).material, 'User-specific explanation');
});
test('explicit exercise path/starter preserved; unsafe paths and symlinks rejected', t => {
  const root = temporary(t);
  let session = configureSession(root, { topic: 'Containers', minutes: 19, exercise: { path: 'labs/Dockerfile', starter: 'FROM scratch\n' } });
  const file = ensureExercise(root, session);
  fs.writeFileSync(file, 'learner code');
  assert.equal(ensureExercise(root, session), file);
  assert.equal(fs.readFileSync(file, 'utf8'), 'learner code');
  assert.throws(() => configureSession(root, { exercise: { path: '../outside' } }));
  const other = temporary(t);
  fs.symlinkSync(other, path.join(root, 'escape'));
  session = configureSession(root, { exercise: { path: 'escape/task.txt' } });
  assert.throws(() => ensureExercise(root, session), /escapes/);
  assert.deepEqual(fs.readdirSync(other), []);
});
test('requirements and probes are session data, not subject switch statements', async t => {
  const root = temporary(t);
  const session = configureSession(root, { topic: 'Anything new', minutes: 13, requirements: [{ key: 'custom-runtime', label: 'Custom runtime', packageName: 'Selected by tutor', probe: { executable: process.execPath, args: ['--version'] } }] });
  const rows = requirementsView(root, session);
  assert.ok(rows.some(r => r.key === 'custom-runtime' && r.status === 'unverified'));
  assert.ok(!rows.some(r => /mysql|postgres/i.test(r.key)));
  const result = await probe('custom-runtime', resolveProbe(root, 'custom-runtime'));
  assert.equal(result.status, 'observed');
});
test('runtime editor path and layout can be configured without source edits', t => {
  const root = temporary(t);
  atomicJSON(path.join(root, '.learning/workspace.json'), { editor: { executable: '/custom/nvim', key: 'editor-local', label: 'My editor', probe: { executable: '/custom/nvim', args: ['--version'] } }, layout: { guideFraction: 0.55 } });
  const runtime = loadRuntime(root);
  assert.equal(runtime.editor.executable, '/custom/nvim');
  assert.equal(runtime.layout.guideFraction, 0.55);
  assert.equal(requirementsView(root, undefined)[0].key, 'editor-local');
});
test('duration is not restricted to a lesson template or arbitrary four-hour ceiling', t => {
  const root = temporary(t);
  assert.equal(durationFromText('latihan selama 480 menit'), 480);
  configureSession(root, { topic: 'Long workshop', minutes: 480 });
  assert.equal(loadTimer(root).durationMs, 480 * 60000);
  assert.throws(() => configureSession(root, { minutes: Infinity }));
});

test('legacy session preserves a unique actual exercise, never recreates domain curriculum', t => {
  const root = temporary(t);
  fs.mkdirSync(path.join(root, 'topics/custom'), { recursive: true });
  fs.writeFileSync(path.join(root, 'topics/custom/work.any'), 'saved work');
  atomicJSON(path.join(root, '.learning/session.json'), { schemaVersion: 1, topic: 'custom', minutes: 21, phase: 'preflight', material: 'Existing material' });
  const migrated = loadSession(root);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.exercise.path, 'topics/custom/work.any');
  assert.deepEqual(migrated.requirements, []);
  assert.equal(migrated.material, 'Existing material');
});
