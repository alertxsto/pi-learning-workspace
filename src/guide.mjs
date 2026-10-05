import { redact } from './core.mjs';

// Pure presentation. No model calls, execution or private terminal capture.
export function guideItems({ session, phase, rows, gaps, selectedTask, completed, page = 'now', probePlan, clockLabel, tutor }) {
  const item = (text, action) => ({ text: redact(text), action });
  const tasks = (session.tasks ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  const current = tasks[selectedTask];
  const result = [];
  if (probePlan) return [...result, item('TINJAU COMMAND — belum dijalankan'), ...probePlan.flatMap(row => [item(row.label), item(JSON.stringify([row.probe.executable, ...row.probe.args]))]), item('Setujui checks [Y]', 'approve'), item('Batalkan [N]', 'cancel')];
  if (page === 'details') {
    result.push(item('PACKAGE / KEBUTUHAN'));
    for (const row of rows) result.push(item(`${row.required === false ? 'Opsional' : 'Wajib'}: ${row.label} · ${row.status}`), item(`Key: ${row.key}`), ...(row.packageName ? [item(`Package: ${row.packageName}`)] : []), item(row.evidence ?? ''), ...(row.source ? [item(`Sumber evidence: ${row.source}`)] : []), ...(row.observedAt ? [item(`Diperiksa: ${row.observedAt}`)] : []), ...(row.setupHint ? [item(row.setupHint)] : []));
    if (session.packages) result.push(item(''), item('CATATAN SETUP'), ...session.packages.split('\n').map(s => item(s)));
    result.push(item(''), item(phase === 'preflight' ? 'PANDUAN SETUP' : 'MATERI'), ...String(session.material ?? 'Materi belum disiapkan tutor.').split('\n').map(s => item(s)));
    for (const turn of tutor?.history ?? []) result.push(item(''), item(`Lo (${turn.intent}): ${turn.question}`), item(`Tutor [${turn.status}]: ${turn.reply}`));
  } else {
    if (page === 'now') {
      if (phase === 'preflight' || gaps.length) {
        result.push(item('PACKAGE / KEBUTUHAN'), item(gaps.length ? `${gaps.length} kebutuhan wajib belum siap` : 'Kebutuhan yang didefinisikan: siap'));
        for (const row of gaps.slice(0, 3)) result.push(item(`• ${row.label}: ${row.status}`));
      }
      result.push(item(phase === 'preflight' ? 'PANDUAN SETUP' : 'MATERI'));
      const paragraph = String(session.material ?? '').trim().split(/\n\s*\n/)[0];
      const intro = paragraph.length > 320 ? `${paragraph.slice(0, 320)}… (lengkap di DETAIL)` : paragraph;
      result.push(...(intro ? intro.split('\n').map(s => item(s)) : [item('Tutor belum menyiapkan ringkasan.')]), item(''));
    }
    result.push(item(tasks.length ? `${phase === 'preflight' ? 'Verifikasi' : 'Langkah'} ${selectedTask + 1}/${tasks.length}` : 'Belum ada langkah'), item(current ? `${completed.includes(selectedTask) ? '[x]' : '[ ]'} ${current}` : 'Belum ada langkah konkret.'));
    if (page === 'steps' && tasks.length) result.push(item('Tandai selesai', 'complete'), item('Sebelumnya', 'previous'), item('Berikutnya', 'next'));
    if (page === 'now') {
      result.push(item(''));
      const turn = tutor?.latest;
      if (turn) {
        result.push(item(`Lo: ${turn.question}`));
        if (turn.status === 'stale') result.push(item('Konteks/draft berubah saat tutor bekerja. Respons lama di DETAIL; cek ulang.'));
        else if (turn.status === 'cancelled' || turn.status === 'interrupted') result.push(item('Permintaan dibatalkan/terputus; bisa tanya lagi.'));
        else result.push(item(turn.reply || 'Tutor sedang membaca konteks…'));
      }
      if (tutor?.shared) result.push(item(`Dibagikan: ${tutor.shared}`));
      if (turn?.evidence) result.push(item(`Evidence: ${turn.evidence.source}`));
      result.push(item('Hint', 'hint'), item('Cek draft (dibagikan)', 'feedback'));
      if (tutor?.pending) result.push(item('Batalkan respons tutor [C]', 'cancel-tutor'));
    }
  }
  if (phase === 'preflight') result.push(item(''), item('Tinjau checks', 'review'), item('Lanjut ke tutor', 'start'));
  else if (!clockLabel?.includes('running')) result.push(item('Mulai / lanjut timer', 'start'));
  if (page === 'details') result.push(item('Tutup workspace', 'quit'));
  return result;
}
