# Website BK MTsN 2 Trenggalek

Aplikasi web Bimbingan dan Konseling untuk:

- **Absensi kehadiran** siswa (Masuk / Tidak Masuk dengan keterangan **Alpa, Sakit, Izin**).
- **Rekap absensi** per kelas dan periode, dengan persentase terhadap **hari efektif semester**.
- **Tahun ajaran & semester**: satu tahun ajaran = Semester Ganjil + Semester Genap, tiap semester punya jumlah hari masuk sendiri, dan dapat diselesaikan untuk lanjut ke semester berikutnya.
- **Kelas VII, VIII, IX** per tahun ajaran dengan kenaikan kelas otomatis.
- **Kelulusan kelas IX** beserta rekapitulasi sekolah lanjutan.
- **Arsip 5 tahun**: data akademik tersimpan 5 tahun, data lama dinonaktifkan (bukan dihapus).
- **Akun superadmin / admin / guru BK**: superadmin mengelola seluruh akun admin.
- **Foto siswa** otomatis dikompres **maksimal 100 KB**.
- **Laporan kerja** bulanan dengan ekspor **Word (.docx)** dan **PDF**.
- **Data siswa** (tambah, edit, nonaktifkan, import Excel).
- **Pengaturan** identitas madrasah dan penandatangan laporan.

Frontend berupa HTML/CSS/JavaScript tanpa proses build. Database, autentikasi, dan
hak akses memakai **Supabase** (PostgreSQL + Supabase Auth + Row Level Security).
Tidak ada backend PHP yang perlu dijalankan.

---

## 1. Kebutuhan

- Proyek Supabase (gratis) — sudah disiapkan: `mhjvebnxsutwbudjwmud`
- Browser modern: Chrome atau Microsoft Edge
- Koneksi internet (data disimpan di Supabase)
- Untuk pengembangan: Node.js (opsional, hanya untuk cek sintaks)

---

## 2. Arsitektur

```text
Browser (HTML/CSS/JS)
   │  supabase-js (vendor/supabase.js)
   ▼
Supabase
   ├─ Auth        → login email + password
   ├─ PostgreSQL  → students, attendance, work_reports, ...
   └─ RLS         → hanya akun guru BK aktif yang boleh membaca/menulis
```

Kunci yang dipakai di browser adalah **publishable/anon key**. Kunci ini memang
boleh publik karena setiap query tetap diperiksa oleh Row Level Security.
**Jangan pernah** menaruh `service_role`/secret key di file mana pun di folder ini.

---

## 3. Setup Supabase (sekali saja)

### Langkah 1 — Buka proyek
Buka <https://supabase.com/dashboard/project/mhjvebnxsutwbudjwmud>.

### Langkah 2 — Jalankan skema database
1. Masuk ke menu **SQL Editor** → **New query**.
2. Buka file **`supabase/schema.sql`**, copy **seluruh** isinya.
3. Tempel di SQL Editor, lalu klik **Run**.
4. Pastikan keenam tabel aplikasi muncul di **Table Editor**.

File tersebut membuat:
- tabel `profiles`, `students`, `attendance`, `work_reports`, `work_report_items`, `app_settings`;
- constraint, index, trigger `updated_at`, dan trigger profil otomatis;
- **Row Level Security** + policy untuk akun login;
- fungsi `save_work_report(...)` untuk menyimpan laporan secara atomik;
- pengaturan awal madrasah dan penandatangan.

> **Data siswa tidak disertakan di repo publik.** File `supabase/schema.sql`
> hanya berisi struktur database. Isi data siswa lewat menu **Data Siswa → Import**
> setelah login. Jika Anda memiliki salinan lokal `supabase/schema-lengkap.local.sql`,
> jalankan file itu untuk mengisi 284 siswa sekaligus.

> File aman dijalankan ulang. Tabel yang sudah ada tidak dihapus dan data siswa
> diperbarui berdasarkan kombinasi **nama + kelas**.

### Langkah 2b — Jalankan migrasi akademik (wajib, sekali)
Perbesar aplikasi (tahun ajaran, semester, tingkat, kelulusan, akun admin, foto
100 KB) memakai **file migrasi baru**:

1. Buka **SQL Editor → New query**.
2. Copy seluruh isi **`supabase/migrations/20261105090000_akademik_roles.sql`**.
3. Klik **Run**.

File migrasi tersebut menambah:

| Objek | Fungsi |
|---|---|
| `profiles.role` | `superadmin`, `admin`, `guru_bk` |
| `academic_years` | Daftar tahun ajaran (mis. 2026/2027) + kolom `is_aktif` |
| `semesters` | Semester **ganjil** & **genap**, tanggal, **jumlah hari efektif**, status `draft/aktif/selesai` |
| `class_groups` | Rombel per tingkat (VII-A, VIII-B, IX-A, …) |
| `student_history` | Kelas siswa per tahun ajaran (riwayat 5 tahun) |
| `graduations` | Kelulusan kelas IX + sekolah lanjutan |
| `students.angkatan/tingkat/foto_*` | Angkatan, tingkat, foto (≤ 100 KB) |
| bucket `siswa-foto` | Storage publik dengan `file_size_limit = 102400`, hanya JPG/PNG/WEBP |
| RPC admin | `admin_list_accounts`, `admin_create_account`, `admin_update_account`, `admin_delete_account` |
| RPC akademik | `save_academic_year`, `set_active_semester`, `finish_semester`, `promote_students`, `archive_old_academic_years`, `graduation_summary` |

> Jika integrasi GitHub Supabase aktif (bagian 4.4), file di
> `supabase/migrations/` dijalankan otomatis saat push — langkah manual ini tidak
> diperlukan.

Setelah migrasi, akun superadmin otomatis tersedia:

| Email | Password | Peran |
|---|---|---|
| `superadmin@bk.local` | `BkMtsn2!2026` | superadmin |

Aturannya:
- Jika sudah ada superadmin → tidak ada perubahan.
- Jika belum ada akun sama sekali → akun bawaan di atas **dibuat otomatis** oleh migrasi.
- Jika sudah ada akun lain tetapi belum ada superadmin → akun paling lama dijadikan superadmin.
- Ingin memaksa/membuat ulang akun bawaan? Jalankan **`supabase/setup-superadmin.sql`** di SQL Editor.

> **Segera ganti password bawaan** setelah login pertama
> (Pengaturan → Akun → Ganti Password). Menu **Akun Admin** hanya terlihat untuk
> superadmin.

### Langkah 3 — Ambil URL dan kunci
Buka **Project Settings → API**:

| Bagian | Contoh | Dipakai untuk |
|---|---|---|
| Project URL | `https://mhjvebnxsutwbudjwmud.supabase.co` | `SUPABASE_URL` |
| anon / publishable key | `sb_publishable_...` | `SUPABASE_ANON_KEY` |

### Langkah 4 — Isi `assets/js/config.js`
Nilai untuk proyek ini **sudah diisi**:

```js
window.BK_CONFIG = {
  SUPABASE_URL: "https://mhjvebnxsutwbudjwmud.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_0QoQPOUArrXnj0mArDr2uQ_pPxFsasw",
  ...
};
```

Ganti kedua nilai tersebut bila Anda memakai proyek Supabase lain.

### Langkah 5 — Buat akun guru BK
1. Buka **Authentication → Users → Add user → Create new user**.
2. Isi **email** dan **password** (minimal 8 karakter).
3. Aktifkan **Auto Confirm User** agar bisa langsung login.
4. Klik **Create user**.

Profil guru BK dibuat otomatis oleh trigger. Setelah login, nama dapat diubah
di **Pengaturan**, dan password dapat diganti di **Pengaturan → Akun → Ganti Password**.

> Jangan aktifkan pendaftaran publik. Akun dibuat oleh admin madrasah saja
> melalui dashboard Supabase.

### Langkah 6 — Buka aplikasi
Aplikasi harus dibuka lewat web server (bukan double-click `index.html`).
Pilihan paling mudah:

```bat
cd C:\BK MTSN 2 Trenggalek\website
start.bat
```

`start.bat` menjalankan server lokal di <http://localhost:8080/>.

Bisa juga memakai XAMPP: copy folder `website` ke `C:\xampp\htdocs\bk-mtsn2`,
nyalakan **Apache** saja (MySQL tidak diperlukan), lalu buka
<http://localhost/bk-mtsn2/>.

### Langkah 7 — Atur URL aplikasi di Supabase
Pengaturan ini dipakai Supabase saat membuat tautan di email (konfirmasi akun,
reset password). Login email + password tetap bisa dari alamat mana pun.

1. Buka **Authentication → URL Configuration**.
2. Isi **Site URL** dengan alamat utama aplikasi:

   ```text
   https://mtsn2trenggalek2026-pixel.github.io/BimbinganKonselingMTsN2/
   ```

   Jika nanti memakai Vercel atau domain sendiri, ganti dengan alamat tersebut.
3. Di **Redirect URLs**, klik **Add URL** lalu tambahkan:

   ```text
   https://mtsn2trenggalek2026-pixel.github.io/BimbinganKonselingMTsN2/**
   http://localhost:8080/**
   https://*.vercel.app/**
   ```

4. Klik **Save**.

> `**` berarti semua halaman di bawah alamat tersebut. Tanpa entri ini, tautan
> reset password akan ditolak dengan pesan *redirect not allowed*.

---

## 4. Publikasi otomatis (GitHub, Vercel, Supabase)

### 4.1 Alur

```text
Edit file di C:\BK MTSN 2 Trenggalek\website
        │  simpan (Ctrl + S)
        ▼
scripts\auto-push.bat  (berjalan di latar belakang)
        │  cek sintaks → git add → commit → push
        ▼
GitHub: mtsn2trenggalek2026-pixel/BimbinganKonselingMTsN2 (branch main)
        ├─ GitHub Pages → build ulang situs (±1 menit)
        ├─ Vercel       → deploy ulang situs (±1 menit)
        └─ Supabase     → menjalankan file baru di supabase/migrations
```

### 4.2 GitHub Pages
Sudah aktif di
<https://mtsn2trenggalek2026-pixel.github.io/BimbinganKonselingMTsN2/>.
Setiap push ke `main` otomatis build ulang; tidak ada pengaturan tambahan.
Status build dapat dilihat di **Settings → Pages**.

### 4.3 Vercel
1. Buka <https://vercel.com/new> lalu login (disarankan **Continue with GitHub**).
2. Pilih **Import Git Repository** → repo `BimbinganKonselingMTsN2`.
   Jika repo belum muncul, klik **Adjust GitHub App Permissions** dan beri akses.
3. Isi konfigurasi berikut:

   | Kolom | Nilai |
   |---|---|
   | Framework Preset | **Other** |
   | Root Directory | `.` (biarkan) |
   | Build Command | kosongkan |
   | Output Directory | kosongkan |
   | Install Command | kosongkan |

4. Klik **Deploy**. Situs tersedia di `https://<nama-proyek>.vercel.app`.
5. Setelah mendapat alamat Vercel, tambahkan ke
   **Supabase → Authentication → URL Configuration** (Site URL dan
   Redirect URLs `https://<nama-proyek>.vercel.app/**`).
6. Setiap push ke `main` menjadi **Production Deployment**. Push ke branch lain
   menjadi **Preview Deployment**.

> Proyek ini hanya file statis. Jika Vercel menampilkan 404, pastikan
> **Root Directory** = `.` dan **Output Directory** kosong (bukan `dist`/`public`).

### 4.4 Integrasi Supabase dengan GitHub (migrasi database otomatis)
Hanya **struktur database** yang ikut otomatis. Data siswa tidak pernah dikirim
ke GitHub.

1. Supabase Dashboard → **Project Settings → Integrations**.
2. Pada **GitHub Integration**, klik **Authorize GitHub** → **Authorize Supabase**.
3. Pilih repo `mtsn2trenggalek2026-pixel/BimbinganKonselingMTsN2`, branch `main`.
4. Isi **Working directory** dengan `.` (folder `supabase/` ada di root repo).
5. Aktifkan **Deploy to production** agar migrasi dijalankan otomatis.
6. Klik **Enable integration**.

Cara kerja:

- Supabase hanya menjalankan file **baru** di `supabase/migrations/`.
- File migrasi yang sudah pernah dijalankan **jangan diubah**. Untuk perubahan
  berikutnya, buat file baru dengan awalan tanggal, misalnya
  `20261201100000_tambah_nis.sql`.
- Perubahan di luar folder `supabase/` (HTML/CSS/JS) tidak menyentuh database.

### 4.5 Auto-push: edit → otomatis masuk GitHub
1. Klik dua kali **`scripts\auto-push.bat`**.
2. Biarkan jendelanya terbuka selama mengedit.
3. Setiap kali file disimpan, skrip menunggu 5 detik, memeriksa sintaks
   `assets/js/*.js`, lalu commit + push otomatis.

Perintah lain:

```bat
scripts\auto-push.bat -Once                :: push sekali lalu keluar
scripts\auto-push.bat -DebounceSeconds 10  :: tunggu 10 detik sebelum push
```

- Log tersimpan di `scripts\auto-push.log`.
- Jika sintaks JavaScript salah, push dibatalkan sampai diperbaiki.
- Jika push gagal (internet/login), skrip mencoba lagi 30 detik kemudian.
- Auto-push hanya mengirim **kode**. Perubahan database tetap lewat folder
  `supabase/migrations/`.
- Untuk berhenti: tekan **Ctrl + C** atau tutup jendela auto-push.

### 4.6 Alur kerja harian
1. Jalankan `scripts\auto-push.bat` (sekali saja, biarkan terbuka).
2. Edit file seperti biasa, lalu simpan.
3. Tunggu ±10 detik. GitHub, Vercel, dan Supabase memperbarui otomatis.
4. Untuk perubahan database: buat file baru di `supabase/migrations/`, simpan,
   lalu tunggu integrasi Supabase menjalankannya.

---

## 5. Login dan akun

Login memakai email + password yang dibuat di **Supabase Auth**.
Tidak ada akun bawaan di dalam kode.

- Lupa password → admin membuka **Authentication → Users**, pilih akun,
  lalu **Reset password**.
- Akun nonaktif → ubah kolom `aktif` pada tabel `profiles` (atau hapus akun
  di Auth).
- Sesi login tersimpan otomatis di browser dan diperbarui oleh Supabase.

---

## 6. Fitur utama

### Absensi
- Pilih tanggal dan kelas.
- Setiap siswa otomatis terdaftar sebagai **Masuk**.
- Klik **Tidak Masuk**, lalu pilih **Alpa / Sakit / Izin**.
- Tombol **Tandai Semua Masuk** untuk mengisi cepat.
- **Simpan Absensi** menyimpan ke database (upsert per siswa per tanggal).
- Ekspor **Excel** dan **PDF** sesuai filter yang tampil.

### Rekap Absensi
- Rentang tanggal + filter kelas.
- Menampilkan Hadir, Alpa, Sakit, Izin, Total hari, dan persentase kehadiran.
- Ekspor **Excel** dan **PDF** (PDF landscape).

### Laporan Kerja
- **Mengikuti format laporan kerja Oktober 2026** (A4 portrait):
  1. Judul **Laporan Kerja** rata tengah, tebal.
  2. Tabel identitas 4 kolom: `Nama | NIP`, `Level Jabatan | Pangkat`,
     `Golongan Ruang | Tugas Tambahan`, `Bulan`.
  3. Tabel kegiatan 4 kolom: **No · Kegiatan · Pekerjaan · Tanggal**.
  4. Blok tanda tangan tanpa garis: Kepala Madrasah (kiri) dan Guru BK (kanan),
     diakhiri `NIP. …`.
- **1 hari bisa banyak kegiatan**, dan **tiap kegiatan bisa banyak pekerjaan**:
  - editor dikelompokkan per **hari** ("Tambah Hari"),
  - di dalam hari ada tombol **Kegiatan** dan **Tambah pekerjaan**,
  - saat disimpan, semua kegiatan dalam satu hari digabung menjadi satu baris
    laporan (nomor mengikuti urutan hari) — sama seperti contoh,
  - teks multi-baris tetap turun ke baris berikutnya di dalam sel.
- Tombol **Pratinjau** menampilkan bentuk tabel sebelum diunduh.
- Simpan, edit, hapus, lalu unduh **Word (.docx)** atau **PDF**.

### Data Siswa
- Tambah/edit/nonaktifkan siswa.
- Import massal dari Excel/CSV dengan kolom:
  `NO` (opsional), `NAMA`, `L/P`, `KELAS`, `NIS` (opsional).
- Unduh template import dari tombol **Template**.
- Ekspor data siswa ke Excel.

### Tahun Ajaran & Semester (menu *Tahun & Semester*)
- Satu tahun ajaran otomatis dibuat dengan **Semester Ganjil** (Jul–Des) dan
  **Semester Genap** (Jan–Jun).
- Setiap semester menyimpan **jumlah hari masuk (hari efektif)**; angka ini
  menjadi dasar persentase kehadiran.
- Alur: **Mulai** semester → guru mengabsen → **Selesaikan & lanjut**.
  - Ganjil selesai → Genap tahun yang sama aktif.
  - Genap selesai → Ganjil tahun ajaran berikutnya dibuat/diaktifkan.
- Tahun ajaran lama dapat diarsipkan (nonaktif) dan tetap dibuka lewat
  **Tampilkan arsip**. Tombol **Arsipkan > 5 tahun** menjalankan
  `archive_old_academic_years()` — tidak ada data yang dihapus.
- **Hapus semester** (tombol di kartu semester) dan **hapus tahun ajaran**
  (ikon sampah di kartu tahun ajaran). Saat dihapus:
  - semester / rombel / riwayat kelas / catatan kelulusan tahun tersebut terhapus;
  - **riwayat absensi tetap tersimpan**, hanya tautan semesternya dikosongkan;
  - laporan kerja tidak tersentuh;
  - jika semester berjalan terhapus, semester terbaru yang tersisa otomatis diaktifkan.
  > Membutuhkan fungsi `delete_semester` & `delete_academic_year`.
  > Jalankan **`supabase/update-hapus-tahun-semester.sql`** bila migrasi Anda dibuat
  > sebelum fitur ini ada.

### Tampilan terang / gelap
- Tombol matahari/bulan di kanan atas (atau menu akun → **Ganti Tema**).
- Pilihan disimpan di browser (`localStorage`), diterapkan sebelum halaman
  digambar agar tidak berkedip. Jika belum pernah memilih, tema mengikuti
  pengaturan sistem operasi.
- Mode gelap menutup **semua** permukaan: kartu, tabel, tombol, dropdown,
  chip filter, tombol absensi (Masuk/Tidak Masuk), modal, notifikasi, form, dan
  halaman login — sehingga tidak ada lagi teks yang tenggelam di latar putih.

### Kelas (menu *Kelas*)
Menu navigasi hanya **Kelas** (tanpa daftar A/B/C dan tingkat).
- Di halaman: 3 pilihan tingkat (VII / VIII / IX) + filter rombel berupa dropdown.
- Menu **Tahun & Semester** dan **Kelulusan** tersedia sebagai tombol di halaman Kelas
  (juga dapat dibuka lewat alamat `#/tahun` dan `#/lulus`).
- Kartu ringkas jumlah siswa & rombel per tingkat.
- Tabel siswa dengan kehadiran semester berjalan.
- **Tambah Siswa**, **Tambah Rombel**, pindah rombel, ubah status.
- **Kenaikan Kelas**: VII → VIII → IX otomatis memakai akhiran rombel yang sama
  (VIII-A → IX-A). Opsi **tandai kelas IX lulus** membuat catatan kelulusan.
- Ekspor Excel per tingkat.

### Kelulusan & Sekolah Lanjutan (menu *Kelulusan & Lanjutan*)
- Daftar siswa kelas IX per tahun ajaran dengan status lulus/tidak lulus.
- Isi **sekolah lanjutan** (SMA, MA, SMK, MAK, Pondok Pesantren, Lainnya),
  kota, jalur masuk, NPSN.
- Grafik distribusi sekolah tujuan dan ringkasan kelulusan.
- Ekspor **Excel** dan **PDF**.

### Akun (menu *Akun Admin* — khusus superadmin)
- Buat akun **superadmin**, **admin**, atau **guru BK** langsung dari aplikasi.
- Ubah nama, peran, dan status **Aktif / Nonaktif**.
- Reset password akun lain, atau **hapus akun**.
- Akun nonaktif tidak bisa login; profil & data tetap tersimpan.
- Password di-hash di server oleh Supabase Auth (RPC `security definer`), bukan
  di browser.

### Data Siswa — foto maksimal 100 KB
- Tombol unggah foto → gambar dikompres di browser (canvas) hingga **≤ 100 KB**,
  disimpan di bucket `siswa-foto` (batas keras di server 102400 byte).
- Pratinjau & ukuran akhir ditampilkan sebelum disimpan.

### Pengaturan
- Nama madrasah, alamat, kota.
- Nama/NIP Kepala Madrasah.
- Nama/NIP/Jabatan Guru BK.
- Ganti password akun yang sedang login.

---

## 7. Struktur folder

```text
website/
├─ index.html                 # kerangka aplikasi (SPA)
├─ start.bat                  # server lokal untuk membuka aplikasi
├─ PANDUAN.txt                # panduan singkat
├─ README.md
├─ supabase/
│  ├─ config.toml             # konfigurasi Supabase CLI
│  ├─ migrations/             # migrasi otomatis saat push ke GitHub
│  │  ├─ 20261104000000_init.sql
│  │  └─ 20261105090000_akademik_roles.sql  # tahun ajaran, semester, akun
│  ├─ schema.sql              # tabel + RLS + RPC (tanpa data siswa)
│  ├─ schema-lengkap.local.sql# versi + 284 siswa (lokal, tidak di-push)
│  ├─ BACA-INI.txt            # langkah menerapkan skema
│  └─ cek.sql                 # query verifikasi
├─ scripts/
│  ├─ auto-push.bat           # klik dua kali: pantau + push otomatis
│  └─ auto-push.ps1           # logika auto-push
├─ assets/
│  ├─ css/style.css
│  ├─ data/students.json      # cadangan lokal (tidak di-push)
│  └─ js/
│     ├─ config.js            # URL + anon key Supabase
│     ├─ utils.js             # utilitas, ikon, modal, tanggal
│     ├─ api.js               # akses data Supabase (Auth + PostgREST + RPC)
│     ├─ exporters.js         # Excel, PDF, Word
│     ├─ dashboard.js
│     ├─ attendance.js
│     ├─ attendance-recap.js  # rekap absensi (semester / rentang)
│     ├─ years.js             # tahun ajaran & semester
│     ├─ levels.js            # kelas VII / VIII / IX
│     ├─ graduation.js        # kelulusan & sekolah lanjutan
│     ├─ reports.js
│     ├─ students.js
│     ├─ accounts.js          # akun admin (superadmin)
│     ├─ settings.js
│     └─ app.js               # login, router, bootstrap
├─ vendor/                    # SheetJS, jsPDF, docx, FileSaver, supabase-js
└─ legacy-mysql/              # versi lama PHP + MySQL (tidak dipakai)
```

---

## 8. Keamanan

- Login memakai **Supabase Auth** (password di-hash oleh Supabase, bukan di browser).
- Semua tabel memakai **Row Level Security**: hanya pengguna `authenticated`
  dengan profil aktif (`profiles.aktif = true`) yang dapat membaca/menulis.
- **Peran**:
  | Peran | Hak |
  |---|---|
  | `superadmin` | Semua hak admin + membuat/mengubah/menonaktifkan/menghapus akun |
  | `admin` | Kelola siswa, rombel, tahun ajaran, kenaikan kelas, kelulusan, foto |
  | `guru_bk` | Absensi, rekap, laporan kerja, lihat data siswa (baca saja) |
- RPC akun (`admin_*`) memakai `security definer` dan memeriksa
  `is_superadmin()` di server, sehingga guru BK tidak dapat membuat/menghapus akun
  walaupun memanggil API langsung.
- Bucket `siswa-foto` dibatasi server-side: `file_size_limit = 102400` byte dan
  hanya menerima `image/jpeg`, `image/png`, `image/webp`. Pengunggah juga
  mengompres gambar di browser sebelum upload.
- Superadmin tidak dapat menonaktifkan atau menghapus akunnya sendiri.
- Kunci yang dipakai di browser adalah **publishable/anon key**, bukan secret.
- Laporan disimpan melalui RPC `save_work_report` agar header + rincian kegiatan
  tersimpan dalam satu transaksi.
- `service_role`/secret key tidak boleh ditaruh di frontend.

---

## 9. Backup dan pemulihan

### Backup
1. Supabase Dashboard → **Database → Backups** (sesuai paket).
2. Alternatif manual: **SQL Editor**, jalankan:

```sql
select * from public.students;
select * from public.attendance;
select * from public.work_reports;
```

lalu unduh hasilnya sebagai CSV.

### Pemulihan
1. Buka **SQL Editor**.
2. Jalankan `supabase/schema.sql` (membuat ulang struktur yang belum ada).
3. Import data dari file backup.

File `supabase/schema.sql` aman dijalankan berulang: data yang sudah ada tidak
dihapus. Data siswa dapat diisi ulang lewat import Excel atau dengan menjalankan
`schema-lengkap.local.sql` (file lokal, tidak ikut di-push).

---

## 10. Reset password

1. Buka **Supabase Dashboard → Authentication → Users**.
2. Cari email guru BK.
3. Klik menu **⋮ → Reset password**, atau kirim **email pemulihan**.
4. Sampaikan password baru kepada guru yang bersangkutan.

Guru juga dapat mengganti password sendiri lewat
**Pengaturan → Akun → Ganti Password** (password lama diminta untuk verifikasi).

---

## 11. MCP Supabase di OpenCode

Server MCP sudah didaftarkan di konfigurasi OpenCode:

```jsonc
{
  "mcp": {
    "servers": {
      "supabase": {
        "type": "remote",
        "url": "https://mcp.supabase.com/mcp?project_ref=mhjvebnxsutwbudjwmud"
      }
    }
  }
}
```

Cara menghubungkan:

1. Di OpenCode, jalankan `/mcps`.
2. Pilih **supabase** → **Authenticate / Connect**.
3. Login ke Supabase memakai akun yang **memiliki proyek `mhjvebnxsutwbudjwmud`**.
4. Setelah status `connected`, agent dapat menjalankan migrasi, query, dan
   pengecekan keamanan langsung ke proyek tersebut.

Jika muncul `needs authentication` atau `permission denied`, berarti akun yang
login di MCP berbeda dengan pemilik proyek. Jalankan `/mcps` → **supabase** →
**Logout**, lalu login dengan akun yang benar.

---

## 12. Troubleshooting

| Masalah | Solusi |
|---|---|
| Layar "Hubungkan ke Supabase" | Jalankan `supabase/schema.sql`, lalu periksa `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `assets/js/config.js`. |
| "Tabel database belum dibuat" / `PGRST205` | Skema belum dijalankan. Buka SQL Editor, jalankan `supabase/schema.sql`. |
| "Email atau password salah" | Buat/atur ulang akun di **Authentication → Users**. Pastikan **Auto Confirm** aktif. |
| "Akun ini belum memiliki profil guru BK" | Profil tidak dibuat. Jalankan ulang bagian trigger/backfill di `schema.sql`, atau tambahkan baris di tabel `profiles` dengan `id` = id user Auth. |
| "Akses ditolak" / RLS | Pastikan `profiles.aktif = true` untuk akun tersebut. |
| Data tidak muncul setelah login | Muat ulang dengan `Ctrl + F5`, lalu periksa **Console** browser. |
| Ekspor Word/PDF tidak jalan | Pastikan folder `vendor/` lengkap dan browser mengizinkan unduhan. |
| Tampilan berantakan | Gunakan Chrome/Edge terbaru, lalu muat ulang dengan `Ctrl + F5`. |
| Auto-push tidak jalan | Jalankan `scripts\auto-push.bat`, pastikan jendelanya terbuka dan lihat `scripts\auto-push.log`. |
| Push ditolak `403` / minta login | Login ulang dengan akun pemilik repo: `git credential-manager github login`, lalu jalankan auto-push lagi. |
| Migrasi Supabase tidak jalan | Pastikan integrasi GitHub aktif, file berada di `supabase/migrations/`, dan namanya berawalan timestamp. |
| Vercel menampilkan 404 | Set **Root Directory** `.` dan kosongkan **Output Directory**. |
| Halaman Vercel/GitHub Pages kosong | Tambahkan alamat situs ke **Supabase → Authentication → URL Configuration**. |
| Semua menu tampil "Halaman belum termuat" | Biasanya nama tabel di database berbeda huruf besar/kecil (mis. `Students`), atau file `assets/js/*.js` di hosting masih lama. Jalankan `supabase/setup-nama-tabel-salah.sql`, lalu muat ulang dengan **Ctrl + Shift + R**. |
| Menu Tahun & Semester / Kelas tidak muncul | Akun Anda berperan `guru_bk`. Minta superadmin mengubah peran menjadi `admin`. |
| "Tabel tahun ajaran belum tersedia" | Migrasi `20261105090000_akademik_roles.sql` belum dijalankan. |
| Gagal membuat akun admin: `function ... does not exist` | Jalankan migrasi akademik (bagian 2b). |
| Foto gagal diunggah | Pastikan bucket `siswa-foto` ada dan file ≤ 100 KB. Gambar besar otomatis dikompres; jika tetap gagal, pilih gambar lain. |
| Kenaikan kelas tidak membuat siswa | Pastikan tahun ajaran tujuan sudah ada dan rombel tingkat tujuan sudah dibuat. |

---

## 13. Catatan pengembangan

- Tidak ada proses build. Cukup edit file lalu muat ulang browser (`Ctrl + F5`).
- Cek sintaks JavaScript:

  ```bat
  node --check assets\js\api.js
  node --check assets\js\app.js
  ```

- Menjalankan server lokal tanpa XAMPP:

  ```bat
  cd C:\BK MTSN 2 Trenggalek\website
  npx serve .
  ```

  atau buka lewat `start.bat` (PHP built-in server dari XAMPP).

- Untuk mengubah struktur database, **jangan edit `supabase/schema.sql` saja**.
  Buat file baru di `supabase/migrations/` dengan nama berawalan tanggal, misalnya
  `20261201100000_tambah_nis.sql`. Setelah di-push, integrasi Supabase akan
  menjalankannya otomatis di proyek produksi.
- `supabase/schema.sql` tetap dipakai untuk menyiapkan proyek baru dari nol
  (jalankan sekali lewat SQL Editor).

---

© 2026 BK MTsN 2 Trenggalek
