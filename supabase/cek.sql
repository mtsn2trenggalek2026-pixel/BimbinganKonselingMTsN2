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

-- 6. Tahun ajaran & semester (setelah migrasi 20261105090000_akademik_roles.sql)
select y.tahun_awal, y.tahun_akhir, y.nama, y.is_aktif as tahun_aktif,
       s.jenis, s.status, s.hari_efektif, s.tanggal_mulai, s.tanggal_selesai
from public.academic_years y
left join public.semesters s on s.academic_year_id = y.id
order by y.tahun_awal desc, s.urutan;

-- 7. Peran akun (superadmin / admin / guru_bk)
select email, full_name, role, aktif from public.profiles order by role, email;

-- 8. Rombel per tingkat
select y.tahun_awal, c.tingkat, c.nama, c.wali_kelas, c.is_aktif
from public.class_groups c
join public.academic_years y on y.id = c.academic_year_id
order by y.tahun_awal desc, c.tingkat, c.nama;

-- 9. Riwayat kelas siswa (kunci penyimpanan data 5 tahun)
select y.tahun_awal, h.tingkat, h.kelas, h.status, count(*) as siswa
from public.student_history h
join public.academic_years y on y.id = h.academic_year_id
group by y.tahun_awal, h.tingkat, h.kelas, h.status
order by y.tahun_awal desc, h.tingkat, h.kelas;

-- 10. Kelulusan kelas IX & sekolah lanjutan
select y.tahun_awal, s.nama, g.status, g.sekolah_lanjutan, g.jenis_sekolah, g.jalur
from public.graduations g
join public.students s on s.id = g.student_id
join public.academic_years y on y.id = g.academic_year_id
order by y.tahun_awal desc, s.nama;

-- 10b. Fungsi hapus tahun ajaran/semester (harus muncul 2 baris)
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('delete_semester', 'delete_academic_year');

-- 11. Bucket foto siswa (harus public = true dan file_size_limit = 102400)
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'siswa-foto';
