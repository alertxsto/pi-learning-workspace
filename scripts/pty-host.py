#!/usr/bin/env python3
"""Private PTY transport. Never writes keyboard input/output to disk or model context."""
import base64
import errno
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios
import time


def emit(record):
    sys.stdout.write(json.dumps(record) + '\n')
    sys.stdout.flush()


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Executable required')
    pid, master = pty.fork()
    if pid == 0:
        env = dict(os.environ, TERM='xterm-256color', COLORTERM='truecolor')
        try:
            os.execvpe(sys.argv[1], sys.argv[1:], env)
        except OSError:
            os.write(2, b'Unable to start requested executable. Check its location/version.\r\n')
            os._exit(127)
    emit({'type': 'ready', 'pid': pid})
    pending = b''
    closing = False
    try:
        while not closing:
            readable, _, _ = select.select([master, sys.stdin.fileno()], [], [], 0.1)
            if master in readable:
                try:
                    output = os.read(master, 16384)
                except OSError as error:
                    if error.errno == errno.EIO:
                        break
                    raise
                if not output:
                    break
                emit({'type': 'output', 'data': base64.b64encode(output).decode('ascii')})
            if sys.stdin.fileno() in readable:
                chunk = os.read(sys.stdin.fileno(), 16384)
                if not chunk:
                    break
                pending += chunk
                if len(pending) > 131072:
                    raise ValueError('PTY control message too large')
                while b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    request = json.loads(line)
                    if request.get('type') == 'input':
                        data = base64.b64decode(request['data'], validate=True)
                        while data:
                            written = os.write(master, data)
                            data = data[written:]
                    elif request.get('type') == 'resize':
                        cols = max(2, min(500, int(request['cols'])))
                        rows = max(2, min(200, int(request['rows'])))
                        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
                        # TIOCSWINSZ signals the terminal foreground group itself.
                        # An explicit killpg races with the newly forked child's setsid().
                    elif request.get('type') == 'close':
                        closing = True
                        break
    finally:
        # Closing the controlling terminal hangs up foreground applications.
        try:
            foreground = os.tcgetpgrp(master)
            if foreground > 0:
                os.killpg(foreground, signal.SIGHUP)
        except (ProcessLookupError, OSError):
            pass
        try:
            os.close(master)
        except OSError:
            pass
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + 0.75
        status = None
        while time.monotonic() < deadline:
            try:
                waited, value = os.waitpid(pid, os.WNOHANG)
                if waited:
                    status = value
                    break
            except ChildProcessError:
                break
            time.sleep(0.02)
        if status is None:
            try:
                os.killpg(pid, signal.SIGKILL)
                _, status = os.waitpid(pid, 0)
            except (ProcessLookupError, ChildProcessError):
                pass
        emit({'type': 'exit', 'code': os.waitstatus_to_exitcode(status) if status is not None else None})


if __name__ == '__main__':
    main()
