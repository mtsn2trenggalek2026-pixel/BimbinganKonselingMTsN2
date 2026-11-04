/* ============================================================
   Lapisan akses data — Supabase (PostgreSQL + Auth + RLS)
   ------------------------------------------------------------
   Memakai pustaka supabase-js (vendor/supabase.js).
   Semua operasi memakai sesi login Supabase Auth; hak akses
   diatur oleh Row Level Security di database.
   ============================================================ */
(function () {
  "use strict";

  var API = {
    user: null,
    session: null
  };

  var client = null;

  function cfg() {
    return window.BK_CONFIG || {};
  }

  function makeError(message, status, code) {
    var err = new Error(message || "Terjadi kesalahan.");
    err.status = status || 0;
    err.code = code || "";
    return err;
  }

  function isPlaceholder(value) {
    return !value || /GANTI|ISI_|CONTOH|PROJECT-REF/i.test(String(value));
  }

  function ensureClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw makeError(
        "Pustaka Supabase belum termuat. Pastikan file vendor/supabase.js ada dan tidak diblokir browser.",
        0,
        "library_missing"
      );
    }
    var url = cfg().SUPABASE_URL;
    var key = cfg().SUPABASE_ANON_KEY;
    if (isPlaceholder(url) || isPlaceholder(key)) {
      throw makeError(
        "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di assets/js/config.js.",
        0,
        "not_configured"
      );
    }
    client = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    return client;
  }

  function fail(error, fallback) {
    var msg = (error && (error.message || error.error_description || error.msg)) || fallback || "Terjadi kesalahan.";
    var errCode = error && error.code;
    // Fungsi database belum dibuat (migrasi terbaru belum dijalankan).
    if (errCode === "PGRST202" || /could not find the function/i.test(msg)) {
      var fn = (msg.match(/public\.([a-z_]+)/i) || [])[1] || "";
      var missing = makeError(
        "Fungsi database" + (fn ? " “" + fn + "”" : "") +
        " belum tersedia di Supabase. Jalankan file supabase/update-hapus-tahun-semester.sql di SQL Editor, lalu muat ulang halaman.",
        400,
        "missing_function"
      );
      missing.detail = msg;
      return missing;
    }
    var code = (error && (error.code || error.error_code)) || "";
    var status = (error && error.status) || 0;

    if (/Invalid login credentials/i.test(msg)) {
      code = "invalid_credentials"; status = 401; msg = "Email atau password salah.";
    } else if (/Email not confirmed/i.test(msg)) {
      code = "email_not_confirmed";
    } else if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) {
      code = "network";
    } else if (code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(msg)) {
      code = "missing_table";
    } else if (code === "23505" || /sudah terdaftar/i.test(msg)) {
      code = "duplicate";
    } else if (code === "23503") {
      code = "foreign_key";
    } else if (code === "23514") {
      code = "invalid_data";
    } else if (code === "42501" || /row-level security|permission denied/i.test(msg)) {
      code = "forbidden";
    } else if (code === "PGRST116" || code === "P0002") {
      code = "not_found";
    } else if (status === 429) {
      code = "too_many_attempts";
    }

    return makeError(msg, status, code);
  }

  function text(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function toBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    return ["1", "true", "ya", "yes", "on"].indexOf(text(value).toLowerCase()) !== -1;
  }

  function db() {
    return ensureClient();
  }

  /* ---------------- PROFIL ---------------- */

  async function loadProfile(user) {
    var res = await db()
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (res.error) throw fail(res.error);
    if (!res.data) {
      throw makeError(
        "Akun ini belum memiliki profil guru BK. Hubungi admin untuk melengkapi data akun.",
        403,
        "no_profile"
      );
    }
    if (res.data.aktif === false) {
      throw makeError("Akun Anda dinonaktifkan. Hubungi admin madrasah.", 403, "inactive");
    }

    return Object.assign({}, res.data, {
      email: res.data.email || user.email || "",
      full_name: res.data.full_name || ""
    });
  }

  /* ---------------- NORMALISASI DATA ---------------- */

  function studentPatch(payload) {
    var p = payload || {};
    var row = {};
    if ("nama" in p) row.nama = text(p.nama);
    if ("jenis_kelamin" in p) row.jenis_kelamin = text(p.jenis_kelamin).toUpperCase();
    if ("kelas" in p) row.kelas = text(p.kelas);
    if ("nis" in p) row.nis = text(p.nis) || null;
    if ("no_urut" in p) {
      var no = text(p.no_urut);
      row.no_urut = no === "" ? null : Number(no);
    }
    if ("aktif" in p) row.aktif = toBool(p.aktif);
    if ("angkatan" in p) {
      var ang = text(p.angkatan);
      row.angkatan = ang === "" ? null : Number(ang);
    }
    if ("tingkat" in p) {
      var tk = text(p.tingkat);
      row.tingkat = tk === "" ? null : Number(tk);
    }
    return row;
  }

  function newStudent(payload) {
    var row = studentPatch(payload);
    if (!("aktif" in row)) row.aktif = true;
    return row;
  }

  function attendanceRow(row) {
    var status = text(row.status).toLowerCase();
    var keterangan = status === "masuk" ? null : text(row.keterangan).toLowerCase();
    if (status === "tidak_masuk" && ["alpa", "sakit", "izin"].indexOf(keterangan) === -1) {
      keterangan = "alpa";
    }
    return {
      student_id: text(row.student_id),
      tanggal: text(row.tanggal),
      status: status,
      keterangan: keterangan,
      catatan: text(row.catatan) || null,
      recorded_by: (API.user && API.user.id) || null
    };
  }

  /* ---------------- AUTENTIKASI ---------------- */

  API.isConfigured = function () {
    if (window.location.protocol === "file:") return false;
    var c = cfg();
    return !isPlaceholder(c.SUPABASE_URL) && !isPlaceholder(c.SUPABASE_ANON_KEY);
  };

  API.init = function () {
    if (typeof window.supabase === "undefined") {
      throw makeError(
        "Pustaka Supabase belum termuat. Pastikan file vendor/supabase.js ada.",
        0,
        "library_missing"
      );
    }
    ensureClient();
    return API;
  };

  API.errorMessage = function (err) {
    if (!err) return "Terjadi kesalahan.";
    var msg = err.message || String(err);
    var map = {
      invalid_credentials: "Email atau password salah.",
      email_not_confirmed: "Email belum dikonfirmasi. Minta admin mengaktifkan akun di Supabase.",
      too_many_attempts: "Terlalu banyak percobaan login. Coba lagi beberapa saat lagi.",
      unauthorized: "Sesi Anda telah berakhir. Silakan login kembali.",
      no_profile: "Akun ini belum terdaftar sebagai guru BK. Hubungi admin madrasah.",
      inactive: "Akun Anda dinonaktifkan. Hubungi admin madrasah.",
      not_configured: "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di assets/js/config.js.",
      library_missing: "Pustaka Supabase gagal dimuat. Pastikan file vendor/supabase.js tersedia.",
      missing_table: "Tabel database belum dibuat. Jalankan file supabase/schema.sql di SQL Editor Supabase.",
      forbidden: "Akses ditolak. Pastikan akun Anda aktif dan sudah login.",
      duplicate: "Data sudah ada. Untuk akun, email tersebut sudah terdaftar.",
      foreign_key: "Data terkait tidak ditemukan. Muat ulang halaman lalu coba lagi.",
      invalid_data: "Data tidak valid. Periksa kembali isian Anda.",
      not_found: "Data yang diminta tidak ditemukan.",
      network: "Tidak dapat terhubung ke Supabase. Periksa koneksi internet dan URL proyek.",
      invalid_password: "Password saat ini salah.",
      weak_password: "Password baru minimal 8 karakter.",
      too_large: "Foto melebihi batas 100 KB.",
      missing_function: "Fungsi database belum tersedia. Jalankan file migrasi terbaru di Supabase SQL Editor."
    };
    if (err.code && map[err.code]) return map[err.code];
    if (err.status === 401) return map.unauthorized;
    if (err.status === 403) return "Akses ditolak.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return map.network;
    return msg;
  };

  API.getSession = async function () {
    var sb = db();
    var res = await sb.auth.getSession();
    if (res.error) throw fail(res.error);

    var session = res.data && res.data.session;
    if (!session || !session.user) {
      API.user = null;
      API.session = null;
      return null;
    }

    var profile;
    try {
      profile = await loadProfile(session.user);
    } catch (err) {
      try { await sb.auth.signOut(); } catch (e) { /* abaikan */ }
      API.user = null;
      API.session = null;
      throw err;
    }

    API.session = session;
    API.user = profile;
    return session;
  };

  API.onAuthStateChange = function (callback) {
    var sb = db();
    var sub = sb.auth.onAuthStateChange(callback);
    return sub && sub.data ? sub.data.subscription : { unsubscribe: function () {} };
  };

  API.signIn = async function (email, password) {
    var sb = db();
    var res = await sb.auth.signInWithPassword({ email: text(email), password: password });
    if (res.error) throw fail(res.error);

    var profile;
    try {
      profile = await loadProfile(res.data.user);
    } catch (err) {
      try { await sb.auth.signOut(); } catch (e) { /* abaikan */ }
      throw err;
    }

    /* Catat waktu login terakhir (abaikan bila gagal, tidak krusial). */
    try {
      await sb.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", res.data.user.id);
    } catch (e) { /* abaikan */ }

    API.session = res.data.session;
    API.user = profile;
    return { user: profile };
  };

  API.signOut = async function () {
    await db().auth.signOut();
    API.user = null;
    API.session = null;
  };

  API.resetPassword = async function (email) {
    if (!email) {
      throw makeError(
        "Masukkan email terlebih dahulu. Hubungi admin bila email pemulihan belum diatur.",
        400,
        "reset_not_supported"
      );
    }
    var sb = db();
    var res = await sb.auth.resetPasswordForEmail(text(email), {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (res.error) throw fail(res.error);
    return { sent: true };
  };

  API.changePassword = async function (currentPassword, newPassword) {
    if (!newPassword || String(newPassword).length < 8) {
      throw makeError("Password baru minimal 8 karakter.", 422, "weak_password");
    }

    var sb = db();
    var email = API.user && API.user.email;
    if (!email) throw makeError("Sesi tidak ditemukan. Silakan login kembali.", 401, "unauthorized");

    /* Verifikasi password lama dengan login ulang (Supabase tidak memintanya). */
    var check = await sb.auth.signInWithPassword({ email: email, password: currentPassword });
    if (check.error) {
      throw makeError("Password saat ini salah.", 422, "invalid_password");
    }

    var res = await sb.auth.updateUser({ password: newPassword });
    if (res.error) throw fail(res.error);

    API.session = res.data ? res.data.session || API.session : API.session;
    return { changed: true };
  };

  API.getProfile = async function () {
    var sb = db();
    var res = await sb.auth.getUser();
    if (res.error) throw fail(res.error);
    var profile = await loadProfile(res.data.user);
    API.user = profile;
    return profile;
  };

  /* ---------------- SISWA ---------------- */

  API.getStudents = async function (includeInactive) {
    var q = db()
      .from("students")
      .select("*")
      .order("kelas", { ascending: true })
      .order("no_urut", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    if (!includeInactive) q = q.eq("aktif", true);

    var res = await q;
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.createStudent = async function (payload) {
    var res = await db().from("students").insert(newStudent(payload)).select().single();
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.updateStudent = async function (id, payload) {
    var res = await db().from("students").update(studentPatch(payload)).eq("id", id).select().maybeSingle();
    if (res.error) throw fail(res.error);
    if (!res.data) throw makeError("Data siswa tidak ditemukan.", 404, "not_found");
    return res.data;
  };

  API.deleteStudent = async function (id) {
    var res = await db().from("students").delete().eq("id", id).select("id");
    if (res.error) throw fail(res.error);
    if (!res.data || !res.data.length) throw makeError("Data siswa tidak ditemukan.", 404, "not_found");
    return { deleted: true };
  };

  API.importStudents = async function (rows) {
    if (!rows || !rows.length) return { imported: 0 };

    var seen = {};
    var payload = [];
    rows.forEach(function (row) {
      if (!row) return;
      var noUrut = text(row.no_urut);
      var item = {
        nama: text(row.nama),
        jenis_kelamin: text(row.jenis_kelamin).toUpperCase(),
        kelas: text(row.kelas),
        nis: text(row.nis) || null,
        no_urut: noUrut === "" ? null : Number(noUrut),
        aktif: "aktif" in row ? toBool(row.aktif) : true
      };
      if (!item.nama || !item.kelas || !item.jenis_kelamin) return;
      var key = item.nama.toLowerCase() + "|" + item.kelas.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      payload.push(item);
    });

    if (!payload.length) return { imported: 0 };

    var res = await db()
      .from("students")
      .upsert(payload, { onConflict: "nama,kelas", ignoreDuplicates: false })
      .select("id");

    if (res.error) throw fail(res.error);
    return { imported: (res.data || payload).length };
  };

  API.getStudentAttendanceCount = async function (studentId) {
    var res = await db()
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId);
    if (res.error) throw fail(res.error);
    return res.count || 0;
  };

  /* ---------------- ABSENSI ---------------- */

  API.getAttendanceByDate = async function (tanggal, semester) {
    var q = db()
      .from("attendance")
      .select("*")
      .eq("tanggal", tanggal);
    // Tampilkan data tanggal tsb. pada semester berjalan DAN catatan lama
    // yang belum memiliki semester (kompatibilitas data sebelum migrasi).
    if (semester && semester.id && semester.academic_year_id) {
      q = q.or(
        "semester_id.eq." + semester.id + ",semester_id.is.null,academic_year_id.eq." + semester.academic_year_id
      );
    }
    var res = await q.order("id", { ascending: true });
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.getAttendanceRange = async function (from, to, opts) {
    var o = opts || {};
    var q = db()
      .from("attendance")
      .select("*")
      .gte("tanggal", from)
      .lte("tanggal", to);
    if (o.academicYearId) {
      q = q.or("academic_year_id.eq." + o.academicYearId + ",academic_year_id.is.null");
    }
    if (o.semesterId) {
      q = q.or("semester_id.eq." + o.semesterId + ",semester_id.is.null");
    }
    var res = await q
      .order("tanggal", { ascending: true })
      .order("id", { ascending: true });
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.saveAttendance = async function (rows, semester) {
    if (!rows || !rows.length) return [];
    var sem = semester || null;
    var payload = rows.map(function (row) {
      var r = attendanceRow(row);
      if (sem && sem.id) {
        r.semester_id = sem.id;
        r.academic_year_id = sem.academic_year_id;
      }
      return r;
    }).filter(function (row) {
      return row.student_id && row.tanggal && row.status;
    });
    if (!payload.length) return [];

    var res = await db()
      .from("attendance")
      .upsert(payload, { onConflict: "student_id,tanggal", ignoreDuplicates: false })
      .select();
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  /* ---------------- LAPORAN KERJA ---------------- */

  API.getReports = async function () {
    var res = await db()
      .from("work_reports")
      .select("*, work_report_items(count)")
      .order("bulan", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (res.error) throw fail(res.error);

    return (res.data || []).map(function (row) {
      var count = row.work_report_items && row.work_report_items[0] ? row.work_report_items[0].count : 0;
      row.item_count = count || 0;
      return row;
    });
  };

  API.getReport = async function (id) {
    if (!id) return null;
    var res = await db()
      .from("work_reports")
      .select("*, work_report_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (res.error) throw fail(res.error);
    if (!res.data) return null;

    res.data.work_report_items = (res.data.work_report_items || []).sort(function (a, b) {
      return (a.no_urut || 0) - (b.no_urut || 0);
    });
    return res.data;
  };

  API.saveReport = async function (report, items) {
    var payload = (items || []).map(function (item) {
      return {
        kegiatan: text(item.kegiatan),
        pekerjaan: text(item.pekerjaan),
        tanggal: item.tanggal || null
      };
    }).filter(function (item) {
      return item.kegiatan !== "";
    });

    var res = await db().rpc("save_work_report", {
      p_report: report || {},
      p_items: payload
    });
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.deleteReport = async function (id) {
    var res = await db().from("work_reports").delete().eq("id", id).select("id");
    if (res.error) throw fail(res.error);
    if (!res.data || !res.data.length) throw makeError("Laporan kerja tidak ditemukan.", 404, "not_found");
    return { deleted: true };
  };

  /* ---------------- PENGATURAN ---------------- */

  API.getSettings = async function () {
    var res = await db().from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (res.error) throw fail(res.error);
    return res.data || null;
  };

  /* ============================================================
     PERAN PENGGUNA
     ============================================================ */

  API.isSuperadmin = function () {
    return Boolean(API.user && API.user.role === "superadmin");
  };

  API.isAdmin = function () {
    return Boolean(API.user && (API.user.role === "superadmin" || API.user.role === "admin"));
  };

  API.roleLabel = function (role) {
    return {
      superadmin: "Superadmin",
      admin: "Admin",
      guru_bk: "Guru BK",
      guru_piket: "Guru Piket",
      wali_kelas: "Wali Kelas"
    }[role] || role || "-";
  };

  API.isGuruPiket = function () {
    return Boolean(API.user && API.user.role === "guru_piket");
  };

  API.isWaliKelas = function () {
    return Boolean(API.user && API.user.role === "wali_kelas");
  };

  /* ---------------- WALI KELAS ---------------- */

  API.getWaliKelasSaya = async function () {
    var res = await db().rpc("wali_kelas_saya");
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.setWaliKelas = async function (userId, classGroupId) {
    var res = await db().rpc("wali_kelas_set", { p_user_id: userId, p_class_group_id: classGroupId });
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.deleteWaliKelas = async function (id) {
    var res = await db().rpc("wali_kelas_hapus", { p_id: id });
    if (res.error) throw fail(res.error);
    return res.data;
  };

  /* Tingkat pengawasan guru BK yang sedang login (null = semua tingkat). */
  API.getMyTingkat = async function () {
    try {
      var res = await db().from("profiles").select("tingkat").eq("id", API.user.id).maybeSingle();
      if (res.error) return API.user.tingkat || null;
      return res.data ? res.data.tingkat : (API.user.tingkat || null);
    } catch (e) {
      return API.user.tingkat || null;
    }
  };

  API.getSemuaWaliKelas = async function () {
    var res = await db()
      .from("wali_kelas")
      .select("id, user_id, academic_year_id, class_group_id, created_at")
      .order("created_at", { ascending: true });
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  /* Absensi satu tanggal dalam satu panggilan (dipakai guru piket & wali kelas). */
  API.getAbsensiHariIni = async function (tanggal) {
    var res = await db().rpc("absensi_hari_ini", { p_tanggal: tanggal });
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  /* ============================================================
     TAHUN AJARAN & SEMESTER
     ============================================================ */

  function nullableDate(value) {
    var v = text(value);
    return v === "" ? null : v.slice(0, 10);
  }

  API.getAcademicYears = async function (includeArchived) {
    var q = db()
      .from("academic_years")
      .select("*")
      .order("tahun_awal", { ascending: false });
    if (!includeArchived) q = q.eq("is_aktif", true);
    var res = await q;
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.getSemesters = async function (includeArchived) {
    var q = db()
      .from("semesters")
      .select("*")
      .order("academic_year_id", { ascending: true })
      .order("urutan", { ascending: true });
    if (!includeArchived) q = q.eq("is_aktif", true);
    var res = await q;
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.saveAcademicYear = async function (year, ganjil, genap) {
    var yearPayload = {
      id: year && year.id ? year.id : "",
      tahun_awal: Number((year && year.tahun_awal) || 0),
      nama: text(year && year.nama),
      tanggal_mulai: nullableDate(year && year.tanggal_mulai),
      tanggal_selesai: nullableDate(year && year.tanggal_selesai),
      catatan: text(year && year.catatan)
    };
    if (!yearPayload.tahun_awal) {
      throw makeError("Tahun awal wajib diisi.", 422, "invalid_data");
    }

    function semPayload(sem, defaults) {
      var s = sem || {};
      return {
        tanggal_mulai: nullableDate(s.tanggal_mulai) || defaults[0],
        tanggal_selesai: nullableDate(s.tanggal_selesai) || defaults[1],
        hari_efektif: Math.max(1, Math.min(366, Number(s.hari_efektif) || 90)),
        status: s.status || "draft"
      };
    }

    var awal = yearPayload.tahun_awal;
    var res = await db().rpc("save_academic_year", {
      p_year: yearPayload,
      p_ganjil: semPayload(ganjil, [awal + "-07-15", awal + "-12-31"]),
      p_genap: semPayload(genap, [awal + 1 + "-01-01", awal + 1 + "-06-30"])
    });
    if (res.error) throw fail(res.error);
    var id = res.data;

    // Tahun ajaran baru: pastikan rombel dasar VII/VIII/IX tersedia.
    if (!yearPayload.id && id) await ensureDefaultClasses(id);
    return id;
  };

  /* Hapus tahun ajaran (semester, rombel, riwayat kelas, kelulusan ikut terhapus).
     Absensi dan laporan kerja tetap disimpan; kolom relasinya dijadikan kosong. */
  API.deleteAcademicYear = async function (id) {
    if (!id) throw makeError("Tahun ajaran tidak dipilih.", 422, "invalid_data");
    var res = await db().rpc("delete_academic_year", { p_year_id: id });
    if (res.error) throw fail(res.error);
    return res.data || {};
  };

  /* Periksa apakah fungsi hapus sudah ada di database (tanpa mengubah data). */
  API.checkDeleteFunctions = async function () {
    var result = { delete_semester: false, delete_academic_year: false };
    var probeSem = await db().rpc("delete_semester", { p_semester_id: "00000000-0000-0000-0000-000000000000" });
    var probeYear = await db().rpc("delete_academic_year", { p_year_id: "00000000-0000-0000-0000-000000000000" });
    result.delete_semester = !(probeSem.error && (probeSem.error.code === "PGRST202" || /could not find the function/i.test(probeSem.error.message || "")));
    result.delete_academic_year = !(probeYear.error && (probeYear.error.code === "PGRST202" || /could not find the function/i.test(probeYear.error.message || "")));
    return result;
  };

  API.deleteSemester = async function (id) {
    if (!id) throw makeError("Semester tidak dipilih.", 422, "invalid_data");
    var res = await db().rpc("delete_semester", { p_semester_id: id });
    if (res.error) throw fail(res.error);
    return res.data || {};
  };

  async function ensureDefaultClasses(academicYearId) {
    var rows = [
      { academic_year_id: academicYearId, tingkat: 7, nama: "VII-A" },
      { academic_year_id: academicYearId, tingkat: 7, nama: "VII-B" },
      { academic_year_id: academicYearId, tingkat: 8, nama: "VIII-A" },
      { academic_year_id: academicYearId, tingkat: 8, nama: "VIII-B" },
      { academic_year_id: academicYearId, tingkat: 9, nama: "IX-A" },
      { academic_year_id: academicYearId, tingkat: 9, nama: "IX-B" }
    ];
    var res = await db()
      .from("class_groups")
      .upsert(rows, { onConflict: "academic_year_id,nama", ignoreDuplicates: true });
    if (res.error) throw fail(res.error);
  }

  API.setActiveSemester = async function (id) {
    var res = await db().rpc("set_active_semester", { p_semester_id: id });
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.finishSemester = async function (id) {
    var res = await db().rpc("finish_semester", { p_semester_id: id });
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.archiveOldYears = async function () {
    var res = await db().rpc("archive_old_academic_years");
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.updateSemester = async function (id, patch) {
    var row = {};
    if (patch) {
      if ("tanggal_mulai" in patch) row.tanggal_mulai = nullableDate(patch.tanggal_mulai);
      if ("tanggal_selesai" in patch) row.tanggal_selesai = nullableDate(patch.tanggal_selesai);
      if ("hari_efektif" in patch) row.hari_efektif = Math.max(1, Math.min(366, Number(patch.hari_efektif) || 90));
      if ("status" in patch) row.status = patch.status;
    }
    var res = await db().from("semesters").update(row).eq("id", id).select().maybeSingle();
    if (res.error) throw fail(res.error);
    if (!res.data) throw makeError("Semester tidak ditemukan.", 404, "not_found");
    return res.data;
  };

  API.updateAcademicYear = async function (id, patch) {
    var row = studentYearPatch(patch);
    if (!Object.keys(row).length) return null;
    var res = await db().from("academic_years").update(row).eq("id", id).select().maybeSingle();
    if (res.error) throw fail(res.error);
    return res.data;
  };

  function studentYearPatch(patch) {
    var p = patch || {};
    var row = {};
    if ("nama" in p) row.nama = text(p.nama) || null;
    if ("is_aktif" in p) row.is_aktif = toBool(p.is_aktif);
    if ("catatan" in p) row.catatan = text(p.catatan) || null;
    if ("tanggal_mulai" in p) row.tanggal_mulai = nullableDate(p.tanggal_mulai);
    if ("tanggal_selesai" in p) row.tanggal_selesai = nullableDate(p.tanggal_selesai);
    return row;
  }

  /* ============================================================
     ROMBEL & RIWAYAT KELAS
     ============================================================ */

  API.getClassGroups = async function (academicYearId, includeArchived) {
    var q = db().from("class_groups").select("*").order("tingkat").order("nama");
    if (academicYearId) q = q.eq("academic_year_id", academicYearId);
    if (!includeArchived) q = q.eq("is_aktif", true);
    var res = await q;
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.saveClassGroup = async function (row) {
    var payload = {
      academic_year_id: text(row.academic_year_id),
      tingkat: Number(row.tingkat),
      nama: text(row.nama),
      wali_kelas: text(row.wali_kelas) || null
    };
    if (!payload.academic_year_id || !payload.nama) {
      throw makeError("Tahun ajaran dan nama rombel wajib diisi.", 422, "invalid_data");
    }
    var res = row.id
      ? await db().from("class_groups").update(payload).eq("id", row.id).select().maybeSingle()
      : await db().from("class_groups").insert(payload).select().maybeSingle();
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.deleteClassGroup = async function (id) {
    var res = await db().from("class_groups").update({ is_aktif: false }).eq("id", id).select("id");
    if (res.error) throw fail(res.error);
    return { archived: true };
  };

  API.getStudentHistory = async function (academicYearId) {
    var q = db().from("student_history").select("*").order("tingkat").order("kelas");
    if (academicYearId) q = q.eq("academic_year_id", academicYearId);
    var res = await q;
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.saveStudentHistory = async function (row) {
    var payload = {
      student_id: text(row.student_id),
      academic_year_id: text(row.academic_year_id),
      tingkat: Number(row.tingkat),
      class_group_id: text(row.class_group_id) || null,
      kelas: text(row.kelas),
      status: text(row.status) || "aktif"
    };
    var res = await db()
      .from("student_history")
      .upsert(payload, { onConflict: "student_id,academic_year_id", ignoreDuplicates: false })
      .select()
      .maybeSingle();
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.promoteStudents = async function (fromYear, toYear, luluskanKelas9) {
    var res = await db().rpc("promote_students", {
      p_from_year: fromYear,
      p_to_year: toYear,
      p_luluskan_kelas_sembilan: Boolean(luluskanKelas9)
    });
    if (res.error) throw fail(res.error);
    return res.data || {};
  };

  API.createStudentsForYear = async function (students, academicYearId, tingkat, kelas, classGroupId) {
    if (!students || !students.length) return { created: 0 };
    var ids = [];
    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      var payload = newStudent({
        nama: s.nama,
        jenis_kelamin: s.jenis_kelamin,
        kelas: kelas,
        nis: s.nis || null,
        no_urut: s.no_urut || null,
        aktif: true
      });
      var res = await db()
        .from("students")
        .upsert(payload, { onConflict: "nama,kelas", ignoreDuplicates: false })
        .select("id")
        .maybeSingle();
      if (res.error) throw fail(res.error);
      if (res.data) ids.push(res.data.id);
    }

    if (ids.length) {
      var rows = ids.map(function (id) {
        return {
          student_id: id,
          academic_year_id: academicYearId,
          tingkat: tingkat,
          class_group_id: classGroupId || null,
          kelas: kelas,
          status: "aktif"
        };
      });
      var hres = await db()
        .from("student_history")
        .upsert(rows, { onConflict: "student_id,academic_year_id", ignoreDuplicates: false });
      if (hres.error) throw fail(hres.error);
    }
    return { created: ids.length };
  };

  /* ============================================================
     KELULUSAN
     ============================================================ */

  API.getGraduations = async function (academicYearId, includeArchived) {
    var q = db().from("graduations").select("*").order("student_id");
    if (academicYearId) q = q.eq("academic_year_id", academicYearId);
    if (!includeArchived) q = q.eq("is_aktif", true);
    var res = await q;
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.saveGraduation = async function (row) {
    var payload = {
      student_id: text(row.student_id),
      academic_year_id: text(row.academic_year_id),
      status: text(row.status) || "lulus",
      sekolah_lanjutan: text(row.sekolah_lanjutan) || null,
      jenis_sekolah: text(row.jenis_sekolah) || null,
      npsn: text(row.npsn) || null,
      kota_sekolah: text(row.kota_sekolah) || null,
      jalur: text(row.jalur) || null,
      tanggal_lulus: nullableDate(row.tanggal_lulus),
      catatan: text(row.catatan) || null
    };
    if (!payload.student_id || !payload.academic_year_id) {
      throw makeError("Siswa dan tahun ajaran wajib diisi.", 422, "invalid_data");
    }
    var res = await db()
      .from("graduations")
      .upsert(payload, { onConflict: "student_id,academic_year_id", ignoreDuplicates: false })
      .select()
      .maybeSingle();
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.deleteGraduation = async function (id) {
    var res = await db().from("graduations").delete().eq("id", id).select("id");
    if (res.error) throw fail(res.error);
    return { deleted: true };
  };

  API.getGraduationSummary = async function (academicYearId) {
    var res = await db().rpc("graduation_summary", { p_academic_year_id: academicYearId });
    if (res.error) throw fail(res.error);
    return res.data || {};
  };

  /* ============================================================
     FOTO SISWA (maks. 100 KB, dikompres di browser)
     ============================================================ */

  API.uploadStudentPhoto = async function (studentId, blob, ext) {
    if (!blob) throw makeError("File foto kosong.", 422, "invalid_data");
    if (blob.size > 102400) {
      throw makeError("Foto melebihi 100 KB setelah dikompres.", 422, "too_large");
    }
    var bucket = "siswa-foto";
    var path = studentId + "/" + Date.now() + "." + (ext || "jpg");
    var sb = db();
    var up = await sb.storage.from(bucket).upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
      cacheControl: "3600"
    });
    if (up.error) throw fail(up.error);

    var pub = sb.storage.from(bucket).getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : null;

    var patch = {
      foto_bucket: bucket,
      foto_path: path,
      foto_ukuran: blob.size,
      foto_uploaded_at: new Date().toISOString()
    };
    var res = await sb.from("students").update(patch).eq("id", studentId).select().maybeSingle();
    if (res.error) throw fail(res.error);

    API.photoUrlCache[path] = url;
    return { path: path, url: url, size: blob.size, student: res.data };
  };

  API.photoUrlCache = {};

  API.getPhotoUrl = function (student) {
    if (!student || !student.foto_path) return "";
    if (API.photoUrlCache[student.foto_path]) return API.photoUrlCache[student.foto_path];
    try {
      var pub = db().storage.from(student.foto_bucket || "siswa-foto").getPublicUrl(student.foto_path);
      var url = pub && pub.data ? pub.data.publicUrl : "";
      API.photoUrlCache[student.foto_path] = url;
      return url;
    } catch (e) {
      return "";
    }
  };

  API.deleteStudentPhoto = async function (student) {
    if (!student || !student.foto_path) return;
    var sb = db();
    try { await sb.storage.from(student.foto_bucket || "siswa-foto").remove([student.foto_path]); } catch (e) { /* abaikan */ }
    var res = await sb.from("students")
      .update({ foto_path: null, foto_ukuran: null, foto_uploaded_at: null })
      .eq("id", student.id);
    if (res.error) throw fail(res.error);
  };

  /* ============================================================
     AKUN ADMIN (superadmin)
     ============================================================ */

  API.listAccounts = async function () {
    var res = await db().rpc("admin_list_accounts");
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.createAccount = async function (email, password, fullName, role, opts) {
    var o = opts || {};
    var res = await db().rpc("admin_create_account", {
      p_email: text(email),
      p_password: password,
      p_full_name: text(fullName),
      p_role: role || "admin",
      p_tingkat: o.tingkat ? Number(o.tingkat) : null,
      p_class_group_id: o.class_group_id || null
    });
    if (res.error) throw fail(res.error);
    return res.data;
  };

  API.updateAccount = async function (id, patch) {
    var p = patch || {};
    var res = await db().rpc("admin_update_account", {
      p_id: id,
      p_full_name: "full_name" in p ? text(p.full_name) : null,
      p_role: "role" in p ? p.role : null,
      p_aktif: "aktif" in p ? Boolean(p.aktif) : null,
      p_password: "password" in p ? p.password : null,
      p_tingkat: "tingkat" in p ? (p.tingkat ? Number(p.tingkat) : null) : null,
      p_class_group_id: p.class_group_id || null
    });
    if (res.error) throw fail(res.error);
    return { updated: true };
  };

  API.deleteAccount = async function (id) {
    var res = await db().rpc("admin_delete_account", { p_id: id });
    if (res.error) throw fail(res.error);
    return { deleted: true };
  };

  API.saveSettings = async function (patch) {
    var allowed = [
      "nama_madrasah", "alamat", "kepala_nama", "kepala_nip",
      "guru_nama", "guru_nip", "guru_jabatan", "kota"
    ];
    var row = {};
    allowed.forEach(function (field) {
      if (!patch || !Object.prototype.hasOwnProperty.call(patch, field)) return;
      var value = text(patch[field]);
      if (field === "nama_madrasah" && value === "") {
        throw makeError("Nama madrasah wajib diisi.", 422, "invalid_settings");
      }
      if (field === "kota" && value === "") value = "Trenggalek";
      row[field] = value === "" ? null : value;
    });

    if (!Object.keys(row).length) {
      return API.getSettings();
    }

    var res = await db().from("app_settings").update(row).eq("id", 1).select().maybeSingle();
    if (res.error) throw fail(res.error);
    return res.data;
  };

  window.API = API;
})();
