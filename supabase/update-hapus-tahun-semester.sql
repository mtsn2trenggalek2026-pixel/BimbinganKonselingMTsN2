-- ============================================================
--  TAMBAHAN: HAPUS TAHUN AJARAN & SEMESTER
--  ------------------------------------------------------------
--  Jalankan SEKALI di Supabase:
--    Dashboard > SQL Editor > New query > tempel isi file > Run
--
--  Hanya perlu bila migrasi
--  "20261105090000_akademik_roles.sql" dijalankan SEBELUM
--  fitur hapus tahun ajaran/semester ditambahkan.
--
--  Yang terjadi saat tahun ajaran dihapus:
--    - semester, rombel, riwayat kelas, dan catatan kelulusan
--      tahun tersebut dihapus,
--    - riwayat absensi TIDAK dihapus (tautan semester dikosongkan),
--    - laporan kerja tidak tersentuh.
-- ============================================================

-- Hapus satu semester
create or replace function public.delete_semester(p_semester_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.semesters;
  v_att integer;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menghapus semester.' using errcode = '42501';
  end if;

  select * into v_row from public.semesters where id = p_semester_id;
  if not found then
    raise exception 'Semester tidak ditemukan.' using errcode = 'P0002';
  end if;

  update public.attendance set semester_id = null where semester_id = p_semester_id;
  get diagnostics v_att = row_count;

  delete from public.semesters where id = p_semester_id;

  return jsonb_build_object('deleted', p_semester_id, 'jenis', v_row.jenis,
                            'status_sebelumnya', v_row.status, 'absensi_dilepas', v_att);
end;
$$;

-- Hapus satu tahun ajaran
create or replace function public.delete_academic_year(p_year_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.academic_years;
  v_att integer; v_hist integer; v_grad integer; v_class integer; v_sem integer;
  v_semester uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menghapus tahun ajaran.' using errcode = '42501';
  end if;

  select * into v_row from public.academic_years where id = p_year_id;
  if not found then
    raise exception 'Tahun ajaran tidak ditemukan.' using errcode = 'P0002';
  end if;

  update public.attendance set academic_year_id = null, semester_id = null
   where academic_year_id = p_year_id
      or semester_id in (select id from public.semesters where academic_year_id = p_year_id);
  get diagnostics v_att = row_count;

  select count(*) into v_sem from public.semesters where academic_year_id = p_year_id;
  select count(*) into v_class from public.class_groups where academic_year_id = p_year_id;

  delete from public.graduations where academic_year_id = p_year_id;
  get diagnostics v_grad = row_count;

  delete from public.student_history where academic_year_id = p_year_id;
  get diagnostics v_hist = row_count;

  delete from public.academic_years where id = p_year_id;

  if not exists (select 1 from public.semesters where status = 'aktif') then
    select id into v_semester from public.semesters order by tanggal_mulai desc limit 1;
    if v_semester is not null then
      update public.semesters set status = 'aktif' where id = v_semester;
    end if;
  end if;

  return jsonb_build_object('deleted', p_year_id, 'semester', v_sem,
    'rombel', v_class, 'riwayat_kelas', v_hist, 'kelulusan', v_grad, 'absensi_dilepas', v_att);
end;
$$;

grant execute on function public.delete_semester(uuid)      to authenticated;
grant execute on function public.delete_academic_year(uuid) to authenticated;

-- Periksa
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('delete_semester', 'delete_academic_year');
