import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Editor, Input, Key, matchesKey, visibleWidth, truncateToWidth, wrapTextWithAnsi, CURSOR_MARKER } from '@earendil-works/pi-tui';
import type { TuiMouseEvent } from '@earendil-works/pi-tui';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { PrivateTerminal } from './pty.mjs';
import { atomicJSON, loadTimer, timerAction, timerLabel, loadSnapshot, probe, recordObservation, redact, telemetryLabels, drainEvents } from './core.mjs';
import { loadSession, configureSession, ensureExercise, requirementsView, activeRequirements, assertPreflightReady, preflightBlockers } from './session.mjs';
import { loadRuntime, editorArguments } from './runtime.mjs';
import { TutorCoordinator, modelTutor, tutorSummary } from './tutor.mjs';
import { guideItems } from './guide.mjs';

// The only renderer is Pi's TUI. Headless xterm emulates each PTY in memory.
export async function openClassroom(ctx: ExtensionContext, signal?: AbortSignal, services: any = {}) {
  if (ctx.mode !== 'tui') throw new Error('Classroom requires Pi interactive TUI');
  const session = loadSession(ctx.cwd);
  if (!session?.topic) throw new Error('Pilih topik dan durasi dahulu; tutor menyiapkan lesson data.');
  const exercise = ensureExercise(ctx.cwd, session);
  const runtime = loadRuntime(ctx.cwd);
  const tasksText = session.tasks ?? '';
  return ctx.ui.custom<{ file: string; minutes: number; completed: number[]; phase: string; submitted: boolean; request?: string; task?: string; publicTutor?: any }>((tui, theme, _kb, done) => {
    let closed = false;
    let focus = session.phase === 'preflight' ? 1 : 0; // editor, shell, guide
    let phase = session.phase;
    let guideScroll = 0;
    let selectedTask = 0;
    let guidePage: 'now' | 'steps' | 'details' | 'help' = 'now';
    let previousGuidePage: 'now' | 'steps' | 'details' = 'now';
    let previousGuideScroll = 0;
    let submissionRequest: string | undefined;
    let composing = false;
    let tutorRevision = 0;
    const snapshots = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
    let guideActions: Array<string | undefined> = [];
    let guideCacheKey = '';
    let readinessRows: any[] = [], readinessGaps: any[] = [];
    let readinessRevision = 0;
    let clockLabel = timerLabel(ctx.cwd);
    let telemetry = telemetryLabels(ctx.sessionManager.getEntries(), ctx.getContextUsage());
    function refreshReadiness() {
      try {
        const rows = requirementsView(ctx.cwd, session), gaps = preflightBlockers(ctx.cwd, session);
        if (JSON.stringify([rows, gaps]) !== JSON.stringify([readinessRows, readinessGaps])) readinessRevision++;
        readinessRows = rows; readinessGaps = gaps;
      }
      catch (error) { readinessRows = []; readinessGaps = [{ label: 'Invalid state', status: 'failed' }]; message = String(error); }
      clockLabel = timerLabel(ctx.cwd);
    }
    let completed: number[] = [];
    try {
      const file = path.join(ctx.cwd, '.learning/classroom-progress.json');
      if (fs.existsSync(file) && fs.statSync(file).size < 32_768) {
        const progress = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (progress.topic === session.topic && progress.tasks === tasksText && Array.isArray(progress.completed)) {
          completed = progress.completed.filter((n: any) => Number.isInteger(n) && n >= 0 && n < 200).slice(0, 200);
          if (Number.isInteger(progress.selectedTask) && progress.selectedTask >= 0 && progress.selectedTask < tasksText.split('\n').filter(Boolean).length) selectedTask = progress.selectedTask;
        }
      }
    } catch { /* Invalid self-report is ignored, never treated as mastery. */ }
    let message = '';
    let checking = false;
    let probePlan: any[] | undefined;
    let guideLines: string[] = [];
    let tooSmall = false;
    let pendingExit: boolean | undefined;
    let geometry = { leftWidth: 0, topHeight: 0, bodyHeight: 0 };
    const guideTabs = [['Tutor', 'page:now'], [' Langkah', 'page:steps'], [' Detail', 'page:details'], [' ?', 'help']].map(([label, action]) => ({ label, action, width: visibleWidth(label), start: 0, end: 0 }));
    function selectPanel(panel: number) {
      focus = panel;
      requestRender();
    }
    function toggleHelp() {
      if (probePlan) { message = 'Selesaikan atau batalkan tinjauan command dahulu.'; requestRender(); return; }
      if (guidePage === 'help') {
        guidePage = previousGuidePage; guideScroll = previousGuideScroll;
      } else {
        previousGuidePage = guidePage; previousGuideScroll = guideScroll;
        guidePage = 'help'; guideScroll = 0; composing = false;
      }
      requestRender();
    }
    const requestRender = () => { if (!closed) tui.requestRender(); };
    const policy = ['../skills/learning-coach/SKILL.md', '../skills/learning-coach/references/presentation.md'].map(file => fs.readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')).join('\n\n');
    const tutor = new TutorCoordinator({ root: ctx.cwd, session,
      transport: services.transport ?? modelTutor(ctx, policy, () => readinessRows),
      onUsage: services.onUsage ?? (() => {}),
      onChange: () => { tutorRevision++; requestRender(); },
    });
    if (tutor.state.history.length) selectedTask = tutor.selectedTask; else tutor.select(selectedTask);
    const question = new Input({ prompt: 'Tanya > ', placeholder: 'tulis pertanyaan…', placeholderStyle: s => theme.fg('muted', s) });
    question.onSubmit = value => {
      if (!value.trim()) return;
      void askTutor('question', value);
    };
    question.onEscape = () => { composing = false; requestRender(); };
    async function askTutor(kind: string, value = '') {
      if (tutor.pending) { message = 'Tutor masih bekerja; C di guide membatalkan. Editor/shell tetap aktif.'; requestRender(); return; }
      guidePage = 'now'; guideScroll = 0; composing = false;
      if (kind === 'question') question.setValue('');
      try { await tutor.ask(kind, value, kind === 'feedback' ? captureDraft : undefined); }
      catch (error) { message = String(error); }
      requestRender();
    }
    function consumeEvidence() {
      const { events } = drainEvents(ctx.cwd);
      for (const event of events) {
        const snapshot = event.text.match(/^File: ([^\n]+)\n__learning_snapshot:([a-zA-Z0-9-]+)\n([\s\S]*)$/);
        if (snapshot) {
          const waiting = snapshots.get(snapshot[2]);
          if (waiting) {
            if (snapshot[1] !== session.exercise.path) waiting.reject(new Error('Nvim sedang membuka file lain. Pilih buffer latihan publik sebelum cek draft.'));
            else waiting.resolve({ source: `unsaved-buffer:${snapshot[1]} (snapshot, bukan bukti run)`, text: redact(snapshot[3]).slice(0, 8000) });
          }
          continue;
        }
        // General bridge evidence was explicitly shared by the learner, not shell capture.
        tutor.share({ source: `${event.kind} @ ${event.createdAt} (cek kecocokan step/target)`, text: event.text });
      }
    }
    function captureDraft(abortSignal: AbortSignal): Promise<any> {
      if (!nvim || nvim.exited) return Promise.resolve({ source: `unsaved-buffer:${session.exercise.path} (editor sementara; bukan bukti run)`, text: redact(editor.getExpandedText()).slice(0, 8000) });
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const cleanup = () => { clearTimeout(timeout); snapshots.delete(id); abortSignal.removeEventListener('abort', cancel); };
        const cancel = () => { cleanup(); reject(new Error('Snapshot dibatalkan.')); };
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Snapshot Nvim belum diterima. Tidak save/close otomatis; cek buffer/bridge lalu coba lagi.')); }, 5000);
        snapshots.set(id, { resolve: value => { cleanup(); resolve(value); }, reject: error => { cleanup(); reject(error); } });
        abortSignal.addEventListener('abort', cancel, { once: true });
        if (abortSignal.aborted) { cancel(); return; }
        nvim.input(`\x1b:LearningSnapshot ${id} ${Buffer.from(exercise).toString('hex')}\r`);
      });
    }
    const shell = new PrivateTerminal({ hostExecutable: runtime.transport.executable, executable: runtime.shell.executable || process.env.SHELL || runtime.shell.fallbackExecutable, args: runtime.shell.args, cwd: ctx.cwd, env: { HISTFILE: '/dev/null' }, onChange: requestRender });
    let nvim: PrivateTerminal | undefined;
    const editor = new Editor(tui, {
      borderColor: s => theme.fg('borderMuted', s),
      selectList: { selectedPrefix: s => theme.fg('accent', s), selectedText: s => theme.fg('text', s), description: s => theme.fg('muted', s), scrollInfo: s => theme.fg('muted', s), noMatch: s => theme.fg('warning', s) },
    });
    editor.setText(fs.readFileSync(exercise, 'utf8'));
    editor.onChange = () => requestRender();
    function startNvim() {
      const status = loadSnapshot(ctx.cwd)?.observations[runtime.editor.key]?.status;
      if (!['observed', 'ready'].includes(status)) { message = `${runtime.editor.label} belum siap dalam memory. Editor sementara aktif; R di kanan untuk meninjau probe.`; return; }
      nvim = new PrivateTerminal({ hostExecutable: runtime.transport.executable, executable: runtime.editor.executable, args: editorArguments(runtime, exercise), cwd: ctx.cwd, onChange: () => {
        if (closed) return;
        if (nvim?.exited) {
          const submit = pendingExit;
          try { editor.setText(fs.readFileSync(exercise, 'utf8')); } catch { message = 'Tidak dapat membaca draft setelah Nvim keluar.'; }
          nvim.close(); nvim = undefined;
          if (submit !== undefined) { pendingExit = undefined; finish(submit); return; }
          message = 'Nvim keluar; draft tersimpan dimuat kembali ke editor sementara.';
        }
        requestRender();
      } });
    }
    startNvim();
    refreshReadiness();
    const tick = setInterval(() => {
      if (pendingExit !== undefined && nvim?.exited) finish(pendingExit);
      else {
        try { consumeEvidence(); } catch (error) { message = `Bridge: ${String(error)}`; }
        refreshReadiness();
        telemetry = telemetryLabels(ctx.sessionManager.getEntries(), ctx.getContextUsage());
        requestRender();
      }
    }, 1000);
    function save() {
      // User's Ctrl+S is explicit permission to save their own editor contents.
      if (nvim && !nvim.exited) { nvim.input('\x1b:w\r'); message = 'Perintah :w dikirim ke Nvim; cek status Nvim untuk hasil.'; }
      else { fs.writeFileSync(exercise, editor.getExpandedText()); message = `Tersimpan: ${path.relative(ctx.cwd, exercise)}`; }
      requestRender();
    }
    function finish(submitted = false, force = false) {
      if (closed) return;
      if (nvim && !nvim.exited && !force) {
        if (pendingExit !== undefined) return;
        pendingExit = submitted;
        nvim.input('\x1b:wqa\r');
        message = 'Nvim menyimpan dan keluar. Jika :w gagal, perbaiki di editor; workspace tidak ditutup paksa.';
        requestRender(); return;
      }
      if (!nvim) save(); // Preserve fallback draft on exit/abort; shell remains private.
      closed = true;
      clearInterval(tick);
      signal?.removeEventListener('abort', abort);
      tutor.close();
      shell.close(); nvim?.close();
      const timer = loadTimer(ctx.cwd);
      if (timer) atomicJSON(path.join(ctx.cwd, '.learning/timer.json'), timerAction(timer, 'pause'));
      atomicJSON(path.join(ctx.cwd, '.learning/classroom-progress.json'), { topic: session.topic, tasks: tasksText, completed, selectedTask, updatedAt: new Date().toISOString(), assessment: 'learner-self-report-only' });
      done({ file: path.relative(ctx.cwd, exercise), minutes: session.minutes, completed, phase, submitted, publicTutor: tutorSummary(ctx.cwd, session), ...(submissionRequest ? { request: submissionRequest, task: tasksText.split('\n').filter(Boolean)[selectedTask] } : {}) });
    }
    function abort() { finish(false, true); }
    signal?.addEventListener('abort', abort, { once: true });
    function beginLearning() {
      try { assertPreflightReady(ctx.cwd, session); }
      catch (error) { message = String(error); requestRender(); return; }
      if (phase === 'preflight') {
        message = 'Checks wajib siap. Kembali ke tutor untuk handoff dan menyiapkan lesson, bukan memakai catatan setup sebagai latihan.';
        finish(true); return;
      }
      configureSession(ctx.cwd, { phase });
      const timer = loadTimer(ctx.cwd);
      atomicJSON(path.join(ctx.cwd, '.learning/timer.json'), timerAction(timer, timer?.remainingMs > 0 ? 'resume' : 'start', session.minutes));
      refreshReadiness();
      message = 'Timer berjalan.';
      requestRender();
    }
    function reviewProbes() {
      if (checking) return;
      probePlan = activeRequirements(ctx.cwd, session).filter((row: any) => row.probe);
      guidePage = 'now';
      guideScroll = 0;
      message = probePlan.length ? 'Tinjau command di kanan. Y menjalankan probe; N batal. Data lesson tidak otomatis dieksekusi.' : 'Tidak ada probe dalam lesson. Tutor perlu menyiapkan definisi kebutuhan/probe.';
      requestRender();
    }
    async function checkTools() {
      if (checking || !probePlan) return;
      const approved = probePlan; probePlan = undefined;
      checking = true; message = 'Menjalankan probe yang lo setujui, bukan scan mesin...'; requestRender();
      try {
        for (const row of approved) {
          const result = await probe(row.key, row.probe);
          if (closed) return;
          recordObservation(ctx.cwd, row.key, result.status, result.evidence, result.source);
        }
        if (!nvim && ['observed', 'ready'].includes(loadSnapshot(ctx.cwd)?.observations[runtime.editor.key]?.status)) { save(); startNvim(); }
        message = 'Observasi diperbarui. Keberhasilan command bukan bukti seluruh environment siap.';
      } catch (e) { message = `Check gagal: ${String(e)}`; }
      finally { checking = false; refreshReadiness(); requestRender(); }
    }
    function performAction(action: string) {
      if (action.startsWith('page:')) {
        const page = action.slice(5);
        if (page !== 'now' && page !== 'steps' && page !== 'details') return;
        guidePage = page; guideScroll = 0; composing = false;
      }
      else if (action === 'help') toggleHelp();
      else if (action === 'review') reviewProbes();
      else if (action === 'approve') void checkTools();
      else if (action === 'cancel') { probePlan = undefined; message = 'Probe dibatalkan; tidak ada command dijalankan.'; }
      else if (action === 'start') beginLearning();
      else if (action === 'hint') void askTutor('hint');
      else if (action === 'feedback') void askTutor('feedback');
      else if (action === 'compose') { guidePage = 'now'; composing = true; focus = 2; }
      else if (action === 'cancel-tutor') tutor.cancel();
      else if (action === 'quit') finish();
      else if (action === 'complete') completed = completed.includes(selectedTask) ? completed.filter(n => n !== selectedTask) : [...completed, selectedTask];
      else if (action === 'next' || action === 'previous') {
        const count = tasksText.split('\n').filter(Boolean).length;
        selectedTask = Math.max(0, Math.min(count - 1, selectedTask + (action === 'next' ? 1 : -1)));
        tutor.select(selectedTask);
        guidePage = 'steps'; guideScroll = 0;
      }
      requestRender();
    }
    function terminalInput(data: string) {
      // Pi uses extended keyboard protocols; translate common keys for PTY apps.
      const mappings: Array<[string, string]> = [[Key.enter, '\r'], [Key.backspace, '\x7f'], [Key.up, '\x1b[A'], [Key.down, '\x1b[B'], [Key.right, '\x1b[C'], [Key.left, '\x1b[D'], [Key.tab, '\t'], [Key.escape, '\x1b'], [Key.ctrl('c'), '\x03'], [Key.ctrl('d'), '\x04']];
      return mappings.find(([key]) => matchesKey(data, key))?.[1] ?? data;
    }
    const component = {
      focused: true,
      invalidate() { editor.invalidate(); question.invalidate(); guideCacheKey = ''; },
      dispose() { finish(false, true); },
      handleMouse(event: TuiMouseEvent) {
        if (tooSmall || event.shift) return undefined;
        if (event.type === 'wheel' && event.x >= geometry.leftWidth) {
          guideScroll = Math.max(0, guideScroll + (event.wheelDelta ?? 0)); requestRender();
          return { handled: true, render: true };
        }
        if (event.type !== 'click' || event.button !== 'left') return undefined;
        if (event.y >= 1 && event.y < geometry.bodyHeight + 1) {
          const row = event.y - 1;
          selectPanel(event.x > geometry.leftWidth ? 2 : row < geometry.topHeight ? 0 : 1);
          if (focus === 2) {
            if (row === 0) {
              const tab = guideTabs.find(item => event.x >= item.start && event.x < item.end);
              if (tab) performAction(tab.action);
            } else if (row === geometry.bodyHeight - 1) {
              composing = true; guidePage = 'now'; requestRender();
            } else {
              const action = guideActions[guideScroll + row - 1];
              if (action) performAction(action);
            }
          }
          return { handled: true, focus: true, render: true };
        }
        return undefined;
      },
      handleInput(data: string) {
        if (matchesKey(data, Key.ctrl('q'))) { finish(); return; }
        if (matchesKey(data, Key.ctrl('g'))) { void askTutor('feedback'); return; }
        const navigation = runtime.navigation;
        for (const [panel, key] of [navigation.editor, navigation.shell, navigation.guide].entries()) if (matchesKey(data, key as any)) { selectPanel(panel); return; }
        if (matchesKey(data, navigation.next as any)) { selectPanel((focus + 1) % 3); return; }
        if (matchesKey(data, navigation.previous as any)) { selectPanel((focus + 2) % 3); return; }
        if (matchesKey(data, Key.ctrl('s'))) { save(); return; }
        if (tooSmall) return;
        if (pendingExit !== undefined && focus === 0 && nvim && !nvim.exited) pendingExit = undefined;
        if (focus === 0) {
          tutor.touchDraft();
          if (nvim && !nvim.exited) { nvim.input(terminalInput(data)); return; }
          else {
            editor.focused = component.focused;
            if (matchesKey(data, Key.enter)) editor.insertTextAtCursor('\n');
            else editor.handleInput(data);
          }
        } else if (focus === 1) { shell.input(terminalInput(data)); return; }
        else {
          if (matchesKey(data, Key.ctrl('c'))) { tutor.cancel(); return; }
          if (composing) { question.focused = component.focused; question.handleInput(data); requestRender(); return; }
          if (data === '?') { toggleHelp(); return; }
          if (data.toLowerCase() === 't') { performAction('compose'); return; }
          if (data.toLowerCase() === 'c') { tutor.cancel(); return; }
          if (['1', '2', '3'].includes(data)) { performAction(`page:${['now', 'steps', 'details'][Number(data) - 1]}`); return; }
          if (data.toLowerCase() === 'h') { performAction('hint'); return; }
          if (data.toLowerCase() === 'j') { performAction('next'); return; }
          if (data.toLowerCase() === 'k') { performAction('previous'); return; }
          if (matchesKey(data, Key.enter)) { performAction(guidePage === 'steps' ? 'complete' : 'compose'); return; }
          if (probePlan && data.toLowerCase() === 'y') void checkTools();
          else if (probePlan && data.toLowerCase() === 'n') { probePlan = undefined; message = 'Probe dibatalkan; tidak ada command dijalankan.'; }
          else if (data.toLowerCase() === 'r') reviewProbes();
          else if (data.toLowerCase() === 'l') beginLearning();
          else if (data.toLowerCase() === 'p') {
            if (phase === 'preflight') { message = 'Timer belajar tetap paused selama setup; selesaikan preflight dan handoff ke tutor dulu.'; requestRender(); return; }
            const timer = loadTimer(ctx.cwd);
            if (timer && !timer.running) {
              try { assertPreflightReady(ctx.cwd, session); } catch (error) { message = String(error); requestRender(); return; }
            }
            if (timer) atomicJSON(path.join(ctx.cwd, '.learning/timer.json'), timerAction(timer, timer.running ? 'pause' : 'resume'));
            refreshReadiness();
          } else if (matchesKey(data, Key.down)) guideScroll++;
          else if (matchesKey(data, Key.up)) guideScroll = Math.max(0, guideScroll - 1);
          else if (data.toLowerCase() === 'n') performAction('next');
          else if (data === ' ') completed = completed.includes(selectedTask) ? completed.filter(n => n !== selectedTask) : [...completed, selectedTask];
        }
        requestRender();
      },
      render(width: number): string[] {
        // Keep rendering bounded and resize both child PTYs with the panel.
        const height = Math.max(12, Math.min(70, tui.terminal.rows - 3));
        tooSmall = width < 64 || height < 16;
        if (tooSmall) return [theme.fg('warning', 'Perbesar terminal ke >=64 kolom dan >=19 baris untuk 3 panel.'), 'Ctrl+Q keluar. Shell tidak akan menerima input saat layout terlalu kecil.'];
        const rightWidth = Math.min(width - 29, Math.max(25, Math.floor(width * runtime.layout.guideFraction)));
        const leftWidth = width - rightWidth - 1;
        const bodyHeight = height - 2;
        const topHeight = Math.max(5, Math.floor(bodyHeight * runtime.layout.editorFraction));
        const bottomHeight = bodyHeight - topHeight;
        geometry = { leftWidth, topHeight, bodyHeight };
        const inner = leftWidth - 2;
        shell.resize(inner, Math.max(2, bottomHeight - 2));
        if (nvim) nvim.resize(inner, Math.max(2, topHeight - 2));
        editor.focused = component.focused && focus === 0 && !nvim;
        const fit = (s: string, columns: number) => { const cut = truncateToWidth(s, columns, ''); return cut + ' '.repeat(Math.max(0, columns - visibleWidth(cut))); };
        const frame = (title: string, content: string[], h: number, active: boolean) => {
          const border = (s: string) => theme.fg(active ? 'accent' : 'borderMuted', s);
          const heading = ` ${title} `;
          const result = [border('┌') + fit(border(heading), leftWidth - 2) + border('┐')];
          for (let i = 0; i < h - 2; i++) result.push(border('│') + fit(content[i] ?? '', inner) + border('│'));
          result.push(border('└' + '─'.repeat(leftWidth - 2) + '┘'));
          return result;
        };
        let editorLines: string[];
        if (nvim && !nvim.exited) editorLines = nvim.lines({ cursor: focus === 0 });
        else {
          const rendered = editor.render(inner);
          const cursor = rendered.findIndex((line: string) => line.includes(CURSOR_MARKER));
          const start = Math.max(0, cursor - (topHeight - 4));
          editorLines = rendered.slice(start, start + topHeight - 2);
        }
        const left = [...frame(nvim && !nvim.exited ? runtime.editor.label : 'Editor sementara', editorLines, topHeight, focus === 0), ...frame('Shell', shell.error ? [shell.error] : shell.exited ? [`Shell keluar (${shell.exitCode ?? '?'}). Tutup dan buka sesi lagi.`] : shell.lines({ cursor: focus === 1 }), bottomHeight, focus === 1)];
        const tutorView = { ...tutor.view(), history: tutor.state.history };
        const inlineCost = tutor.state.cost;
        const help = guidePage === 'help' && !probePlan;
        const key = JSON.stringify([rightWidth, guidePage, selectedTask, completed, phase, probePlan, readinessRevision, clockLabel.includes('running'), tutorRevision, help ? [telemetry, inlineCost.total, inlineCost.unknown] : undefined]);
        if (key !== guideCacheKey) {
          guideCacheKey = key; guideLines = []; guideActions = [];
          const items = help ? [
            { text: 'Bantuan', action: undefined },
            { text: `${runtime.navigation.editor} · Editor\n${runtime.navigation.shell} · Shell\n${runtime.navigation.guide} · Tutor\n${runtime.navigation.next} / ${runtime.navigation.previous} · Pindah panel`, action: undefined },
            { text: '\nCtrl+S · Simpan\nCtrl+G · Bagikan draft publik ke tutor, tanpa save\nCtrl+Q · Tutup workspace', action: undefined },
            { text: '\nDi tutor (bukan kolom pertanyaan):\n1 / 2 / 3 · Tutor / Langkah / Detail\nT · Tanya\nH · Hint\nJ / K · Langkah berikut / sebelumnya\nSpace / Enter di Langkah · Tandai selesai\nR · Tinjau checks; Y / N · Setujui / batal\nL · Mulai timer atau handoff setup\nP · Pause / lanjut; C · Batalkan respons\n? · Kembali dari bantuan', action: undefined },
            { text: '\nCentang adalah laporan pengguna, bukan bukti kesiapan. Shell private tidak dikirim ke model. Checks memerlukan persetujuan; versi tool bukan bukti akses target. Program memakai izin akun, bukan sandbox.', action: undefined },
            { text: `\n${telemetry.join('\n')}\nTutor nested: $${inlineCost.total.toFixed(4)}${inlineCost.unknown ? ' (parsial)' : ''}; context terpisah\nWorkspace: ${ctx.cwd}`, action: undefined },
          ] : guideItems({ session, phase, rows: readinessRows, gaps: readinessGaps, selectedTask, completed, page: guidePage, probePlan, clockLabel, tutor: tutorView });
          for (const item of items) {
            for (const line of item.text.split('\n').flatMap(text => wrapTextWithAnsi(text, rightWidth - 2))) {
              guideLines.push(item.action ? theme.fg('accent', line) : line); guideActions.push(item.action);
            }
          }
        }
        const guideHeight = bodyHeight - 2;
        guideScroll = Math.min(guideScroll, Math.max(0, guideLines.length - guideHeight));
        question.focused = component.focused && focus === 2 && composing;
        const inputLine = question.render(rightWidth - 2)[0];
        let tabColumn = leftWidth + 1, tabs = '';
        const activeTab = help ? 'help' : `page:${guidePage}`;
        for (const tab of guideTabs) {
          tab.start = tabColumn; tab.end = tabColumn + tab.width; tabColumn = tab.end;
          const active = tab.action === activeTab;
          tabs += theme.style(tab.label, { fg: active ? 'accent' : 'muted', bold: active });
        }
        const combined = left.map((line, i) => {
          const right = i === 0 ? tabs : i === bodyHeight - 1 ? inputLine : guideLines[guideScroll + i - 1] ?? '';
          return fit(line, leftWidth) + ' ' + fit(right, rightWidth);
        });

        const timer = `${phase === 'preflight' ? 'Setup · ' : ''}${clockLabel}`;
        const heading = fit(theme.fg('accent', session.topic), width - visibleWidth(timer) - 1) + ' ' + theme.fg('muted', timer);
        return [heading, ...combined, truncateToWidth(redact(message), width)];
      },
    };
    if (signal?.aborted) finish(false);
    return component;
  }, { overlay: true, overlayOptions: { width: '100%', maxHeight: '100%', anchor: 'center' } });
}
