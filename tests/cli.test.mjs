import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../scripts/learn.mjs', import.meta.url));
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-learning-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 30000, ...options });
}

// Exercise a real Pi operation, offline, rather than a stand-in that echoes argv.
// Export resolves its relative input/output paths from Pi's actual working directory.
test('start passes selected/default cwd and literal Pi argv to real offline session export', t => {
  const version = spawnSync('pi', ['--version'], { encoding: 'utf8' });
  if (version.error?.code === 'ENOENT') return t.skip('Installed Pi is required for offline CLI integration');
  assert.equal(version.status, 0, version.stderr);
  const base = temporary(t);
  const env = { ...process.env, PI_CODING_AGENT_DIR: path.join(base, 'agent'), PI_OFFLINE: '1' };
  const workspace = path.join(base, "learner's workspace");
  const elsewhere = path.join(base, 'unrelated cwd');
  fs.mkdirSync(workspace);
  fs.mkdirSync(elsewhere);
  const input = "learner's saved session.jsonl";
  const content = 'A preserved learner message';
  const timestamp = '2026-01-01T00:00:00.000Z';
  fs.writeFileSync(path.join(workspace, input), [
    { type: 'session', version: 3, id: 'cli-export', timestamp, cwd: workspace },
    { type: 'message', id: 'message1', parentId: null, timestamp, message: { role: 'user', content, timestamp: Date.parse(timestamp) } },
  ].map(value => JSON.stringify(value)).join('\n') + '\n');
  for (const [args, cwd, output] of [
    [['start', workspace], elsewhere, "learner's selected output.html"],
    [['start'], workspace, "learner's default output.html"],
  ]) {
    const result = run([...args, '--', '--offline', '--export', input, output], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const html = fs.readFileSync(path.join(workspace, output), 'utf8');
    const encoded = html.match(/<script id="session-data" type="application\/json">([^<]+)<\/script>/)?.[1];
    const exported = JSON.parse(Buffer.from(encoded ?? '', 'base64').toString('utf8'));
    assert.equal(exported.header.id, 'cli-export');
    assert.equal(exported.entries.find(entry => entry.type === 'message')?.message.content, content);
    assert.equal(fs.existsSync(path.join(elsewhere, output)), false);
  }
  assert.equal(fs.existsSync(path.join(workspace, '.learning')), false);
  assert.equal(fs.existsSync(path.join(workspace, '.learning-source')), false);
  const failedArgs = ['--offline', '--export', "missing learner's session.jsonl"];
  const direct = spawnSync('pi', failedArgs, { cwd: workspace, env, encoding: 'utf8' });
  const launched = run(['start', workspace, '--', ...failedArgs], { cwd: elsewhere, env });
  assert.notEqual(direct.status, 0);
  assert.equal(launched.status, direct.status);
  assert.ok(launched.stderr.trim(), 'Pi failure stderr remains visible');
});

test('start/install report missing Pi and fail without changing the workspace', t => {
  const workspace = temporary(t);
  const env = { ...process.env, PATH: workspace };
  for (const args of [['start', workspace], ['install']]) {
    const result = run(args, { cwd: workspace, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Could not launch Pi.*ENOENT/s);
    assert.deepEqual(fs.readdirSync(workspace), []);
  }
});

test('doctor reports missing local prerequisites, never persists readiness', t => {
  const workspace = temporary(t);
  const result = run(['doctor', workspace], { env: { ...process.env, PATH: workspace } });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL Pi/);
  assert.match(result.stdout, /FAIL Neovim/);
  assert.match(result.stdout, /FAIL Python POSIX PTY modules/);
  assert.deepEqual(fs.readdirSync(workspace), []);
});

test('malformed commands and invalid workspaces fail instead of silently ignoring args', t => {
  const workspace = temporary(t);
  for (const args of [['unknown'], ['init', workspace, 'extra'], ['install', workspace], ['doctor', '--', '--version'], ['start', workspace, '--version']]) {
    const result = run(args, { cwd: workspace });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  }
  const missing = run(['start', path.join(workspace, 'missing')]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /ENOENT/);
  const file = path.join(workspace, 'not a directory');
  fs.writeFileSync(file, 'learner work');
  const invalid = run(['start', file]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Workspace is not a directory/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'learner work');
});
