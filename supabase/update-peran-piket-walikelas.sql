-- ============================================================
--  TAMBAHAN: PERAN GURU PIKET & WALI KELAS
--  ------------------------------------------------------------
--  Jalankan SEKALI di Supabase:
--    Dashboard > SQL Editor > New query > tempel isi file > Run
--
--  Isi file ini sama dengan
--  migrations/20261107090000_peran_piket_walikelas.sql
--  (disediakan terpisah agar mudah dijalankan manual).
--
--  Bila menggunakan integrasi GitHub Supabase, file migrasi
--  tersebut berjalan otomatis dan file ini tidak perlu dijalankan.
-- ============================================================

-- 1. Perluas pilihan role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'guru_bk', 'guru_piket', 'wali_kelas'));

create or replace function public.is_wali_kelas()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() = 'wali_kelas'; $$;

create or replace function public.is_guru_piket()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() = 'guru_piket'; $$;

-- 2. Tabel pemetaan wali kelas
create table if not exists public.wali_kelas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_group_id   uuid not null references public.class_groups (id) on delete cascade,
  created_at       timestamptz not null default now(),
  constraint wali_kelas_unique unique (user_id, academic_year_id, class_group_id)
);

create index if not exists wali_kelas_user_idx  on public.wali_kelas (user_id);
create index if not exists wali_kelas_class_idx on public.wali_kelas (class_group_id);

-- 3. RPC wali kelas
create or replace function public.wali_kelas_saya()
returns table (
  id uuid, class_group_id uuid, nama text, tingkat integer,
  academic_year_id uuid, tahun_awal integer, tahun_label text
)
language sql stable security definer set search_path = public
as $$
  select w.id, c.id, c.nama, c.tingkat, y.id, y.tahun_awal,
         coalesce(y.nama, 'Tahun Ajaran ' || y.tahun_awal || '/' || (y.tahun_awal + 1))
    from public.wali_kelas w
    join public.class_groups c   on c.id = w.class_group_id
    join public.academic_years y on y.id = w.academic_year_id
   where w.user_id = auth.uid()
   order by y.tahun_awal desc, c.nama;
$$;

create or replace function public.wali_kelas_set(p_user_id uuid, p_class_group_id uuid)
returns jsonb language plpgsql security invoker set search_path = public
as $$
declare v_year uuid;
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
end; $$;

create or replace function public.wali_kelas_hapus(p_id uuid)
returns jsonb language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menghapus wali kelas.' using errcode = '42501';
  end if;
  delete from public.wali_kelas where id = p_id;
  return jsonb_build_object('deleted', p_id);
end; $$;

-- 4. Data absensi satu tanggal (dipakai dasbor piket & wali kelas)
create or replace function public.absensi_hari_ini(p_tanggal date)
returns table (
  student_id uuid, nama text, nis text, jenis_kelamin text, kelas text,
  tingkat integer, status text, keterangan text, catatan text, status_hari boolean
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.nama, s.nis, s.jenis_kelamin::text,
         coalesce(h.kelas, s.kelas) as kelas, coalesce(h.tingkat, s.tingkat),
         coalesce(a.status, 'masuk'), a.keterangan, a.catatan,
         (a.id is not null)
    from public.students s
    left join public.student_history h
      on h.student_id = s.id
     and h.academic_year_id = (select s2.academic_year_id from public.semesters s2 where s2.status = 'aktif' limit 1)
    left join public.attendance a
      on a.student_id = s.id and a.tanggal = p_tanggal
   where s.aktif
     and (
       public.is_admin() or public.is_staff()
       or exists (select 1 from public.wali_kelas w
                   where w.user_id = auth.uid() and w.class_group_id = h.class_group_id)
     )
   order by coalesce(h.kelas, s.kelas), s.nama;
$$;

-- 5. RLS
alter table public.wali_kelas enable row level security;

drop policy if exists wali_kelas_select on public.wali_kelas;
create policy wali_kelas_select on public.wali_kelas
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists wali_kelas_write on public.wali_kelas;
create policy wali_kelas_write on public.wali_kelas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists students_select_wali on public.students;
create policy students_select_wali on public.students
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.student_history h
                 join public.wali_kelas w on w.class_group_id = h.class_group_id
                where h.student_id = students.id and w.user_id = auth.uid())
  );

drop policy if exists attendance_select_wali on public.attendance;
create policy attendance_select_wali on public.attendance
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.student_history h
                 join public.wali_kelas w on w.class_group_id = h.class_group_id
                where h.student_id = attendance.student_id and w.user_id = auth.uid())
  );

drop policy if exists attendance_select_piket on public.attendance;
create policy attendance_select_piket on public.attendance
  for select to authenticated using (public.is_guru_piket());

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

drop policy if exists class_groups_select_piket on public.class_groups;
create policy class_groups_select_piket on public.class_groups
  for select to authenticated using (public.is_guru_piket());

drop policy if exists students_select_piket on public.students;
create policy students_select_piket on public.students
  for select to authenticated using (public.is_guru_piket());

drop policy if exists student_history_select_piket on public.student_history;
create policy student_history_select_piket on public.student_history
  for select to authenticated using (public.is_guru_piket());

-- 6. Fungsi akun menerima peran baru
create or replace function public.admin_create_account(
  p_email text, p_password text, p_full_name text default '', p_role text default 'admin'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role  text := coalesce(nullif(btrim(p_role), ''), 'admin');
  v_id    uuid := gen_random_uuid();
  v_name  text;
begin
  if not public.is_superadmin() then
    raise exception 'Hanya superadmin yang dapat membuat akun.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Format email tidak valid.' using errcode = '22023';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Password minimal 8 karakter.' using errcode = '22023';
  end if;
  if v_role not in ('superadmin', 'admin', 'guru_bk', 'guru_piket', 'wali_kelas') then
    raise exception 'Role tidak dikenal.' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Email sudah terdaftar.' using errcode = '23505';
  end if;

  v_name := coalesce(nullif(btrim(coalesce(p_full_name, '')), ''), split_part(v_email, '@', 1));

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', v_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    now(), now(), now()
  );

  insert into public.profiles (id, email, full_name, role, aktif)
  values (v_id, v_email, v_name, v_role, true)
  on conflict (id) do update set
    email = excluded.email, full_name = excluded.full_name,
    role = excluded.role, aktif = true;

  return v_id;
end;
$$;

create or replace function public.admin_update_account(
  p_id uuid, p_full_name text default null, p_role text default null,
  p_aktif boolean default null, p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_target public.profiles;
begin
  if not public.is_superadmin() then
    raise exception 'Hanya superadmin yang dapat mengubah akun.' using errcode = '42501';
  end if;

  select * into v_target from public.profiles where id = p_id;
  if not found then
    raise exception 'Akun tidak ditemukan.' using errcode = 'P0002';
  end if;

  if p_role is not null and p_role not in ('superadmin', 'admin', 'guru_bk', 'guru_piket', 'wali_kelas') then
    raise exception 'Role tidak dikenal.' using errcode = '22023';
  end if;

  if p_id = auth.uid() and (p_aktif = false or (p_role is not null and p_role <> 'superadmin')) then
    raise exception 'Anda tidak dapat menonaktifkan atau menurunkan role akun sendiri.' using errcode = '22023';
  end if;

  if p_password is not null and p_password <> '' then
    if length(p_password) < 8 then
      raise exception 'Password minimal 8 karakter.' using errcode = '22023';
    end if;
    update auth.users
       set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
     where id = p_id;
  end if;

  update public.profiles set
    full_name = coalesce(nullif(btrim(coalesce(p_full_name, '')), ''), full_name),
    role      = coalesce(p_role, role),
    aktif     = coalesce(p_aktif, aktif)
  where id = p_id;
end;
$$;

-- 7. Hak akses
grant select, insert, update, delete on public.wali_kelas to authenticated;
grant execute on function public.is_wali_kelas()            to authenticated;
grant execute on function public.is_guru_piket()            to authenticated;
grant execute on function public.wali_kelas_saya()          to authenticated;
grant execute on function public.wali_kelas_set(uuid, uuid) to authenticated;
grant execute on function public.wali_kelas_hapus(uuid)     to authenticated;
grant execute on function public.absensi_hari_ini(date)     to authenticated;

-- 8. Periksa: harus muncul 4 fungsi
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('wali_kelas_saya', 'wali_kelas_set', 'wali_kelas_hapus', 'absensi_hari_ini')
 order by proname;
