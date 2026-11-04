-- ============================================================
--  Migrasi: Tahun Ajaran, Semester, Rombel, Mutasi Siswa, Akun
--  ------------------------------------------------------------
--  Menambahkan:
--   1. Role superadmin / admin (kolom profiles.role + fungsi bantu)
--   2. RPC admin untuk membuat / mengubah / menonaktifkan / menghapus
--      akun admin (password di-hash oleh Supabase Auth di server)
--   3. Tahun ajaran (ganjil + genap) dan pengaturan hari efektif
--   4. Rombongan belajar per tingkat (VII / VIII / IX)
--   5. Riwayat kelas siswa per tahun ajaran (kunci data 5 tahun)
--   6. Rekapitulasi kelulusan kelas IX + sekolah lanjutan
--   7. Foto siswa (storage_bucket, maksimal 100 KB)
--   8. Pengaman data: baris akademik berlaku 5 tahun lalu
--      diarsipkan (is_aktif = false), tidak dihapus.
--   9. Akun superadmin bawaan bila belum ada akun sama sekali:
--        superadmin@bk.local  /  BkMtsn2!2026  (segera ganti
--        password setelah login pertama).
--
--  File aman dijalankan ulang (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFIL & ROLE
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'guru_bk';

alter table public.profiles
  add column if not exists aktif boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'guru_bk'));

comment on column public.profiles.role is 'superadmin = kelola akun; admin = kelola data; guru_bk = operasional.';

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid() and p.aktif),
    'anon'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('superadmin', 'admin');
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'superadmin';
$$;

-- Pastikan selalu ada akun superadmin. Perilaku:
--   1. Bila sudah ada superadmin  -> tidak diubah.
--   2. Bila belum ada & sudah ada akun lain
--      -> akun paling lama dijadikan superadmin.
--   3. Bila belum ada superadmin DAN belum ada akun sama sekali
--      -> dibuat akun bawaan  superadmin@bk.local / BkMtsn2!2026
--         (segera ganti password setelah login pertama).
do $$
declare
  v_email    text := 'superadmin@bk.local';
  v_password text := 'BkMtsn2!2026';
  v_nama     text := 'Super Admin BK';
  v_id       uuid;
begin
  if exists (select 1 from public.profiles where role = 'superadmin') then
    return;
  end if;

  -- 2. Jadikan akun paling lama sebagai superadmin.
  select id into v_id from public.profiles order by created_at asc, id asc limit 1;
  if v_id is not null then
    update public.profiles set role = 'superadmin', aktif = true where id = v_id;
    return;
  end if;

  -- 3. Belum ada akun sama sekali: buat akun superadmin bawaan.
  v_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', v_nama),
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
  values (v_id, v_email, v_nama, 'superadmin', true)
  on conflict (id) do update set
    email = excluded.email, full_name = excluded.full_name,
    role = 'superadmin', aktif = true;

  raise notice 'Akun superadmin bawaan dibuat: % / %', v_email, v_password;
end;
$$;

-- ------------------------------------------------------------
-- 2. TAHUN AJARAN & SEMESTER
-- ------------------------------------------------------------
create table if not exists public.academic_years (
  id              uuid primary key default gen_random_uuid(),
  tahun_awal      integer not null check (tahun_awal between 2000 and 2100),
  tahun_akhir     integer generated always as (tahun_awal + 1) stored,
  nama            text,
  tanggal_mulai   date,
  tanggal_selesai date,
  is_aktif        boolean not null default true,   -- true = data hidup, false = arsip
  catatan         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint academic_years_unique unique (tahun_awal)
);

create table if not exists public.semesters (
  id                 uuid primary key default gen_random_uuid(),
  academic_year_id   uuid not null references public.academic_years (id) on delete cascade,
  jenis              text not null check (jenis in ('ganjil', 'genap')),
  urutan             integer not null check (urutan between 1 and 2),
  tanggal_mulai      date not null,
  tanggal_selesai    date not null,
  hari_efektif       integer not null default 90 check (hari_efektif between 1 and 366),
  status             text not null default 'draft' check (status in ('draft', 'aktif', 'selesai')),
  is_aktif           boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint semesters_unique unique (academic_year_id, jenis),
  constraint semesters_urutan_unique unique (academic_year_id, urutan),
  constraint semesters_range check (tanggal_selesai >= tanggal_mulai)
);

create unique index if not exists semesters_satu_aktif
  on public.semesters ((status)) where status = 'aktif';

comment on column public.semesters.hari_efektif is 'Jumlah hari masuk / hari efektif pada semester tersebut (dasar persentase kehadiran).';

-- ------------------------------------------------------------
-- 3. ROMBONGAN BELAJAR (per tingkat)
-- ------------------------------------------------------------
create table if not exists public.class_groups (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  tingkat          integer not null check (tingkat in (7, 8, 9)),
  nama             text not null,
  wali_kelas       text,
  is_aktif         boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint class_groups_unique unique (academic_year_id, nama)
);

create index if not exists class_groups_tingkat_idx on public.class_groups (tingkat);

-- ------------------------------------------------------------
-- 4. RIWAYAT KELAS SISWA PER TAHUN AJARAN
-- ------------------------------------------------------------
create table if not exists public.student_history (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  tingkat          integer not null check (tingkat in (7, 8, 9)),
  class_group_id   uuid references public.class_groups (id) on delete set null,
  kelas            text not null,
  status           text not null default 'aktif'
                   check (status in ('aktif', 'naik', 'tetap', 'lulus', 'pindah', 'keluar')),
  catatan          text,
  is_aktif         boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint student_history_unique unique (student_id, academic_year_id)
);

create index if not exists student_history_year_idx on public.student_history (academic_year_id, tingkat);
create index if not exists student_history_student_idx on public.student_history (student_id);

-- ------------------------------------------------------------
-- 5. TAMBAHAN KOLOM SISWA & ABSENSI
-- ------------------------------------------------------------
alter table public.students
  add column if not exists angkatan integer,
  add column if not exists tingkat integer check (tingkat is null or tingkat in (7, 8, 9)),
  add column if not exists foto_bucket text default 'siswa-foto',
  add column if not exists foto_path text,
  add column if not exists foto_uploaded_at timestamptz;

alter table public.students
  add column if not exists foto_ukuran integer check (foto_ukuran is null or foto_ukuran <= 102400);

comment on column public.students.angkatan is 'Tahun awal masuk (mis. 2026 = kelas VII tahun ajaran 2026/2027).';
comment on column public.students.foto_ukuran is 'Ukuran foto dalam byte, maksimal 102400 (100 KB).';

alter table public.attendance
  add column if not exists academic_year_id uuid references public.academic_years (id) on delete set null,
  add column if not exists semester_id uuid references public.semesters (id) on delete set null;

create index if not exists attendance_year_idx on public.attendance (academic_year_id);
create index if not exists attendance_semester_idx on public.attendance (semester_id);

-- ------------------------------------------------------------
-- 6. KELULUSAN & SEKOLAH LANJUTAN
-- ------------------------------------------------------------
create table if not exists public.graduations (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students (id) on delete cascade,
  academic_year_id   uuid not null references public.academic_years (id) on delete cascade,
  status             text not null default 'lulus'
                     check (status in ('lulus', 'tidak_lulus', 'mengulang')),
  sekolah_lanjutan   text,
  jenis_sekolah      text check (jenis_sekolah is null or jenis_sekolah in
                     ('SMA', 'MA', 'SMK', 'MAK', 'Pondok Pesantren', 'Lainnya')),
  npsn               text,
  kota_sekolah       text,
  jalur              text,
  tanggal_lulus      date,
  catatan            text,
  is_aktif           boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint graduations_unique unique (student_id, academic_year_id)
);

create index if not exists graduations_year_idx on public.graduations (academic_year_id);

-- ------------------------------------------------------------
-- 7. TRIGGER updated_at
-- ------------------------------------------------------------
drop trigger if exists academic_years_touch_updated_at on public.academic_years;
create trigger academic_years_touch_updated_at
  before update on public.academic_years
  for each row execute function public.touch_updated_at();

drop trigger if exists semesters_touch_updated_at on public.semesters;
create trigger semesters_touch_updated_at
  before update on public.semesters
  for each row execute function public.touch_updated_at();

drop trigger if exists class_groups_touch_updated_at on public.class_groups;
create trigger class_groups_touch_updated_at
  before update on public.class_groups
  for each row execute function public.touch_updated_at();

drop trigger if exists student_history_touch_updated_at on public.student_history;
create trigger student_history_touch_updated_at
  before update on public.student_history
  for each row execute function public.touch_updated_at();

drop trigger if exists graduations_touch_updated_at on public.graduations;
create trigger graduations_touch_updated_at
  before update on public.graduations
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 8. FUNGSI AKADEMIK
-- ------------------------------------------------------------

-- Simpan tahun ajaran beserta kedua semesternya.
create or replace function public.save_academic_year(p_year jsonb, p_ganjil jsonb, p_genap jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id     uuid;
  v_awal   integer;
  v_akhir  integer;
  v_nama   text;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah tahun ajaran.' using errcode = '42501';
  end if;

  v_id := nullif(btrim(coalesce(p_year ->> 'id', '')), '')::uuid;

  if v_id is null then
    v_awal := coalesce((p_year ->> 'tahun_awal')::integer, extract(year from current_date)::integer);
    insert into public.academic_years (
      tahun_awal, nama, tanggal_mulai, tanggal_selesai, catatan
    ) values (
      v_awal,
      nullif(btrim(coalesce(p_year ->> 'nama', '')), ''),
      nullif(btrim(coalesce(p_year ->> 'tanggal_mulai', '')), '')::date,
      nullif(btrim(coalesce(p_year ->> 'tanggal_selesai', '')), '')::date,
      nullif(btrim(coalesce(p_year ->> 'catatan', '')), '')
    )
    returning id, tahun_awal, tahun_akhir, nama into v_id, v_awal, v_akhir, v_nama;
  else
    update public.academic_years set
      tahun_awal      = coalesce((p_year ->> 'tahun_awal')::integer, tahun_awal),
      nama            = nullif(btrim(coalesce(p_year ->> 'nama', '')), ''),
      tanggal_mulai   = nullif(btrim(coalesce(p_year ->> 'tanggal_mulai', '')), '')::date,
      tanggal_selesai = nullif(btrim(coalesce(p_year ->> 'tanggal_selesai', '')), '')::date,
      catatan         = nullif(btrim(coalesce(p_year ->> 'catatan', '')), '')
    where id = v_id
    returning tahun_awal, tahun_akhir, nama into v_awal, v_akhir, v_nama;
    if not found then
      raise exception 'Tahun ajaran tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  -- Ganjil (urutan 1)
  insert into public.semesters (
    academic_year_id, jenis, urutan, tanggal_mulai, tanggal_selesai, hari_efektif, status
  ) values (
    v_id, 'ganjil', 1,
    coalesce(nullif(btrim(coalesce(p_ganjil ->> 'tanggal_mulai', '')), '')::date, make_date(v_awal, 7, 15)),
    coalesce(nullif(btrim(coalesce(p_ganjil ->> 'tanggal_selesai', '')), '')::date, make_date(v_awal, 12, 31)),
    coalesce((p_ganjil ->> 'hari_efektif')::integer, 90),
    coalesce(nullif(p_ganjil ->> 'status', ''), 'draft')
  )
  on conflict (academic_year_id, jenis) do update set
    tanggal_mulai   = excluded.tanggal_mulai,
    tanggal_selesai = excluded.tanggal_selesai,
    hari_efektif    = excluded.hari_efektif,
    status          = excluded.status;

  -- Genap (urutan 2)
  insert into public.semesters (
    academic_year_id, jenis, urutan, tanggal_mulai, tanggal_selesai, hari_efektif, status
  ) values (
    v_id, 'genap', 2,
    coalesce(nullif(btrim(coalesce(p_genap ->> 'tanggal_mulai', '')), '')::date, make_date(v_akhir, 1, 1)),
    coalesce(nullif(btrim(coalesce(p_genap ->> 'tanggal_selesai', '')), '')::date, make_date(v_akhir, 6, 30)),
    coalesce((p_genap ->> 'hari_efektif')::integer, 90),
    coalesce(nullif(p_genap ->> 'status', ''), 'draft')
  )
  on conflict (academic_year_id, jenis) do update set
    tanggal_mulai   = excluded.tanggal_mulai,
    tanggal_selesai = excluded.tanggal_selesai,
    hari_efektif    = excluded.hari_efektif,
    status          = excluded.status;

  return v_id;
end;
$$;

-- Jadikan satu semester sebagai semester berjalan (semester lain otomatis tidak aktif).
create or replace function public.set_active_semester(p_semester_id uuid)
returns public.semesters
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.semesters;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah semester berjalan.' using errcode = '42501';
  end if;

  update public.semesters set status = 'draft' where status = 'aktif' and id <> p_semester_id;
  update public.semesters set status = 'aktif' where id = p_semester_id;

  select * into v_row from public.semesters where id = p_semester_id;
  if not found then
    raise exception 'Semester tidak ditemukan.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Selesaikan semester berjalan dan lanjutkan ke semesternya berikutnya
-- (ganjil -> genap pada tahun ajaran yang sama, genap -> ganjil tahun ajaran berikutnya).
create or replace function public.finish_semester(p_semester_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cur      public.semesters;
  v_awal     integer;
  v_next     public.semesters;
  v_new_year uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menutup semester.' using errcode = '42501';
  end if;

  select * into v_cur from public.semesters where id = p_semester_id;
  if not found then
    raise exception 'Semester tidak ditemukan.' using errcode = 'P0002';
  end if;

  update public.semesters set status = 'selesai' where id = p_semester_id;

  if v_cur.jenis = 'ganjil' then
    select * into v_next from public.semesters
     where academic_year_id = v_cur.academic_year_id and jenis = 'genap';
  else
    select tahun_awal into v_awal from public.academic_years where id = v_cur.academic_year_id;

    select id into v_new_year from public.academic_years where tahun_awal = v_awal + 1;

    if v_new_year is null then
      insert into public.academic_years (tahun_awal, nama, tanggal_mulai, tanggal_selesai)
      values (
        v_awal + 1,
        'Tahun Ajaran ' || (v_awal + 1) || '/' || (v_awal + 2),
        make_date(v_awal + 1, 7, 15),
        make_date(v_awal + 2, 6, 30)
      )
      returning id into v_new_year;

      insert into public.semesters (academic_year_id, jenis, urutan, tanggal_mulai, tanggal_selesai, hari_efektif)
      values
        (v_new_year, 'ganjil', 1, make_date(v_awal + 1, 7, 15), make_date(v_awal + 1, 12, 31), 90),
        (v_new_year, 'genap', 2, make_date(v_awal + 2, 1, 1), make_date(v_awal + 2, 6, 30), 90);
    end if;

    select * into v_next from public.semesters
     where academic_year_id = v_new_year and jenis = 'ganjil';
  end if;

  update public.semesters set status = 'draft' where status = 'aktif';
  if v_next.id is not null then
    update public.semesters set status = 'aktif' where id = v_next.id;
  end if;

  return jsonb_build_object(
    'selesai', p_semester_id,
    'lanjut', v_next.id,
    'jenis', v_next.jenis,
    'academic_year_id', v_next.academic_year_id
  );
end;
$$;

-- Proses kenaikan kelas: siswa tingkat 7 -> 8, 8 -> 9.
-- Siswa tingkat 9 tetap tingkat 9 dan ditandai "lulus" bila p_luluskan_kelas_sembilan.
create or replace function public.promote_students(p_from_year uuid, p_to_year uuid, p_luluskan_kelas_sembilan boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row      record;
  v_class    public.class_groups;
  v_n        integer := 0;
  v_lulus    integer := 0;
  v_tahun    integer;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat memproses kenaikan kelas.' using errcode = '42501';
  end if;
  if p_from_year = p_to_year then
    raise exception 'Tahun ajaran asal dan tujuan harus berbeda.' using errcode = '22023';
  end if;

  select tahun_awal into v_tahun from public.academic_years where id = p_to_year;
  if v_tahun is null then
    raise exception 'Tahun ajaran tujuan tidak ditemukan.' using errcode = 'P0002';
  end if;

  for v_row in
    select h.*, s.nama
      from public.student_history h
      join public.students s on s.id = h.student_id
     where h.academic_year_id = p_from_year
       and h.status in ('aktif', 'naik', 'tetap')
     order by h.kelas, s.nama
  loop
    if v_row.tingkat >= 9 then
      if p_luluskan_kelas_sembilan then
        update public.student_history
           set status = 'lulus', updated_at = now()
         where id = v_row.id;
        insert into public.graduations (student_id, academic_year_id, status, tanggal_lulus)
        values (v_row.student_id, p_to_year, 'lulus', make_date(v_tahun, 6, 30))
        on conflict (student_id, academic_year_id) do nothing;
        v_lulus := v_lulus + 1;
      else
        insert into public.student_history (student_id, academic_year_id, tingkat, kelas, status)
        values (v_row.student_id, p_to_year, 9, v_row.kelas, 'tetap')
        on conflict (student_id, academic_year_id) do update set updated_at = now();
      end if;
      continue;
    end if;

    -- Cari rombel tujuan dengan akhiran sama (mis. VIII-A -> IX-A).
    select * into v_class
      from public.class_groups
     where academic_year_id = p_to_year
       and tingkat = v_row.tingkat + 1
       and split_part(nama, '-', 2) = split_part(v_row.kelas, '-', 2)
     limit 1;

    if v_class.id is null then
      select * into v_class
        from public.class_groups
       where academic_year_id = p_to_year
         and tingkat = v_row.tingkat + 1
       order by nama
       limit 1;
    end if;

    insert into public.student_history (student_id, academic_year_id, tingkat, class_group_id, kelas, status)
    values (
      v_row.student_id, p_to_year, v_row.tingkat + 1,
      v_class.id,
      coalesce(v_class.nama, replace(v_row.kelas, 'VIII', 'IX')),
      'naik'
    )
    on conflict (student_id, academic_year_id) do update set
      tingkat    = excluded.tingkat,
      kelas      = excluded.kelas,
      status     = 'naik',
      updated_at = now();

    update public.student_history set status = 'naik' where id = v_row.id;

    update public.students
       set kelas = coalesce(v_class.nama, replace(v_row.kelas, 'VIII', 'IX')),
           tingkat = v_row.tingkat + 1,
           updated_at = now()
     where id = v_row.student_id;

    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('naik', v_n, 'lulus', v_lulus);
end;
$$;

-- Arsipkan data yang lebih tua dari 5 tahun (is_aktif = false).
-- Data TIDAK dihapus, hanya disembunyikan dari tampilan "aktif".
create or replace function public.archive_old_academic_years()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_batas integer := extract(year from current_date)::integer - 5;
  v_n     integer;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menjalankan pengarsipan.' using errcode = '42501';
  end if;

  update public.academic_years
     set is_aktif = false
   where tahun_awal < v_batas and is_aktif;

  get diagnostics v_n = row_count;

  update public.semesters s
     set is_aktif = false
    from public.academic_years y
   where s.academic_year_id = y.id and y.is_aktif = false and s.is_aktif;

  update public.class_groups c
     set is_aktif = false
    from public.academic_years y
   where c.academic_year_id = y.id and y.is_aktif = false and c.is_aktif;

  update public.student_history h
     set is_aktif = false
    from public.academic_years y
   where h.academic_year_id = y.id and y.is_aktif = false and h.is_aktif;

  update public.graduations g
     set is_aktif = false
    from public.academic_years y
   where g.academic_year_id = y.id and y.is_aktif = false and g.is_aktif;

  return v_n;
end;
$$;

-- Rekap kelulusan kelas IX: jumlah siswa, tujuan sekolah, dan persentase kehadiran.
create or replace function public.graduation_summary(p_academic_year_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total    integer;
  v_lulus    integer;
  v_lanjut   integer;
  v_sekolah  jsonb;
  v_jalur    jsonb;
  v_kehadiran numeric;
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;

  select count(*) into v_total from public.graduations where academic_year_id = p_academic_year_id;
  select count(*) into v_lulus from public.graduations
   where academic_year_id = p_academic_year_id and status = 'lulus';
  select count(*) into v_lanjut from public.graduations
   where academic_year_id = p_academic_year_id and btrim(coalesce(sekolah_lanjutan, '')) <> '';

  select coalesce(jsonb_agg(x order by x.jumlah desc), '[]'::jsonb) into v_sekolah
    from (
      select coalesce(nullif(btrim(sekolah_lanjutan), ''), '(belum diisi)') as sekolah,
             count(*) as jumlah
        from public.graduations
       where academic_year_id = p_academic_year_id
       group by 1
    ) x;

  select coalesce(jsonb_agg(x order by x.jumlah desc), '[]'::jsonb) into v_jalur
    from (
      select coalesce(nullif(btrim(jalur), ''), '(belum diisi)') as jalur,
             count(*) as jumlah
        from public.graduations
       where academic_year_id = p_academic_year_id
       group by 1
    ) x;

  select round(
           case when count(*) = 0 then 0
                else (count(*) filter (where a.status = 'masuk')::numeric / count(*)) * 100
           end, 1)
    into v_kehadiran
    from public.attendance a
    join public.student_history h
      on h.student_id = a.student_id
     and h.academic_year_id = p_academic_year_id
   where h.tingkat = 9;

  return jsonb_build_object(
    'total', v_total,
    'lulus', v_lulus,
    'lanjut', v_lanjut,
    'belum_lanjut', v_total - v_lanjut,
    'sekolah', v_sekolah,
    'jalur', v_jalur,
    'persen_kehadiran', coalesce(v_kehadiran, 0)
  );
end;
$$;

-- ------------------------------------------------------------
-- 9. RPC AKUN ADMIN (superadmin)
--    Password di-hash oleh Supabase Auth (pgcrypto di schema auth).
-- ------------------------------------------------------------
create or replace function public.admin_list_accounts()
returns table (
  id uuid, email text, full_name text, role text, aktif boolean,
  last_login timestamptz, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.role, p.aktif, p.last_login, p.created_at
    from public.profiles p
   where public.is_superadmin()
   order by case p.role when 'superadmin' then 1 when 'admin' then 2 else 3 end,
            p.created_at;
$$;

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
  if v_role not in ('superadmin', 'admin', 'guru_bk') then
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
    v_email, crypt(p_password, gen_salt('bf')),
    now(),
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
    email     = excluded.email,
    full_name = excluded.full_name,
    role      = excluded.role,
    aktif     = true;

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

  if p_role is not null and p_role not in ('superadmin', 'admin', 'guru_bk') then
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
       set encrypted_password = crypt(p_password, gen_salt('bf')),
           updated_at = now()
     where id = p_id;
  end if;

  update public.profiles set
    full_name = coalesce(nullif(btrim(coalesce(p_full_name, '')), ''), full_name),
    role      = coalesce(p_role, role),
    aktif     = coalesce(p_aktif, aktif)
  where id = p_id;
end;
$$;

create or replace function public.admin_delete_account(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Hanya superadmin yang dapat menghapus akun.' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'Anda tidak dapat menghapus akun sendiri.' using errcode = '22023';
  end if;

  delete from auth.users where id = p_id;
  if not found then
    raise exception 'Akun tidak ditemukan.' using errcode = 'P0002';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.academic_years  enable row level security;
alter table public.semesters       enable row level security;
alter table public.class_groups    enable row level security;
alter table public.student_history enable row level security;
alter table public.graduations     enable row level security;

-- Baca: semua staf. Tulis: admin.
do $$
declare
  t text;
begin
  foreach t in array array['academic_years', 'semesters', 'class_groups', 'student_history', 'graduations']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_delete', t);
  end loop;
end;
$$;

-- Siswa: tambah/ubah/hapus khusus admin; guru BK hanya membaca.
drop policy if exists students_insert on public.students;
create policy students_insert on public.students
  for insert to authenticated with check (public.is_admin());

drop policy if exists students_update on public.students;
create policy students_update on public.students
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists students_delete on public.students;
create policy students_delete on public.students
  for delete to authenticated using (public.is_admin());

-- Profil: ubah profil sendiri; superadmin boleh mengubah semua profil.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_superadmin())
  with check (id = auth.uid() or public.is_superadmin());

-- ------------------------------------------------------------
-- 11. HAK AKSES
-- ------------------------------------------------------------
grant select, insert, update, delete on public.academic_years  to authenticated;
grant select, insert, update, delete on public.semesters       to authenticated;
grant select, insert, update, delete on public.class_groups    to authenticated;
grant select, insert, update, delete on public.student_history to authenticated;
grant select, insert, update, delete on public.graduations     to authenticated;

grant execute on function public.current_role()                                    to authenticated;
grant execute on function public.is_admin()                                        to authenticated;
grant execute on function public.is_superadmin()                                   to authenticated;
grant execute on function public.save_academic_year(jsonb, jsonb, jsonb)           to authenticated;
grant execute on function public.set_active_semester(uuid)                         to authenticated;
grant execute on function public.finish_semester(uuid)                             to authenticated;
grant execute on function public.promote_students(uuid, uuid, boolean)             to authenticated;
grant execute on function public.archive_old_academic_years()                      to authenticated;
grant execute on function public.graduation_summary(uuid)                          to authenticated;
grant execute on function public.admin_list_accounts()                             to authenticated;
grant execute on function public.admin_create_account(text, text, text, text)      to authenticated;
grant execute on function public.admin_update_account(uuid, text, text, boolean, text) to authenticated;
grant execute on function public.admin_delete_account(uuid)                        to authenticated;

-- ------------------------------------------------------------
-- 12. STORAGE FOTO SISWA (maks. 100 KB)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'siswa-foto', 'siswa-foto', true, 102400,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 102400,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists siswa_foto_read on storage.objects;
create policy siswa_foto_read on storage.objects
  for select using (bucket_id = 'siswa-foto');

drop policy if exists siswa_foto_write on storage.objects;
create policy siswa_foto_write on storage.objects
  for insert to authenticated with check (bucket_id = 'siswa-foto' and public.is_admin());

drop policy if exists siswa_foto_update on storage.objects;
create policy siswa_foto_update on storage.objects
  for update to authenticated using (bucket_id = 'siswa-foto' and public.is_admin());

drop policy if exists siswa_foto_delete on storage.objects;
create policy siswa_foto_delete on storage.objects
  for delete to authenticated using (bucket_id = 'siswa-foto' and public.is_admin());

-- ------------------------------------------------------------
-- 13. DATA AWAL
-- ------------------------------------------------------------
do $$
declare
  v_year  uuid;
  v_awal  integer;
begin
  if not exists (select 1 from public.academic_years) then
    -- Tahun ajaran berjalan: mulai Juli tahun ini (atau tahun lalu bila < Juli).
    v_awal := case when extract(month from current_date) >= 7
                   then extract(year from current_date)::integer
                   else extract(year from current_date)::integer - 1 end;

    insert into public.academic_years (tahun_awal, nama, tanggal_mulai, tanggal_selesai)
    values (
      v_awal,
      'Tahun Ajaran ' || v_awal || '/' || (v_awal + 1),
      make_date(v_awal, 7, 15),
      make_date(v_awal + 1, 6, 30)
    )
    returning id into v_year;

    insert into public.semesters (academic_year_id, jenis, urutan, tanggal_mulai, tanggal_selesai, hari_efektif, status)
    values
      (v_year, 'ganjil', 1, make_date(v_awal, 7, 15), make_date(v_awal, 12, 31), 90, 'aktif'),
      (v_year, 'genap', 2, make_date(v_awal + 1, 1, 1), make_date(v_awal + 1, 6, 30), 90, 'draft');
  end if;

  -- Lengkapi rombel VII / VIII / IX untuk setiap tahun ajaran yang aktif.
  insert into public.class_groups (academic_year_id, tingkat, nama)
  select y.id, t.tingkat, t.nama
    from public.academic_years y
   cross join (values (7, 'VII-A'), (7, 'VII-B'), (8, 'VIII-A'), (8, 'VIII-B'), (9, 'IX-A'), (9, 'IX-B')) as t(tingkat, nama)
   where y.is_aktif
  on conflict (academic_year_id, nama) do nothing;
end;
$$;

-- Isi tingkat & riwayat kelas siswa dari kolom kelas yang sudah ada.
do $$
declare
  v_year uuid;
  v_awal integer;
begin
  select y.id, y.tahun_awal into v_year, v_awal
    from public.academic_years y
   where exists (select 1 from public.semesters s where s.academic_year_id = y.id and s.status = 'aktif')
   order by y.tahun_awal desc
   limit 1;

  if v_year is null then
    select id, tahun_awal into v_year, v_awal from public.academic_years order by tahun_awal desc limit 1;
  end if;
  if v_year is null then
    return;
  end if;

  update public.students
     set tingkat = case
       when lower(kelas) like '%vii%' or kelas like '%8%' then 8
       when lower(kelas) like '%ix%' or kelas like '%9%' then 9
       else 7
     end
   where tingkat is null;

  update public.students set angkatan = v_awal - (tingkat - 7) where angkatan is null;

  insert into public.student_history (student_id, academic_year_id, tingkat, kelas, status)
  select s.id, v_year, s.tingkat, s.kelas, 'aktif'
    from public.students s
   where s.aktif
  on conflict (student_id, academic_year_id) do nothing;
end;
$$;
