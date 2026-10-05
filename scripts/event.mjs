#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { enqueueEvent, safeWorkspaceFile, redact } from '../src/core.mjs';

const [rootArg, kind, relative] = process.argv.slice(2);
try {
  if (!rootArg || !['editor', 'saved-file'].includes(kind)) throw new Error('Usage: event.mjs <workspace> editor|saved-file <relative-file>; editor text comes from stdin');
  const root = path.resolve(rootArg);
  const file = safeWorkspaceFile(root, relative);
  let text;
  if (kind === 'editor') {
    const chunks = []; let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 12_000) throw new Error('Selection too large; send a smaller excerpt');
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks).toString('utf8');
  } else {
    if (fs.statSync(file).size > 10_000) throw new Error('File too large; send a selection instead');
    text = fs.readFileSync(file, 'utf8');
  }
  enqueueEvent(root, { schemaVersion: 1, kind, text: `File: ${relative}\n${redact(text)}`.slice(0, 10_000), createdAt: new Date().toISOString() });
  console.log('Queued locally. In Pi use /bridge send to request feedback.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
