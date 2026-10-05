import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import learning from '../extensions/learning.ts';
import { recordObservation, enqueueEvent } from '../src/core.mjs';
import { configureSession } from '../src/session.mjs';

function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-learning-ext-'));
  const handlers = new Map(); const commands = new Map(); const tools = new Map(); const messages = []; const notices = [];
  const pi = { on: (event, handler) => handlers.set(event, handler), registerCommand: (name, spec) => commands.set(name, spec), registerTool: spec => tools.set(spec.name, spec), sendUserMessage: (text, options) => messages.push({ text, options }) };
  const ctx = { cwd: root, mode: 'print', isIdle: () => true, sessionManager: { getEntries: () => [] }, getContextUsage: () => undefined, ui: { notify: text => notices.push(text), setStatus: () => {}, setWidget: () => {} } };
  learning(pi);
  t.after(() => { handlers.get('session_shutdown')?.(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, handlers, commands, tools, messages, notices, ctx };
}

test('factory and startup do not probe or write environment', t => {
  const h = harness(t);
  assert.deepEqual(fs.readdirSync(h.root), []);
  h.handlers.get('session_start')({}, h.ctx);
  assert.deepEqual(fs.readdirSync(h.root), []);
  const event = { systemPromptOptions: { sections: {} } };
  h.handlers.get('before_agent_start')(event, h.ctx);
  assert.match(event.systemPromptOptions.sections.learning_environment, /UNKNOWN/);
  assert.deepEqual(fs.readdirSync(h.root), []);
});
test('injected snapshot is reused and doctor is memory-only', async t => {
  const h = harness(t);
  recordObservation(h.root, 'nvim', 'missing-from-path', 'historical observation', 'prior-session', null);
  const event = { systemPromptOptions: { sections: {} } };
  h.handlers.get('before_agent_start')(event, h.ctx);
  assert.match(event.systemPromptOptions.sections.learning_environment, /historical observation/);
  await h.commands.get('doctor').handler('', h.ctx);
  assert.match(h.notices.at(-1), /missing-from-path/);
});
test('bridge only invokes model on explicit send', async t => {
  const h = harness(t);
  h.handlers.get('session_start')({}, h.ctx);
  enqueueEvent(h.root, { schemaVersion: 1, kind: 'runner', text: 'test failed', createdAt: new Date().toISOString() });
  assert.equal(h.messages.length, 0);
  await h.commands.get('bridge').handler('send', h.ctx);
  assert.equal(h.messages.length, 1);
  assert.match(h.messages[0].text, /UNTRUSTED/);
  assert.equal(h.messages[0].options.deliverAs, 'followUp');
});
test('pending bridge evidence survives normal shutdown/restart', async t => {
  const h = harness(t);
  h.ctx.mode = 'tui';
  h.handlers.get('session_start')({}, h.ctx);
  enqueueEvent(h.root, { schemaVersion: 1, kind: 'runner', text: 'saved attempt', createdAt: new Date().toISOString() });
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(h.messages.length, 0);
  h.handlers.get('session_shutdown')();
  assert.ok(fs.existsSync(path.join(h.root, '.learning/pending.json')));
  h.handlers.get('session_start')({}, h.ctx);
  await h.commands.get('bridge').handler('send', h.ctx);
  assert.match(h.messages[0].text, /saved attempt/);
});

test('20-minute natural request is persisted, injected and reused by focus start', async t => {
  const h = harness(t);
  const event = { prompt: 'gw mau belajar mysql selama 20 menit', systemPromptOptions: { sections: {} } };
  h.handlers.get('before_agent_start')(event, h.ctx);
  assert.match(event.systemPromptOptions.sections.learning_session, /20 minutes/);
  await h.commands.get('focus').handler('start', h.ctx);
  const timer = JSON.parse(fs.readFileSync(path.join(h.root, '.learning/timer.json'), 'utf8'));
  assert.equal(timer.durationMs, 20 * 60000);
  assert.equal(timer.running, true);
});

test('model tool cannot silently override learner 20 minutes with 30', async t => {
  const h = harness(t);
  h.handlers.get('before_agent_start')({ prompt: 'belajar mysql 20 menit', systemPromptOptions: { sections: {} } }, h.ctx);
  await assert.rejects(h.tools.get('learning_workspace').execute('id', { topic: 'mysql', minutes: 30 }, undefined, undefined, h.ctx), /User memilih 20/);
});

test('workspace tool accepts free-form topics and requires tutor-authored lesson data', t => {
  const h = harness(t);
  const schema = h.tools.get('learning_workspace').parameters;
  assert.equal(schema.properties.topic.enum, undefined);
  for (const key of ['material', 'tasks', 'requirements', 'exercise']) assert.ok(schema.required.includes(key));
});
test('configured probe never executes until explicitly approved', async t => {
  const h = harness(t);
  const marker = path.join(h.root, 'approved-only');
  const definition = { executable: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'approved')`] };
  configureSession(h.root, { topic: 'New subject', minutes: 17, requirements: [{ key: 'custom-check', label: 'Explicitly configured command', probe: definition }] });
  await h.commands.get('env').handler('probe custom-check', h.ctx);
  assert.ok(!fs.existsSync(marker));
  assert.match(h.notices.at(-1), /explicit approval/);
  h.ctx.hasUI = true;
  h.ctx.ui.confirm = async (_title, preview) => { assert.equal(preview, JSON.stringify([definition.executable, ...definition.args])); return false; };
  await h.commands.get('env').handler('probe custom-check', h.ctx);
  assert.ok(!fs.existsSync(marker));
  h.ctx.ui.confirm = async () => true;
  await h.commands.get('env').handler('probe custom-check', h.ctx);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'approved');
});

test('preflight model report is memory-only and mandatory skill is injected before UI preparation', async t => {
  const h = harness(t);
  const marker = path.join(h.root, 'never-executed');
  const result = await h.tools.get('learning_preflight').execute('report', { requirements: [{ key: 'safe-report-only', label: 'Configured but not executed', probe: { executable: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`] } }] }, undefined, undefined, h.ctx);
  assert.equal(result.details.workspace, fs.realpathSync(h.root));
  assert.equal(result.details.memoryPresent, false);
  assert.ok(!fs.existsSync(marker));
  assert.deepEqual(fs.readdirSync(h.root), []);
  const event = { systemPromptOptions: { sections: {} } };
  h.handlers.get('before_agent_start')(event, h.ctx);
  assert.match(event.systemPromptOptions.sections.learning_preflight_contract, /learning-preflight\/SKILL.md/);
  assert.match(event.systemPromptOptions.sections.learning_preflight_contract, /Nvim is REQUIRED/);
  assert.match(event.systemPromptOptions.sections.learning_coach_contract, /learning-coach\/SKILL.md/);
  assert.match(event.systemPromptOptions.sections.learning_coach_contract, /inside the workspace/);
});
test('focus start and resume cannot bypass unknown prerequisites of an actual lesson', async t => {
  const h = harness(t);
  configureSession(h.root, { topic: 'Hands-on subject', minutes: 20 });
  for (const action of ['start', 'resume']) {
    await h.commands.get('focus').handler(action, h.ctx);
    assert.match(h.notices.at(-1), /Preflight belum selesai/);
    const timer = JSON.parse(fs.readFileSync(path.join(h.root, '.learning/timer.json'), 'utf8'));
    assert.equal(timer.running, false);
  }
});

test('model cannot open lesson UI without a preflight report in the current agent run', async t => {
  const h = harness(t);
  const params = { topic: 'Subject', material: 'Setup', tasks: 'Verify', requirements: [], exercise: { path: 'notes/setup.md' } };
  await assert.rejects(h.tools.get('learning_workspace').execute('ui', params, undefined, undefined, h.ctx), /CALL learning_preflight/);
  await assert.rejects(h.tools.get('learning_workspace').execute('ui', { ...params, minutes: 20 }, undefined, undefined, h.ctx), /Jangan mengarang proposal menit/);
  await h.tools.get('learning_preflight').execute('report', {}, undefined, undefined, h.ctx);
  h.handlers.get('before_agent_start')({ systemPromptOptions: { sections: {} } }, h.ctx);
  await assert.rejects(h.tools.get('learning_workspace').execute('ui', params, undefined, undefined, h.ctx), /CALL learning_preflight/);
  assert.deepEqual(fs.readdirSync(h.root), []);
});

test('preflight refuses noninteractive mode without spawning shell', async t => {
  const h = harness(t);
  await h.commands.get('preflight').handler('', h.ctx);
  assert.match(h.notices.at(-1), /Requires Pi interactive TUI/);
});
