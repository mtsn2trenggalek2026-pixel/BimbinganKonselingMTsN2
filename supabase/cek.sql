-- ============================================================
--  CEK CEPAT SETELAH MENJALANKAN schema.sql
--  Jalankan di Supabase Dashboard > SQL Editor.
-- ============================================================

-- 1. Jumlah siswa (284 setelah data siswa diimpor)
select count(*) as total_siswa from public.students;

-- 2. Daftar tabel aplikasi
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 3. Profil pengguna (harus ada setelah user Auth dibuat)
select p.email, p.full_name, p.role, p.aktif, p.last_login
from public.profiles p
order by p.created_at;

-- 4. Pengaturan awal
select nama_madrasah, kepala_nama, guru_nama, kota
from public.app_settings
where id = 1;

-- 5. Ringkasan data
select
  (select count(*) from public.students)          as siswa,
  (select count(*) from public.attendance)        as absensi,
  (select count(*) from public.work_reports)      as laporan,
  (select count(*) from public.work_report_items) as rincian_kegiatan;
