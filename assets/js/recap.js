/* ============================================================
   Halaman Rekap Absensi
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    from: "",
    to: "",
    kelas: "",
    students: [],
    recordsByStudent: {},
    rows: [],
    loading: false,
    token: 0
  };

  function shell() {
    var classes = U.uniqueClasses(state.students);
    return '' +
      '<div class="page-head">' +
        '<div><h1>Rekap Absensi</h1><p>Rekap kehadiran siswa dalam periode tertentu, siap diekspor ke Excel atau PDF.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="rec-excel">' + U.icon("download", 17) + "<span>Excel</span></button>" +
          '<button type="button" class="btn btn-secondary" id="rec-pdf">' + U.icon("printer", 17) + "<span>PDF</span></button>" +
        "</div>" +
      "</div>" +
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field"><label for="rec-from">Dari tanggal</label><input type="date" id="rec-from" value="' + state.from + '"></div>' +
          '<div class="field"><label for="rec-to">Sampai tanggal</label><input type="date" id="rec-to" value="' + state.to + '"></div>' +
          '<div class="field"><label for="rec-kelas">Kelas</label><select id="rec-kelas"><option value="">Semua Kelas</option>' +
            classes.map(function (k) { return '<option value="' + U.escape(k) + '">' + U.escape(k) + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field field-action"><button type="button" class="btn btn-primary" id="rec-show">' + U.icon("chart", 17) + "<span>Tampilkan</span></button></div>" +
        "</div>" +
      "</div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Siswa</span><strong id="rec-total-siswa">0</strong><small>dalam filter</small></div>' +
        '<div class="summary-card tone-green"><span class="summary-label">Hadir</span><strong id="rec-total-hadir">0</strong><small>catatan</small></div>' +
        '<div class="summary-card tone-red"><span class="summary-label">Tidak Masuk</span><strong id="rec-total-tidak">0</strong><small>catatan</small></div>' +
        '<div class="summary-card tone-amber"><span class="summary-label">Rata-rata Hadir</span><strong id="rec-avg">0%</strong><small>dari hari terabsen</small></div>' +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count" id="rec-count">0 siswa</span><span class="table-muted" id="rec-period"></span></div>' +
          '<div class="table-toolbar-right"><span class="table-muted">Persentase dihitung dari hari yang sudah diabsen.</span></div>' +
        "</div>" +
        '<div class="table-wrap"><table class="data-table recap-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Kelas</th>' +
          '<th class="col-center">Hadir</th><th class="col-center">Alpa</th><th class="col-center">Sakit</th><th class="col-center">Izin</th>' +
          '<th class="col-center">Total</th><th class="col-center">% Hadir</th>' +
        "</tr></thead><tbody id=\"rec-tbody\"><tr><td colspan=\"10\">" + loadingRow() + "</td></tr></tbody></table></div>" +
      "</div>";
  }

  function loadingRow() {
    return '<div class="table-loading"><span class="spinner"></span><span>Memuat rekap absensi…</span></div>';
  }

  function computeRows() {
    return U.sortStudents(state.students).map(function (s) {
      var recs = state.recordsByStudent[s.id] || [];
      var hadir = 0, alpa = 0, sakit = 0, izin = 0;
      recs.forEach(function (r) {
        if (r.status === "masuk") hadir++;
        else if (r.keterangan === "alpa") alpa++;
        else if (r.keterangan === "sakit") sakit++;
        else if (r.keterangan === "izin") izin++;
      });
      var total = recs.length;
      return {
        id: s.id,
        nama: s.nama,
        jenis_kelamin: s.jenis_kelamin,
        kelas: s.kelas,
        hadir: hadir,
        alpa: alpa,
        sakit: sakit,
        izin: izin,
        total: total,
        persen: U.percent(hadir, total)
      };
    });
  }

  function filteredRows() {
    return state.rows.filter(function (r) { return !state.kelas || r.kelas === state.kelas; });
  }

  function renderTable() {
    var tbody = U.$("#rec-tbody", state.container);
    if (!tbody) return;
    if (state.loading) { tbody.innerHTML = '<tr><td colspan="10">' + loadingRow() + "</td></tr>"; return; }
    var rows = filteredRows();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="10">' + U.emptyState("chart", "Belum ada data", "Belum ada siswa atau absensi pada periode ini.") + "</td></tr>";
    } else {
      tbody.innerHTML = rows.map(function (r, i) {
        return '<tr data-id="' + U.escape(r.id) + '">' +
          '<td class="col-no">' + (i + 1) + "</td>" +
          '<td><div class="student-cell"><span class="avatar avatar-xs">' + U.escape(U.initials(r.nama)) + "</span>" +
            '<div class="student-cell-text"><strong>' + U.escape(r.nama) + "</strong></div></div></td>" +
          '<td class="col-center"><span class="badge badge-gender ' + (r.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(r.jenis_kelamin) + "</span></td>" +
          '<td class="col-center"><span class="class-pill">' + U.escape(r.kelas) + "</span></td>" +
          '<td class="col-center num-strong text-green" data-label="Hadir">' + r.hadir + "</td>" +
          '<td class="col-center num text-red" data-label="Alpa">' + r.alpa + "</td>" +
          '<td class="col-center num text-amber" data-label="Sakit">' + r.sakit + "</td>" +
          '<td class="col-center num text-blue" data-label="Izin">' + r.izin + "</td>" +
          '<td class="col-center num" data-label="Total">' + r.total + "</td>" +
          '<td class="col-center" data-label="% Hadir"><div class="percent-cell"><div class="percent-track"><div class="percent-fill" style="width:' + r.persen + '%"></div></div><span>' + r.persen + "%</span></div></td>" +
        "</tr>";
      }).join("") +
      '<tr class="total-row">' +
        '<td colspan="4">JUMLAH</td>' +
        '<td class="col-center" data-label="Hadir">' + rows.reduce(function (a, r) { return a + r.hadir; }, 0) + "</td>" +
        '<td class="col-center" data-label="Alpa">' + rows.reduce(function (a, r) { return a + r.alpa; }, 0) + "</td>" +
        '<td class="col-center" data-label="Sakit">' + rows.reduce(function (a, r) { return a + r.sakit; }, 0) + "</td>" +
        '<td class="col-center" data-label="Izin">' + rows.reduce(function (a, r) { return a + r.izin; }, 0) + "</td>" +
        '<td class="col-center" data-label="Total">' + rows.reduce(function (a, r) { return a + r.total; }, 0) + "</td>" +
        '<td class="col-center" data-label="% Hadir">' + U.percent(rows.reduce(function (a, r) { return a + r.hadir; }, 0), rows.reduce(function (a, r) { return a + r.total; }, 0)) + "%</td>" +
      "</tr>";
    }

    var count = U.$("#rec-count", state.container);
    if (count) count.textContent = rows.length + " siswa" + (state.kelas ? " · " + state.kelas : "");
    var period = U.$("#rec-period", state.container);
    if (period) period.textContent = "Periode " + U.formatDateID(state.from) + " – " + U.formatDateID(state.to);
    updateSummary(rows);
  }

  function updateSummary(rows) {
    var totalSiswa = rows.length;
    var hadir = rows.reduce(function (a, r) { return a + r.hadir; }, 0);
    var total = rows.reduce(function (a, r) { return a + r.total; }, 0);
    var tidak = rows.reduce(function (a, r) { return a + r.alpa + r.sakit + r.izin; }, 0);
    var set = function (sel, val) { var n = U.$(sel, state.container); if (n) n.textContent = val; };
    set("#rec-total-siswa", totalSiswa);
    set("#rec-total-hadir", hadir);
    set("#rec-total-tidak", tidak);
    set("#rec-avg", U.percent(hadir, total) + "%");
  }

  async function load() {
    if (state.from > state.to) {
      U.toast("Tanggal awal tidak boleh melebihi tanggal akhir.", "warning");
      return;
    }
    var token = ++state.token;
    state.loading = true;
    renderTable();
    try {
      var records = await API.getAttendanceRange(state.from, state.to);
      if (token !== state.token) return;
      state.recordsByStudent = {};
      (records || []).forEach(function (r) {
        (state.recordsByStudent[r.student_id] = state.recordsByStudent[r.student_id] || []).push(r);
      });
      state.rows = computeRows();
      state.loading = false;
      if (token !== state.token) return;
      renderTable();
      if (!records || !records.length) {
        U.toast("Belum ada absensi pada periode " + U.formatDateID(state.from) + " – " + U.formatDateID(state.to) + ".", "info");
      }
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      var tbody = U.$("#rec-tbody", state.container);
      if (tbody) tbody.innerHTML = '<tr><td colspan="10"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(API.errorMessage(err)) + "</span></div></td></tr>";
      U.toast(API.errorMessage(err), "error");
    }
  }

  function doExport(kind) {
    var rows = filteredRows();
    if (!rows.length) { U.toast("Tidak ada data untuk diekspor.", "warning"); return; }
    var meta = { from: state.from, to: state.to, kelas: state.kelas, tanggalTTD: U.todayISO() };
    try {
      if (kind === "excel") EX.recapExcel(rows, meta);
      else EX.recapPdf(rows, meta);
    } catch (err) {
      U.toast("Gagal membuat file: " + (err.message || err), "error");
    }
  }

  function bind(container) {
    U.$("#rec-show", container).addEventListener("click", function () {
      state.from = U.$("#rec-from", container).value || U.firstDayOfMonthISO();
      state.to = U.$("#rec-to", container).value || U.todayISO();
      load();
    });
    U.$("#rec-kelas", container).addEventListener("change", function (e) {
      state.kelas = e.target.value;
      renderTable();
    });
    U.$("#rec-excel", container).addEventListener("click", function () { doExport("excel"); });
    U.$("#rec-pdf", container).addEventListener("click", function () { doExport("pdf"); });
  }

  function render(container) {
    state.container = container;
    state.from = U.firstDayOfMonthISO();
    state.to = U.todayISO();
    state.kelas = "";
    state.students = (window.APP_STATE.students || []).slice();
    state.recordsByStudent = {};
    state.rows = [];
    state.loading = false;
    state.token++;
    container.innerHTML = shell();
    bind(container);
    load();
  }

  window.Pages = window.Pages || {};
  window.Pages.recap = { render: render };
})();