import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TutorCoordinator, tutorSummary, modelTutor, savedDraft } from '../src/tutor.mjs';
import { telemetryLabels } from '../src/core.mjs';
const session = { topic: 'Arbitrary subject', minutes: 20, phase: 'learning', material: 'Authored lesson, not unknown to tutor', tasks: 'Try an operation\nExplain what changed', requirements: [], exercise: { path: 'labs/work.txt' } };
function fixture(t, transport) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return new TutorCoordinator({ root, session, transport });
}
test('question/hint carries authored lesson, current step, learner history and no shell', async t => {
  const packets = [];
  const tutor = fixture(t, async (packet, { onText }) => { packets.push(packet); onText('partial'); return { text: 'one hint', usage: { cost: { total: 0.01 } } }; });
  tutor.select(1);
  assert.equal(await tutor.ask('question', 'Kenapa berubah?'), true);
  assert.equal(await tutor.ask('hint'), true);
  assert.equal(packets[0].goal, session.topic);
  assert.equal(packets[0].minutes, 20);
  assert.equal(packets[0].currentStep, 'Explain what changed');
  assert.match(packets[0].material, /Authored lesson/);
  assert.equal(packets[0].evidence, null);
  assert.match(packets[0].visibility, /private/);
  assert.equal(packets[1].history[0].question, 'Kenapa berubah?');
  assert.equal(tutor.state.history[1].assisted, true);
  assert.equal(tutor.state.cost.total, 0.02);
  const restored = new TutorCoordinator({ root: tutor.root, session, transport: tutor.transport });
  assert.equal(restored.selectedTask, 1);
  assert.equal(tutorSummary(tutor.root, session).history.length, 2);
  assert.equal(tutorSummary(tutor.root, session).currentStep, 'Explain what changed');
});
test('feedback captures unsaved public evidence without writing the exercise', async t => {
  let packet;
  const tutor = fixture(t, async input => { packet = input; return { text: 'feedback' }; });
  fs.mkdirSync(path.join(tutor.root, 'labs'));
  fs.writeFileSync(path.join(tutor.root, session.exercise.path), 'saved original');
  await tutor.ask('feedback', '', async () => ({ source: 'unsaved-buffer:labs/work.txt', text: 'learner changed buffer password=secret' }));
  assert.match(packet.evidence.draft.text, /learner changed buffer/);
  assert.doesNotMatch(packet.evidence.draft.text, /secret/);
  assert.equal(fs.readFileSync(path.join(tutor.root, session.exercise.path), 'utf8'), 'saved original');
  assert.match(tutor.state.history[0].evidence.source, /unsaved-buffer/);
});
test('busy/cancel does not launch another call and step change withholds stale feedback', async t => {
  let resolve;
  const tutor = fixture(t, async () => await new Promise(r => { resolve = r; }));
  const first = tutor.ask('hint');
  await assert.rejects(tutor.ask('question', 'another'), /masih bekerja/);
  tutor.select(1); resolve({ text: 'old step hint', usage: { cost: { total: 0.02 } } });
  assert.equal(await first, false);
  assert.equal(tutor.state.history[0].status, 'stale');
  const second = tutor.ask('hint'); tutor.cancel(); resolve({ text: 'late response', usage: { cost: { total: 0.01 } } });
  assert.equal(await second, false);
  assert.equal(tutor.state.history[1].status, 'cancelled');
  assert.equal(tutor.state.cost.total, 0.03);
});
test('editing while a captured attempt is pending marks feedback stale', async t => {
  let resolve;
  const tutor = fixture(t, async () => await new Promise(r => { resolve = r; }));
  const run = tutor.ask('feedback', '', async () => ({ source: 'unsaved-buffer', text: 'old' }));
  await new Promise(r => setImmediate(r)); tutor.touchDraft(); resolve({ text: 'old correction' });
  assert.equal(await run, false);
  assert.equal(tutor.view().latest.status, 'stale');
});
test('failed capture does not call model; close aborts outstanding work', async t => {
  let calls = 0;
  const tutor = fixture(t, async () => { calls++; return { text: 'unused' }; });
  await tutor.ask('feedback', '', async () => { throw new Error('missing snapshot'); });
  assert.equal(calls, 0); assert.equal(tutor.view().latest.status, 'error');
  tutor.close(); assert.equal(await tutor.ask('hint'), false);
});
test('nested model uses selected model, no tools, signals and normalized usage on error', async () => {
  let args;
  const result = { stopReason: 'error', errorMessage: 'provider failure', usage: { cost: { total: 0.03 } } };
  const model = { id: 'chosen-model' };
  const ctx = { model, modelRegistry: { streamSimple(...input) {
    args = input;
    return { async *[Symbol.asyncIterator]() { yield { type: 'text_delta', delta: 'partial' }; }, async result() { return result; } };
  } } };
  let text;
  const signal = new AbortController().signal;
  const response = await modelTutor(ctx, 'package policy')({ goal: session.topic }, { signal, onText: value => { text = value; } });
  assert.equal(args[0], model); assert.equal(args[2].signal, signal); assert.equal(args[1].tools, undefined);
  assert.match(args[1].systemPrompt, /NO tools/); assert.equal(text, 'partial'); assert.equal(response.failed, 'error');
  assert.equal(response.usage.cost.total, 0.03);
});
test('failed provider usage is recorded and interrupted state is resumable', async t => {
  const tutor = fixture(t, async () => ({ text: 'provider failure', failed: 'error', usage: { cost: { total: 0.01 } } }));
  await tutor.ask('question', 'Help');
  assert.equal(tutor.view().latest.status, 'error');
  assert.equal(tutor.state.cost.total, 0.01);
  tutor.state.history[0].status = 'pending'; tutor.persist();
  const restored = new TutorCoordinator({ root: tutor.root, session, transport: tutor.transport });
  assert.equal(restored.view().latest.status, 'interrupted');
});
test('saved public draft rejects symlink escape and telemetry includes nested usage once', t => {
  const tutor = fixture(t, async () => ({}));
  fs.mkdirSync(path.join(tutor.root, 'labs')); fs.symlinkSync('/etc/passwd', path.join(tutor.root, session.exercise.path));
  assert.throws(() => savedDraft(tutor.root, session), /symlink|workspace|private|public|escape/i);
  const [cost] = telemetryLabels([{ type: 'message', message: { role: 'assistant', usage: { cost: { total: 0.10 } } } }, { type: 'custom', customType: 'learning-tutor-usage', data: { usage: { cost: { total: 0.02 } } } }]);
  assert.match(cost, /0\.1200/);
});
