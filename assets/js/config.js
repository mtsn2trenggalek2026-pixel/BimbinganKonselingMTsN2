/* ============================================================
   Konfigurasi aplikasi BK MTsN 2 Trenggalek
   ------------------------------------------------------------
   Aplikasi memakai Supabase (PostgreSQL + Auth).
   Isi dua nilai di bawah dari Supabase Dashboard:

     Project Settings > API
       - Project URL          -> SUPABASE_URL
       - anon / publishable   -> SUPABASE_ANON_KEY

   Kunci anon/publishable AMAN dipakai di browser karena akses
   data dilindungi Row Level Security. JANGAN pernah menaruh
   service_role / secret key di file ini.
   ============================================================ */
window.BK_CONFIG = {
  SUPABASE_URL: "https://mhjvebnxsutwbudjwmud.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_0QoQPOUArrXnj0mArDr2uQ_pPxFsasw",
  DB_LABEL: "PostgreSQL Â· Supabase (mhjvebnxsutwbudjwmud)",

  APP_NAME: "BK MTsN 2 Trenggalek",
  SCHOOL_NAME: "MTsN 2 Trenggalek",
  SCHOOL_SUB: "Bimbingan dan Konseling",

  DEFAULT_KOTA: "Trenggalek",
  DEFAULT_KEPALA_NAMA: "AHZAN WINARTO, S.Pd., M.Pd",
  DEFAULT_KEPALA_NIP: "NIP. 197706151999031006",
  DEFAULT_GURU_NAMA: "ROSYIDAH RATNA P, S.Psi",
  DEFAULT_GURU_NIP: "NIP. 197902092025212006",
  DEFAULT_GURU_JABATAN: "Guru Bimbingan Konseling",

  VERSION: "5.0.0"
};
