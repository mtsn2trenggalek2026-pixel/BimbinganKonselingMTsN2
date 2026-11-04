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
    } else if (code === "23505") {
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
      duplicate: "Data sudah ada (duplikat nama dan kelas).",
      foreign_key: "Data terkait tidak ditemukan. Muat ulang halaman lalu coba lagi.",
      invalid_data: "Data tidak valid. Periksa kembali isian Anda.",
      not_found: "Data yang diminta tidak ditemukan.",
      network: "Tidak dapat terhubung ke Supabase. Periksa koneksi internet dan URL proyek.",
      invalid_password: "Password saat ini salah.",
      weak_password: "Password baru minimal 8 karakter."
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

  API.getAttendanceByDate = async function (tanggal) {
    var res = await db()
      .from("attendance")
      .select("*")
      .eq("tanggal", tanggal)
      .order("id", { ascending: true });
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.getAttendanceRange = async function (from, to) {
    var res = await db()
      .from("attendance")
      .select("*")
      .gte("tanggal", from)
      .lte("tanggal", to)
      .order("tanggal", { ascending: true })
      .order("id", { ascending: true });
    if (res.error) throw fail(res.error);
    return res.data || [];
  };

  API.saveAttendance = async function (rows) {
    if (!rows || !rows.length) return [];
    var payload = rows.map(attendanceRow).filter(function (row) {
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
