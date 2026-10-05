import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import xterm from '@xterm/headless';
import { loadRuntime } from './runtime.mjs';
const { Terminal } = xterm;
const host = fileURLToPath(new URL('../scripts/pty-host.py', import.meta.url));

export class PrivateTerminal {
  constructor({ executable, args = [], cwd, hostExecutable, cols = 60, rows = 12, onChange = () => {}, env = {} }) {
    if (process.platform === 'win32') throw new Error('Embedded PTY requires Linux/macOS/WSL; Windows native is not supported yet.');
    this.cols = cols; this.rows = rows; this.closed = false; this.exited = false; this.error = undefined; this.onChange = onChange;
    this.revision = 0; this.lineCache = new Map();
    this.terminal = new Terminal({ cols, rows, scrollback: 200, allowProposedApi: true });
    this.child = spawn(hostExecutable ?? loadRuntime(cwd).transport.executable, ['-u', host, executable, ...args], { cwd, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    this.terminal.onData(data => this.input(data)); // DSR/terminal replies, not logs.
    let pending = '';
    this.child.stdout.on('data', chunk => {
      if (this.closed) return;
      pending += chunk.toString('utf8');
      if (pending.length > 1_000_000) { this.error = 'PTY transport overflow'; this.close(); return; }
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        try {
          const event = JSON.parse(line);
          if (event.type === 'output') this.terminal.write(Buffer.from(event.data, 'base64'), () => { this.revision++; this.lineCache.clear(); this.onChange(); });
          else if (event.type === 'ready') { this.ready = true; this.resize(this.cols, this.rows); }
          else if (event.type === 'exit') { this.exited = true; this.exitCode = event.code; this.onChange(); }
        } catch { this.error = 'PTY transport error'; this.onChange(); }
      }
    });
    this.child.stderr.on('data', () => { this.error = 'PTY helper failed; verify python3 is available'; this.onChange(); });
    this.child.once('error', () => { this.error = 'Cannot start python3 PTY helper'; this.exited = true; this.onChange(); });
    this.child.once('close', () => { this.exited = true; this.onChange(); });
    this.child.stdin.on('error', () => {});
  }
  send(message) {
    if (this.closed || this.child.stdin.destroyed) return;
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  input(data) { if (!this.exited) this.send({ type: 'input', data: Buffer.from(data).toString('base64') }); }
  resize(cols, rows) {
    cols = Math.max(2, Math.min(500, cols)); rows = Math.max(2, Math.min(200, rows));
    if (cols !== this.cols || rows !== this.rows) { this.terminal.resize(cols, rows); this.revision++; this.lineCache.clear(); }
    this.cols = cols; this.rows = rows;
    const size = `${cols}:${rows}`;
    if (this.lastSize !== size) { this.lastSize = size; this.send({ type: 'resize', cols, rows }); }
  }
  lines({ cursor = false } = {}) {
    const cached = this.lineCache.get(cursor);
    if (cached) return cached;
    const buffer = this.terminal.buffer.active;
    const lines = [];
    for (let y = 0; y < this.rows; y++) {
      const row = buffer.getLine(buffer.baseY + y);
      let text = '', activeStyle = '';
      for (let x = 0; x < this.cols; x++) {
        const cell = row?.getCell(x);
        if (cell?.getWidth() === 0) continue;
        const char = cell?.getChars() || ' ';
        const style = [];
        if (cell?.isBold()) style.push(1);
        if (cell?.isItalic()) style.push(3);
        if (cell?.isUnderline()) style.push(4);
        if (cell?.isInverse()) style.push(7);
        if (cursor && y === buffer.cursorY && x === buffer.cursorX) style.push(7);
        for (const [channel, prefix] of [['Fg', 38], ['Bg', 48]]) {
          if (cell?.[`is${channel}RGB`]()) {
            const color = cell[`get${channel}Color`]();
            style.push(`${prefix};2;${(color >> 16) & 255};${(color >> 8) & 255};${color & 255}`);
          } else if (cell?.[`is${channel}Palette`]()) style.push(`${prefix};5;${cell[`get${channel}Color`]()}`);
        }
        const nextStyle = style.join(';');
        if (nextStyle !== activeStyle) {
          if (activeStyle) text += '\x1b[0m';
          if (nextStyle) text += `\x1b[${nextStyle}m`;
          activeStyle = nextStyle;
        }
        text += char;
      }
      if (activeStyle) text += '\x1b[0m';
      lines.push(text);
    }
    this.lineCache.set(cursor, lines);
    return lines;
  }
  close() {
    if (this.closed) return;
    this.send({ type: 'close' });
    this.closed = true;
    this.child.stdin.end();
    const timeout = setTimeout(() => { if (!this.exited) this.child.kill('SIGKILL'); }, 1500);
    timeout.unref();
    this.child.once('close', () => clearTimeout(timeout));
    this.lineCache.clear();
    this.terminal.dispose();
  }
}
