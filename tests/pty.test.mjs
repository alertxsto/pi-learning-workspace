import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrivateTerminal } from '../src/pty.mjs';

async function waitFor(predicate, description, milliseconds = 5000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); }
  throw new Error(`Timed out: ${description}`);
}
function terminal(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-pty-test-'));
  const tty = new PrivateTerminal({ executable: '/bin/bash', args: ['--noprofile', '--norc', '-i'], cwd: root, cols: 120, rows: 25, env: { HOME: root, HISTFILE: '/dev/null', PS1: 'TEST> ' } });
  t.after(() => { tty.close(); fs.rmSync(root, { recursive: true, force: true }); });
  tty.testRoot = root;
  return tty;
}
const screen = tty => tty.lines().join('\n').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
const hasLine = (tty, text) => screen(tty).split('\n').some(line => line.trim() === text);

test('real PTY: child stdin and stdout are TTY; resize reaches stty', { skip: process.platform === 'win32' }, async t => {
  const tty = terminal(t);
  await waitFor(() => tty.ready, 'PTY ready');
  tty.resize(100, 18);
  tty.input('test -t 0 && test -t 1 && printf "REAL_TTY_OK\\n"; stty size\r');
  await waitFor(() => screen(tty).includes('18 100'), 'stty resize');
  assert.match(screen(tty), /REAL_TTY_OK/);
});
test('Ctrl+C interrupts foreground process without destroying shell', { skip: process.platform === 'win32' }, async t => {
  const tty = terminal(t);
  await waitFor(() => tty.ready, 'PTY ready');
  tty.input('sleep 30\r');
  await new Promise(resolve => setTimeout(resolve, 150));
  tty.input('\x03');
  tty.input('printf "SHELL_SURVIVED\\n"\r');
  await waitFor(() => hasLine(tty, 'SHELL_SURVIVED'), 'shell after interrupt');
  assert.equal(tty.exited, false);
});
test('viewport cache reuses unchanged frames and invalidates on output and resize', { skip: process.platform === 'win32' }, async t => {
  const tty = terminal(t);
  await waitFor(() => screen(tty).includes('TEST>'), 'initial prompt');
  const first = tty.lines({ cursor: true });
  assert.equal(tty.lines({ cursor: true }), first);
  tty.input('printf "CACHE_CHANGED\\n"\r');
  await waitFor(() => hasLine(tty, 'CACHE_CHANGED'), 'new output');
  assert.notEqual(tty.lines({ cursor: true }), first);
  const second = tty.lines();
  tty.resize(90, 18);
  assert.notEqual(tty.lines(), second);
  assert.equal(tty.lines().length, 18);
});

test('silent password input is not rendered and no transport log file is created', { skip: process.platform === 'win32' }, async t => {
  const tty = terminal(t);
  await waitFor(() => tty.ready, 'PTY ready');
  tty.input('read -s -p "Password: " value; printf "\\nREAD_FINISHED\\n"\r');
  await waitFor(() => screen(tty).includes('Password:'), 'password prompt');
  await new Promise(resolve => setTimeout(resolve, 100));
  tty.input('synthetic-password-123\r');
  await waitFor(() => hasLine(tty, 'READ_FINISHED'), 'password read finished');
  assert.ok(!screen(tty).includes('synthetic-password-123'));
  assert.deepEqual(fs.readdirSync(tty.testRoot), []);
});
