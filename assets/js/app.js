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
    dbError: null,
    route: ""
  };

  var PAGES = {
    dashboard: { title: "Dasbor", render: function (c) { window.Pages.dashboard.render(c); } },
    absensi: { title: "Absensi Kehadiran", render: function (c) { window.Pages.attendance.render(c); } },
    rekap: { title: "Rekap Absensi", render: function (c) { window.Pages.recap.render(c); } },
    laporan: { title: "Laporan Kerja", render: function (c) { window.Pages.reports.render(c); } },
    siswa: { title: "Data Siswa", render: function (c) { window.Pages.students.render(c); } },
    pengaturan: { title: "Pengaturan", render: function (c) { window.Pages.settings.render(c); } }
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
  }

  function paintUser() {
    var email = (state.user && state.user.email) || "guru@bk.sch.id";
    var name = (state.profile && state.profile.full_name) || email.split("@")[0];
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
    main.innerHTML = "";
    try {
      page.render(main);
    } catch (err) {
      main.innerHTML = '<div class="card"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(err.message || String(err)) + "</span></div></div>";
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
  App.refreshStudents = async function () {
    state.students = U.sortStudents((await API.getStudents(false)) || []);
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
})();