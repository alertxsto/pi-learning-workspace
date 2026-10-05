import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const defaultsPath = fileURLToPath(new URL('../config/runtime.json', import.meta.url));
const keyPattern = /^[a-z][a-z0-9_-]{0,63}$/;

export function editorArguments(runtime, exercise) {
  const bridge = fileURLToPath(new URL('../nvim/learning.lua', import.meta.url));
  return [...runtime.editor.args, '--cmd', `lua dofile(${JSON.stringify(bridge)})`, exercise];
}
export function validateProbeSpec(spec) {
  if (!spec || typeof spec.executable !== 'string' || !spec.executable.trim() || spec.executable.length > 512 || /[\x00-\x1f]/.test(spec.executable) || !Array.isArray(spec.args) || spec.args.length > 32 || spec.args.some(arg => typeof arg !== 'string' || arg.length > 2048 || /[\x00-\x1f]/.test(arg))) throw new Error('Invalid probe: executable + argv array required');
  return { executable: spec.executable, args: [...spec.args] };
}
function read(file) {
  if (fs.statSync(file).size > 32_768) throw new Error('Runtime configuration too large');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export function loadRuntime(root) {
  const defaults = read(defaultsPath);
  const file = root ? path.join(root, '.learning/workspace.json') : undefined;
  const override = file && fs.existsSync(file) ? read(file) : {};
  const config = { editor: { ...defaults.editor, ...override.editor }, shell: { ...defaults.shell, ...override.shell }, transport: { ...defaults.transport, ...override.transport }, probes: { ...defaults.probes, ...override.probes }, navigation: { ...defaults.navigation, ...override.navigation }, layout: { ...defaults.layout, ...override.layout } };
  if (config.editor.kind !== 'nvim' || !keyPattern.test(config.editor.key) || typeof config.editor.label !== 'string' || config.editor.label.length > 100 || /[\x00-\x1f]/.test(config.editor.label) || !Array.isArray(config.editor.args)) throw new Error('Invalid editor adapter config (currently nvim supported)');
  validateProbeSpec({ executable: config.editor.executable, args: config.editor.args });
  config.editor.probe = override.editor?.probe ?? { ...defaults.editor.probe, executable: config.editor.executable };
  validateProbeSpec(config.editor.probe);
  validateProbeSpec({ executable: config.shell.fallbackExecutable, args: config.shell.args });
  if (config.shell.executable !== null) validateProbeSpec({ executable: config.shell.executable, args: config.shell.args });
  validateProbeSpec({ executable: config.transport.executable, args: [] });
  if (Object.keys(config.probes).length > 64) throw new Error('Too many configured probes');
  for (const [key, spec] of Object.entries(config.probes)) {
    if (!keyPattern.test(key)) throw new Error('Invalid probe key');
    validateProbeSpec(spec);
  }
  for (const key of ['editor', 'shell', 'guide', 'next', 'previous']) if (typeof config.navigation[key] !== 'string' || !/^(?:(?:ctrl|alt|shift)\+)*(?:[a-z0-9]|left|right|up|down|tab|escape|f[1-9]|f1[0-2])$/.test(config.navigation[key])) throw new Error('Invalid navigation key');
  if (new Set(Object.values(config.navigation)).size !== 5) throw new Error('Navigation shortcuts must be distinct');
  for (const fraction of [config.layout.guideFraction, config.layout.editorFraction]) if (!Number.isFinite(fraction) || fraction < 0.2 || fraction > 0.8) throw new Error('Panel fraction must be .2.. .8');
  return config;
}
