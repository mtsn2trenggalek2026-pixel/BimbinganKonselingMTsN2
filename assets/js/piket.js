/* ============================================================
   Dasbor & Absensi — Guru Piket
   ------------------------------------------------------------
   Guru piket HANYA mengabsen siswa:
     - memilih tanggal & kelas,
     - menandai Masuk / Tidak Masuk (Alpa, Sakit, Izin),
     - menyimpan,
     - melihat ringkasan hari ini.
   Tidak ada menu data siswa, laporan kerja, atau pengaturan.
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    view: "dashboard",
    tanggal: "",
    kelas: "",
    search: "",
    rows: [],
    semester: null,
    year: null,
    loading: false,
    saving: false,
    token: 0
  };

  function today() { return U.todayISO(); }

  function semesterOf() {
    return window.APP_STATE.activeSemester || null;
  }

  /* ---------------- DATA ---------------- */

  async function loadRows(tanggal) {
    var token = ++state.token;
    state.loading = true;
    paint();
    try {
      var data = await API.getAbsensiHariIni(tanggal || state.tanggal);
      if (token !== state.token) return;
      state.rows = data || [];
      state.loading = false;
      paint();
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      state.rows = [];
      paint();
      U.toast(API.errorMessage(err), "error", 6000);
    }
  }

  function classes() {
    return U.uniqueClasses(state.rows.map(function (r) { return r.kelas; }).filter(Boolean));
  }

  function visible() {
    var q = state.search.trim().toLowerCase();
    return state.rows.filter(function (r) {
      if (state.kelas && r.kelas !== state.kelas) return false;
      if (!q) return true;
      return String(r.nama).toLowerCase().indexOf(q) !== -1 || String(r.nis || "").indexOf(q) !== -1;
    });
  }

  function counts() {
    var c = { hadir: 0, alpa: 0, sakit: 0, izin: 0, total: 0 };
    var list = state.rows.filter(function (r) { return !state.kelas || r.kelas === state.kelas; });
    list.forEach(function (r) {
      c.total++;
      if (r.status === "masuk") c.hadir++;
      else if (c[r.keterangan] !== undefined) c[r.keterangan]++;
    });
    return c;
  }

  /* ---------------- RENDER ---------------- */

  function semesterStrip() {
    var sem = state.semester;
    var year = state.year;
    if (!sem) {
      return '<div class="notice notice-warning">' + U.icon("info", 18) +
        "<span>Semester berjalan belum diatur admin. Absensi tetap bisa disimpan, tetapi belum terhubung ke semester.</span></div>";
    }
    return '<div class="semester-strip">' +
      '<div class="ss-item"><span class="ss-label">Tahun ajaran</span><strong>' + U.escape(U.tahunAjaranLabel(year)) + "</strong></div>" +
      '<div class="ss-item"><span class="ss-label">Semester</span><strong>' + U.escape(U.SEMESTER_LABEL[sem.jenis]) + "</strong></div>" +
      '<div class="ss-item"><span class="ss-label">Hari efektif</span><strong>' + (sem.hari_efektif || 0) + " hari</strong></div>" +
    "</div>";
  }

  function paint() {
    if (!state.container) return;
    var main = U.$("#piket-main", state.container);
    if (!main) return;

    var c = counts();
    var list = visible();
    var summary =
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Siswa</span><strong>' + c.total + "</strong><small>dalam filter</small></div>" +
        '<div class="summary-card tone-green"><span class="summary-label">Masuk</span><strong id="pk-hadir">' + c.hadir + "</strong><small>siswa</small></div>" +
        '<div class="summary-card tone-red"><span class="summary-label">Tidak Masuk</span><strong id="pk-tidak">' + (c.alpa + c.sakit + c.izin) + "</strong><small>Alpa " + c.alpa + " · Sakit " + c.sakit + " · Izin " + c.izin + "</small></div>" +
        '<div class="summary-card tone-amber"><span class="summary-label">Tanggal</span><strong class="stat-value-sm">' + U.escape(U.formatDateID(state.tanggal)) + "</strong><small>" + U.escape(U.formatDateLong(state.tanggal).split(",")[0]) + "</small></div>" +
      "</div>";

    main.innerHTML =
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field"><label for="pk-tanggal">Tanggal</label><input type="date" id="pk-tanggal" value="' + state.tanggal + '"></div>' +
          '<div class="field"><label for="pk-kelas">Kelas</label><select id="pk-kelas"><option value="">Semua Kelas</option>' +
            classes().map(function (k) { return '<option value="' + U.escape(k) + '"' + (state.kelas === k ? " selected" : "") + ">" + U.escape(k) + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field grow"><label for="pk-search">Cari siswa</label><div class="input-with-icon">' + U.icon("search", 17) + '<input type="search" id="pk-search" value="' + U.escape(state.search) + '" placeholder="Nama atau NIS…" autocomplete="off"></div></div>' +
          '<div class="field field-action"><button type="button" class="btn btn-soft" id="pk-all">' + U.icon("checkCircle", 17) + "<span>Semua Masuk</span></button></div>" +
        "</div>" +
      "</div>" +
      summary +
      '<div class="card table-card">' +
        '<div class="table-toolbar">' +
          '<div class="table-toolbar-left"><span class="table-count" id="pk-count">' + list.length + " siswa</span>" +
            '<span class="dirty-badge hidden" id="pk-dirty"><span class="dot"></span>Belum disimpan</span></div>' +
          '<div class="table-toolbar-right">' +
            '<button type="button" class="btn btn-ghost btn-sm" id="pk-reload">' + U.icon("refresh", 16) + "<span>Muat ulang</span></button>" +
            '<button type="button" class="btn btn-primary" id="pk-save">' + U.icon("save", 17) + "<span>Simpan Absensi</span></button>" +
          "</div>" +
        "</div>" +
        '<div class="table-wrap"><table class="data-table abs-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Kelas</th>' +
          '<th class="col-center">Kehadiran</th><th class="col-center">Keterangan</th>' +
        "</tr></thead><tbody id=\"pk-tbody\">" + bodyRows(list) + "</tbody></table></div>" +
      "</div>";

    bindMain(main);
    schedulerAutosave();
  }

  function bodyRows(list) {
    if (state.loading) {
      return '<tr><td colspan="6"><div class="table-loading"><span class="spinner"></span><span>Memuat data absensi…</span></div></td></tr>';
    }
    if (!list.length) {
      return '<tr><td colspan="6">' + U.emptyState("users", "Tidak ada siswa", "Belum ada siswa pada filter ini. Hubungi admin bila data siswa belum diisi.") + "</td></tr>";
    }
    return list.map(function (r, i) {
      var masuk = r.status === "masuk";
      var reason = masuk ? '<span class="reason-placeholder">—</span>'
        : '<div class="reason-group">' + ["alpa", "sakit", "izin"].map(function (x) {
            return '<button type="button" data-reason="' + x + '" class="reason-chip ' + x + (r.keterangan === x ? " active" : "") + '">' + U.alasanLabel(x) + "</button>";
          }).join("") + "</div>";
      return '<tr data-id="' + U.escape(r.student_id) + '">' +
        '<td class="col-no">' + (i + 1) + "</td>" +
        '<td><div class="student-cell"><span class="avatar avatar-xs">' + U.escape(U.initials(r.nama)) + "</span>" +
          '<div class="student-cell-text"><strong>' + U.escape(r.nama) + "</strong>" + (r.nis ? "<small>NIS " + U.escape(r.nis) + "</small>" : "") + "</div></div></td>" +
        '<td class="col-center"><span class="badge badge-gender ' + (r.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(r.jenis_kelamin) + "</span></td>" +
        '<td class="col-center"><span class="class-pill">' + U.escape(r.kelas || "-") + "</span></td>" +
        '<td class="col-center" data-label="Kehadiran"><div class="segmented segmented-sm">' +
          '<button type="button" data-act="masuk" class="' + (masuk ? "active" : "") + '">' + U.icon("check", 14) + "<span>Masuk</span></button>" +
          '<button type="button" data-act="tidak" class="' + (!masuk ? "active danger" : "") + '">' + U.icon("x", 14) + "<span>Tidak Masuk</span></button>" +
        "</div></td>" +
        '<td class="col-center" data-label="Keterangan">' + reason + "</td>" +
      "</tr>";
    }).join("");
  }

  function rowOf(id) {
    return state.rows.filter(function (r) { return r.student_id === id; })[0] || null;
  }

  var autosaveTimer = null;
  function schedulerAutosave() {
    var badge = U.$("#pk-dirty", state.container);
    if (badge) badge.classList.remove("hidden");
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () { save(true); }, 1200);
  }

  /* ---------------- AKSI ---------------- */

  async function save(silent) {
    if (state.saving) return;
    var list = state.rows.filter(function (r) { return !state.kelas || r.kelas === state.kelas; });
    if (!list.length) { if (!silent) U.toast("Tidak ada siswa untuk disimpan.", "warning"); return; }
    state.saving = true;
    var btn = U.$("#pk-save", state.container);
    if (btn && !silent) U.buttonLoading(btn, true);
    try {
      await API.saveAttendance(list.map(function (r) {
        return {
          student_id: r.student_id,
          tanggal: state.tanggal,
          status: r.status,
          keterangan: r.status === "tidak_masuk" ? (r.keterangan || "alpa") : null,
          catatan: r.catatan || null
        };
      }), state.semester);
      var badge = U.$("#pk-dirty", state.container);
      if (badge) badge.classList.add("hidden");
      if (!silent) U.toast("Absensi " + (state.kelas || "semua kelas") + " " + U.formatDateID(state.tanggal) + " tersimpan.", "success");
    } catch (err) {
      U.toast(API.errorMessage(err), "error", 6000);
    } finally {
      state.saving = false;
      if (btn && !silent) U.buttonLoading(btn, false);
    }
  }

  function bindMain(main) {
    var tgl = U.$("#pk-tanggal", main);
    if (tgl) {
      tgl.addEventListener("change", function (e) {
        state.tanggal = e.target.value || today();
        loadRows(state.tanggal);
      });
    }
    var kelas = U.$("#pk-kelas", main);
    if (kelas) {
      kelas.addEventListener("change", function (e) {
        state.kelas = e.target.value;
        paint();
      });
    }
    var search = U.$("#pk-search", main);
    if (search) {
      search.addEventListener("input", U.debounce(function (e) {
        state.search = e.target.value || "";
        paint();
      }, 180));
    }
    var all = U.$("#pk-all", main);
    if (all) {
      all.addEventListener("click", function () {
        state.rows.forEach(function (r) {
          if (!state.kelas || r.kelas === state.kelas) { r.status = "masuk"; r.keterangan = null; }
        });
        paint();
        U.toast("Semua siswa ditandai masuk. Menyimpan…", "info");
      });
    }
    var reload = U.$("#pk-reload", main);
    if (reload) reload.addEventListener("click", function () { loadRows(state.tanggal); });
    var saveBtn = U.$("#pk-save", main);
    if (saveBtn) saveBtn.addEventListener("click", function () { save(false); });

    U.on(U.$("#pk-tbody", main), "click", "[data-act]", function (e, btn) {
      var tr = btn.closest("tr[data-id]");
      var r = tr && rowOf(tr.dataset.id);
      if (!r) return;
      var masuk = btn.dataset.act === "masuk";
      r.status = masuk ? "masuk" : "tidak_masuk";
      r.keterangan = masuk ? null : (r.keterangan || "alpa");
      paint();
    });
    U.on(U.$("#pk-tbody", main), "click", "[data-reason]", function (e, btn) {
      var tr = btn.closest("tr[data-id]");
      var r = tr && rowOf(tr.dataset.id);
      if (!r) return;
      r.status = "tidak_masuk";
      r.keterangan = btn.dataset.reason;
      paint();
    });
  }

  /* ---------------- HALAMAN ---------------- */

  function dashboardShell() {
    var c = counts();
    return '<div class="page-head">' +
        '<div><h1>Dasbor Guru Piket</h1><p>Anda bertugas mencatat kehadiran siswa hari ini.</p></div>' +
        '<div class="page-actions">' +
          '<a class="btn btn-primary" href="#/piket-absen">' + U.icon("calendarCheck", 17) + "<span>Mulai Absensi</span></a>" +
        "</div>" +
      "</div>" +
      semesterStrip() +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Siswa</span><strong>' + state.rows.length + "</strong><small>terdaftar</small></div>" +
        '<div class="summary-card tone-green"><span class="summary-label">Masuk</span><strong>' + c.hadir + "</strong><small>siswa</small></div>" +
        '<div class="summary-card tone-red"><span class="summary-label">Tidak Masuk</span><strong>' + (c.alpa + c.sakit + c.izin) + "</strong><small>Alpa " + c.alpa + " · Sakit " + c.sakit + " · Izin " + c.izin + "</small></div>" +
        '<div class="summary-card tone-blue"><span class="summary-label">Tanggal</span><strong class="stat-value-sm">' + U.escape(U.formatDateID(state.tanggal)) + "</strong><small>" + U.escape(U.formatDateLong(state.tanggal).split(",")[0]) + "</small></div>" +
      "</div>" +
      '<div class="quick-actions">' +
        '<a class="quick-action" href="#/piket-absen"><span class="qa-icon tone-teal">' + U.icon("calendarCheck", 20) + "</span><span><strong>Absensi Hari Ini</strong><small>Catat kehadiran siswa</small></span>" + U.icon("arrowRight", 17) + "</a>" +
      "</div>" +
      '<div class="card"><div class="card-head"><div><h3>Rekap per Kelas</h3><p>Kehadiran hari ini</p></div>' +
        '<a href="#/piket-absen" class="link-sm">Isi absensi ' + U.icon("arrowRight", 14) + "</a></div>" +
        '<div class="class-bars">' + classBars() + "</div></div>";
  }

  function classBars() {
    var byClass = U.groupBy(state.rows, function (r) { return r.kelas || "-"; });
    var keys = Object.keys(byClass).sort(function (a, b) { return a.localeCompare(b, "id", { numeric: true }); });
    if (!keys.length) return '<div class="mini-empty">' + U.icon("users", 24) + "<p>Belum ada data siswa.</p></div>";
    return keys.map(function (k) {
      var list = byClass[k];
      var hadir = list.filter(function (r) { return r.status === "masuk"; }).length;
      var pct = list.length ? Math.round((hadir / list.length) * 100) : 0;
      return '<div class="class-bar-row">' +
        '<div class="class-bar-label"><span>' + U.escape(k) + "</span><small>" + hadir + "/" + list.length + "</small></div>" +
        '<div class="class-bar-track"><div class="class-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="class-bar-pct">' + pct + "%</div></div>";
    }).join("");
  }

  function renderDashboard(container) {
    state.view = "dashboard";
    state.tanggal = today();
    state.rows = [];
    state.loading = true;
    container.innerHTML = dashboardShell();
    loadRows(state.tanggal).then(function () {
      if (state.view === "dashboard" && state.container === container) {
        container.innerHTML = dashboardShell();
      }
    });
  }

  function renderAbsen(container) {
    state.view = "absen";
    state.tanggal = today();
    state.kelas = "";
    state.search = "";
    state.rows = [];
    state.loading = true;
    container.innerHTML =
      '<div class="page-head"><div><h1>Absensi Kehadiran</h1><p>Tandai <strong>Masuk</strong> atau <strong>Tidak Masuk</strong> (Alpa, Sakit, Izin) lalu simpan.</p></div></div>' +
      semesterStrip() +
      '<div id="piket-main"></div>';
    loadRows(state.tanggal);
  }

  window.Pages = window.Pages || {};
  window.Pages.piket = { render: renderDashboard };
  window.Pages.piketAbsen = { render: renderAbsen };
})();
