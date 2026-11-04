-- ============================================================
--  Website BK MTsN 2 Trenggalek â€” Skema PostgreSQL / Supabase
--  ------------------------------------------------------------
--  Cara pakai:
--    1. Buka Supabase Dashboard > SQL Editor > New query.
--    2. Copy seluruh isi file ini, lalu klik "Run".
--    3. Buat akun guru BK di Authentication > Users (Auto Confirm).
--    4. Isi URL + anon/publishable key di assets/js/config.js.
--
--  File ini aman dijalankan ulang (idempotent): tabel yang sudah
--  ada tidak dihapus, data siswa diperbarui berdasarkan nama+kelas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFIL PENGGUNA (terhubung ke auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  full_name   text not null default '',
  role        text not null default 'guru_bk',
  aktif       boolean not null default true,
  last_login  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Profil guru BK / admin yang terhubung ke Supabase Auth.';

-- Fungsi bantu: apakah pengguna yang login adalah staf aktif?
-- SECURITY DEFINER agar tidak memicu rekursi RLS pada tabel profiles.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.aktif
  );
$$;

-- Buat profil otomatis setiap ada user baru di Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. DATA SISWA
-- ------------------------------------------------------------
create table if not exists public.students (
  id             uuid primary key default gen_random_uuid(),
  nama           text not null,
  jenis_kelamin  char(1) not null check (jenis_kelamin in ('L', 'P')),
  kelas          text not null,
  nis            text,
  no_urut        integer check (no_urut is null or no_urut > 0),
  aktif          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint students_nama_kelas_key unique (nama, kelas)
);

create index if not exists students_kelas_idx on public.students (kelas);
create index if not exists students_nama_idx on public.students (nama);

-- ------------------------------------------------------------
-- 3. ABSENSI
-- ------------------------------------------------------------
create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  tanggal      date not null,
  status       text not null check (status in ('masuk', 'tidak_masuk')),
  keterangan   text,
  catatan      text,
  recorded_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint attendance_student_tanggal_key unique (student_id, tanggal),
  constraint attendance_keterangan_check check (
    (status = 'masuk' and keterangan is null) or
    (status = 'tidak_masuk' and keterangan in ('alpa', 'sakit', 'izin'))
  )
);

create index if not exists attendance_tanggal_idx on public.attendance (tanggal);
create index if not exists attendance_student_idx on public.attendance (student_id);
create index if not exists attendance_recorded_by_idx on public.attendance (recorded_by);

-- ------------------------------------------------------------
-- 4. LAPORAN KERJA
-- ------------------------------------------------------------
create table if not exists public.work_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles (id) on delete set null default auth.uid(),
  nama             text not null,
  nip              text,
  level_jabatan    text,
  pangkat          text,
  golongan_ruang   text,
  tugas_tambahan   text,
  bulan            date not null,
  kota             text not null default 'Trenggalek',
  tanggal_ttd      date,
  kepala_nama      text,
  kepala_nip       text,
  guru_jabatan     text default 'Guru Bimbingan Konseling',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists work_reports_bulan_idx on public.work_reports (bulan);
create index if not exists work_reports_user_idx on public.work_reports (user_id);

create table if not exists public.work_report_items (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.work_reports (id) on delete cascade,
  no_urut    integer not null,
  kegiatan   text not null,
  pekerjaan  text not null default '',
  tanggal    date,
  constraint work_report_items_report_no_key unique (report_id, no_urut)
);

create index if not exists work_report_items_report_idx on public.work_report_items (report_id);

-- ------------------------------------------------------------
-- 5. PENGATURAN APLIKASI (satu baris, id = 1)
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  id             smallint primary key default 1 check (id = 1),
  nama_madrasah  text not null default 'MTsN 2 Trenggalek',
  alamat         text,
  kepala_nama    text default 'AHZAN WINARTO, S.Pd., M.Pd',
  kepala_nip     text default 'NIP. 197706151999031006',
  guru_nama      text default 'ROSYIDAH RATNA P, S.Psi',
  guru_nip       text default 'NIP. 197902092025212006',
  guru_jabatan   text default 'Guru Bimbingan Konseling',
  kota           text default 'Trenggalek',
  updated_at     timestamptz not null default now()
);

insert into public.app_settings (id) values (1)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 6. TRIGGER updated_at
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists students_touch_updated_at on public.students;
create trigger students_touch_updated_at
  before update on public.students
  for each row execute function public.touch_updated_at();

drop trigger if exists attendance_touch_updated_at on public.attendance;
create trigger attendance_touch_updated_at
  before update on public.attendance
  for each row execute function public.touch_updated_at();

drop trigger if exists work_reports_touch_updated_at on public.work_reports;
create trigger work_reports_touch_updated_at
  before update on public.work_reports
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
--    Hanya pengguna login (authenticated) yang boleh mengakses.
-- ------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.students          enable row level security;
alter table public.attendance        enable row level security;
alter table public.work_reports      enable row level security;
alter table public.work_report_items enable row level security;
alter table public.app_settings      enable row level security;

-- profiles: baca profil sendiri (atau staf), ubah profil sendiri.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- students
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated using (public.is_staff());

drop policy if exists students_insert on public.students;
create policy students_insert on public.students
  for insert to authenticated with check (public.is_staff());

drop policy if exists students_update on public.students;
create policy students_update on public.students
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists students_delete on public.students;
create policy students_delete on public.students
  for delete to authenticated using (public.is_staff());

-- attendance
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated using (public.is_staff());

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated with check (public.is_staff());

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance
  for delete to authenticated using (public.is_staff());

-- work_reports
drop policy if exists work_reports_select on public.work_reports;
create policy work_reports_select on public.work_reports
  for select to authenticated using (public.is_staff());

drop policy if exists work_reports_insert on public.work_reports;
create policy work_reports_insert on public.work_reports
  for insert to authenticated with check (public.is_staff());

drop policy if exists work_reports_update on public.work_reports;
create policy work_reports_update on public.work_reports
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists work_reports_delete on public.work_reports;
create policy work_reports_delete on public.work_reports
  for delete to authenticated using (public.is_staff());

-- work_report_items
drop policy if exists work_report_items_select on public.work_report_items;
create policy work_report_items_select on public.work_report_items
  for select to authenticated using (public.is_staff());

drop policy if exists work_report_items_insert on public.work_report_items;
create policy work_report_items_insert on public.work_report_items
  for insert to authenticated with check (public.is_staff());

drop policy if exists work_report_items_update on public.work_report_items;
create policy work_report_items_update on public.work_report_items
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists work_report_items_delete on public.work_report_items;
create policy work_report_items_delete on public.work_report_items
  for delete to authenticated using (public.is_staff());

-- app_settings
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (public.is_staff());

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------
-- 8. RPC: simpan laporan kerja + rincian kegiatan (atomik)
-- ------------------------------------------------------------
create or replace function public.save_work_report(p_report jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id        uuid;
  v_nama      text := btrim(coalesce(p_report ->> 'nama', ''));
  v_bulan_txt text;
  v_bulan     date;
  v_item      jsonb;
  v_no        integer := 0;
  v_total     integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;

  if v_nama = '' then
    raise exception 'Nama pegawai wajib diisi.' using errcode = '22023';
  end if;

  v_bulan_txt := left(coalesce(p_report ->> 'bulan', ''), 7);
  if v_bulan_txt !~ '^\d{4}-\d{2}$' then
    raise exception 'Bulan laporan tidak valid.' using errcode = '22023';
  end if;
  v_bulan := (v_bulan_txt || '-01')::date;

  for v_item in
    select elem from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as t(elem)
  loop
    if btrim(coalesce(v_item ->> 'kegiatan', '')) <> '' then
      v_total := v_total + 1;
    end if;
  end loop;

  if v_total = 0 then
    raise exception 'Tambahkan minimal satu kegiatan.' using errcode = '22023';
  end if;

  v_id := nullif(btrim(coalesce(p_report ->> 'id', '')), '')::uuid;

  if v_id is null then
    insert into public.work_reports (
      user_id, nama, nip, level_jabatan, pangkat, golongan_ruang,
      tugas_tambahan, bulan, kota, tanggal_ttd, kepala_nama, kepala_nip, guru_jabatan
    ) values (
      auth.uid(),
      v_nama,
      nullif(btrim(coalesce(p_report ->> 'nip', '')), ''),
      nullif(btrim(coalesce(p_report ->> 'level_jabatan', '')), ''),
      nullif(btrim(coalesce(p_report ->> 'pangkat', '')), ''),
      nullif(btrim(coalesce(p_report ->> 'golongan_ruang', '')), ''),
      nullif(btrim(coalesce(p_report ->> 'tugas_tambahan', '')), ''),
      v_bulan,
      coalesce(nullif(btrim(coalesce(p_report ->> 'kota', '')), ''), 'Trenggalek'),
      nullif(btrim(coalesce(p_report ->> 'tanggal_ttd', '')), '')::date,
      nullif(btrim(coalesce(p_report ->> 'kepala_nama', '')), ''),
      nullif(btrim(coalesce(p_report ->> 'kepala_nip', '')), ''),
      coalesce(nullif(btrim(coalesce(p_report ->> 'guru_jabatan', '')), ''), 'Guru Bimbingan Konseling')
    )
    returning id into v_id;
  else
    update public.work_reports set
      nama           = v_nama,
      nip            = nullif(btrim(coalesce(p_report ->> 'nip', '')), ''),
      level_jabatan  = nullif(btrim(coalesce(p_report ->> 'level_jabatan', '')), ''),
      pangkat        = nullif(btrim(coalesce(p_report ->> 'pangkat', '')), ''),
      golongan_ruang = nullif(btrim(coalesce(p_report ->> 'golongan_ruang', '')), ''),
      tugas_tambahan = nullif(btrim(coalesce(p_report ->> 'tugas_tambahan', '')), ''),
      bulan          = v_bulan,
      kota           = coalesce(nullif(btrim(coalesce(p_report ->> 'kota', '')), ''), 'Trenggalek'),
      tanggal_ttd    = nullif(btrim(coalesce(p_report ->> 'tanggal_ttd', '')), '')::date,
      kepala_nama    = nullif(btrim(coalesce(p_report ->> 'kepala_nama', '')), ''),
      kepala_nip     = nullif(btrim(coalesce(p_report ->> 'kepala_nip', '')), ''),
      guru_jabatan   = coalesce(nullif(btrim(coalesce(p_report ->> 'guru_jabatan', '')), ''), 'Guru Bimbingan Konseling')
    where id = v_id;

    if not found then
      raise exception 'Laporan kerja tidak ditemukan.' using errcode = 'P0002';
    end if;

    delete from public.work_report_items where report_id = v_id;
  end if;

  for v_item in
    select elem from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as t(elem)
  loop
    if btrim(coalesce(v_item ->> 'kegiatan', '')) <> '' then
      v_no := v_no + 1;
      insert into public.work_report_items (report_id, no_urut, kegiatan, pekerjaan, tanggal)
      values (
        v_id,
        v_no,
        btrim(v_item ->> 'kegiatan'),
        btrim(coalesce(v_item ->> 'pekerjaan', '')),
        nullif(btrim(coalesce(v_item ->> 'tanggal', '')), '')::date
      );
    end if;
  end loop;

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- 9. HAK AKSES (grant)
-- ------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.students          to authenticated;
grant select, insert, update, delete on public.attendance        to authenticated;
grant select, insert, update, delete on public.work_reports      to authenticated;
grant select, insert, update, delete on public.work_report_items to authenticated;
grant select, update               on public.app_settings        to authenticated;
grant select, insert, update        on public.profiles           to authenticated;

grant execute on function public.is_staff()                    to authenticated;
grant execute on function public.save_work_report(jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 10. ISI PENGATURAN AWAL
-- ------------------------------------------------------------
insert into public.app_settings (
  id, nama_madrasah, kepala_nama, kepala_nip,
  guru_nama, guru_nip, guru_jabatan, kota
) values (
  1, 'MTsN 2 Trenggalek', 'AHZAN WINARTO, S.Pd., M.Pd', 'NIP. 197706151999031006',
  'ROSYIDAH RATNA P, S.Psi', 'NIP. 197902092025212006', 'Guru Bimbingan Konseling', 'Trenggalek'
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 11. BACKFILL PROFIL (bila user dibuat sebelum trigger ada)
-- ------------------------------------------------------------
insert into public.profiles (id, email, full_name)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  )
from auth.users u
on conflict (id) do nothing;


-- ============================================================
-- CATATAN: DATA SISWA TIDAK DISERTAKAN DI REPOSITORI PUBLIK
-- ------------------------------------------------------------
-- Demi melindungi data pribadi siswa, 284 baris data siswa
-- tidak disimpan di file ini.
--
-- Cara mengisi data siswa pada proyek Supabase baru:
--   1. Login ke aplikasi sebagai guru BK.
--   2. Buka menu "Data Siswa" > "Import".
--   3. Unggah file Excel/CSV dengan kolom:
--      NO (opsional), NAMA, L/P, KELAS, NIS (opsional).
--
-- Jika Anda memiliki salinan lokal schema-lengkap.local.sql
-- (tidak di-push), jalankan file tersebut untuk mengisi data
-- siswa secara otomatis.
-- ============================================================
