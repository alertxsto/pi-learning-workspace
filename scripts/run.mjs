#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';
import { enqueueEvent, redact } from '../src/core.mjs';

// Explicit public exercise runner. Never use --share for credential-sensitive commands.
const args = process.argv.slice(2);
const divider = args.indexOf('--');
try {
  if (divider < 1 || !args[divider + 1]) throw new Error('Usage: run.mjs <workspace> [--share] [--timeout=60] -- <executable> [args...]');
  const root = path.resolve(args[0]);
  const flags = args.slice(1, divider);
  if (flags.some(f => f !== '--share' && !/^--timeout=\d+$/.test(f))) throw new Error('Unknown runner option');
  const share = flags.includes('--share');
  const seconds = Number(flags.find(f => f.startsWith('--timeout='))?.split('=')[1] ?? 60);
  if (seconds < 1 || seconds > 600) throw new Error('Timeout must be 1..600 seconds');
  const [command, ...commandArgs] = args.slice(divider + 1);
  if (share) console.error('Opt-in capture: public exercises ONLY. Up to 8 KiB output will be queued. Redaction is best-effort; no guarantee for arbitrary secrets. Use /preflight for credential prompts.');
  const child = spawn(command, commandArgs, { cwd: root, stdio: share ? ['ignore', 'pipe', 'pipe'] : 'inherit', detached: process.platform !== 'win32' });
  let output = ''; let timedOut = false;
  function terminate(signal) {
    try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal); else child.kill(signal); } catch { /* Already exited. */ }
  }
  const interrupt = () => terminate('SIGINT');
  process.on('SIGINT', interrupt);
  let hardKill;
  const timeout = setTimeout(() => { timedOut = true; terminate('SIGTERM'); hardKill = setTimeout(() => terminate('SIGKILL'), 1000); }, seconds * 1000);
  if (share) {
    const collect = (stream, chunk) => {
      stream.write(chunk);
      if (output.length < 8000) output += chunk.toString('utf8').slice(0, 8000 - output.length);
    };
    child.stdout.on('data', chunk => collect(process.stdout, chunk));
    child.stderr.on('data', chunk => collect(process.stderr, chunk));
  }
  const cleanup = () => { clearTimeout(timeout); if (hardKill) clearTimeout(hardKill); process.off('SIGINT', interrupt); };
  child.once('error', error => { cleanup(); console.error(error.message); process.exitCode = 1; });
  child.once('close', (code, signal) => {
    cleanup();
    if (share) {
      try {
        // Deliberately omit argv: command arguments can contain passwords or URLs.
        enqueueEvent(root, { schemaVersion: 1, kind: 'runner', text: `Public exercise runner; exit=${code}; signal=${signal}; timeout=${timedOut}\n${redact(output)}`, createdAt: new Date().toISOString() });
        console.error('Result queued locally. In Pi: /bridge send');
      } catch (error) { console.error(`Not queued: ${error.message}`); }
    }
    process.exitCode = timedOut ? 124 : (code ?? 1);
  });
} catch (error) { console.error(error.message); process.exitCode = 1; }
