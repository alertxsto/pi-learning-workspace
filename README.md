# Pi Learning Workspace

Belajar di dalam Pi lewat **editor, shell, dan tutor interaktif**, dengan chrome terminal ringkas:

```text
Latihan                              17:00 paused
┌ Neovim ─────────────────┐ Tutor Langkah Detail ?
│                         │ Materi dan langkah aktif
│                         │
└─────────────────────────┘ Hint · cek draft
┌ Shell ──────────────────┐
│                         │
└─────────────────────────┘ Tanya >
```

**v0.7:** paket portabel Linux/macOS/WSL, CLI `pi-learning`, launcher langsung ke Pi tanpa tmux, pemeriksaan prerequisite eksplisit, dan verifikasi instalasi artifact bersih. Source tidak bergantung username, distro, atau lokasi clone.

**UI terminal:** header hanya topik/timer, label panel pendek, tab guide satu baris. Shortcut, workspace path, penjelasan privasi dan telemetry tambahan tersedia lewat `?`; materi, draft dan reply tutor tidak dikurangi. Footer bawaan Pi tetap aktif, tetapi status/widget learning yang duplikat disembunyikan selama `/kelas` terbuka dan dipulihkan saat keluar.

**v0.6:** inline tutor input/hints/explicit unsaved public-buffer feedback preserve Nvim/PTY; bounded shared history/current step + parent handoff. See [continuity slice and limits](docs/inline-tutor-v06.md). **v0.5:** guide dipisah Saat Ini/Langkah/Detail, aksi clickable, hint handoff, skill coaching/presentation/resources, dan render caching.  mandatory skill/preflight memory review, readiness gates, dan navigasi panel langsung + mouse.  topik, materi, task, requirements/probes, file latihan dan starter berasal dari data tutor/sesi, bukan curriculum hardcoded. Runtime editor/shell/PTY host dan proporsi layout bisa diatur lewat JSON. `/kelas` dan `/preflight` membuka UI yang sama di Pi. Takeover shell v0.1 sudah diganti. Nvim dipakai jika sudah ditemukan dalam environment memory; jika belum, editor sementara yang benar-benar bisa diedit ditampilkan dengan label jelas—supaya preflight tetap bisa dimulai sebelum Nvim diinstall.

## Instalasi dan menjalankan

### Prerequisite

- Linux (termasuk Omarchy/Fedora), macOS, atau WSL dengan terminal interaktif.
- Node.js **>=22.19**, npm, Pi **1.0.2** (versi host yang dipakai untuk verifikasi), Neovim, dan Python 3 dengan modul POSIX `pty`, `termios`, `fcntl`.
- Shell dari `$SHELL`, atau `/bin/sh` jika variabelnya tidak tersedia.
- Login/provider model diatur lewat Pi sendiri (`/login`); package tidak membawa credential atau mengunci provider/model.

Pi dapat dipasang dengan `npm install -g --ignore-scripts @earendil-works/pi-coding-agent@1.0.2`. Pasang Node/Nvim/Python sesuai package manager host jika belum tersedia; package ini tidak menginstall software sistem/database, memakai sudo, atau mengubah service otomatis. Windows native tanpa WSL tidak didukung.

### Dari clone lokal

Jalankan dari root repo, di lokasi apa pun:

```bash
npm ci --ignore-scripts --legacy-peer-deps
node scripts/learn.mjs install
node scripts/learn.mjs init ~/belajar
node scripts/learn.mjs doctor ~/belajar
cd ~/belajar
pi
```

`install` mendaftarkan extension + skills ke konfigurasi Pi pengguna. Setelah itu `pi` di **folder mana pun** memuat package; folder aktif menjadi workspace, bukan lokasi clone. `init` opsional untuk menyiapkan notes/memory kosong dan tidak menimpa draft, instruksi, konfigurasi, atau memory yang sudah ada. Default `init` adalah `~/belajar`.

Local package tidak dicopy atau dipasang dependensinya oleh Pi: jangan hapus/pindahkan clone setelah registrasi. Jika clone dipindahkan, jalankan `npm ci` dan `node scripts/learn.mjs install` dari lokasi baru, lalu hapus deklarasi lokasi lama yang ditampilkan `pi list`.

### CLI pada PATH

Opsional, untuk memakai command pendek tanpa path script:

```bash
npm install --global --prefix "$HOME/.local" --ignore-scripts --legacy-peer-deps .
export PATH="$HOME/.local/bin:$PATH"
pi-learning install
pi-learning init ~/belajar
pi-learning doctor ~/belajar
pi-learning start ~/belajar
```

Persist penambahan PATH di konfigurasi shell sendiri jika diperlukan. `start` tanpa path memakai **current directory**, meneruskan stdio/exit status Pi, dan memuat package dari lokasi executable yang terpasang. Argumen Pi diteruskan setelah separator:

```bash
pi-learning start ~/belajar -- --continue
pi-learning start "/path/with spaces/workspace" -- --offline --no-session
```

Launcher tidak membutuhkan tmux atau readiness memory untuk membuka Pi. Readiness gate Nvim/tool/target di `/kelas` tetap berlaku. `pi-learning doctor` berbeda dari `/doctor`: command CLI menjalankan pemeriksaan lokal Node/Pi/Nvim/Python secara eksplisit, sedangkan `/doctor` hanya membaca memory. Check CLI tidak menyimpan readiness atau membuktikan akses database/task.

### Dari GitHub

Pasang package dari [repository GitHub](https://github.com/alertxsto/pi-learning-workspace):

```bash
pi install git:github.com/alertxsto/pi-learning-workspace
mkdir -p ~/belajar
cd ~/belajar
pi
```

Pi mengelola checkout dan memasang dependency runtime package dari git. Host `@earendil-works/pi-*` adalah optional peer dependencies dan tidak dibundel sebagai salinan runtime. `@xterm/headless` dipin karena memakai API buffer experimental. Tidak perlu mengedit settings Pi dengan path Fedora atau menjalankan installer per-distro.

Gunakan tag/commit untuk instalasi reproducible (`git:github.com/alertxsto/pi-learning-workspace@<tag-or-commit>`). Update unpinned package dengan `pi update git:github.com/alertxsto/pi-learning-workspace`; untuk clone lokal, update source + `npm ci`. Gunakan `pi list` dan `pi remove <source>` untuk melepas extension tanpa menghapus workspace belajar.

Jika Pi sudah berjalan dengan extension ini, gunakan `/reload` setelah update. Lalu:

```text
/kelas Topik pilihan lo 20
```

Atau:

```text
/preflight Topik pilihan lo 20
```

Sesi yang sudah dikonfigurasi bisa dibuka lagi dengan `/kelas` atau `/preflight` tanpa mengulang durasi. Jika belum ada durasi, UI bertanya sekali; **tidak ada default diam-diam 30 menit**.

## Lesson data dan konfigurasi, bukan hardcoded course

Tutor menyiapkan `learning_workspace` dengan:
- `topic`: label bebas, tanpa enum MySQL/PostgreSQL atau kamus topik.
- `material`, `tasks`, `packages`: konten untuk tujuan dan level pengguna saat itu.
- `requirements`: array `key`, `label`, optional `kind`, `description`, `packageName`, `setupHint`, dan `probe: { executable, args }`.
- `exercise: { path, starter? }`: path teks publik relative ke workspace; starter tidak menimpa file yang sudah ada.
- `minutes`: pilihan pengguna, bukan durasi template. Tidak ada batas arbitrer empat jam; angka harus aman direpresentasikan dalam milidetik.

Data disimpan di `.learning/session.json` dan `.learning/lessons/`. Membuka topik tersimpan memakai data itu lagi. Untuk topik baru, tutor harus menyiapkan kontennya; manual command meminta file jika belum dipilih dan menampilkan status materi/task belum disiapkan, **bukan menyisipkan materi generik atau fake assignment**. Session lama dimigrasi dari data yang benar-benar ada, tanpa merekonstruksi curriculum bawaan.

Default adapter ada di `config/runtime.json`; override pengguna ada di `<workspace>/.learning/workspace.json`, misalnya:

```json
{
  "editor": { "executable": "/path/to/nvim" },
  "shell": { "executable": "/path/to/shell", "args": ["-i"] },
  "transport": { "executable": "/path/to/python3" },
  "layout": { "guideFraction": 0.45, "editorFraction": 0.55 }
}
```

Path di contoh harus diganti dengan pilihan yang nyata. Editor adapter saat ini tetap **Nvim**, sesuai pilihan pengguna; JSON tidak membuat dukungan Emacs/Windows muncul tanpa implementasi adapter. Extra `/env probe` dapat didefinisikan di `probes` pada konfigurasi. Program dan argv ditampilkan untuk persetujuan; data lesson/config bukan izin untuk menjalankan command. Tidak ada mapping installer Fedora/OS di engine: tutor menyusun advice dari fakta relevan yang telah diamati.

Kontrak schema, keyboard routing, protokol PTY, dan batas keamanan tetap mekanisme kode; yang tidak dikunci adalah pilihan/topik/isi pembelajaran dan konfigurasi runtime.

## Preflight benar-benar mendahului latihan

Baca `skills/learning-preflight/SKILL.md` dan `references/protocol.md`: protocol lengkap workspace/scope, memory, requirements, checks, approval setup, credential-safe target/login/permissions, recovery, dan handoff.

1. Tutor wajib CALL `learning_preflight` sebelum membuka UI melalui tool; runtime menolak model yang melewatkan memory review pada agent run saat ini. Report tidak menjalankan command atau scan: menampilkan actual Pi cwd, snapshot, canonical observation keys, durasi dan gaps.
2. Resolve mismatch workspace terlebih dahulu. Pi di `~` tidak otomatis membaca memory `~/belajar`; shell `cd` tidak mengubah cwd Pi. Jangan copy/merge state diam-diam atau menganggap missing memory berarti semua package missing.
3. Requirements diturunkan dari outcome dan direkonsiliasi dengan key yang sudah ada. `required` default true; `acceptedStatuses` hanya `observed`/`ready`. Editor Nvim yang dipilih wajib, tidak bisa di-waive oleh model. Client version bukan login/permission readiness.
4. Preflight UI berisi keputusan/setup/checks dengan judul **PANDUAN SETUP / LANGKAH VERIFIKASI**, bukan assessment quiz. Fallback hanya untuk catatan setup, tidak meloloskan hands-on readiness.
5. Unknown/failed/missing/stale required facts memblokir phase learning dan timer. L di preflight memeriksa gate dan kembali ke tutor untuk lesson sebenarnya jika siap; tidak memakai setup notes sebagai soal. P tidak dapat resume timer saat preflight. `/focus start/resume` tidak dapat bypass prerequisite/handoff.
6. Setelah evidence dan target lengkap, tutor konfirmasi handoff lalu menyiapkan lesson nyata dengan durasi pilihan pengguna yang tidak berubah.

Force workflow jika perlu:

```text
/skill:learning-preflight lanjutkan preflight sesuai memory, jangan mulai soal dahulu
```

Ini bukan universal semantic verifier: tutor tetap harus memasukkan seluruh requirements yang benar, menilai scope/freshness dan tidak mengarang fakta. Wizard target/setup yang lebih kaya dan in-place preflight-to-new-lesson authoring belum tersedia. Pertanyaan/hint/public-buffer feedback inline sekarang tersedia dengan tool-free nested model request. Setup shell tetap private, jadi tutor tidak boleh mengaku menonton command/output yang tidak dibagikan.

## Continuity tutor inline dan batas runtime

[Dokumentasi tutor inline](docs/inline-tutor-v06.md) menjelaskan question/hint/unsaved-buffer feedback tanpa teardown: real Pi/Nvim smoke dengan offline fixture membuktikan PID, unsaved draft dan shell state tetap hidup. Model main tetap menunggu tool sampai exit; nested tutor menggunakan explicit shared context, bukan seluruh parent transcript. Full phase/new-lesson authoring tetap memakai handoff ke main agent; automatic search belum tersedia dan live paid-model pedagogy belum tervalidasi.

## Coaching, guide rapi dan resource

`skills/learning-coach/SKILL.md` + presentation reference mengatur konsep pendek → prediksi/attempt → feedback/hint → retry → independent transfer. Tutor tidak menumpuk seluruh syllabus, semua task, timer/shortcut boilerplate dan evidence di satu panel. First paragraph material menjadi ringkasan bounded; isi penuh tetap tersedia.

Guide punya **TUTOR / LANGKAH / DETAIL**, dengan input pertanyaan di bawah. Tanya/hint memakai selected Pi model, authored lesson/current step/public history dan shared evidence; tidak save/close Nvim/PTY. Cek draft publik (Ctrl+G) secara eksplisit membagikan snapshot buffer belum disimpan; bukan run proof. Embedded bridge dimuat melalui command editor yang ditampilkan pada confirmation. Previous/next/checkbox tetap self-report, bukan readiness/mastery. Langkah/history tersimpan bounded; parent mendapat summary saat keluar.

Resource SQL yang halaman/title-nya telah dicek tersedia di `resources/sql-learning.md`: official MySQL 8.4 tutorial atau MariaDB SELECT reference menurut identity sebenarnya, SQLBolt untuk basic attempts, SQLZoo untuk transfer, dan optional playground/practice dengan caveat engine/privacy. Ini seed pengetahuan, bukan registry topik di engine. Browser exercise execution dan semua fitur/paywall belum diuji. Skill memilih sumber sesuai level/outcome/dialect/version dan mencari yang baru untuk topik lain.

### Performa: perbaikan kode, bukan janji skill

- Readiness/timer/telemetry disampling tiap detik, bukan dibaca/dihitung pada setiap key/render.
- Guide layout/text dicache per width/state; input PTY tidak memicu redraw prematur sebelum echo/output.
- PTY viewport dicache sampai output/resize berubah; style ANSI dikelompokkan per run, tidak diulang per cell.
- Satu controlled static-viewport microbenchmark (120×25, 100 reads) berubah dari ~198 ms ke ~21 ms. Ini bukan typing-latency benchmark atau jaminan lag pada konfigurasi/terminal pengguna hilang. Perlu retest nyata; Nvim smoke memakai clean config.

## Kontrol layar

| Kontrol | Fungsi |
|---|---|
| `Alt+1`, `Alt+2`, `Alt+3` | Langsung pilih editor, shell, guide tanpa cycling |
| Klik panel/header editor | Pilih fokus dalam Pi fullscreen; bukan cursor positioning Nvim |
| `Ctrl+T` / `Alt+Left` | Cycle berikutnya / sebelumnya (kompatibilitas) |
| `Ctrl+S` | Simpan editor; mengirim `:w` jika menggunakan Nvim |
| Klik aksi dalam guide | Page, previous/next, self-report, checks, hint, feedback, exit |
| `1` / `2` / `3` di guide | Tutor / Langkah / Detail |
| Klik `?` / `?` di guide (di luar kolom pertanyaan) | Buka/tutup bantuan; kembali ke page/scroll sebelumnya |
| Klik input / `T`, lalu Enter | Tanya/jawab tutor inline; Escape keluar dari input |
| `C` / Ctrl+C di guide | Batalkan respons tutor, bukan menutup workspace |
| `J` / `K` di guide | Langkah berikutnya / sebelumnya |
| `H` di guide | Satu hint inline, tanpa save/exit |
| `Ctrl+G` | Bagikan/cek snapshot buffer latihan publik inline, tanpa disk save |
| `Ctrl+Q` | Simpan draft dan kembali ke chat Pi |
| `Ctrl+C` di shell | Interupsi foreground command, shell tetap hidup |
| `R` di panel kanan | Tinjau command probe dari requirements lesson |
| `Y` / `N` saat review probe | Setujui execution / batalkan tanpa menjalankan command |
| `L` di panel kanan | Preflight: cek gate + handoff; learning: mulai/resume timer |
| `P` di panel kanan | Pause/resume saat learning; tidak melewati preflight |
| `N`, lalu `Space` di panel kanan | Pilih dan centang task sebagai self-report |
| Panah atas/bawah / wheel di panel kanan | Scroll setup/materi/task tanpa memindah fokus saat wheel |

Border berwarna menunjukkan panel aktif; header menampilkan topik/timer. Shortcut langsung dan workspace path ada dalam bantuan `?`, bukan bar permanen. Navigation bisa dioverride melalui `navigation` di `.learning/workspace.json`; bantuan menampilkan konfigurasi aktual. Tab tetap native indentation/completion, bukan focus switch. Mouse focus/wheel didukung fullscreen; regular mode memakai keyboard karena terminal memiliki scrollback. Bantuan tidak boleh menutupi command yang sedang menunggu persetujuan.

Editor sementara menerima Enter untuk newline. Nvim memakai keyboard normalnya; shortcut global di atas dicadangkan workspace. Nvim yang masih aktif disimpan/ditutup lewat `:wqa` sebelum workspace keluar; jika save gagal, workspace tidak menutupnya paksa. Forced cancellation/shutdown dapat memerlukan recovery swap Nvim.

Terminal minimal 64 kolom ×19 baris, idealnya >=120×35. Resize diteruskan ke kedua PTY. Layout terlalu kecil menampilkan peringatan dan tidak meneruskan input biasa ke shell. Pi menjadi satu-satunya renderer; xterm headless hanya mengemulasi buffer terminal di memori.

## Apa yang ditampilkan di kanan?

- Package/tool yang tersedia, tidak ditemukan di PATH, atau belum diverifikasi.
- Gap target database, autentikasi dan izin—bukan menganggap semua siap karena binary ada.
- Package/setup hints dari data tutor yang berdasar memory OS/target relevan, tanpa installer mapping dalam engine.
- Penjelasan materi dan task yang disiapkan tutor untuk tujuan pengguna; tidak ada starter curriculum bawaan.
- Checklist persisten yang dilabeli **laporan pengguna**, bukan bukti mastery.

Menekan `R` hanya meninjau probe yang tercantum dalam requirements sesi. `Y` baru menjalankan command yang ditampilkan, `N` membatalkan. Tidak full scan atau otomatis menebak probe. Command configured punya izin akun pengguna, bukan sandbox; periksa efeknya sebelum menyetujui. Keberhasilan process exit dicatat sebagai observasi, bukan klaim seluruh environment siap. Check tanpa definisi probe tetap unknown sampai ada bukti terarah.

Command install yang dicantumkan adalah saran. Tidak ada install button yang diam-diam menjalankan command. Pengguna dapat menjalankan command yang disetujui sendiri di panel shell, lalu review dan setujui probe relevan untuk memperbarui observasi. Jika Nvim berhasil ditemukan, editor sementara disimpan lalu panel editor membuka Nvim.

## Agent harus membuka UI, bukan hanya memberi rencana

`AGENTS.md`, skill dan injected runtime mewajibkan **read learning-preflight → CALL learning_preflight → resolve prerequisites → CALL learning_workspace**, bukan langsung menyiapkan soal. Tool menerima topic bebas, phase, minutes, material, tasks, packages, requirements dan exercise. Material/tasks/requirements/exercise wajib diberikan; isi tidak dipilih lewat subject dictionary. Tool tidak boleh mengganti durasi yang dipilih pengguna; mismatch ditolak.

Kalimat seperti “gw mau belajar MySQL 20 menit” disimpan menjadi session preference sebelum agent mulai, lalu diinjek sebagai `learning_session`. `/focus start` tanpa angka memakai pilihan yang tersimpan; jika sesi hands-on masih preflight, prerequisite/handoff harus diselesaikan dahulu. Perubahan eksplisit seperti “ubah jadi 15 menit” memperbarui preferensi dan timer.

Saat workspace terbuka, TUTOR menerima pertanyaan/hint/public-buffer feedback lewat selected-model nested request tanpa menutup Nvim/PTY. Konteks berasal dari authored lesson/current step/public history/explicit evidence, bukan private shell atau seluruh parent transcript. Main-agent authoring/search/setup tools tetap di luar inline tutor. Tidak ada model call setiap ketikan atau setiap detik timer.

## Memory-first environment

```text
/env show
/doctor
/doctor requirement-key-dari-lesson
/env probe nvim
/env probe requirement-key-dari-lesson
```

Snapshot `.learning/environment.json` dibaca/injek, bukan full scan startup. Historical observations boleh memiliki `observedAt: null` jika waktu aslinya tidak dicatat. Scope host/WSL/container/remote harus dibedakan. PATH discovery tidak membuktikan service hidup, login, atau izin.

`pg_isready` menguji readiness; `mysqladmin ping` dapat sukses dengan Access denied. Keduanya tidak membuktikan authenticated access. `SELECT 1` bukan tes seluruh write permissions. Target database latihan perlu dipilih sebelum setup; jangan menggunakan produksi atau menginstall server kedua tanpa alasan.

Manual record:

```text
/env record mysql-target observed Dedicated local learning database, target confirmed by user
```

Ini klaim manual, bukan verifikasi independen. Jangan simpan credential. Runtime/scope yang berubah memerlukan invalidasi/probe relevan, bukan scan seluruh mesin.

## Timer, biaya dan context

```text
/focus start 20
/focus pause
/focus resume
/focus status
```

- Preflight menjaga timer belajar paused. L memvalidasi gate/handoff; timer baru dimulai dengan L dalam lesson yang siap. Setup-time budget UI terpisah belum diimplementasikan.
- Pilihan menit adalah sumber kebenaran, bukan angka template dalam skill.
- Expiration tidak menghapus pekerjaan; keluar normal mem-pause timer.
- Widget dan layar belajar menampilkan `usage.cost.total` tercatat serta context estimate Pi.
- USD dilabeli estimasi/parsial/unknown, **bukan tagihan aktual subscription**. Metadata nol tidak membuktikan gratis; biaya search/provider tambahan bisa tidak tercakup.
- Footer bawaan Pi tetap ada. Context aktif berbeda dari total token sepanjang sesi; setelah compaction bisa sementara unknown.

## Privasi shell

PTY menerima input/output live, tetapi **input dan transcript shell tidak ditulis ke log, session memory atau model context oleh extension ini**. Headless buffer hanya ada selama UI terbuka dan dibuang saat close. Shell Bash diarahkan ke `HISTFILE=/dev/null`; perilaku history shell lain atau perekam terminal eksternal tetap di luar kontrol extension.

Password prompt dengan echo-off berjalan seperti terminal sungguhan; kalau pengguna mengetik secret dalam command yang memang echo, secret dapat terlihat di layar. Jangan menaruh password di command line. Output shell tidak otomatis dikirim untuk feedback; `Ctrl+G` hanya memberi path latihan dan self-report task. File latihan harus berisi materi publik, bukan credential.

Shell/tools punya izin akun pengguna; workspace dan instruksi tutor **bukan sandbox atau permission boundary**. Install/service/database/volume changes memerlukan persetujuan. Jangan otomatis reset data saat error/cancel.

## Bridge dan launcher native

`pi-learning start [workspace]` atau `node scripts/learn.mjs start [workspace]` membuka Pi langsung. Nvim, shell, dan tutor berada di tiga panel TUI `/kelas`; launcher tmux eksternal sudah dihapus. tmux hanya dibutuhkan untuk script smoke UI developer, bukan instalasi/runtime pengguna.

Untuk editor Nvim eksternal, plugin `nvim/learning.lua` menyediakan `:LearningSend` dan `<leader>ls`; kirim buffer/selected lines secara opt-in. Bridge:

```text
/bridge watch topics/mysql/latihan.sql
/bridge status
/bridge send
/bridge clear
```

Antrean bounded 20 event, saved files digabung, context maksimal 24.000 karakter. Watcher tidak melihat buffer belum disimpan. Shell bebas tidak otomatis dipantau.

Runner latihan:

```bash
node scripts/run.mjs ~/belajar -- python latihan.py
node scripts/run.mjs ~/belajar --share --timeout=60 -- python latihan.py
```

`--share` hanya untuk latihan publik tanpa credential. Capture maksimal 8 KiB, argv tidak disimpan, stdin ditutup, redaction best-effort. Jangan gunakan capture untuk setup/password; gunakan PTY private. Timeout POSIX menghentikan process group; Windows descendants cleanup belum lengkap.

## Struktur dan state

```text
AGENTS.md                  kontrak tutor, durasi, kewajiban membuka UI
skills/                    sesi, environment, review custom
extensions/learning.ts     commands/tool, lifecycle, prompt injection
src/classroom.ts           3-panel Pi custom UI, guide pages/actions/hint handoff
src/guide.mjs              pure compact guide presentation, no I/O/topic registry
src/tutor.mjs              public coordinator, context/history/provenance, nested tool-free tutor
src/pty.mjs                private PTY transport + xterm headless
scripts/pty-host.py         POSIX PTY helper, Python stdlib
src/session.mjs            pilihan durasi/topic, lesson data, requirements/exercise
src/runtime.mjs            validated runtime config loader
config/runtime.json        editable adapter defaults, bukan curriculum
src/core.mjs               snapshot, probe, bridge, timer, telemetry
scripts/                   init/launcher, runner, events, smoke tests
nvim/learning.lua           explicit external-editor context sharing
```

Workspace menyimpan:
- `.learning/environment.json`: observasi environment.
- `.learning/session.json`: durasi pilihan, topik bebas, phase, konten, requirements dan exercise.
- `.learning/lessons/`: saved lesson data per topic.
- `.learning/workspace.json`: override runtime config per workspace.
- `.learning/timer.json`: timer lokal.
- `.learning/classroom-progress.json`: checklist self-report.
- `.learning/inbox/`, `pending.json`: evidence opt-in.
- Path latihan yang dipilih tutor/pengguna, tanpa filename/extension per-topic yang dikunci. Draft tidak ditimpa saat membuka kembali.
- Learner memory dan wiki: progres berbasis bukti terpisah dari referensi konsep.

`.learning/`, credential dan local paths tidak ikut Git. Agent tidak boleh mengarang penjelasan pengguna, klaim mastery, readiness atau hasil test.

## Test yang sudah tersedia

```bash
npm run check
npm run smoke:pi
npm run smoke:ui
npm run smoke:nvim
npm run smoke:tutor  # offline fixture, inline conversation + unsaved snapshot + PID/shell continuity
npm run smoke:package # pack/install artifact, CLI + global discovery dari folder lain + PTY nyata
```

- Unit/integration tests: durasi natural-language 20 vs default 30, tool mismatch, memory-only startup, queue, runner, timer, exercise preservation.
- PTY tests nyata: stdin/stdout TTY, `stty` resize, Ctrl+C, silent password input, tanpa transport log.
- Pi RPC smoke: command/skill registration, tanpa model call.
- Guide/cache regressions: one-step summary, details visibility, full probe approval argv, bounded main text and PTY viewport invalidation.
- Regression preflight: wrong workspace/missing memory, canonical keys, Nvim required, runtime/access readiness, focus bypass, mandatory model report dan implicit timer pause.
- **Pi TUI smoke nyata:** isolated tmux socket + temporary home, 3-panel render, materi/tasks, shell command, edit/save dengan fallback **dan Nvim aktual**, arbitrary topic/session data, 17-minute timer pilihan fixture, direct Alt panel selection, fullscreen mouse focus + page/action/step clicks, blocked L/P saat setup, resize, return to Pi. Tidak memakai session/credential pengguna atau model call.

`smoke:ui` membutuhkan tmux, python3 dan Pi. `smoke:nvim` membutuhkan Nvim dan melakukan version probe terarah hanya pada workspace test sementara. `smoke:package` melakukan pack lokal dan install dalam prefix sementara; npm boleh mendownload dependency runtime yang dideklarasikan, tetapi credential/config/session pengguna tidak dipakai dan Pi tetap offline tanpa model call. GitHub Actions memeriksa Ubuntu/macOS × Node 22.19/24 dengan Pi 1.0.2: check, RPC/package smoke, serta Nvim UI. [Status dan log CI lintas platform](https://github.com/alertxsto/pi-learning-workspace/actions) tersedia di repository; hasil lokal Omarchy bukan pengganti run macOS. WSL memakai backend Linux yang sama tetapi belum diverifikasi di host WSL. TypeScript extension diuji melalui Pi dan Node stripping, bukan full static typecheck.

## GitHub / referensi

[Repository GitHub](https://github.com/alertxsto/pi-learning-workspace) menyediakan source dan instalasi package dari git. `package.json` membatasi artifact ke runtime, skills, bridge, dan dokumentasi publik; auth/session/data belajar/test fixtures tidak dibundel. `.github/workflows/ci.yml` memverifikasi instalasi dan UI di platform POSIX. `ATTRIBUTION.md` mencatat sumber ide; skills ditulis ulang, bukan copy 1:1. Lisensi MIT. [Dokumentasi tutor inline](docs/inline-tutor-v06.md) mencatat kemampuan dan batas runtime.
