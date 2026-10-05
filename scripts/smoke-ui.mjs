#!/usr/bin/env node
// Optional real Pi TUI smoke test using an OWN tmux socket and temporary home.
// No model prompt, credential, database connection, system install or existing session is used.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configureSession } from '../src/session.mjs';
import { probe, recordObservation, atomicJSON } from '../src/core.mjs';
import { loadRuntime } from '../src/runtime.mjs';
import { isolatedEnvironment } from './smoke-support.mjs';
const useNvim = process.argv.includes('--nvim');
const useTutor = process.argv.includes('--tutor');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-ui-smoke-'));
const root = path.join(sandbox, 'workspace');
const environment = isolatedEnvironment(sandbox);
fs.mkdirSync(root);
const socket = `pi-ui-${crypto.randomUUID().slice(0, 8)}`;
const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
function tmux(...args) {
  const result = spawnSync('tmux', ['-f', '/dev/null', '-L', socket, ...args], { env: environment, encoding: 'utf8', timeout: 5000 });
  if (result.error || result.status !== 0) throw new Error(`tmux ${args[0]} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
function text(value) { tmux('send-keys', '-t', 'ui', '-l', value); }
function key(value) { tmux('send-keys', '-t', 'ui', value); }
function screen() { return tmux('capture-pane', '-p', '-t', 'ui'); }
function clickLabel(label) {
  const lines = screen().split('\n');
  const row = lines.findIndex(line => line.includes(label));
  if (row < 0) throw new Error(`Clickable label missing: ${label}`);
  const col = lines[row].indexOf(label) + Math.min(2, label.length);
  text(`\x1b[<0;${col};${row + 1}M\x1b[<0;${col};${row + 1}m`);
}
async function waitFor(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; await new Promise(r => setTimeout(r, 150)); }
  throw new Error(`Timeout: ${label}\n${screen()}`);
}
try {
  if (process.platform === 'win32') throw new Error('TUI smoke requires Linux/macOS/WSL with tmux, python3 and Pi');
  fs.copyFileSync(path.join(repo, 'AGENTS.md'), path.join(root, 'AGENTS.md'));
  fs.writeFileSync(path.join(environment.PI_CODING_AGENT_DIR, 'settings.json'), JSON.stringify({ quietStartup: true, lastChangelogVersion: '1.0.2', defaultProvider: useTutor ? 'learning-smoke' : 'openai', defaultModel: useTutor ? 'fixture' : 'gpt-5.5' }));
  configureSession(root, { topic: 'Transport Layer 9', minutes: 17, phase: 'preflight', material: 'Custom tutor material from session data.\n\nSUPPORT_DETAIL_ONLY: additional explanation and sources.', tasks: 'Perform the experiment\nExplain the observation', requirements: [], exercise: { path: 'labs/transport/attempt.conf', starter: '' } });
  if (useNvim) {
    const editor = loadRuntime(root).editor;
    const result = await probe(editor.key, editor.probe);
    if (result.status !== 'observed') throw new Error('Actual Nvim smoke requires an available editor');
    recordObservation(root, editor.key, result.status, result.evidence, result.source);
    atomicJSON(path.join(root, '.learning/workspace.json'), { editor: { args: ['--clean', '-n'] } });
    configureSession(root, { phase: 'learning' });
  }
  const env = Object.entries(environment).map(([name, value]) => `${name}=${quote(value)}`).join(' ');
  const command = `env -i ${env} pi --offline --no-extensions --no-session -e ${quote(repo)}${useTutor ? ` -e ${quote(path.join(repo, 'scripts/fixtures/tutor-provider.ts'))}` : ''}`;
  tmux('new-session', '-d', '-s', 'ui', '-x', '150', '-y', '45', '-c', root, command);
  await waitFor(() => screen().includes('Focus'), 'Pi ready');
  text('/kelas'); key('Enter');
  await waitFor(() => screen().includes('Buka workspace belajar?'), 'confirmation'); key('Enter');
  await waitFor(() => screen().includes('Perform the experiment'), 'authored lesson in workspace');
  key('M-2');
  text('printf "UI_SHELL_OK\\n"'); key('Enter');
  await waitFor(() => screen().split('\n').some(line => /│UI_SHELL_OK\s/.test(line)), 'real shell output');
  key('M-3');
  text('?');
  await waitFor(() => screen().includes('Ctrl+G'), 'on-demand help');
  text('?');
  await waitFor(() => screen().includes('Perform the experiment'), 'help returns to authored lesson');
  clickLabel('?');
  await waitFor(() => screen().includes('Ctrl+G'), 'click help tab');
  const memoryFile = path.join(root, '.learning/environment.json');
  const readMemory = () => fs.existsSync(memoryFile) ? fs.readFileSync(memoryFile, 'utf8') : undefined;
  const memoryBefore = readMemory();
  text('r');
  await waitFor(() => screen().includes('--version'), 'reviewing checks leaves help and exposes full argv');
  text('?');
  await waitFor(() => screen().includes('Selesaikan atau batalkan'), 'help cannot conceal pending approval');
  if (!screen().includes('--version')) throw new Error('Approval command disappeared behind help');
  text('n');
  await waitFor(() => !screen().includes('--version'), 'cancel pending approval');
  if (readMemory() !== memoryBefore) throw new Error('Help/review/cancel executed a probe or changed memory');
  if (screen().includes('SUPPORT_DETAIL_ONLY')) throw new Error('Summary leaked full supporting material');
  clickLabel('Detail');
  await waitFor(() => screen().includes('SUPPORT_DETAIL_ONLY'), 'click details page');
  clickLabel('Langkah');
  await waitFor(() => screen().includes('Perform the experiment'), 'click steps page');
  clickLabel('Berikutnya');
  await waitFor(() => screen().includes('Explain the observation'), 'click next task');
  clickLabel('Tandai selesai');
  await waitFor(() => screen().includes('[x] Explain the observation'), 'click task self-report');
  text('l');
  if (useNvim) await waitFor(() => screen().includes('running'), 'learner-configured timer started');
  else {
    await waitFor(() => screen().includes('Preflight belum selesai'), 'required editor blocks lesson start');
    const paused = JSON.parse(fs.readFileSync(path.join(root, '.learning/timer.json'), 'utf8'));
    if (paused.running) throw new Error('Preflight incorrectly started learning timer');
    text('p');
    await waitFor(() => screen().includes('tetap paused'), 'pause key cannot bypass preflight');
  }
  // Click the editor header; edit/save below proves actual focus rather than a status caption.
  clickLabel(useNvim ? loadRuntime(root).editor.label : 'Editor sementara');
  if (useNvim) text('i');
  text('UI_EDITOR_OK');
  // Ctrl+S leaves Nvim insert mode itself. Adjacent bare Escape + Ctrl+S
  // can be parsed as Alt+Ctrl+S by the outer terminal input protocol.
  key('C-s');
  await waitFor(() => fs.readFileSync(path.join(root, 'labs/transport/attempt.conf'), 'utf8').includes('UI_EDITOR_OK'), 'editor save');
  if (useTutor) {
    const editorPid = () => spawnSync('ps', ['-eo', 'pid,comm,args'], { encoding: 'utf8' }).stdout.split('\n').find(line => /^\s*\d+\s+nvim\s/.test(line) && line.includes(path.join(root, 'labs/transport/attempt.conf')))?.trim().split(/\s+/)[0];
    const originalPid = useNvim ? editorPid() : undefined;
    if (useNvim && !originalPid) throw new Error('Owned Nvim PID missing');
    key('M-2'); text('UI_SCOPE=keep; PRIVATE_SENTINEL=DO_NOT_SHARE_482; cd labs'); key('Enter');
    key('M-3'); text('t'); text('Kenapa langkah ini?'); key('Enter');
    await waitFor(() => screen().includes('INLINE_REPLY question'), 'in-place question answer');
    text('h');
    await waitFor(() => screen().includes('INLINE_REPLY hint'), 'in-place graduated hint');
    key('M-1'); text(useNvim ? 'A UNSAVED_ONLY' : ' UNSAVED_ONLY');
    const savedBefore = fs.readFileSync(path.join(root, 'labs/transport/attempt.conf'), 'utf8');
    if (savedBefore.includes('UNSAVED_ONLY')) throw new Error('Unexpected implicit save');
    key('C-g');
    await waitFor(() => screen().includes('UNSAVED_SEEN'), 'explicit unsaved public buffer feedback');
    if (fs.readFileSync(path.join(root, 'labs/transport/attempt.conf'), 'utf8') !== savedBefore) throw new Error('Feedback saved draft implicitly');
    if (useNvim && editorPid() !== originalPid) throw new Error('Hint/feedback replaced Nvim process');
    key('M-2'); text('printf "STATE_OK_%s_%s\\n" "$UI_SCOPE" "${PWD##*/}"'); key('Enter');
    await waitFor(() => screen().split('\n').some(line => /│STATE_OK_keep_labs\s/.test(line)), 'shell state/cwd preserved through tutor calls');
    const packets = fs.readFileSync(path.join(root, 'tutor-fixture.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    if (packets.length !== 3 || packets.some(packet => packet.goal !== 'Transport Layer 9' || packet.currentStep !== 'Explain the observation' || packet.minutes !== 17)) throw new Error('Tutor lost authored goal/current step/duration');
    if (!packets[2].history.some(turn => turn.intent === 'hint') || JSON.stringify(packets).includes('DO_NOT_SHARE_482')) throw new Error('History missing or private shell leaked');
    key('M-3'); text('t'); text('slow request'); key('Enter');
    await waitFor(() => screen().includes('Batalkan respons'), 'pending cancellable tutor');
    text('c');
    await waitFor(() => screen().includes('Permintaan dibatalkan'), 'cancel keeps workspace');
  }
  // Check responsive resize while overlay is open.
  tmux('resize-window', '-t', 'ui', '-x', '110', '-y', '35');
  await waitFor(() => screen().includes('Explain the observation'), 'authored step survives resize');
  key('C-q');
  await waitFor(() => !screen().includes('Explain the observation'), 'return to Pi');
  const timer = JSON.parse(fs.readFileSync(path.join(root, '.learning/timer.json'), 'utf8'));
  if (timer.durationMs !== 17 * 60000 || timer.running) throw new Error('Timer duration/pause state wrong');
  if (Object.keys(JSON.parse(fs.readFileSync(path.join(environment.PI_CODING_AGENT_DIR, 'auth.json'), 'utf8'))).length) throw new Error('Smoke wrote credentials');
  if (fs.readdirSync(environment.PI_CODING_AGENT_SESSION_DIR).length) throw new Error('Smoke persisted a Pi session');
  console.log(`Real Pi TUI OK: arbitrary subject + session lesson data, 3 panels, private PTY, ${useNvim ? 'actual Nvim + learner timer' : 'fallback setup editor + readiness gate'} save, direct keyboard/mouse selection + guide pages/actions/task progression, resize and return to Pi. ${useTutor ? 'Inline question/hint/unsaved feedback/cancel with offline fixture; Nvim PID and shell cwd/variables preserved; no private shell leakage.' : 'No model call.'}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  spawnSync('tmux', ['-f', '/dev/null', '-L', socket, 'kill-server'], { env: environment, stdio: 'ignore', timeout: 5000 }); // ONLY the owned test socket.
  await new Promise(resolve => setTimeout(resolve, 1500)); // Allow owned Pi/PTY shutdown writes to finish.
  fs.rmSync(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
