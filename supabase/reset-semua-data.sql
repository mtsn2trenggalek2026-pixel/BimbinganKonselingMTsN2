-- ============================================================
--  RESET / HAPUS SEMUA DATA APLIKASI
--  ------------------------------------------------------------
--  Cara pakai:
--    1. Supabase Dashboard > SQL Editor > New query
--    2. Copy SELURUH isi file ini, tempel, lalu klik "Run"
--
--  YANG DIHAPUS:
--    - semua siswa (foto di Storage dihapus lewat menu Storage,
--      karena tabel storage.objects dilindungi Supabase)
--    - semua riwayat absensi
--    - semua laporan kerja + rincian kegiatan
--    - semua kelulusan & riwayat kelas
--    - semua rombel (kelas)
--    - semua semester dan tahun ajaran
--
--  YANG TIDAK DIHAPUS:
--    - akun login (tabel profiles / Authentication)
--    - pengaturan madrasah (app_settings)
--
--  PERINGATAN: tindakan ini PERMANEN. Buat cadangan dulu
--  (Database > Backups, atau ekspor Data Siswa ke Excel).
-- ============================================================

begin;

-- 1. Lepaskan tautan absensi (data absensi dihapus di langkah berikut)
update public.attendance
   set academic_year_id = null,
       semester_id = null;

-- 2. Laporan kerja
delete from public.work_report_items;
delete from public.work_reports;

-- 3. Absensi
delete from public.attendance;

-- 4. Data akademik
delete from public.graduations;
delete from public.student_history;
delete from public.class_groups;
delete from public.semesters;
delete from public.academic_years;

-- 5. Data siswa
delete from public.students;

-- 6. Kosongkan tautan foto pada profil siswa (berkas foto TIDAK bisa
--    dihapus lewat SQL — Storage melindungi tabel storage.objects).
--    Lihat catatan "HAPUS FOTO" di bawah file ini.
--    (Data siswa sudah dihapus, jadi baris ini hanya jaring pengaman.)
update public.students
   set foto_path = null,
       foto_ukuran = null,
       foto_uploaded_at = null
 where foto_path is not null;

commit;

-- ============================================================
--  PERIKSA HASIL (semua angka harus 0)
-- ============================================================
select
  (select count(*) from public.students)          as siswa,
  (select count(*) from public.attendance)        as absensi,
  (select count(*) from public.work_reports)      as laporan,
  (select count(*) from public.work_report_items) as rincian_kegiatan,
  (select count(*) from public.academic_years)    as tahun_ajaran,
  (select count(*) from public.semesters)         as semester,
  (select count(*) from public.class_groups)      as rombel,
  (select count(*) from public.student_history)   as riwayat_kelas,
  (select count(*) from public.graduations)       as kelulusan,
  (select count(*) from storage.objects
     where bucket_id = 'siswa-foto')              as foto;

-- ============================================================
--  HAPUS FOTO DI STORAGE (manual, di luar SQL)
--  ------------------------------------------------------------
--  Supabase memblokir "delete from storage.objects"
--  (error 42501: Direct deletion from storage tables is not
--  allowed). Hapus foto lewat salah satu cara:
--
--  A. Dashboard (paling mudah)
--     1. Menu "Storage" > bucket "siswa-foto"
--     2. Klik folder pertama, tahan Shift + klik folder terakhir
--     3. Klik "Delete" > konfirmasi
--
--  B. Lewat aplikasi
--     1. Login sebagai admin/superadmin
--     2. Buka data siswa satu per satu > Edit > Hapus foto
--        (tidak praktis bila siswanya banyak)
--
--  C. Lewat API (service_role key, JANGAN ditaruh di website)
--     Simpan sebagai file bernama hapus-foto.mjs lalu jalankan
--     "node hapus-foto.mjs" di komputer Anda:
--
--       import { createClient } from "@supabase/supabase-js";
--       const sb = createClient("https://mhjvebnxsutwbudjwmud.supabase.co",
--         "ISI_SERVICE_ROLE_KEY");
--       const { data: folders } = await sb.storage.from("siswa-foto").list("", { limit: 1000 });
--       for (const f of folders || []) {
--         const { data: files } = await sb.storage.from("siswa-foto").list(f.name, { limit: 1000 });
--         const paths = (files || []).map(x => f.name + "/" + x.name);
--         if (paths.length) await sb.storage.from("siswa-foto").remove(paths);
--         await sb.storage.from("siswa-foto").remove([f.name]).catch(() => {});
--       }
--       console.log("Foto siswa dihapus.");
--
--  Foto yang tertinggal tidak memengaruhi aplikasi; hanya memakan
--  sedikit ruang Storage dan bisa dihapus kapan saja.
-- ============================================================

-- ============================================================
--  SETELAH DATA KOSONG
--  ------------------------------------------------------------
--  Buat tahun ajaran baru dari aplikasi:
--    Login sebagai admin/superadmin > menu "Tahun & Semester"
--    > "Tahun Ajaran Baru".
--  Akun login tetap ada dan tidak perlu dibuat ulang.
-- ============================================================
