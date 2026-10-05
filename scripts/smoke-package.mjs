#!/usr/bin/env node
// Real packed-artifact verification. npm may download the declared runtime dependency.
// Pi registration/RPC and the artifact PTY use only temporary config, credentials and workspaces.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isolatedEnvironment, inspectCommands } from './smoke-support.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-clean-package-'));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args[0]} failed: ${result.error?.message ?? result.stderr ?? result.status}\n${result.stdout ?? ''}`);
  return result.stdout;
}
const hostPackages = new Set(['@earendil-works/pi-coding-agent', '@earendil-works/pi-tui', '@earendil-works/pi-ai', '@earendil-works/pi-agent-core', 'typebox']);
function rejectHostCopies(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    const manifest = path.join(child, 'package.json');
    if (fs.existsSync(manifest)) assert.ok(!hostPackages.has(JSON.parse(fs.readFileSync(manifest, 'utf8')).name), `Host dependency copy installed at ${child}`);
    rejectHostCopies(child);
  }
}

// This program is executed by Node with the artifact's module root, not imports from the checkout.
const artifactRuntime = `
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const [packageRoot, workspace] = process.argv.slice(1);
const { loadRuntime } = await import(pathToFileURL(path.join(packageRoot, 'src/runtime.mjs')));
const { PrivateTerminal } = await import(pathToFileURL(path.join(packageRoot, 'src/pty.mjs')));
const runtime = loadRuntime(workspace);
assert.ok(fs.existsSync(path.join(packageRoot, 'nvim/learning.lua')));
const terminal = new PrivateTerminal({ executable: '/bin/sh', args: ['-i'], cwd: workspace, hostExecutable: runtime.transport.executable });
const waitFor = async predicate => {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (terminal.error) throw new Error(terminal.error);
    if (terminal.exited || Date.now() > deadline) throw new Error('Artifact PTY did not produce expected output');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
};
try {
  await waitFor(() => terminal.ready);
  terminal.input("printf '%s%s\\n' 'ARTIFACT_' 'PTY_OK'\\n");
  // The split marker cannot match command echo; shell prompts need not end on their own line.
  await waitFor(() => terminal.lines().some(line => line.includes('ARTIFACT_PTY_OK')));
  console.log('Installed artifact runtime and Python/private PTY OK');
} finally { terminal.close(); }
`;

try {
  const env = isolatedEnvironment(root);
  // Reuse only the npm download cache, never user npmrc/auth or host node_modules.
  env.NPM_CONFIG_CACHE = process.env.npm_config_cache ?? process.env.NPM_CONFIG_CACHE ?? path.join(os.homedir(), '.npm');
  const packed = JSON.parse(run('npm', ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', root], { cwd: repo, env }));
  assert.equal(packed.length, 1);
  const artifact = path.join(root, packed[0].filename);
  const files = new Set(packed[0].files.map(file => file.path));
  const allowedFiles = new Set(['package.json', 'README.md', 'AGENTS.md', 'LICENSE', 'ATTRIBUTION.md']);
  const allowedDirectories = new Set(['extensions', 'src', 'config', 'skills', 'nvim', 'scripts', 'resources', 'docs']);
  const privateNames = new Set(['.git', '.pi', '.agent', '.learning', '.learning-source', 'node_modules', 'sessions', 'auth.json', 'mcp-auth.json', 'models.json', 'settings.json', 'learner.md', 'progress.md', 'misconceptions.md', 'reviews.md', 'superpowers', 'audit-learning-ux-v05.md']);
  for (const file of files) {
    const parts = file.split('/');
    assert.ok(parts.length > 1 ? allowedDirectories.has(parts[0]) : allowedFiles.has(file), `Unexpected shipped resource: ${file}`);
    assert.ok(!parts.some(part => part.startsWith('.') || privateNames.has(part)) && !/\.(jsonl|tgz|pem|key|sqlite|db)$/.test(file), `Private/bundled state shipped: ${file}`);
  }
  for (const file of files) {
    if (file.startsWith('scripts/')) assert.ok(['scripts/learn.mjs', 'scripts/pty-host.py', 'scripts/run.mjs', 'scripts/event.mjs'].includes(file), `Development/private script shipped: ${file}`);
    if (file.startsWith('config/')) assert.equal(file, 'config/runtime.json', `Unexpected configuration shipped: ${file}`);
  }
  for (const file of ['extensions/learning.ts', 'src/core.mjs', 'src/runtime.mjs', 'src/classroom.ts', 'src/pty.mjs', 'config/runtime.json', 'scripts/learn.mjs', 'scripts/pty-host.py', 'scripts/run.mjs', 'scripts/event.mjs', 'nvim/learning.lua', 'AGENTS.md', 'README.md', 'LICENSE', 'ATTRIBUTION.md']) assert.ok(files.has(file), `Missing artifact resource: ${file}`);
  for (const skill of ['learning-session', 'learning-environment', 'learning-review', 'learning-preflight', 'learning-coach']) assert.ok(files.has(`skills/${skill}/SKILL.md`), `Missing packaged skill: ${skill}`);
  assert.ok(files.has('resources/sql-learning.md'), 'Missing skill-referenced SQL learning resource');

  const prefix = path.join(root, "clean install's prefix");
  run('npm', ['install', '--prefix', prefix, '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', artifact], { cwd: root, env });
  const installed = path.join(prefix, 'node_modules/pi-learning-workspace');
  rejectHostCopies(path.join(prefix, 'node_modules'));
  const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  for (const name of hostPackages) assert.ok(!manifest.dependencies?.[name] && !manifest.optionalDependencies?.[name], `Host package declared as runtime dependency: ${name}`);
  const cli = path.join(prefix, 'node_modules/.bin/pi-learning');
  assert.ok(fs.existsSync(cli), 'Packed CLI bin was not installed');
  const workspace = path.join(root, "unrelated learner's workspace with spaces");
  run(cli, ['init', workspace], { cwd: root, env });
  for (const entry of ['AGENTS.md', 'topics', 'sources', 'wiki', '.learning/inbox', 'learner.md', 'progress.md', 'misconceptions.md', 'reviews.md']) assert.ok(fs.existsSync(path.join(workspace, entry)), `CLI init missed ${entry}`);
  const snapshot = JSON.parse(fs.readFileSync(path.join(workspace, '.learning/environment.json'), 'utf8'));
  assert.deepEqual(snapshot.observations, {}, 'CLI init invented readiness observations');
  assert.ok(!fs.existsSync(path.join(workspace, '.learning-source')), 'CLI init relies on an obsolete checkout pointer');
  const progress = path.join(workspace, 'progress.md');
  fs.appendFileSync(progress, '\nLEARNER_KEEP_ME\n');
  const before = fs.readFileSync(progress, 'utf8');
  run(cli, ['init', workspace], { cwd: root, env });
  assert.equal(fs.readFileSync(progress, 'utf8'), before, 'Repeated init overwrote learner content');

  // The installed CLI registers its own package globally via actual Pi, with no project trust dependency.
  run(cli, ['install'], { cwd: workspace, env });
  const count = await inspectCommands('pi', ['--offline', '--no-session', '--mode', 'rpc'], { cwd: workspace, env, packageRoot: installed });
  // start must open real Pi without tmux or any recorded Nvim readiness gate.
  await inspectCommands(cli, ['start', workspace, '--', '--offline', '--no-session', '--mode', 'rpc'], { cwd: root, env, packageRoot: installed });
  run(process.execPath, ['--input-type=module', '-e', artifactRuntime, installed, workspace], { cwd: workspace, env });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(env.PI_CODING_AGENT_DIR, 'auth.json'), 'utf8')), {}, 'Smoke wrote credentials');
  assert.equal(fs.readdirSync(env.PI_CODING_AGENT_SESSION_DIR).length, 0, 'Smoke persisted a Pi session');
  console.log(`Clean artifact OK: privacy allowlist, install without host copies, CLI init/install/start, ${count} real commands/skills discovered outside checkout, packaged runtime/PTY resources. No model call.`);
} catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
