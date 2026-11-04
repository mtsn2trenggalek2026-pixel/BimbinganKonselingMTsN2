/* ============================================================
   Halaman Absensi Kehadiran
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    tanggal: "",
    kelas: "",
    search: "",
    students: [],
    records: {},
    entries: {},
    loading: false,
    dirty: false,
    token: 0
  };

  function shell() {
    var classes = U.uniqueClasses(state.students);
    return '' +
      '<div class="page-head">' +
        '<div><h1>Absensi Kehadiran</h1><p>Catat kehadiran siswa per hari. Pilih <strong>Masuk</strong> atau <strong>Tidak Masuk</strong> beserta keterangannya.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="abs-excel">' + U.icon("download", 17) + "<span>Excel</span></button>" +
          '<button type="button" class="btn btn-secondary" id="abs-pdf">' + U.icon("printer", 17) + "<span>PDF</span></button>" +
        "</div>" +
      "</div>" +
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field"><label for="abs-tanggal">Tanggal</label><input type="date" id="abs-tanggal" value="' + state.tanggal + '"></div>' +
          '<div class="field"><label for="abs-kelas">Kelas</label><select id="abs-kelas"><option value="">Semua Kelas</option>' +
            classes.map(function (k) { return '<option value="' + U.escape(k) + '">' + U.escape(k) + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field grow"><label for="abs-search">Cari siswa</label><div class="input-with-icon">' + U.icon("search", 17) + '<input type="search" id="abs-search" placeholder="Ketik nama siswa…" autocomplete="off"></div></div>' +
          '<div class="field field-action"><button type="button" class="btn btn-soft" id="abs-mark-all">' + U.icon("checkCircle", 17) + "<span>Tandai Semua Masuk</span></button></div>" +
        "</div>" +
      "</div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-green"><span class="summary-label">Hadir</span><strong id="sum-hadir">0</strong><small>siswa</small></div>' +
        '<div class="summary-card tone-red"><span class="summary-label">Alpa</span><strong id="sum-alpa">0</strong><small>siswa</small></div>' +
        '<div class="summary-card tone-amber"><span class="summary-label">Sakit</span><strong id="sum-sakit">0</strong><small>siswa</small></div>' +
        '<div class="summary-card tone-blue"><span class="summary-label">Izin</span><strong id="sum-izin">0</strong><small>siswa</small></div>' +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar">' +
          '<div class="table-toolbar-left"><span id="abs-count" class="table-count">0 siswa</span><span id="abs-dirty" class="dirty-badge hidden"><span class="dot"></span>Belum disimpan</span></div>' +
          '<div class="table-toolbar-right">' +
            '<button type="button" class="btn btn-ghost btn-sm" id="abs-reload" title="Muat ulang data dari server">' + U.icon("refresh", 16) + "<span>Muat ulang</span></button>" +
            '<button type="button" class="btn btn-primary" id="abs-save">' + U.icon("save", 17) + "<span>Simpan Absensi</span></button>" +
          "</div>" +
        "</div>" +
        '<div class="table-wrap"><table class="data-table abs-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Kelas</th><th class="col-center">Kehadiran</th><th class="col-center">Keterangan</th>' +
        "</tr></thead><tbody id=\"abs-tbody\"><tr><td colspan=\"6\">" + loadingRow() + "</td></tr></tbody></table></div>" +
      "</div>";
  }

  function loadingRow() {
    return '<div class="table-loading"><span class="spinner"></span><span>Memuat data absensi…</span></div>';
  }

  function getClassStudents() {
    return state.students.filter(function (s) { return !state.kelas || s.kelas === state.kelas; });
  }

  function getVisibleStudents() {
    var q = state.search.trim().toLowerCase();
    return getClassStudents().filter(function (s) {
      return !q || String(s.nama).toLowerCase().indexOf(q) !== -1;
    });
  }

  function rowHtml(s, index) {
    var e = state.entries[s.id] || { status: "masuk", keterangan: null };
    var isMasuk = e.status === "masuk";
    var reasonCell = isMasuk
      ? '<span class="reason-placeholder">—</span>'
      : '<div class="reason-group">' + ["alpa", "sakit", "izin"].map(function (r) {
          return '<button type="button" data-reason="' + r + '" class="reason-chip ' + r + (e.keterangan === r ? " active" : "") + '">' + U.alasanLabel(r) + "</button>";
        }).join("") + "</div>";
    return '<tr data-id="' + U.escape(s.id) + '">' +
      '<td class="col-no">' + (index + 1) + "</td>" +
      '<td><div class="student-cell"><span class="avatar avatar-xs">' + U.escape(U.initials(s.nama)) + "</span>" +
        '<div class="student-cell-text"><strong>' + U.escape(s.nama) + "</strong>" + (s.nis ? '<small>NIS ' + U.escape(s.nis) + "</small>" : "") + "</div></div></td>" +
      '<td class="col-center"><span class="badge badge-gender ' + (s.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(s.jenis_kelamin) + "</span></td>" +
      '<td class="col-center"><span class="class-pill">' + U.escape(s.kelas) + "</span></td>" +
      '<td class="col-center" data-label="Kehadiran"><div class="segmented segmented-sm">' +
        '<button type="button" data-action="masuk" class="' + (isMasuk ? "active" : "") + '" aria-pressed="' + isMasuk + '">' + U.icon("check", 14) + "<span>Masuk</span></button>" +
        '<button type="button" data-action="tidak" class="' + (!isMasuk ? "active danger" : "") + '" aria-pressed="' + (!isMasuk) + '">' + U.icon("x", 14) + "<span>Tidak Masuk</span></button>" +
      "</div></td>" +
      '<td class="col-center" data-label="Keterangan">' + reasonCell + "</td>" +
    "</tr>";
  }

  function renderTable() {
    var tbody = U.$("#abs-tbody", state.container);
    if (!tbody) return;
    if (state.loading) { tbody.innerHTML = '<tr><td colspan="6">' + loadingRow() + "</td></tr>"; return; }
    var list = getVisibleStudents();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6">' + U.emptyState("users", "Tidak ada siswa", "Ubah filter kelas atau kata pencarian.") + "</td></tr>";
    } else {
      tbody.innerHTML = list.map(rowHtml).join("");
    }
    var count = U.$("#abs-count", state.container);
    if (count) count.textContent = list.length + " siswa" + (state.kelas ? " · " + state.kelas : "");
    updateSummary();
    updateDirty();
  }

  function updateSummary() {
    var list = getClassStudents();
    var c = { hadir: 0, alpa: 0, sakit: 0, izin: 0 };
    list.forEach(function (s) {
      var e = state.entries[s.id] || { status: "masuk" };
      if (e.status === "masuk") c.hadir++;
      else if (e.keterangan && c[e.keterangan] !== undefined) c[e.keterangan]++;
    });
    var map = { "#sum-hadir": c.hadir, "#sum-alpa": c.alpa, "#sum-sakit": c.sakit, "#sum-izin": c.izin };
    Object.keys(map).forEach(function (sel) {
      var node = U.$(sel, state.container);
      if (node) node.textContent = map[sel];
    });
  }

  function updateDirty() {
    var badge = U.$("#abs-dirty", state.container);
    if (badge) badge.classList.toggle("hidden", !isDirty());
  }

  function isDirty() {
    return getClassStudents().some(function (s) {
      var e = state.entries[s.id];
      var r = state.records[s.id];
      if (!e) return false;
      if (!r) return true;
      if (e.status !== r.status) return true;
      if ((e.keterangan || null) !== (r.keterangan || null)) return true;
      if ((e.catatan || null) !== (r.catatan || null)) return true;
      return false;
    });
  }

  async function loadData() {
    var token = ++state.token;
    state.loading = true;
    state.dirty = false;
    renderTable();
    try {
      var records = await API.getAttendanceByDate(state.tanggal);
      if (token !== state.token) return;
      state.records = {};
      (records || []).forEach(function (r) { state.records[r.student_id] = r; });
      state.entries = {};
      var missing = 0;
      state.students.forEach(function (s) {
        var r = state.records[s.id];
        if (r) {
          state.entries[s.id] = { status: r.status, keterangan: r.keterangan || null, catatan: r.catatan || null };
        } else {
          state.entries[s.id] = { status: "masuk", keterangan: null, catatan: null };
          missing++;
        }
      });
      state.loading = false;
      state.dirty = missing > 0;
      if (token !== state.token) return;
      renderTable();
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      var tbody = U.$("#abs-tbody", state.container);
      if (tbody) tbody.innerHTML = '<tr><td colspan="6"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(API.errorMessage(err)) + "</span></div></td></tr>";
      U.toast(API.errorMessage(err), "error");
    }
  }

  function setStatus(id, status) {
    var e = state.entries[id];
    if (!e) return;
    e.status = status;
    if (status === "tidak_masuk" && !e.keterangan) e.keterangan = "alpa";
    if (status === "masuk") e.keterangan = null;
    state.dirty = true;
    renderTable();
  }

  function setReason(id, reason) {
    var e = state.entries[id];
    if (!e) return;
    e.status = "tidak_masuk";
    e.keterangan = reason;
    state.dirty = true;
    renderTable();
  }

  function collectRows(students) {
    return students.map(function (s) {
      var e = state.entries[s.id] || { status: "masuk", keterangan: null };
      return {
        student_id: s.id,
        tanggal: state.tanggal,
        status: e.status,
        keterangan: e.status === "tidak_masuk" ? (e.keterangan || "alpa") : null,
        catatan: e.catatan || null,
        recorded_by: window.APP_STATE.user ? window.APP_STATE.user.id : null
      };
    });
  }

  async function save() {
    var btn = U.$("#abs-save", state.container);
    var list = getClassStudents();
    if (!list.length) { U.toast("Tidak ada siswa untuk disimpan.", "warning"); return; }
    var rows = collectRows(list);
    U.buttonLoading(btn, true);
    try {
      var saved = await API.saveAttendance(rows);
      (saved || []).forEach(function (r) { state.records[r.student_id] = r; });
      state.dirty = false;
      updateDirty();
      U.toast("Absensi " + (state.kelas || "semua kelas") + " tanggal " + U.formatDateID(state.tanggal) + " berhasil disimpan.", "success");
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    } finally {
      U.buttonLoading(btn, false);
    }
  }

  function exportRows() {
    var list = getVisibleStudents();
    return list.map(function (s) {
      var e = state.entries[s.id] || { status: "masuk" };
      return {
        nama: s.nama,
        jenis_kelamin: s.jenis_kelamin,
        kelas: s.kelas,
        status: e.status,
        keterangan: e.keterangan,
        catatan: e.catatan || ""
      };
    });
  }

  function doExport(kind) {
    var rows = exportRows();
    if (!rows.length) { U.toast("Tidak ada data untuk diekspor.", "warning"); return; }
    var meta = { tanggal: state.tanggal, kelas: state.kelas, tanggalTTD: U.todayISO() };
    try {
      if (kind === "excel") EX.attendanceExcel(rows, meta);
      else EX.attendancePdf(rows, meta);
      if (isDirty()) U.toast("Catatan: ekspor memakai data yang tampil, termasuk perubahan yang belum disimpan.", "info", 5000);
    } catch (err) {
      U.toast("Gagal membuat file: " + (err.message || err), "error");
    }
  }

  function bind(container) {
    U.$("#abs-tanggal", container).addEventListener("change", function (e) {
      state.tanggal = e.target.value || U.todayISO();
      loadData();
    });
    U.$("#abs-kelas", container).addEventListener("change", function (e) {
      state.kelas = e.target.value;
      renderTable();
    });
    U.$("#abs-search", container).addEventListener("input", U.debounce(function (e) {
      state.search = e.target.value || "";
      renderTable();
    }, 180));
    U.$("#abs-mark-all", container).addEventListener("click", function () {
      var list = getClassStudents();
      list.forEach(function (s) {
        var e = state.entries[s.id];
        if (e) { e.status = "masuk"; e.keterangan = null; }
      });
      state.dirty = true;
      renderTable();
      U.toast(list.length + " siswa ditandai masuk. Klik Simpan Absensi untuk menyimpan.", "info");
    });
    U.$("#abs-save", container).addEventListener("click", save);
    U.$("#abs-reload", container).addEventListener("click", function () {
      loadData();
      U.toast("Data dimuat ulang dari server.", "info");
    });
    U.$("#abs-excel", container).addEventListener("click", function () { doExport("excel"); });
    U.$("#abs-pdf", container).addEventListener("click", function () { doExport("pdf"); });

    U.on(U.$("#abs-tbody", container), "click", "[data-action]", function (e, btn) {
      var tr = btn.closest("tr[data-id]");
      if (!tr) return;
      setStatus(tr.dataset.id, btn.dataset.action === "masuk" ? "masuk" : "tidak_masuk");
    });
    U.on(U.$("#abs-tbody", container), "click", "[data-reason]", function (e, btn) {
      var tr = btn.closest("tr[data-id]");
      if (!tr) return;
      setReason(tr.dataset.id, btn.dataset.reason);
    });
  }

  function render(container) {
    state.container = container;
    state.tanggal = U.todayISO();
    state.kelas = "";
    state.search = "";
    state.students = U.sortStudents((window.APP_STATE.students || []).slice());
    state.entries = {};
    state.records = {};
    state.dirty = false;
    state.token++;
    container.innerHTML = shell();
    bind(container);
    loadData();
  }

  window.Pages = window.Pages || {};
  window.Pages.attendance = { render: render };
})();