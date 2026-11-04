-- ============================================================
--  PERBAIKI NAMA TABEL YANG SALAH (bila ada)
--  ------------------------------------------------------------
--  Gejala:
--    - semua menu tampil "Halaman belum termuat"
--    - semua data kosong setelah login
--  Penyebab: tabel dibuat lewat Table Editor dengan nama
--  berbeda, mis. "students" menjadi "Students" (huruf besar),
--  sedangkan aplikasi mencari nama huruf kecil.
--
--  Jalankan di Supabase Dashboard > SQL Editor > New query > Run.
--  Perintah ini hanya berjalan bila nama huruf kecil BELUM ada,
--  jadi tidak menimpa tabel yang sudah benar.
-- ============================================================

do $$
declare
  v_from text;
  v_to   text;
begin
  for v_from, v_to in
    select * from (values
      ('Students',           'students'),
      ('Student',            'students'),
      ('Profiles',           'profiles'),
      ('Profile',            'profiles'),
      ('Attendance',         'attendance'),
      ('AppSettings',        'app_settings'),
      ('App_Settings',       'app_settings'),
      ('WorkReports',        'work_reports'),
      ('WorkReportItems',    'work_report_items'),
      ('AcademicYears',      'academic_years'),
      ('Academic_Years',     'academic_years'),
      ('Semesters',          'semesters'),
      ('ClassGroups',        'class_groups'),
      ('Class_Groups',       'class_groups'),
      ('StudentHistory',     'student_history'),
      ('Student_History',    'student_history'),
      ('Graduations',        'graduations')
    ) as t(a, b)
  loop
    if to_regclass('public.' || quote_ident(v_from)) is not null
       and to_regclass('public.' || quote_ident(v_to)) is null then
      execute format('alter table public.%I rename to %I', v_from, v_to);
      raise notice 'Renamed public.% -> public.%', v_from, v_to;
    end if;
  end loop;
end;
$$;

-- ============================================================
--  PERIKSA HASIL: semua harus berstatus "ADA"
-- ============================================================
select t.nama,
       case when to_regclass('public.' || t.nama) is null then 'BELUM ADA'
            else 'ADA' end as status
from (values
  ('profiles'), ('students'), ('attendance'),
  ('work_reports'), ('work_report_items'), ('app_settings'),
  ('academic_years'), ('semesters'), ('class_groups'),
  ('student_history'), ('graduations')
) as t(nama);

-- Bila ada yang BELUM ADA, jalankan berurutan:
--   1. schema.sql
--   2. migrations/20261105090000_akademik_roles.sql
--   3. setup-superadmin.sql (bila perlu)
