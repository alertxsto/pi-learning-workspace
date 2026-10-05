import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const learningCommands = ['doctor', 'env', 'focus', 'bridge', 'preflight', 'kelas', 'skill:learning-session', 'skill:learning-environment', 'skill:learning-review', 'skill:learning-preflight', 'skill:learning-coach'];

// Deliberately do not inherit provider/cloud credentials, user configuration or Pi markers.
export function isolatedEnvironment(root) {
  const env = {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: path.join(root, 'home'),
    SHELL: '/bin/sh',
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    TMPDIR: path.join(root, 'tmp'),
    XDG_CONFIG_HOME: path.join(root, 'config'),
    XDG_CACHE_HOME: path.join(root, 'cache'),
    XDG_DATA_HOME: path.join(root, 'data'),
    PI_CODING_AGENT_DIR: path.join(root, 'agent'),
    PI_CODING_AGENT_SESSION_DIR: path.join(root, 'sessions'),
    PI_OFFLINE: '1',
    PI_SKIP_VERSION_CHECK: '1',
    PI_TELEMETRY: '0',
    NPM_CONFIG_USERCONFIG: path.join(root, 'npmrc'),
    NPM_CONFIG_GLOBALCONFIG: path.join(root, 'global-npmrc'),
    NPM_CONFIG_CACHE: path.join(root, 'npm-cache'),
  };
  for (const key of ['HOME', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'NPM_CONFIG_CACHE']) fs.mkdirSync(env[key], { recursive: true, mode: 0o700 });
  fs.writeFileSync(env.NPM_CONFIG_USERCONFIG, '');
  fs.writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, '');
  fs.writeFileSync(path.join(env.PI_CODING_AGENT_DIR, 'auth.json'), '{}\n', { mode: 0o600 });
  fs.writeFileSync(path.join(env.PI_CODING_AGENT_DIR, 'settings.json'), JSON.stringify({ quietStartup: true, lastChangelogVersion: '1.0.2' }));
  return env;
}

export async function inspectCommands(executable, args, { cwd, env, packageRoot }) {
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 30_000);
    child.stdout.on('data', chunk => { out += chunk.toString(); });
    child.stderr.on('data', chunk => { err += chunk.toString(); });
    child.stdin.on('error', () => {}); // Startup/close errors are reported below with stderr.
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut || code !== 0) reject(new Error(`${executable} RPC ${timedOut ? 'timed out' : `exited ${code ?? signal}`}: ${err.slice(0, 4000)}`));
      else resolve(out);
    });
    child.stdin.end(JSON.stringify({ id: 'learning-smoke', type: 'get_commands' }) + '\n');
  });
  const records = stdout.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  const response = records.find(record => record.id === 'learning-smoke' && record.type === 'response');
  if (!response?.success) throw new Error('get_commands did not succeed');
  const artifactRoot = packageRoot && fs.realpathSync(packageRoot);
  for (const name of learningCommands) {
    const command = response.data.commands.find(command => command.name === name);
    if (!command) throw new Error(`Missing command: ${name}`);
    const source = name.startsWith('skill:') ? 'skill' : 'extension';
    if (command.source !== source) throw new Error(`Wrong command source for ${name}: ${command.source}`);
    if (artifactRoot) {
      const resource = command.sourceInfo?.path;
      const relative = resource && path.relative(artifactRoot, fs.realpathSync(resource));
      if (!resource || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`${name} was not loaded from the installed artifact: ${resource}`);
    }
  }
  return learningCommands.length;
}
