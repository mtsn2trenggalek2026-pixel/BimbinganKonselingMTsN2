-- ============================================================
--  BUAT AKUN SUPERADMIN PERTAMA
--  ------------------------------------------------------------
--  Jalankan SEKALI di Supabase:
--    Dashboard > SQL Editor > New query > tempel isi file ini > Run
--
--  Akun yang dibuat:
--    Email    : superadmin@bk.local
--    Password : BkMtsn2!2026
--    Nama     : Super Admin BK
--    Peran    : superadmin
--
--  PENTING:
--   1. Jalankan dulu  migrations/20261105090000_akademik_roles.sql
--      (kolom profiles.role & tabel profil harus sudah ada).
--   2. Segera ganti password setelah login pertama:
--      menu Pengaturan > Akun > Ganti Password.
--   3. File ini hanya berisi SQL — tidak ada service_role key.
-- ============================================================

do $$
declare
  v_email    text := 'superadmin@bk.local';
  v_password text := 'BkMtsn2!2026';
  v_nama     text := 'Super Admin BK';
  v_id       uuid;
begin
  -- Cari user Auth dengan email tersebut (dibuat dashboard atau sebelumnya).
  select id into v_id from auth.users where lower(email) = lower(v_email) limit 1;

  if v_id is null then
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
  end if;

  -- Pastikan profil ada, aktif, dan berperan superadmin.
  insert into public.profiles (id, email, full_name, role, aktif)
  values (v_id, v_email, v_nama, 'superadmin', true)
  on conflict (id) do update set
    email     = excluded.email,
    full_name = excluded.full_name,
    role      = 'superadmin',
    aktif     = true;

  raise notice 'Superadmin siap: % (id %)', v_email, v_id;
end;
$$;

-- ============================================================
--  PERIKSA HASIL
-- ============================================================
select id, email, full_name, role, aktif, created_at
from public.profiles
where lower(email) = 'superadmin@bk.local';

-- ============================================================
--  CARA LOGIN
--  ------------------------------------------------------------
--  Buka aplikasi (mis. http://localhost:8080/)
--    Email    : superadmin@bk.local
--    Password : BkMtsn2!2026
--
--  Setelah login:
--   1. Menu "Pengaturan > Ganti Password" untuk mengganti password.
--   2. Menu "Akun Admin" untuk membuat akun admin/guru BK lain.
--   3. Menu "Tahun & Semester" untuk mengisi hari efektif semester.
-- ============================================================
