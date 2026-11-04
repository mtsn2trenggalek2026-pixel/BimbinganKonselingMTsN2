/* ============================================================
   Dasbor & Daftar Kelas — Wali Kelas
   ------------------------------------------------------------
   Wali kelas hanya MELIHAT (baca saja):
     - siswa di rombel yang diampu,
     - siapa yang masuk / tidak masuk pada tanggal tertentu,
     - rekap kehadiran semester berjalan.
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    tanggal: "",
    kelasId: "",
    rombels: [],
    rows: [],
    rekap: {},
    semester: null,
    year: null,
    loading: false,
    token: 0
  };

  function today() { return U.todayISO(); }

  function activeRombel() {
    return state.rombels.filter(function (r) { return r.class_group_id === state.kelasId; })[0] || state.rombels[0] || null;
  }

  function rowsForClass() {
    var rb = activeRombel();
    if (!rb) return [];
    return state.rows.filter(function (r) { return r.kelas === rb.nama; });
  }

  function counts(list) {
    var c = { total: 0, hadir: 0, alpa: 0, sakit: 0, izin: 0 };
    (list || []).forEach(function (r) {
      c.total++;
      if (r.status === "masuk") c.hadir++;
      else if (c[r.keterangan] !== undefined) c[r.keterangan]++;
    });
    return c;
  }

  async function loadAll() {
    var token = ++state.token;
    state.loading = true;
    paint();
    try {
      var rombels = await API.getWaliKelasSaya();
      if (token !== state.token) return;
      state.rombels = rombels || [];
      if (!state.rombels.length) {
        state.loading = false;
        paint();
        return;
      }
      if (!state.kelasId || !state.rombels.some(function (r) { return r.class_group_id === state.kelasId; })) {
        state.kelasId = state.rombels[0].class_group_id;
      }

      var res = await Promise.all([
        API.getAbsensiHariIni(state.tanggal),
        loadRekap()
      ]);
      if (token !== state.token) return;
      state.rows = res[0] || [];
      state.rekap = res[1] || {};
      state.loading = false;
      paint();
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      state.rows = [];
      paint();
      if (err && err.code === "missing_function") {
        U.toast(API.errorMessage(err), "error", 9000);
      } else {
        U.toast(API.errorMessage(err), "error", 6000);
      }
    }
  }

  /* Rekap kehadiran semester berjalan per siswa untuk rombel yang diampu. */
  async function loadRekap() {
    var sem = state.semester;
    if (!sem || !sem.tanggal_mulai) return {};
    var recs = await API.getAttendanceRange(sem.tanggal_mulai, sem.tanggal_selesai, {
      academicYearId: sem.academic_year_id,
      semesterId: sem.id
    });
    var map = {};
    (recs || []).forEach(function (r) {
      var m = map[r.student_id] || (map[r.student_id] = { hadir: 0, alpa: 0, sakit: 0, izin: 0, total: 0 });
      m.total++;
      if (r.status === "masuk") m.hadir++;
      else if (m[r.keterangan] !== undefined) m[r.keterangan]++;
    });
    return map;
  }

  function paint() {
    if (!state.container) return;
    var box = U.$("#wk-main", state.container);
    if (box) box.innerHTML = mainHtml();
    bindMain();
  }

  function rombelChooser() {
    if (state.rombels.length <= 1) return "";
    return '<select id="wk-kelas">' + state.rombels.map(function (r) {
      return '<option value="' + U.escape(r.class_group_id) + '"' + (r.class_group_id === state.kelasId ? " selected" : "") + ">" +
        U.escape(r.nama) + " · " + U.escape(r.tahun_label) + "</option>";
    }).join("") + "</select>";
  }

  function mainHtml() {
    if (state.loading) {
      return '<div class="card"><div class="table-loading"><span class="spinner"></span><span>Memuat data kelas…</span></div></div>';
    }
    if (!state.rombels.length) {
      return '<div class="card setup-card">' + U.emptyState("users", "Belum ada kelas yang diampu",
        "Akun Anda belum dipasangkan ke rombel mana pun. Hubungi admin/superadmin untuk mengatur wali kelas.") + "</div>";
    }

    var rb = activeRombel();
    return '<div class="page-head">' +
        '<div><h1>Kelas ' + U.escape(rb.nama) + '</h1><p>' + U.escape(rb.tahun_label) + " · kelas " + U.TINGKAT_ROMAN[rb.tingkat] + "</p></div>" +
        '<div class="page-actions">' + rombelChooser() + "</div>" +
      "</div>" +
      '<div class="card filter-card"><div class="filter-row">' +
        '<div class="field"><label for="wk-tanggal">Tanggal</label><input type="date" id="wk-tanggal" value="' + state.tanggal + '"></div>' +
        '<div class="field grow"><label>Info</label><div class="wk-info">' +
          U.icon("eye", 15) + "<span>Anda hanya dapat melihat data kehadiran kelas ini.</span></div></div>" +
      "</div></div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Siswa</span><strong>' + rowsForClass().length + "</strong><small>di kelas ini</small></div>" +
        '<div class="summary-card tone-green"><span class="summary-label">Masuk</span><strong>' + counts(rowsForClass()).hadir + "</strong><small>siswa</small></div>" +
        '<div class="summary-card tone-red"><span class="summary-label">Tidak Masuk</span><strong>' + (counts(rowsForClass()).alpa + counts(rowsForClass()).sakit + counts(rowsForClass()).izin) + "</strong><small>Alpa " + counts(rowsForClass()).alpa + " · Sakit " + counts(rowsForClass()).sakit + " · Izin " + counts(rowsForClass()).izin + "</small></div>" +
        '<div class="summary-card tone-amber"><span class="summary-label">Tanggal</span><strong class="stat-value-sm">' + U.escape(U.formatDateID(state.tanggal)) + "</strong><small>" + U.escape(U.formatDateLong(state.tanggal).split(",")[0]) + "</small></div>" +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count">' + rowsForClass().length + " siswa</span></div>" +
          '<div class="table-toolbar-right"><button type="button" class="btn btn-ghost btn-sm" id="wk-reload">' + U.icon("refresh", 16) + "<span>Muat ulang</span></button></div></div>" +
        '<div class="table-wrap"><table class="data-table wk-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th>' +
          '<th class="col-center">Status Hari Ini</th><th class="col-center">Hadir (semester)</th><th class="col-center">%</th>' +
        "</tr></thead><tbody>" + bodyRows() + "</tbody></table></div>" +
      "</div>";
  }

  function statusCell(r) {
    if (r.status === "masuk") return '<span class="badge badge-success">Masuk</span>';
    if (!r.status_hari) return '<span class="badge badge-neutral">Belum diabsen</span>';
    return '<span class="badge badge-' + (r.keterangan || "alpa") + '">' + U.escape(U.alasanLabel(r.keterangan)) + "</span>";
  }

  function bodyRows() {
    var list = rowsForClass();
    if (!list.length) {
      return '<tr><td colspan="6">' + U.emptyState("users", "Belum ada siswa", "Belum ada siswa yang terdaftar pada rombel ini.") + "</td></tr>";
    }
    var sem = state.semester;
    var target = sem ? Number(sem.hari_efektif) || 0 : 0;
    return list.map(function (r, i) {
      var rk = state.rekap[r.student_id] || { hadir: 0, total: 0 };
      var dasar = Math.max(target, rk.total);
      var persen = U.percent(rk.hadir, dasar);
      var tone = persen >= 90 ? "good" : persen >= 75 ? "warn" : "bad";
      return '<tr data-id="' + U.escape(r.student_id) + '">' +
        '<td class="col-no">' + (i + 1) + "</td>" +
        '<td><div class="student-cell"><span class="avatar avatar-xs">' + U.escape(U.initials(r.nama)) + "</span>" +
          '<div class="student-cell-text"><strong>' + U.escape(r.nama) + "</strong>" + (r.nis ? "<small>NIS " + U.escape(r.nis) + "</small>" : "") + "</div></div></td>" +
        '<td class="col-center"><span class="badge badge-gender ' + (r.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(r.jenis_kelamin) + "</span></td>" +
        '<td class="col-center" data-label="Status">' + statusCell(r) + "</td>" +
        '<td class="col-center" data-label="Hadir"><span class="num-strong text-green">' + rk.hadir + "</span>" +
          (target ? '<small class="cell-sub">/ ' + target + " hari</small>" : "") + "</td>" +
        '<td class="col-center" data-label="%"><span class="pill-pct ' + tone + '">' + (rk.total ? persen + "%" : "—") + "</span></td>" +
      "</tr>";
    }).join("");
  }

  function bindMain() {
    var tgl = U.$("#wk-tanggal", state.container);
    if (tgl) tgl.addEventListener("change", function (e) { state.tanggal = e.target.value || today(); loadAll(); });
    var kelas = U.$("#wk-kelas", state.container);
    if (kelas) kelas.addEventListener("change", function (e) { state.kelasId = e.target.value; loadAll(); });
    var reload = U.$("#wk-reload", state.container);
    if (reload) reload.addEventListener("click", loadAll);
  }

  function render(container) {
    state.container = container;
    state.tanggal = today();
    state.rows = [];
    state.rekap = {};
    state.loading = true;
    state.semester = window.APP_STATE.activeSemester || null;
    state.year = window.APP_STATE.activeYear || null;
    container.innerHTML = '<div id="wk-main"></div><div id="wk-dash-slot"></div>';
    loadAll();
  }

  window.Pages = window.Pages || {};
  window.Pages.waliKelas = { render: render };
})();
