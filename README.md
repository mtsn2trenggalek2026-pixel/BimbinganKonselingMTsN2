# Website BK MTsN 2 Trenggalek

Aplikasi web Bimbingan dan Konseling untuk:

- **Absensi kehadiran** siswa (Masuk / Tidak Masuk dengan keterangan **Alpa, Sakit, Izin**).
- **Rekap absensi** per kelas dan periode.
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

---

## 4. Login dan akun

Login memakai email + password yang dibuat di **Supabase Auth**.
Tidak ada akun bawaan di dalam kode.

- Lupa password → admin membuka **Authentication → Users**, pilih akun,
  lalu **Reset password**.
- Akun nonaktif → ubah kolom `aktif` pada tabel `profiles` (atau hapus akun
  di Auth).
- Sesi login tersimpan otomatis di browser dan diperbarui oleh Supabase.

---

## 5. Fitur utama

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
- Identitas pegawai: Nama, NIP, Level Jabatan, Pangkat, Golongan Ruang,
  Tugas Tambahan, Bulan.
- Tabel kegiatan: No (otomatis), Kegiatan, Pekerjaan (boleh multi-baris), Tanggal.
- Simpan, edit, hapus, lalu unduh **Word (.docx)** atau **PDF**.
- Format mengikuti contoh: A4 portrait, tabel identitas, tabel kegiatan 4 kolom,
  dan blok tanda tangan Kepala Madrasah + Guru BK.

### Data Siswa
- Tambah/edit/nonaktifkan siswa.
- Import massal dari Excel/CSV dengan kolom:
  `NO` (opsional), `NAMA`, `L/P`, `KELAS`, `NIS` (opsional).
- Unduh template import dari tombol **Template**.
- Ekspor data siswa ke Excel.

### Pengaturan
- Nama madrasah, alamat, kota.
- Nama/NIP Kepala Madrasah.
- Nama/NIP/Jabatan Guru BK.
- Ganti password akun yang sedang login.

---

## 6. Struktur folder

```text
website/
├─ index.html                 # kerangka aplikasi (SPA)
├─ start.bat                  # server lokal untuk membuka aplikasi
├─ PANDUAN.txt                # panduan singkat
├─ README.md
├─ supabase/
│  ├─ schema.sql              # tabel + RLS + RPC (tanpa data siswa)
│  ├─ schema-lengkap.local.sql# versi + 284 siswa (lokal, tidak di-push)
│  ├─ BACA-INI.txt            # langkah menerapkan skema
│  └─ cek.sql                 # query verifikasi
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
│     ├─ recap.js
│     ├─ reports.js
│     ├─ students.js
│     ├─ settings.js
│     └─ app.js               # login, router, bootstrap
├─ vendor/                    # SheetJS, jsPDF, docx, FileSaver, supabase-js
└─ legacy-mysql/              # versi lama PHP + MySQL (tidak dipakai)
```

---

## 7. Keamanan

- Login memakai **Supabase Auth** (password di-hash oleh Supabase, bukan di browser).
- Semua tabel memakai **Row Level Security**: hanya pengguna `authenticated`
  dengan profil aktif (`profiles.aktif = true`) yang dapat membaca/menulis.
- Kunci yang dipakai di browser adalah **publishable/anon key**, bukan secret.
- Laporan disimpan melalui RPC `save_work_report` agar header + rincian kegiatan
  tersimpan dalam satu transaksi.
- `service_role`/secret key tidak boleh ditaruh di frontend.

---

## 8. Backup dan pemulihan

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

## 9. Reset password

1. Buka **Supabase Dashboard → Authentication → Users**.
2. Cari email guru BK.
3. Klik menu **⋮ → Reset password**, atau kirim **email pemulihan**.
4. Sampaikan password baru kepada guru yang bersangkutan.

Guru juga dapat mengganti password sendiri lewat
**Pengaturan → Akun → Ganti Password** (password lama diminta untuk verifikasi).

---

## 10. MCP Supabase di OpenCode

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

## 11. Troubleshooting

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

---

## 12. Catatan pengembangan

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

- Untuk mengubah struktur database, edit `supabase/schema.sql` lalu jalankan ulang
  di SQL Editor (atau lewat MCP `apply_migration`).

---

© 2026 BK MTsN 2 Trenggalek
