#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isolatedEnvironment, inspectCommands } from './smoke-support.mjs';

// Offline; inspect real extension/skill registration without a model prompt.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-package-load-'));
try {
  const env = isolatedEnvironment(root);
  const workspace = path.join(root, 'unrelated workspace');
  fs.mkdirSync(workspace);
  const count = await inspectCommands('pi', ['--offline', '--no-extensions', '--no-session', '-e', repo, '--mode', 'rpc'], { cwd: workspace, env, packageRoot: repo });
  console.log(`Pi package load OK: ${count} actual commands/skills registered in an isolated agent directory. No model call or environment probe.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
