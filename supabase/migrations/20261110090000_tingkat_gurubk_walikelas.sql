-- ============================================================
--  PEMBATASAN AKSES GURU BK & WALI KELAS
--  ------------------------------------------------------------
--   1. Guru BK hanya mengawasi SATU TINGKAT (VII / VIII / IX).
--      Tingkat disimpan di profiles.tingkat.
--   2. Wali kelas hanya mengampu SATU KELAS per tahun ajaran.
--      Pemetaan disimpan di tabel wali_kelas (maks. 1 baris per
--      akun + tahun ajaran).
--   3. Fungsi absensi_hari_ini & RPC wali kelas disesuaikan.
--
--  File aman dijalankan ulang (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. KOLOM TINGKAT PADA PROFIL
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists tingkat integer;

alter table public.profiles
  drop constraint if exists profiles_tingkat_check;
alter table public.profiles
  add constraint profiles_tingkat_check
  check (tingkat is null or tingkat in (7, 8, 9));

comment on column public.profiles.tingkat is 'Tingkat yang diawasi guru BK (7/8/9). Kosong = semua tingkat.';

-- Fungsi bantu: tingkat milik guru BK yang login.
create or replace function public.my_tingkat()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select p.tingkat from public.profiles p
   where p.id = auth.uid() and p.aktif
   limit 1;
$$;

-- ------------------------------------------------------------
-- 2. SATU KELAS PER WALI KELAS (per tahun ajaran)
-- ------------------------------------------------------------
-- Hapus duplikat lebih dulu bila sebelumnya ada lebih dari satu.
delete from public.wali_kelas a
 using public.wali_kelas b
 where a.user_id = b.user_id
   and a.academic_year_id = b.academic_year_id
   and a.created_at > b.created_at;

alter table public.wali_kelas
  drop constraint if exists wali_kelas_unique;

alter table public.wali_kelas
  drop constraint if exists wali_kelas_satu_kelas_per_tahun;

alter table public.wali_kelas
  add constraint wali_kelas_satu_kelas_per_tahun
  unique (user_id, academic_year_id);

-- ------------------------------------------------------------
-- 3. RPC WALI KELAS
-- ------------------------------------------------------------
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

  -- Satu wali kelas hanya untuk satu kelas per tahun ajaran:
  -- pemetaan lama pada tahun ajaran yang sama diganti.
  delete from public.wali_kelas
   where user_id = p_user_id and academic_year_id = v_year;

  insert into public.wali_kelas (user_id, academic_year_id, class_group_id)
  values (p_user_id, v_year, p_class_group_id);

  -- Pastikan akun berperan wali_kelas (kecuali admin/superadmin).
  update public.profiles
     set role = 'wali_kelas'
   where id = p_user_id and role not in ('superadmin', 'admin');

  return jsonb_build_object('user_id', p_user_id, 'class_group_id', p_class_group_id, 'academic_year_id', v_year);
end;
$$;

-- ------------------------------------------------------------
-- 4. ABSENSI HARI INI — ikut membatasi tingkat guru BK
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
       public.is_admin()
       or (public.is_staff() and (public.my_tingkat() is null or coalesce(h.tingkat, s.tingkat) = public.my_tingkat()))
       or exists (select 1 from public.wali_kelas w
                   where w.user_id = auth.uid() and w.class_group_id = h.class_group_id)
     )
   order by coalesce(h.kelas, s.kelas), s.nama;
$$;

-- ------------------------------------------------------------
-- 5. RLS — guru BK hanya melihat siswa pada tingkatnya
-- ------------------------------------------------------------
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated
  using (public.is_admin() or (public.is_staff() and (public.my_tingkat() is null or public.my_tingkat() = coalesce(public.students.tingkat, 0))));

-- Policy tambahan agar siswa tanpa tingkat tetap terlihat bila guru BK belum diset
drop policy if exists students_select_bk_tanpa_tingkat on public.students;
create policy students_select_bk_tanpa_tingkat on public.students
  for select to authenticated
  using (public.is_staff() and public.my_tingkat() is not null and public.students.tingkat is null);

drop policy if exists student_history_select_bk on public.student_history;
create policy student_history_select_bk on public.student_history
  for select to authenticated
  using (public.is_admin() or (public.is_staff() and (public.my_tingkat() is null or public.student_history.tingkat = public.my_tingkat())));

drop policy if exists attendance_select_bk on public.attendance;
create policy attendance_select_bk on public.attendance
  for select to authenticated
  using (
    public.is_admin()
    or public.is_guru_piket()
    or (
      public.is_staff()
      and (
        public.my_tingkat() is null
        or exists (
          select 1 from public.students s
           where s.id = public.attendance.student_id
             and (s.tingkat is null or s.tingkat = public.my_tingkat())
        )
      )
    )
    or exists (
      select 1 from public.student_history h
        join public.wali_kelas w on w.class_group_id = h.class_group_id
       where h.student_id = public.attendance.student_id and w.user_id = auth.uid()
    )
  );

-- Tulis absensi: guru BK hanya pada tingkatnya.
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (
    public.is_admin()
    or public.is_guru_piket()
    or (
      public.is_staff()
      and (
        public.my_tingkat() is null
        or exists (
          select 1 from public.students s
           where s.id = public.attendance.student_id
             and (s.tingkat is null or s.tingkat = public.my_tingkat())
        )
      )
    )
  );

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (
    public.is_admin()
    or public.is_guru_piket()
    or (
      public.is_staff()
      and (
        public.my_tingkat() is null
        or exists (
          select 1 from public.students s
           where s.id = public.attendance.student_id
             and (s.tingkat is null or s.tingkat = public.my_tingkat())
        )
      )
    )
  )
  with check (
    public.is_admin()
    or public.is_guru_piket()
    or (
      public.is_staff()
      and (
        public.my_tingkat() is null
        or exists (
          select 1 from public.students s
           where s.id = public.attendance.student_id
             and (s.tingkat is null or s.tingkat = public.my_tingkat())
        )
      )
    )
  );

-- ------------------------------------------------------------
-- 6. AKUN — simpan tingkat guru BK & kelas wali kelas
-- ------------------------------------------------------------
create or replace function public.admin_create_account(
  p_email text, p_password text, p_full_name text default '', p_role text default 'admin',
  p_tingkat integer default null, p_class_group_id uuid default null
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
  v_year  uuid;
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

  insert into public.profiles (id, email, full_name, role, aktif, tingkat)
  values (
    v_id, v_email, v_name, v_role, true,
    case when v_role = 'guru_bk' then p_tingkat else null end
  )
  on conflict (id) do update set
    email = excluded.email, full_name = excluded.full_name,
    role = excluded.role, aktif = true, tingkat = excluded.tingkat;

  -- Wali kelas: langsung pasangkan ke satu kelas.
  if v_role = 'wali_kelas' and p_class_group_id is not null then
    select academic_year_id into v_year from public.class_groups where id = p_class_group_id;
    if v_year is not null then
      delete from public.wali_kelas where user_id = v_id and academic_year_id = v_year;
      insert into public.wali_kelas (user_id, academic_year_id, class_group_id)
      values (v_id, v_year, p_class_group_id);
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_update_account(
  p_id uuid, p_full_name text default null, p_role text default null,
  p_aktif boolean default null, p_password text default null,
  p_tingkat integer default null, p_class_group_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_target public.profiles;
  v_year   uuid;
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
    aktif     = coalesce(p_aktif, aktif),
    tingkat   = case
                  when coalesce(p_role, role) = 'guru_bk' then coalesce(p_tingkat, tingkat)
                  else null
                end
  where id = p_id;

  -- Wali kelas: satu kelas per tahun ajaran.
  if p_class_group_id is not null then
    select academic_year_id into v_year from public.class_groups where id = p_class_group_id;
    if v_year is not null then
      delete from public.wali_kelas where user_id = p_id and academic_year_id = v_year;
      insert into public.wali_kelas (user_id, academic_year_id, class_group_id)
      values (p_id, v_year, p_class_group_id);
    end if;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 7. HAK AKSES + LENGKAPI TINGKAT SISWA YANG BELUM DIISI
-- ------------------------------------------------------------
grant execute on function public.my_tingkat() to authenticated;

grant execute on function public.admin_create_account(text, text, text, text, integer, uuid) to authenticated;
grant execute on function public.admin_update_account(uuid, text, text, boolean, text, integer, uuid) to authenticated;

-- Hapus fungsi lama (versi tanpa parameter tingkat).
drop function if exists public.admin_create_account(text, text, text, text);
drop function if exists public.admin_update_account(uuid, text, text, boolean, text);

-- Lengkapi kolom tingkat pada siswa dari kolom kelas.
update public.students
   set tingkat = case
     when upper(regexp_replace(kelas, '[^A-Za-z0-9]', '', 'g')) ~ '^(IX|9)' then 9
     when upper(regexp_replace(kelas, '[^A-Za-z0-9]', '', 'g')) ~ '^(VIII|8)' then 8
     else 7
   end
 where tingkat is null and kelas is not null;

-- ------------------------------------------------------------
-- 8. PERIKSA
-- ------------------------------------------------------------
select p.email, p.role, p.tingkat, p.aktif
  from public.profiles p
 order by p.role, p.email;

select w.user_id, c.nama as kelas, y.tahun_awal
  from public.wali_kelas w
  join public.class_groups c on c.id = w.class_group_id
  join public.academic_years y on y.id = w.academic_year_id
 order by y.tahun_awal desc, c.nama;
