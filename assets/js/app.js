/* ============================================================
   Aplikasi utama: autentikasi, navigasi, dan bootstrap data
   ============================================================ */
(function () {
  "use strict";

  var App = {};
  var state = window.APP_STATE = {
    session: null,
    user: null,
    profile: null,
    settings: {},
    students: [],
    academicYears: [],
    semesters: [],
    activeYear: null,
    activeSemester: null,
    dbError: null,
    route: ""
  };

  /* Nama modul halaman -> window.Pages[modul].render */
  var MODULES = {
    dashboard: "dashboard",
    tahun: "years",
    tingkat: "level",
    lulus: "graduation",
    absensi: "attendance",
    rekap: "recap",
    laporan: "reports",
    siswa: "students",
    akun: "accounts",
    pengaturan: "settings"
  };

  function pageModule(key) {
    var mod = MODULES[key];
    return mod && window.Pages && window.Pages[mod] ? window.Pages[mod] : null;
  }

  function pageRender(key) {
    return function (c) {
      var mod = pageModule(key);
      if (!mod) {
        App.pageMissing(c, key);
        return;
      }
      mod.render(c);
    };
  }

  var PAGES = {
    dashboard: { title: "Dasbor", render: pageRender("dashboard") },
    tahun: { title: "Tahun Ajaran & Semester", render: pageRender("tahun") },
    tingkat: { title: "Kelas VII · VIII · IX", render: pageRender("tingkat") },
    lulus: { title: "Kelulusan & Lanjutan", render: pageRender("lulus") },
    absensi: { title: "Absensi Kehadiran", render: pageRender("absensi") },
    rekap: { title: "Rekap Absensi", render: pageRender("rekap") },
    laporan: { title: "Laporan Kerja", render: pageRender("laporan") },
    siswa: { title: "Data Siswa", render: pageRender("siswa") },
    akun: { title: "Akun Admin", render: pageRender("akun") },
    pengaturan: { title: "Pengaturan", render: pageRender("pengaturan") }
  };

  /* Menu yang hanya tampil untuk peran tertentu. */
  var PAGE_ROLES = {
    akun: ["superadmin"],
    tahun: ["superadmin", "admin"],
    tingkat: ["superadmin", "admin"],
    lulus: ["superadmin", "admin"]
  };

  function $(sel) { return document.querySelector(sel); }

  /* ---------------- BOOT ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    bindStatic();
    boot();
  });

  async function boot() {
    if (!API.isConfigured()) {
      showSetup(
        window.location.protocol === "file:"
          ? "Halaman dibuka langsung dari file. Jalankan lewat web server, misalnya http://localhost/bk-mtsn2/ atau hosting."
          : "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di assets/js/config.js."
      );
      return;
    }
    try {
      API.init();
    } catch (err) {
      showSetup(err.message);
      return;
    }

    try {
      var session = await API.getSession();
      if (session) {
        await enterApp();
      } else {
        showAuth();
      }
    } catch (err) {
      if (err && (err.code === "no_profile" || err.code === "inactive")) {
        showAuth();
        var loginErr = $("#login-error");
        if (loginErr) {
          loginErr.textContent = API.errorMessage(err);
          loginErr.classList.remove("hidden");
        }
      } else {
        showSetup(API.errorMessage(err));
      }
    }

    hideBoot();
  }

  function hideBoot() {
    var boot = $("#boot-screen");
    if (boot) boot.classList.add("hidden");
  }

  /* ---------------- TAMPILAN AUTH / SETUP ---------------- */
  function showAuth() {
    $("#app-shell").classList.add("hidden");
    $("#setup-screen").classList.add("hidden");
    $("#auth-screen").classList.remove("hidden");
    document.body.classList.remove("app-mode");
    document.body.classList.add("auth-mode");
    var email = "";
    try { email = localStorage.getItem("bk.lastEmail") || ""; } catch (e) {}
    var input = $("#login-email");
    if (input && !input.value) input.value = email;
    var err = $("#login-error");
    if (err) { err.textContent = ""; err.classList.add("hidden"); }
    setTimeout(function () { if (input) input.focus(); }, 150);
    hideBoot();
  }

  function showSetup(message) {
    $("#app-shell").classList.add("hidden");
    $("#auth-screen").classList.add("hidden");
    $("#setup-screen").classList.remove("hidden");
    document.body.classList.remove("app-mode");
    document.body.classList.add("auth-mode");
    if (message) {
      var box = $("#setup-error");
      if (box) { box.textContent = message; box.classList.remove("hidden"); }
    }
    hideBoot();
  }

  function showApp() {
    $("#auth-screen").classList.add("hidden");
    $("#setup-screen").classList.add("hidden");
    $("#app-shell").classList.remove("hidden");
    document.body.classList.remove("auth-mode");
    document.body.classList.add("app-mode");
    hideBoot();
  }

  /* ---------------- MASUK APLIKASI ---------------- */
  async function enterApp() {
    state.session = API.session;
    state.user = API.user;
    showApp();
    paintUser();

    U.loading(true, "Memuat data awal…");
    try {
      await loadBootstrap();
      paintUser();
    } finally {
      U.loading(false);
    }

    var target = window.location.hash && window.location.hash.indexOf("#/") === 0 ? window.location.hash : "#/dashboard";
    if (window.location.hash !== target) {
      window.location.hash = target;
    } else {
      renderRoute();
    }
  }

  async function loadBootstrap() {
    state.dbError = null;
    try { state.settings = (await API.getSettings()) || {}; } catch (err) { state.settings = {}; }
    try { state.profile = await API.getProfile(); } catch (err) { state.profile = null; }
    try {
      state.students = U.sortStudents((await API.getStudents(false)) || []);
    } catch (err) {
      state.students = [];
      state.dbError = API.errorMessage(err);
    }
    await loadAcademic();
  }

  /* Tahun ajaran + semester berjalan (dipakai absensi, rekap, dan dasbor). */
  async function loadAcademic() {
    try {
      var res = await Promise.all([API.getAcademicYears(false), API.getSemesters(false)]);
      var years = res[0] || [];
      var sems = res[1] || [];
      state.academicYears = years;
      state.semesters = sems;

      var active = sems.filter(function (s) { return s.status === "aktif"; })[0];
      if (!active) {
        active = sems.filter(function (s) { return s.status !== "selesai"; })[0] || sems[0] || null;
      }
      state.activeSemester = active || null;
      state.activeYear = active
        ? years.filter(function (y) { return y.id === active.academic_year_id; })[0] || null
        : years.filter(function (y) { return y.is_aktif !== false; })[0] || years[0] || null;

      if (state.activeSemester) {
        try { localStorage.setItem("bk.activeSemester", state.activeSemester.id); } catch (e) {}
      }
    } catch (err) {
      state.academicYears = [];
      state.semesters = [];
      state.activeSemester = null;
      state.activeYear = null;
      var msg = API.errorMessage(err);
      // Tabel belum ada (migrasi belum dijalankan) → jangan blokir aplikasi.
      if (/academic_years|semesters|does not exist|PGRST205/i.test(msg)) {
        state.academicError = "Tabel tahun ajaran belum tersedia. Jalankan migrasi database.";
      }
    }
  }

  function canSee(route) {
    var allowed = PAGE_ROLES[route];
    if (!allowed) return true;
    return allowed.indexOf((state.user && state.user.role) || "guru_bk") !== -1;
  }

  /* Tampilkan / sembunyikan menu sesuai peran. */
  function paintNav() {
    U.$$("[data-role-menu]").forEach(function (el) {
      var route = el.getAttribute("data-role-menu");
      el.classList.toggle("hidden", !canSee(route));
    });
    var badge = $("#sidebar-role");
    if (badge) {
      badge.textContent = API.roleLabel(state.user && state.user.role);
      badge.className = "badge " + (state.user && state.user.role === "superadmin"
        ? "badge-super"
        : state.user && state.user.role === "admin" ? "badge-admin" : "badge-neutral");
    }
    var ctx = $("#sidebar-context");
    if (ctx) {
      if (state.activeSemester && state.activeYear) {
        ctx.innerHTML = "<strong>" + U.escape(U.tahunAjaranLabel(state.activeYear)) + "</strong>" +
          "<span>" + U.escape(U.SEMESTER_LABEL[state.activeSemester.jenis] || "-") + " · " +
          state.activeSemester.hari_efektif + " hari efektif</span>";
        ctx.classList.remove("hidden");
      } else {
        ctx.classList.add("hidden");
      }
    }
  }

  function paintUser() {
    var email = (state.user && state.user.email) || "guru@bk.sch.id";
    var name = (state.profile && state.profile.full_name) || email.split("@")[0];
    paintNav();
    var initials = U.initials(name);
    ["#sidebar-avatar", "#topbar-avatar"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.textContent = initials;
    });
    var nameEl = $("#sidebar-name");
    if (nameEl) nameEl.textContent = name;
    var emailEl = $("#sidebar-email");
    if (emailEl) emailEl.textContent = email;
    var topName = $("#topbar-name");
    if (topName) topName.textContent = name;
    var topEmail = $("#topbar-email");
    if (topEmail) topEmail.textContent = email;
    var menuName = $("#user-menu-name");
    if (menuName) menuName.textContent = name;
    var menuEmail = $("#user-menu-email");
    if (menuEmail) menuEmail.textContent = email;
  }

  /* ---------------- ROUTER ---------------- */
  function currentRoute() {
    var hash = window.location.hash || "";
    var m = hash.match(/^#\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : "dashboard";
  }

  function renderRoute() {
    if (!state.session) { showAuth(); return; }
    if (state.dbError) { renderDbError(); return; }
    var key = currentRoute();
    if (!PAGES[key]) key = "dashboard";
    if (!canSee(key)) {
      U.toast("Halaman ini hanya untuk " + (key === "akun" ? "superadmin" : "admin") + ".", "warning");
      key = "dashboard";
    }
    state.route = key;
    var page = PAGES[key];

    // Nav aktif
    U.$$(".nav-link").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === key);
    });
    document.title = page.title + " · BK MTsN 2 Trenggalek";
    var dateEl = $("#topbar-date");
    if (dateEl) dateEl.textContent = "Sistem Informasi BK · " + U.nowLabel();
    var dd = $("#user-dropdown");
    if (dd) dd.classList.remove("open");

    var main = $("#main-content");
    if (!main) return;
    if (!window.Pages || !pageModule(key)) {
      U.$$(".nav-link").forEach(function (a) {
        a.classList.toggle("active", a.dataset.route === key);
      });
      App.pageMissing(main, key);
      return;
    }
    main.innerHTML = "";
    try {
      page.render(main);
    } catch (err) {
      var msg = err && (err.message || String(err));
      if (/is not a function|is not defined|undefined is not|Cannot read properties of undefined \(reading 'render'\)/i.test(msg || "")) {
        U.toast("Skrip halaman " + key + " belum termuat (Ctrl + Shift + R).", "error", 6000);
        App.pageMissing(main, key);
      } else {
        main.innerHTML = '<div class="card"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(msg) + "</span></div></div>";
      }
    }
    closeSidebar();
    window.scrollTo(0, 0);
  }

  function renderDbError() {
    U.$$(".nav-link").forEach(function (a) { a.classList.remove("active"); });
    var main = $("#main-content");
    main.innerHTML =
      '<div class="card setup-card">' +
        '<div class="setup-icon">' + U.icon("alert", 30) + "</div>" +
        "<h2>Database belum siap digunakan</h2>" +
        "<p class=\"muted\">" + U.escape(state.dbError) + "</p>" +
        '<div class="setup-steps">' +
          "<div><span>1</span><p>Buka <strong>Supabase Dashboard</strong> proyek Anda, lalu masuk ke menu <strong>SQL Editor</strong>.</p></div>" +
          "<div><span>2</span><p>Copy seluruh isi file <code>supabase/schema.sql</code>, tempel di SQL Editor, lalu klik <strong>Run</strong>.</p></div>" +
          "<div><span>3</span><p>Pastikan akun Anda ada di <strong>Authentication &gt; Users</strong> dan profilnya aktif.</p></div>" +
          "<div><span>4</span><p>Periksa <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> di <code>assets/js/config.js</code>, lalu muat ulang halaman ini.</p></div>" +
        "</div>" +
        '<button type="button" class="btn btn-primary" id="db-retry">' + U.icon("refresh", 17) + "<span>Coba Lagi</span></button>" +
      "</div>";
    var retry = $("#db-retry");
    if (retry) retry.addEventListener("click", async function () {
      U.buttonLoading(retry, true);
      await loadBootstrap();
      U.buttonLoading(retry, false);
      if (state.dbError) U.toast(state.dbError, "error");
      else { U.toast("Database berhasil terhubung.", "success"); renderRoute(); }
    });
  }

  function navigate(route) {
    window.location.hash = "#/" + route;
  }

  /* ---------------- AKSI ---------------- */
  App.navigate = navigate;
  App.renderRoute = renderRoute;
  App.refreshAcademic = async function () {
    await loadAcademic();
    paintNav();
    return { year: state.activeYear, semester: state.activeSemester };
  };
  App.canSee = canSee;
  App.canEdit = function () { return Boolean(API.isAdmin()); };
  /* Dipakai oleh halaman dengan skrip yang gagal dimuat:
     tampilkan pesan jelas, jangan biarkan menu kosong. */
  App.pageMissing = function (container, route, err) {
    var file = {
      dashboard: "dashboard.js", tahun: "years.js", tingkat: "levels.js",
      lulus: "graduation.js", absensi: "attendance.js", rekap: "attendance-recap.js",
      laporan: "reports.js", siswa: "students.js", akun: "accounts.js",
      pengaturan: "settings.js"
    }[route] || route;
    container.innerHTML =
      '<div class="card setup-card">' +
        '<div class="setup-icon">' + U.icon("alert", 30) + "</div>" +
        "<h2>Halaman belum termuat</h2>" +
        '<p class="muted">File <code>assets/js/' + U.escape(file) + "</code> gagal dimuat" +
        (err ? ": " + U.escape(err) : "") + ". Halaman lain tetap dapat dipakai.</p>" +
        '<div class="setup-steps">' +
          "<div><span>1</span><p>Muat ulang aplikasi dengan <strong>Ctrl + Shift + R</strong> (hapus cache).</p></div>" +
          "<div><span>2</span><p>Pastikan nama file di folder <code>assets/js</code> persis sama (huruf besar/kecil).</p></div>" +
          "<div><span>3</span><p>Buka <strong>F12 → Console</strong> untuk melihat error pemuatan file.</p></div>" +
        "</div>" +
        '<button type="button" class="btn btn-primary" onclick="location.reload(true)">' + U.icon("refresh", 17) + "<span>Muat Ulang</span></button>" +
      "</div>";
  };
  App.refreshStudents = async function () {
    state.students = U.sortStudents((await API.getStudents(false)) || []);
    return state.students;
  };
  /* Muat ulang semua siswa termasuk yang nonaktif (untuk halaman data siswa). */
  App.refreshStudentsAll = async function () {
    state.students = U.sortStudents((await API.getStudents(true)) || []);
    return state.students;
  };
  App.logout = async function () {
    var ok = await U.confirm("Keluar dari akun ini?", {
      title: "Keluar", confirmLabel: "Ya, Keluar", danger: false
    });
    if (!ok) return;
    try {
      await API.signOut();
      state.session = null;
      state.user = null;
      state.profile = null;
      showAuth();
      U.toast("Anda telah keluar.", "info");
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  };

  window.App = App;

  /* ---------------- EVENT BINDING ---------------- */
  function bindStatic() {
    bindTheme();

    // Login
    var form = $("#login-form");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var email = $("#login-email").value.trim();
        var password = $("#login-password").value;
        var errBox = $("#login-error");
        var btn = $("#login-submit");
        errBox.classList.add("hidden");
        if (!email || !password) {
          errBox.textContent = "Email dan password wajib diisi.";
          errBox.classList.remove("hidden");
          return;
        }
        U.buttonLoading(btn, true);
        try {
          await API.signIn(email, password);
          try { localStorage.setItem("bk.lastEmail", email); } catch (e2) {}
          U.toast("Selamat datang kembali!", "success");
          await enterApp();
        } catch (err) {
          errBox.textContent = API.errorMessage(err);
          errBox.classList.remove("hidden");
        } finally {
          U.buttonLoading(btn, false);
          $("#login-password").value = "";
        }
      });
    }

    // Toggle password
    var toggle = $("#toggle-password");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var input = $("#login-password");
        var isPwd = input.type === "password";
        input.type = isPwd ? "text" : "password";
        toggle.innerHTML = U.icon(isPwd ? "eyeOff" : "eye", 18);
      });
    }

    // Lupa password
    var forgot = $("#forgot-password");
    if (forgot) {
      forgot.addEventListener("click", function (e) {
        e.preventDefault();
        U.modal({
          title: "Lupa Password",
          subtitle: "Reset password dilakukan oleh admin madrasah.",
          size: "sm",
          body: '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Reset password dilakukan oleh admin madrasah melalui Supabase.</span></div>" +
            '<p class="form-hint">Langkah admin:</p>' +
            '<p class="form-hint">1. Buka <strong>Supabase Dashboard &gt; Authentication &gt; Users</strong>.<br>' +
            '2. Pilih akun guru BK, klik menu <strong>&#8942; &gt; Reset password</strong> (atau kirim email pemulihan).<br>' +
            '3. Sampaikan password baru kepada guru yang bersangkutan.</p>' +
            '<p class="form-hint">Setelah login, Anda dapat mengganti password sendiri melalui menu <strong>Pengaturan &gt; Akun &gt; Ganti Password</strong>.</p>',
          actions: [{ label: "Mengerti", class: "btn-primary" }]
        });
      });
    }

    // Muat ulang dari layar bantuan server
    var setupRetry = $("#setup-retry");
    if (setupRetry) {
      setupRetry.addEventListener("click", function () {
        window.location.reload();
      });
    }

    // Navigasi
    U.on(document, "click", ".nav-link", function (e, link) {
      if (link.getAttribute("href")) return;
      e.preventDefault();
      navigate(link.dataset.route);
    });
    window.addEventListener("hashchange", function () {
      if (state.session) renderRoute();
    });

    // Sidebar mobile
    var menuBtn = $("#menu-toggle");
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        document.body.classList.toggle("sidebar-open");
      });
    }
    var overlay = $("#sidebar-overlay");
    if (overlay) overlay.addEventListener("click", closeSidebar);
    U.on(document, "click", ".nav-link", function () { closeSidebar(); });

    // User menu
    var userBtn = $("#user-menu-btn");
    if (userBtn) {
      userBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var dd = $("#user-dropdown");
        dd.classList.toggle("open");
      });
    }
    document.addEventListener("click", function (e) {
      var dd = $("#user-dropdown");
      if (dd && dd.classList.contains("open") && !e.target.closest("#user-menu-wrap")) {
        dd.classList.remove("open");
      }
    });
    U.on(document, "click", "#menu-logout", function (e) {
      e.preventDefault();
      App.logout();
    });
    U.on(document, "click", "#menu-settings", function (e) {
      e.preventDefault();
      var dd = $("#user-dropdown");
      if (dd) dd.classList.remove("open");
      navigate("pengaturan");
    });

    // Sesi berakhir saat aplikasi sedang dipakai
    document.addEventListener("bk:unauthorized", function () {
      if (!state.session) return;
      state.session = null;
      state.user = null;
      state.profile = null;
      showAuth();
      U.toast("Sesi Anda telah berakhir. Silakan login kembali.", "info");
    });
  }

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
  }

  /* ---------------- TEMA TERANG / GELAP ---------------- */
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    var t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("bk.theme", t); } catch (e) {}
    var menuIcon = document.querySelector("#menu-theme span[data-icon]");
    if (menuIcon) menuIcon.innerHTML = U.icon(t === "dark" ? "sun" : "moon", 16);
    var toggle = document.querySelector("#theme-toggle");
    if (toggle) {
      toggle.setAttribute("title", t === "dark" ? "Aktifkan tema terang" : "Aktifkan tema gelap");
      var light = toggle.querySelector(".theme-light-icon");
      var dark = toggle.querySelector(".theme-dark-icon");
      if (light) light.innerHTML = U.icon("moon", 18);
      if (dark) dark.innerHTML = U.icon("sun", 18);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0b1220" : "#0f766e");
  }

  App.toggleTheme = function () {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
    U.toast(currentTheme() === "dark" ? "Tema gelap aktif." : "Tema terang aktif.", "info", 1800);
  };

  function bindTheme() {
    var toggle = $("#theme-toggle");
    if (toggle) toggle.addEventListener("click", App.toggleTheme);
    U.on(document, "click", "#menu-theme", function (e) {
      e.preventDefault();
      var dd = $("#user-dropdown");
      if (dd) dd.classList.remove("open");
      App.toggleTheme();
    });
    applyTheme(currentTheme());
  }
})();