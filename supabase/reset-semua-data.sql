-- ============================================================
--  RESET / HAPUS SEMUA DATA APLIKASI
--  ------------------------------------------------------------
--  Cara pakai:
--    1. Supabase Dashboard > SQL Editor > New query
--    2. Copy SELURUH isi file ini, tempel, lalu klik "Run"
--
--  YANG DIHAPUS:
--    - semua siswa (beserta foto di Storage)
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

-- 6. Foto siswa di Storage (abaikan bila bucket belum ada)
do $$
begin
  if exists (select 1 from storage.buckets where id = 'siswa-foto') then
    delete from storage.objects where bucket_id = 'siswa-foto';
  end if;
end;
$$;

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
--  SETELAH DATA KOSONG
--  ------------------------------------------------------------
--  Buat tahun ajaran baru dari aplikasi:
--    Login sebagai admin/superadmin > menu "Tahun & Semester"
--    > "Tahun Ajaran Baru".
--  Akun login tetap ada dan tidak perlu dibuat ulang.
-- ============================================================
