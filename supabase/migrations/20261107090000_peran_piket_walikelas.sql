-- ============================================================
--  PERAN BARU: GURU PIKET & WALI KELAS
--  ------------------------------------------------------------
--  Menambahkan:
--   1. pilihan role: superadmin, admin, guru_bk, guru_piket, wali_kelas
--   2. tabel wali_kelas (pemetaan akun login -> rombel yang diampu)
--   3. RPC wali_kelas_set / wali_kelas_hapus / wali_kelas_saya
--   4. RPC absensi_hari_ini (data kehadiran untuk dasbor)
--
--  Aturan akses:
--   - guru_piket : hanya mengisi/merubah absensi (tidak lihat data siswa
--                  lengkap, tidak ubah siswa, tidak akses laporan kerja)
--   - wali_kelas : hanya MELIHAT siswa di rombel yang diampu (baca saja),
--                  termasuk siapa yang masuk / tidak masuk.
--
--  File aman dijalankan ulang (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERLUAS PILIHAN ROLE
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'guru_bk', 'guru_piket', 'wali_kelas'));

create or replace function public.is_wali_kelas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'wali_kelas';
$$;

create or replace function public.is_guru_piket()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'guru_piket';
$$;

-- Wali kelas memiliki izin BACA data (siswa, absensi, rombel) pada rombelnya
-- sendiri. is_staff() tetap dipakai policy lama; fungsi ini menambahkan akses
-- baca terbatas untuk wali kelas.
create or replace function public.can_read_students()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff() or public.is_wali_kelas();
$$;

-- ------------------------------------------------------------
-- 2. TABEL WALI KELAS
-- ------------------------------------------------------------
create table if not exists public.wali_kelas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_group_id   uuid not null references public.class_groups (id) on delete cascade,
  created_at       timestamptz not null default now(),
  constraint wali_kelas_unique unique (user_id, academic_year_id, class_group_id)
);

create index if not exists wali_kelas_user_idx on public.wali_kelas (user_id);
create index if not exists wali_kelas_class_idx on public.wali_kelas (class_group_id);

comment on table public.wali_kelas is 'Akun wali kelas beserta rombel yang diampu per tahun ajaran.';

-- ------------------------------------------------------------
-- 3. RPC WALI KELAS
-- ------------------------------------------------------------

-- Daftar rombel yang diampu pengguna yang sedang login.
create or replace function public.wali_kelas_saya()
returns table (
  id uuid, class_group_id uuid, nama text, tingkat integer,
  academic_year_id uuid, tahun_awal integer, tahun_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, c.id, c.nama, c.tingkat, y.id, y.tahun_awal,
         coalesce(y.nama, 'Tahun Ajaran ' || y.tahun_awal || '/' || (y.tahun_awal + 1))
    from public.wali_kelas w
    join public.class_groups c on c.id = w.class_group_id
    join public.academic_years y on y.id = w.academic_year_id
   where w.user_id = auth.uid()
   order by y.tahun_awal desc, c.nama;
$$;

-- Simpan pemetaan wali kelas (khusus admin/superadmin).
create or replace function public.wali_kelas_set(p_user_id uuid, p_class_group_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_year uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengatur wali kelas.' using errcode = '42501';
  end if;

  select academic_year_id into v_year from public.class_groups where id = p_class_group_id;
  if v_year is null then
    raise exception 'Rombel tidak ditemukan.' using errcode = 'P0002';
  end if;

  insert into public.wali_kelas (user_id, academic_year_id, class_group_id)
  values (p_user_id, v_year, p_class_group_id)
  on conflict do nothing;

  return jsonb_build_object('user_id', p_user_id, 'class_group_id', p_class_group_id);
end;
$$;

create or replace function public.wali_kelas_hapus(p_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menghapus wali kelas.' using errcode = '42501';
  end if;
  delete from public.wali_kelas where id = p_id;
  return jsonb_build_object('deleted', p_id);
end;
$$;

-- ------------------------------------------------------------
-- 4. RPC ABSENSI HARI INI (hemat: satu panggilan untuk semua siswa)
-- ------------------------------------------------------------
create or replace function public.absensi_hari_ini(p_tanggal date)
returns table (
  student_id uuid, nama text, nis text, jenis_kelamin text, kelas text,
  tingkat integer, status text, keterangan text, catatan text, status_hari boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
         s.nama,
         s.nis,
         s.jenis_kelamin::text,
         coalesce(h.kelas, s.kelas),
         coalesce(h.tingkat, s.tingkat),
         coalesce(a.status, 'masuk'),
         a.keterangan,
         a.catatan,
         (a.id is not null)
    from public.students s
    left join public.student_history h
      on h.student_id = s.id
     and h.academic_year_id = (
       select s2.academic_year_id from public.semesters s2
        where s2.status = 'aktif' limit 1
     )
    left join public.attendance a
      on a.student_id = s.id and a.tanggal = p_tanggal
   where s.aktif
     and (
       public.is_admin()
       or public.is_staff()
       or exists (
         select 1 from public.wali_kelas w
          where w.user_id = auth.uid()
            and w.class_group_id = h.class_group_id
       )
     )
   order by kelas, s.nama;
$$;

-- ------------------------------------------------------------
-- 5. RLS TABEL WALI KELAS
-- ------------------------------------------------------------
alter table public.wali_kelas enable row level security;

drop policy if exists wali_kelas_select on public.wali_kelas;
create policy wali_kelas_select on public.wali_kelas
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists wali_kelas_write on public.wali_kelas;
create policy wali_kelas_write on public.wali_kelas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 6. RLS BACA UNTUK WALI KELAS (hanya rombel yang diampu)
-- ------------------------------------------------------------
drop policy if exists students_select_wali on public.students;
create policy students_select_wali on public.students
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
        from public.student_history h
        join public.wali_kelas w on w.class_group_id = h.class_group_id
       where h.student_id = students.id and w.user_id = auth.uid()
    )
  );

drop policy if exists attendance_select_wali on public.attendance;
create policy attendance_select_wali on public.attendance
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
        from public.student_history h
        join public.wali_kelas w on w.class_group_id = h.class_group_id
       where h.student_id = attendance.student_id and w.user_id = auth.uid()
    )
  );

-- Guru piket: boleh melihat tanggal absensi yang sudah ada (untuk mengisi/mengubah).
drop policy if exists attendance_select_piket on public.attendance;
create policy attendance_select_piket on public.attendance
  for select to authenticated
  using (public.is_guru_piket());

-- Guru piket: menulis absensi.
drop policy if exists attendance_insert_piket on public.attendance;
create policy attendance_insert_piket on public.attendance
  for insert to authenticated with check (public.is_staff() or public.is_guru_piket());

drop policy if exists attendance_update_piket on public.attendance;
create policy attendance_update_piket on public.attendance
  for update to authenticated
  using (public.is_staff() or public.is_guru_piket())
  with check (public.is_staff() or public.is_guru_piket());

drop policy if exists semesters_select_wali on public.semesters;
create policy semesters_select_wali on public.semesters
  for select to authenticated using (public.is_staff() or public.is_wali_kelas());

drop policy if exists academic_years_select_wali on public.academic_years;
create policy academic_years_select_wali on public.academic_years
  for select to authenticated using (public.is_staff() or public.is_wali_kelas());

drop policy if exists class_groups_select_wali on public.class_groups;
create policy class_groups_select_wali on public.class_groups
  for select to authenticated using (public.is_staff() or public.is_wali_kelas());

drop policy if exists student_history_select_wali on public.student_history;
create policy student_history_select_wali on public.student_history
  for select to authenticated using (public.is_staff() or public.is_wali_kelas());

-- Guru piket perlu daftar rombel (untuk filter kelas di halaman absensi).
drop policy if exists class_groups_select_piket on public.class_groups;
create policy class_groups_select_piket on public.class_groups
  for select to authenticated using (public.is_guru_piket());

drop policy if exists students_select_piket on public.students;
create policy students_select_piket on public.students
  for select to authenticated using (public.is_guru_piket());

drop policy if exists student_history_select_piket on public.student_history;
create policy student_history_select_piket on public.student_history
  for select to authenticated using (public.is_guru_piket());

-- ------------------------------------------------------------
-- 7. HAK AKSES
-- ------------------------------------------------------------
grant select, insert, update, delete on public.wali_kelas to authenticated;
grant execute on function public.is_wali_kelas()                to authenticated;
grant execute on function public.is_guru_piket()                to authenticated;
grant execute on function public.can_read_students()            to authenticated;
grant execute on function public.wali_kelas_saya()              to authenticated;
grant execute on function public.wali_kelas_set(uuid, uuid)     to authenticated;
grant execute on function public.wali_kelas_hapus(uuid)         to authenticated;
grant execute on function public.absensi_hari_ini(date)         to authenticated;

-- ------------------------------------------------------------
-- 8. PERIKSA
-- ------------------------------------------------------------
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('wali_kelas_saya', 'wali_kelas_set', 'wali_kelas_hapus', 'absensi_hari_ini')
 order by proname;
