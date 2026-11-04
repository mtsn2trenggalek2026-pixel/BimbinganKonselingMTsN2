/* ============================================================
   Halaman Laporan Kerja
   ============================================================ */
(function () {
  "use strict";

  var KEGIATAN_OPTIONS = [
    "Melaksanakan tugas tambahan yang melekat pada pelaksanaan kegiatan pokok sesuai dengan beban tugas guru",
    "Melaksanakan pembelajaran atau bimbingan",
    "Libur Umum",
    "Mengerjakan administrasi BK",
    "Piket ketertiban",
    "Piket KBM",
    "Piket penyambutan siswa",
    "Upacara Bendera",
    "Apel Pagi",
    "Jumat Taqorub",
    "Layanan bimbingan klasikal",
    "Layanan bimbingan pribadi",
    "Layanan bimbingan kelompok",
    "Konseling individual",
    "Konseling kelompok",
    "Koordinasi dengan wali kelas",
    "Koordinasi dengan wali murid",
    "Panggilan orang tua",
    "Lainnya"
  ];

  var state = {
    container: null,
    view: "list",
    reports: [],
    loaded: false,
    loading: false,
    saving: false,
    editing: null,
    items: [],
    editorDirty: false,
    token: 0
  };

  function settings() { return window.APP_STATE.settings || {}; }

  function stripNip(value) {
    return String(value || "").replace(/^\s*NIP\.?\s*/i, "").trim();
  }

  /* ---------------- DAFTAR LAPORAN ---------------- */
  function listShell() {
    return '' +
      '<div class="page-head">' +
        '<div><h1>Laporan Kerja</h1><p>Buat laporan kerja harian, lalu unduh sebagai Word atau PDF.</p></div>' +
        '<div class="page-actions"><button type="button" class="btn btn-primary" id="rep-new">' + U.icon("plus", 17) + "<span>Buat Laporan</span></button></div>" +
      "</div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Total Laporan</span><strong id="rep-stat-total">0</strong><small>dokumen</small></div>' +
        '<div class="summary-card tone-amber"><span class="summary-label">Bulan Ini</span><strong id="rep-stat-month">0</strong><small>laporan</small></div>' +
        '<div class="summary-card tone-green"><span class="summary-label">Total Kegiatan</span><strong id="rep-stat-items">0</strong><small>baris tercatat</small></div>' +
        '<div class="summary-card tone-blue"><span class="summary-label">Terakhir Dibuat</span><strong id="rep-stat-last" class="stat-value-sm">—</strong><small id="rep-stat-last-sub">belum ada</small></div>' +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count" id="rep-count">0 laporan</span></div>' +
          '<div class="table-toolbar-right"><button type="button" class="btn btn-ghost btn-sm" id="rep-refresh">' + U.icon("refresh", 16) + "<span>Muat ulang</span></button></div>" +
        "</div>" +
        '<div class="table-wrap"><table class="data-table report-table"><thead><tr>' +
          '<th>Bulan</th><th>Nama</th><th class="col-center">Kegiatan</th><th>Terakhir Diubah</th><th class="col-actions">Aksi</th>' +
        "</tr></thead><tbody id=\"rep-list-body\"><tr><td colspan=\"5\">" + loadingRow("Memuat laporan…") + "</td></tr></tbody></table></div>" +
      "</div>";
  }

  function loadingRow(text) {
    return '<div class="table-loading"><span class="spinner"></span><span>' + U.escape(text || "Memuat…") + "</span></div>";
  }

  function itemCount(r) {
    if (!r.work_report_items) return 0;
    if (Array.isArray(r.work_report_items)) {
      return r.work_report_items[0] ? (r.work_report_items[0].count || 0) : 0;
    }
    return r.work_report_items.count || 0;
  }

  function paintList() {
    var reports = state.reports || [];
    var thisMonth = U.monthKey(U.todayISO());
    var monthCount = reports.filter(function (r) { return U.monthKey(r.bulan) === thisMonth; }).length;
    var totalItems = reports.reduce(function (a, r) { return a + itemCount(r); }, 0);
    var set = function (sel, val) { var n = U.$(sel, state.container); if (n) n.textContent = val; };
    set("#rep-stat-total", reports.length);
    set("#rep-stat-month", monthCount);
    set("#rep-stat-items", totalItems);
    set("#rep-count", reports.length + " laporan");
    if (reports.length) {
      set("#rep-stat-last", U.monthLabelFromDate(reports[0].bulan));
      set("#rep-stat-last-sub", reports[0].nama || "-");
    } else {
      set("#rep-stat-last", "—");
      set("#rep-stat-last-sub", "belum ada");
    }

    var tbody = U.$("#rep-list-body", state.container);
    if (!tbody) return;
    if (!reports.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + U.emptyState("file", "Belum ada laporan kerja",
        "Mulai buat laporan kerja bulanan pertama Anda.", '<button type="button" class="btn btn-primary" data-action="new">' + U.icon("plus", 17) + "<span>Buat Laporan</span></button>") + "</td></tr>";
      return;
    }
    tbody.innerHTML = reports.map(function (r) {
      var count = itemCount(r);
      var updated = r.updated_at ? U.formatDateShort(String(r.updated_at).slice(0, 10)) : "-";
      return '<tr data-id="' + U.escape(r.id) + '">' +
        '<td><div class="month-cell"><span class="month-icon">' + U.icon("calendar", 16) + "</span><strong>" + U.escape(U.monthLabelFromDate(r.bulan)) + "</strong></div></td>" +
        '<td><div class="student-cell-text"><strong>' + U.escape(r.nama || "-") + "</strong><small>" + U.escape(r.tugas_tambahan || "Guru BK") + "</small></div></td>" +
        '<td class="col-center"><span class="badge badge-neutral">' + count + " kegiatan</span></td>" +
        '<td><span class="muted-sm">' + U.escape(updated) + "</span></td>" +
        '<td class="col-actions"><div class="action-group">' +
          '<button type="button" class="icon-btn" data-action="edit" title="Edit laporan">' + U.icon("edit", 16) + "</button>" +
          '<button type="button" class="icon-btn" data-action="word" title="Unduh Word">' + U.icon("file", 16) + "</button>" +
          '<button type="button" class="icon-btn" data-action="pdf" title="Unduh PDF">' + U.icon("printer", 16) + "</button>" +
          '<button type="button" class="icon-btn icon-danger" data-action="delete" title="Hapus laporan">' + U.icon("trash", 16) + "</button>" +
        "</div></td>" +
      "</tr>";
    }).join("");
  }

  async function loadReports(force) {
    if (state.loading) return;
    if (state.loaded && !force) { paintList(); return; }
    state.loading = true;
    var tbody = U.$("#rep-list-body", state.container);
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">' + loadingRow("Memuat laporan…") + "</td></tr>";
    try {
      state.reports = await API.getReports();
      state.loaded = true;
      state.loading = false;
      paintList();
    } catch (err) {
      state.loading = false;
      if (tbody) tbody.innerHTML = '<tr><td colspan="5"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(API.errorMessage(err)) + "</span></div></td></tr>";
      U.toast(API.errorMessage(err), "error");
    }
  }

  function renderList() {
    state.view = "list";
    state.container.innerHTML = listShell();
    bindList();
    if (state.loaded) paintList();
    else loadReports();
  }

  function bindList() {
    var c = state.container;
    U.$("#rep-new", c).addEventListener("click", function () { openEditor(null); });
    U.$("#rep-refresh", c).addEventListener("click", function () { loadReports(true); U.toast("Memuat ulang laporan…", "info"); });
    U.on(c, "click", '[data-action="new"]', function () { openEditor(null); });
    U.on(c, "click", '[data-action="edit"]', function (e, btn) {
      var id = btn.closest("tr").dataset.id;
      editReport(id);
    });
    U.on(c, "click", '[data-action="word"]', function (e, btn) {
      var id = btn.closest("tr").dataset.id;
      exportSaved(id, "word", btn);
    });
    U.on(c, "click", '[data-action="pdf"]', function (e, btn) {
      var id = btn.closest("tr").dataset.id;
      exportSaved(id, "pdf", btn);
    });
    U.on(c, "click", '[data-action="delete"]', function (e, btn) {
      var id = btn.closest("tr").dataset.id;
      deleteReport(id);
    });
  }

  async function editReport(id) {
    U.toast("Membuka laporan…", "info", 1500);
    try {
      var report = await API.getReport(id);
      if (!report) { U.toast("Laporan tidak ditemukan.", "error"); return; }
      openEditor(report, report.work_report_items || []);
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  async function exportSaved(id, kind, btn) {
    if (btn) U.buttonLoading(btn, true);
    try {
      var report = await API.getReport(id);
      if (!report) throw new Error("Laporan tidak ditemukan.");
      var items = (report.work_report_items || []).slice().sort(function (a, b) { return a.no_urut - b.no_urut; });
      if (kind === "word") await EX.reportWord(report, items, {});
      else EX.reportPdf(report, items, {});
      U.toast("File " + (kind === "word" ? "Word" : "PDF") + " berhasil dibuat.", "success");
    } catch (err) {
      U.toast("Gagal membuat file: " + (err.message || err), "error");
    } finally {
      if (btn) U.buttonLoading(btn, false);
    }
  }

  async function deleteReport(id) {
    var ok = await U.confirm("Hapus laporan kerja ini secara permanen? Tindakan ini tidak dapat dibatalkan.", {
      title: "Hapus Laporan",
      confirmLabel: "Ya, Hapus",
      danger: true
    });
    if (!ok) return;
    try {
      await API.deleteReport(id);
      U.toast("Laporan berhasil dihapus.", "success");
      state.loaded = false;
      loadReports(true);
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  /* ---------------- EDITOR ---------------- */
  function defaults() {
    var s = settings();
    return {
      id: null,
      nama: s.guru_nama || window.BK_CONFIG.DEFAULT_GURU_NAMA,
      nip: stripNip(s.guru_nip || window.BK_CONFIG.DEFAULT_GURU_NIP),
      level_jabatan: "Guru",
      pangkat: "-",
      golongan_ruang: "IX",
      tugas_tambahan: "Guru Piket",
      bulan: U.todayISO().slice(0, 7),
      kota: s.kota || window.BK_CONFIG.DEFAULT_KOTA,
      tanggal_ttd: U.todayISO(),
      kepala_nama: s.kepala_nama || window.BK_CONFIG.DEFAULT_KEPALA_NAMA,
      kepala_nip: stripNip(s.kepala_nip || window.BK_CONFIG.DEFAULT_KEPALA_NIP),
      guru_jabatan: s.guru_jabatan || window.BK_CONFIG.DEFAULT_GURU_JABATAN
    };
  }

  function newItem(index) {
    return {
      no_urut: (index || 0) + 1,
      kegiatan: "Melaksanakan pembelajaran atau bimbingan",
      pekerjaan: "",
      tanggal: U.todayISO()
    };
  }

  function normalizeReport(r) {
    return {
      id: r.id,
      nama: r.nama || "",
      nip: stripNip(r.nip || ""),
      level_jabatan: r.level_jabatan || "",
      pangkat: r.pangkat || "",
      golongan_ruang: r.golongan_ruang || "",
      tugas_tambahan: r.tugas_tambahan || "",
      bulan: r.bulan ? String(r.bulan).slice(0, 7) : U.todayISO().slice(0, 7),
      kota: r.kota || window.BK_CONFIG.DEFAULT_KOTA,
      tanggal_ttd: r.tanggal_ttd || U.todayISO(),
      kepala_nama: r.kepala_nama || settings().kepala_nama || window.BK_CONFIG.DEFAULT_KEPALA_NAMA,
      kepala_nip: stripNip(r.kepala_nip || settings().kepala_nip || window.BK_CONFIG.DEFAULT_KEPALA_NIP),
      guru_jabatan: r.guru_jabatan || window.BK_CONFIG.DEFAULT_GURU_JABATAN
    };
  }

  function openEditor(report, items) {
    state.view = "editor";
    state.editing = report ? normalizeReport(report) : defaults();
    if (items && items.length) {
      state.items = items.slice().sort(function (a, b) { return (a.no_urut || 0) - (b.no_urut || 0); }).map(function (it, i) {
        return { no_urut: i + 1, kegiatan: it.kegiatan || "", pekerjaan: it.pekerjaan || "", tanggal: it.tanggal || "" };
      });
    } else {
      state.items = [newItem(0)];
    }
    state.editorDirty = false;
    renderEditor();
  }

  function field(label, id, value, type, extraClass) {
    return '<div class="field ' + (extraClass || "") + '"><label for="' + id + '">' + U.escape(label) + "</label>" +
      '<input type="' + (type || "text") + '" id="' + id + '" data-field="' + id.replace("rep-", "") + '" value="' + U.escape(value || "") + '"></div>';
  }

  function editorShell() {
    var r = state.editing;
    var isNew = !r.id;
    return '' +
      '<div class="page-head editor-head">' +
        '<div class="editor-title"><button type="button" class="icon-btn" id="rep-back" title="Kembali">' + U.icon("arrowLeft", 20) + "</button>" +
          "<div><h1>" + (isNew ? "Laporan Kerja Baru" : "Edit Laporan Kerja") + "</h1><p>Isi identitas dan kegiatan harian, lalu simpan atau unduh.</p></div></div>" +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="rep-word">' + U.icon("file", 17) + "<span>Word</span></button>" +
          '<button type="button" class="btn btn-secondary" id="rep-pdf">' + U.icon("printer", 17) + "<span>PDF</span></button>" +
          '<button type="button" class="btn btn-primary" id="rep-save">' + U.icon("save", 17) + "<span>Simpan</span></button>" +
        "</div>" +
      "</div>" +
      '<div class="card" id="rep-identity">' +
        '<div class="card-head"><div><h3>Identitas Pegawai</h3><p>Data ini akan tampil pada laporan.</p></div></div>' +
        '<div class="form-grid">' +
          field("Nama", "rep-nama", r.nama, "text", "span-2") +
          field("NIP", "rep-nip", r.nip) +
          field("Level Jabatan", "rep-level_jabatan", r.level_jabatan) +
          field("Pangkat", "rep-pangkat", r.pangkat) +
          field("Golongan Ruang", "rep-golongan_ruang", r.golongan_ruang) +
          field("Tugas Tambahan", "rep-tugas_tambahan", r.tugas_tambahan) +
          field("Bulan", "rep-bulan", r.bulan, "month") +
          field("Kota", "rep-kota", r.kota) +
          field("Tanggal Tanda Tangan", "rep-tanggal_ttd", r.tanggal_ttd, "date") +
          field("Kepala Madrasah", "rep-kepala_nama", r.kepala_nama) +
          field("NIP Kepala", "rep-kepala_nip", r.kepala_nip) +
          field("Jabatan Penandatangan", "rep-guru_jabatan", r.guru_jabatan) +
        "</div>" +
      "</div>" +
      '<div class="card">' +
        '<div class="card-head"><div><h3>Kegiatan Harian</h3><p>Tambahkan satu baris untuk setiap kegiatan. Nomor urut otomatis.</p></div>' +
          '<button type="button" class="btn btn-soft btn-sm" id="rep-add-item">' + U.icon("plus", 16) + "<span>Tambah Baris</span></button></div>" +
        '<div class="table-wrap"><table class="data-table editor-table"><thead><tr>' +
          '<th class="col-no">No</th><th class="col-kegiatan">Kegiatan</th><th>Pekerjaan</th><th class="col-tanggal">Tanggal</th><th class="col-actions"></th>' +
        "</tr></thead><tbody id=\"rep-items\"></tbody></table></div>" +
        '<div class="editor-foot"><span class="table-muted" id="rep-item-count">0 kegiatan</span>' +
          '<span class="table-muted">Tip: gunakan Enter di kolom Pekerjaan untuk menambah baris dalam satu sel.</span></div>' +
      "</div>" +
      '<datalist id="kegiatan-list">' + KEGIATAN_OPTIONS.map(function (k) { return '<option value="' + U.escape(k) + '"></option>'; }).join("") + "</datalist>";
  }

  function renderItems() {
    var tbody = U.$("#rep-items", state.container);
    if (!tbody) return;
    if (!state.items.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + U.emptyState("clipboard", "Belum ada kegiatan", "Klik Tambah Baris untuk mulai mengisi.") + "</td></tr>";
    } else {
      tbody.innerHTML = state.items.map(function (it, i) {
        return '<tr data-index="' + i + '">' +
          '<td class="col-no">' + (i + 1) + ".</td>" +
          '<td><input type="text" class="input-table" list="kegiatan-list" data-field="kegiatan" value="' + U.escape(it.kegiatan || "") + '" placeholder="Kegiatan…"></td>' +
          '<td><textarea class="input-table" data-field="pekerjaan" rows="2" placeholder="Uraian pekerjaan…">' + U.escape(it.pekerjaan || "") + "</textarea></td>" +
          '<td><input type="date" class="input-table" data-field="tanggal" value="' + U.escape(it.tanggal || "") + '"></td>' +
          '<td class="col-actions"><button type="button" class="icon-btn icon-danger" data-action="remove-item" title="Hapus baris">' + U.icon("trash", 16) + "</button></td>" +
        "</tr>";
      }).join("");
    }
    var count = U.$("#rep-item-count", state.container);
    if (count) count.textContent = state.items.length + " kegiatan";
  }

  function renderEditor() {
    state.container.innerHTML = editorShell();
    bindEditor();
    renderItems();
  }

  function bindEditor() {
    var c = state.container;
    U.$("#rep-back", c).addEventListener("click", async function () {
      if (state.editorDirty) {
        var ok = await U.confirm("Perubahan pada laporan belum disimpan. Yakin ingin keluar?", {
          title: "Keluar dari Editor",
          confirmLabel: "Ya, Keluar",
          danger: true
        });
        if (!ok) return;
      }
      if (window.location.hash === "#/laporan") {
        renderList();
      } else {
        window.location.hash = "#/laporan";
      }
    });
    U.$("#rep-save", c).addEventListener("click", save);
    U.$("#rep-word", c).addEventListener("click", function () { exportEditor("word", this); });
    U.$("#rep-pdf", c).addEventListener("click", function () { exportEditor("pdf", this); });
    U.$("#rep-add-item", c).addEventListener("click", function () {
      state.items.push(newItem(state.items.length));
      state.editorDirty = true;
      renderItems();
    });

    // Identitas
    U.on(U.$("#rep-identity", c), "input", "[data-field]", function (e, input) {
      state.editing[input.dataset.field] = input.value;
      state.editorDirty = true;
    });
    U.on(U.$("#rep-identity", c), "change", "[data-field]", function (e, input) {
      state.editing[input.dataset.field] = input.value;
      state.editorDirty = true;
    });

    // Baris kegiatan
    U.on(U.$("#rep-items", c), "input", "[data-field]", function (e, input) {
      var tr = input.closest("tr[data-index]");
      if (!tr) return;
      var idx = Number(tr.dataset.index);
      if (!state.items[idx]) return;
      state.items[idx][input.dataset.field] = input.value;
      state.editorDirty = true;
    });
    U.on(U.$("#rep-items", c), "change", "[data-field]", function (e, input) {
      var tr = input.closest("tr[data-index]");
      if (!tr) return;
      var idx = Number(tr.dataset.index);
      if (!state.items[idx]) return;
      state.items[idx][input.dataset.field] = input.value;
      state.editorDirty = true;
    });
    U.on(U.$("#rep-items", c), "click", '[data-action="remove-item"]', function (e, btn) {
      var tr = btn.closest("tr[data-index]");
      if (!tr) return;
      var idx = Number(tr.dataset.index);
      state.items.splice(idx, 1);
      state.items.forEach(function (it, i) { it.no_urut = i + 1; });
      state.editorDirty = true;
      renderItems();
    });
  }

  function collect() {
    var r = state.editing;
    var report = {
      id: r.id || null,
      nama: (r.nama || "").trim(),
      nip: stripNip(r.nip),
      level_jabatan: (r.level_jabatan || "").trim(),
      pangkat: (r.pangkat || "").trim(),
      golongan_ruang: (r.golongan_ruang || "").trim(),
      tugas_tambahan: (r.tugas_tambahan || "").trim(),
      bulan: r.bulan ? (String(r.bulan).length === 7 ? r.bulan + "-01" : String(r.bulan).slice(0, 10)) : null,
      kota: (r.kota || "").trim(),
      tanggal_ttd: r.tanggal_ttd || null,
      kepala_nama: (r.kepala_nama || "").trim(),
      kepala_nip: stripNip(r.kepala_nip),
      guru_jabatan: (r.guru_jabatan || "").trim()
    };
    var items = state.items.map(function (it, i) {
      return {
        no_urut: i + 1,
        kegiatan: (it.kegiatan || "").trim(),
        pekerjaan: (it.pekerjaan || "").trim(),
        tanggal: it.tanggal || null
      };
    });
    return { report: report, items: items };
  }

  function validate(data) {
    if (!data.report.nama) { U.toast("Nama pegawai wajib diisi.", "warning"); return false; }
    if (!data.report.bulan) { U.toast("Bulan laporan wajib dipilih.", "warning"); return false; }
    if (!data.items.length) { U.toast("Tambahkan minimal satu kegiatan.", "warning"); return false; }
    for (var i = 0; i < data.items.length; i++) {
      var it = data.items[i];
      if (!it.kegiatan) { U.toast("Kegiatan baris " + (i + 1) + " belum diisi.", "warning"); return false; }
      var isLibur = /libur/i.test(it.kegiatan);
      if (!it.pekerjaan && !isLibur) { U.toast("Pekerjaan baris " + (i + 1) + " belum diisi.", "warning"); return false; }
      if (!it.tanggal) { U.toast("Tanggal baris " + (i + 1) + " belum diisi.", "warning"); return false; }
    }
    return true;
  }

  async function save() {
    if (state.saving) return;
    var data = collect();
    if (!validate(data)) return;
    state.saving = true;
    var btn = U.$("#rep-save", state.container);
    U.buttonLoading(btn, true);
    try {
      await API.saveReport(data.report, data.items);
      state.editorDirty = false;
      state.loaded = false;
      state.saving = false;
      U.toast("Laporan kerja berhasil disimpan.", "success");
      if (window.location.hash !== "#/laporan") {
        window.location.hash = "#/laporan";
      } else {
        renderList();
        loadReports(true);
      }
    } catch (err) {
      state.saving = false;
      U.toast(API.errorMessage(err), "error");
    } finally {
      U.buttonLoading(btn, false);
    }
  }

  async function exportEditor(kind, btn) {
    var data = collect();
    if (!validate(data)) return;
    if (btn) U.buttonLoading(btn, true);
    try {
      if (kind === "word") await EX.reportWord(data.report, data.items, {});
      else EX.reportPdf(data.report, data.items, {});
      U.toast("File " + (kind === "word" ? "Word" : "PDF") + " berhasil dibuat.", "success");
    } catch (err) {
      U.toast("Gagal membuat file: " + (err.message || err), "error");
    } finally {
      if (btn) U.buttonLoading(btn, false);
    }
  }

  /* ---------------- ROUTER HALAMAN ---------------- */
  function render(container) {
    state.container = container;
    state.token++;
    var hash = window.location.hash || "";
    var query = hash.indexOf("?") !== -1 ? hash.split("?")[1] : "";
    var params = new URLSearchParams(query);
    if (params.get("new") === "1") {
      openEditor(null);
    } else if (params.get("edit")) {
      editReport(params.get("edit"));
    } else {
      renderList();
    }
  }

  window.Pages = window.Pages || {};
  window.Pages.reports = { render: render };
})();