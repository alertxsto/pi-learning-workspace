#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { atomicJSON } from '../src/core.mjs';
import { loadRuntime } from '../src/runtime.mjs';

const source = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const usage = 'Usage: pi-learning init [workspace]\n       pi-learning start [workspace] [-- <Pi args...>]\n       pi-learning install\n       pi-learning doctor [workspace]';
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";

function runPi(args, cwd) {
  const result = spawnSync('pi', args, { cwd, stdio: 'inherit' });
  if (result.error) throw new Error(`Could not launch Pi: ${result.error.message}. Install Pi and make sure pi is on PATH.`);
  if (result.signal) {
    // Preserve signal termination rather than reporting a successful launcher exit.
    process.kill(process.pid, result.signal);
    process.exitCode = 1;
  } else process.exitCode = result.status ?? 1;
}

function initialize(root) {
  fs.mkdirSync(root, { recursive: true });
  for (const directory of ['topics', 'sources', 'wiki']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.mkdirSync(path.join(root, '.learning/inbox'), { recursive: true, mode: 0o700 });
  const absent = file => !fs.lstatSync(file, { throwIfNoEntry: false });
  if (absent(path.join(root, 'AGENTS.md'))) fs.copyFileSync(path.join(source, 'AGENTS.md'), path.join(root, 'AGENTS.md'), fs.constants.COPYFILE_EXCL);
  if (absent(path.join(root, '.learning/environment.json'))) atomicJSON(path.join(root, '.learning/environment.json'), { schemaVersion: 1, scope: 'execution-scope-not-yet-recorded', observations: {} });
  const notes = {
    'learner.md': '# Learner\n\nGoals, available time and confirmed preferences: not recorded yet.\n',
    'progress.md': '# Progress\n\nNo completed exercise evidence yet.\n',
    'misconceptions.md': '# Misconceptions\n\nRecord specific gaps and evidence, not labels about the learner.\n',
    'reviews.md': '# Reviews\n\nNo review scheduled yet.\n',
  };
  for (const [file, text] of Object.entries(notes)) if (absent(path.join(root, file))) fs.writeFileSync(path.join(root, file), text, { flag: 'wx' });
  console.log(`Initialized ${root}. No environment probe/install was performed.\nStart: pi-learning start ${quote(root)}\nOr: node ${quote(fileURLToPath(import.meta.url))} start ${quote(root)}`);
}

function doctor(root) {
  const runtime = loadRuntime(root);
  const [major, minor] = process.versions.node.split('.').map(Number);
  let failed = major < 22 || (major === 22 && minor < 19);
  console.log(`Workspace: ${root}\n${failed ? 'FAIL' : 'OK'} Node ${process.versions.node} (requires >=22.19)`);
  const checks = [
    ['Pi', 'pi', ['--version']],
    ['Neovim', runtime.editor.executable, ['--version']],
    ['Python POSIX PTY modules', runtime.transport.executable, ['-c', 'import sys, pty, termios, fcntl, select, struct; print(sys.version.split()[0])']],
  ];
  for (const [label, executable, args] of checks) {
    const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
    const ok = !result.error && result.status === 0;
    failed ||= !ok;
    const detail = ok ? result.stdout.trim().split('\n')[0] : result.error?.message || result.stderr?.trim() || `exit ${result.status}, signal ${result.signal ?? 'none'}`;
    console.log(`${ok ? 'OK' : 'FAIL'} ${label} (${executable}): ${detail}`);
  }
  console.log('Only these local prerequisites were checked. No memory was updated, no task/database readiness was established, and no scan, network check or installation was performed.');
  process.exitCode = failed ? 1 : 0;
}

try {
  const [action, ...args] = process.argv.slice(2);
  if (!action || action === '--help' || action === '-h') {
    if (args.length) throw new Error(usage);
    console.log(usage);
  } else {
    if (!['init', 'start', 'install', 'doctor'].includes(action)) throw new Error(`Unknown command: ${action}\n${usage}`);
    if (process.platform === 'win32') throw new Error('Use Linux, macOS or WSL. Native Windows is not supported.');
    const separator = args.indexOf('--');
    const workspaceArgs = separator < 0 ? args : args.slice(0, separator);
    if (workspaceArgs.length > (action === 'install' ? 0 : 1) || workspaceArgs.some(arg => arg.startsWith('-')) || (separator >= 0 && action !== 'start')) throw new Error(usage);
    const root = path.resolve(workspaceArgs[0] ?? (action === 'init' ? path.join(os.homedir(), 'belajar') : process.cwd()));
    if (action === 'init') initialize(root);
    else if (action === 'install') runPi(['install', source]);
    else {
      if (!fs.statSync(root).isDirectory()) throw new Error(`Workspace is not a directory: ${root}`);
      if (action === 'doctor') doctor(root);
      else runPi(['-e', source, ...(separator < 0 ? [] : args.slice(separator + 1))], root);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
