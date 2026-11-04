/* ============================================================
   Halaman Laporan Kerja
   ============================================================ */
(function () {
  "use strict";

  var KEGIATAN_OPTIONS_UNUSED = [
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

  var KEGIATAN_UTAMA = [
    "Melaksanakan tugas tambahan yang melekat pada pelaksanaan kegiatan pokok sesuai dengan beban tugas guru",
    "Melaksanakan pembelajaran atau bimbingan",
    "Libur Umum"
  ];

  var PEKERJAAN_UMUM = [
    "Piket ketertiban",
    "Piket KBM",
    "Piket penyambutan siswa",
    "Upacara Bendera",
    "Apel Pagi",
    "Jumat Taqorub",
    "Mengerjakan Administrasi BK",
    "Layanan bimbingan klasikal",
    "Layanan bimbingan pribadi",
    "Layanan bimbingan kelompok",
    "Konseling individual",
    "Konseling kelompok",
    "Koordinasi dengan Tim BK",
    "Koordinasi dengan wali kelas",
    "Koordinasi dengan wali murid",
    "Koordinasi dengan waka kesiswaan",
    "Panggilan orang tua",
    "Pawai Taaruf"
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
    asPdf: false,
    token: 0
  };

  /* ---------- Struktur: 1 hari = banyak kegiatan = banyak pekerjaan ---------- */
  function newWork(text) { return { text: text || "" }; }
  function newActivity(kegiatan) {
    return { kegiatan: kegiatan || "Melaksanakan pembelajaran atau bimbingan", works: [newWork("")] };
  }
  function newDay(tanggal) {
    return { tanggal: tanggal || U.todayISO(), activities: [newActivity()] };
  }

  /* Ubah hasil lampiran DB (satu baris = satu kegiatan + pekerjaan multi-baris)
     menjadi struktur hari → kegiatan → pekerjaan. */
  function groupItems(items) {
    var days = [];
    var byDate = {};
    (items || []).slice().sort(function (a, b) {
      var da = a.tanggal || "", db = b.tanggal || "";
      if (da !== db) return da < db ? -1 : 1;
      return (a.no_urut || 0) - (b.no_urut || 0);
    }).forEach(function (it) {
      var date = it.tanggal || "";
      var day = byDate[date];
      if (!day) {
        day = { tanggal: date, activities: [] };
        byDate[date] = day;
        days.push(day);
      }
      var lines = String(it.pekerjaan || "").split(/\r?\n/).map(function (t) { return t.trim(); });
      var works = lines.filter(function (t) { return t !== ""; }).map(function (t) { return newWork(t); });
      day.activities.push({
        kegiatan: it.kegiatan || "",
        works: works.length ? works : [newWork("")]
      });
    });
    return days.length ? days : [newDay()];
  }

  /* Ubah struktur ke baris penyimpanan: 1 baris per kegiatan. */
  function flatten(days) {
    var rows = [];
    var no = 0;
    (days || []).forEach(function (day) {
      var acts = (day.activities || []).filter(function (a) {
        return String(a.kegiatan || "").trim() !== "" ||
          (a.works || []).some(function (w) { return String(w.text || "").trim() !== ""; });
      });
      if (!acts.length) {
        no++;
        rows.push({ no_urut: no, kegiatan: "Libur Umum", pekerjaan: "", tanggal: day.tanggal || null });
        return;
      }
      acts.forEach(function (a) {
        no++;
        rows.push({
          no_urut: no,
          kegiatan: String(a.kegiatan || "").trim(),
          pekerjaan: (a.works || []).map(function (w) { return String(w.text || "").replace(/\r?\n/g, " ").trim(); })
            .filter(function (t) { return t !== ""; }).join("\n"),
          tanggal: day.tanggal || null
        });
      });
    });
    return rows;
  }

  /* Baris untuk tampilan pratinjau / ekspor: [no, kegiatanHTML, pekerjaanHTML, tanggal] */
  function previewRows(days) {
    var rows = [];
    var no = 0;
    (days || []).forEach(function (day) {
      var acts = (day.activities || []).filter(function (a) {
        return String(a.kegiatan || "").trim() !== "" ||
          (a.works || []).some(function (w) { return String(w.text || "").trim() !== ""; });
      });
      if (!acts.length) {
        no++;
        rows.push({ no: no + ".", kegiatan: "Libur Umum", pekerjaan: "", tanggal: day.tanggal, kegiatanLines: ["Libur Umum"], workLines: [] });
        return;
      }
      acts.forEach(function (a) {
        no++;
        var workLines = (a.works || []).map(function (w) { return String(w.text || "").trim(); }).filter(Boolean);
        rows.push({
          no: no + ".",
          kegiatan: String(a.kegiatan || "").trim(),
          pekerjaan: workLines.join("\n"),
          tanggal: day.tanggal,
          kegiatanLines: String(a.kegiatan || "").split(/\r?\n/).map(function (t) { return t.trim(); }).filter(Boolean),
          workLines: workLines
        });
      });
    });
    return rows;
  }

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
      var raw = (report.work_report_items || []).slice().sort(function (a, b) { return a.no_urut - b.no_urut; });
      // Gabungkan per tanggal -> satu baris laporan = satu hari.
      var days = groupItems(raw).map(function (day) {
        return {
          tanggal: day.tanggal,
          activities: day.activities.map(function (a) {
            return {
              kegiatan: String(a.kegiatan || "").trim(),
              works: (a.works || []).map(function (w) { return String(w.text || "").trim(); }).filter(Boolean)
            };
          }).filter(function (a) { return a.kegiatan || a.works.length; })
        };
      });
      if (kind === "word") await EX.reportWord(report, raw, { days: days });
      else EX.reportPdf(report, raw, { days: days });
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
    state.items = groupItems(items || (report && report.work_report_items) || []);
    state.editorDirty = false;
    renderEditor();
  }

  function field(label, id, value, type, extraClass) {
    return '<div class="field ' + (extraClass || "") + '"><label for="' + id + '">' + U.escape(label) + "</label>" +
      '<input type="' + (type || "text") + '" id="' + id + '" data-field="' + id.replace("rep-", "") + '" value="' + U.escape(value || "") + '"></div>';
  }

  /* ---------------- SHELL EDITOR ---------------- */
  function editorShell() {
    var r = state.editing;
    var isNew = !r.id;
    return '' +
      '<div class="page-head editor-head">' +
        '<div class="editor-title"><button type="button" class="icon-btn" id="rep-back" title="Kembali">' + U.icon("arrowLeft", 20) + "</button>" +
          "<div><h1>" + (isNew ? "Laporan Kerja Baru" : "Edit Laporan Kerja") + "</h1>" +
          "<p>Satu hari bisa diisi beberapa kegiatan, dan setiap kegiatan bisa diisi beberapa pekerjaan.</p></div></div>" +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="rep-preview">' + U.icon("eye", 17) + "<span>Pratinjau</span></button>" +
          '<button type="button" class="btn btn-secondary" id="rep-word">' + U.icon("file", 17) + "<span>Word</span></button>" +
          '<button type="button" class="btn btn-secondary" id="rep-pdf">' + U.icon("printer", 17) + "<span>PDF</span></button>" +
          '<button type="button" class="btn btn-primary" id="rep-save">' + U.icon("save", 17) + "<span>Simpan</span></button>" +
        "</div>" +
      "</div>" +
      '<details class="card rep-collapse" id="rep-identity-box"' + (isNew ? " open" : "") + " data-is-new=\"" + (isNew ? "1" : "0") + "\">" +
        '<summary class="rep-collapse-head"><span>' + U.icon("user", 17) + "<strong>Identitas Pegawai &amp; Penandatangan</strong></span>" +
          '<span class="rep-collapse-hint">klik untuk buka/tutup</span></summary>' +
        '<div class="form-grid" id="rep-identity">' +
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
      "</details>" +
      '<div class="card">' +
        '<div class="card-head"><div><h3>Kegiatan Harian</h3>' +
          '<p>Tambahkan hari, lalu isi kegiatan pada hari tersebut. Jumlah nomor mengikuti urutan hari.</p></div>' +
          '<button type="button" class="btn btn-soft btn-sm" id="rep-add-day">' + U.icon("plus", 16) + "<span>Tambah Hari</span></button></div>" +
        '<div class="rep-days" id="rep-days"></div>' +
        '<div class="editor-foot"><span class="table-muted" id="rep-item-count">0 hari</span>' +
          '<span class="table-muted">Pekerjaan ditulis satu baris per pekerjaan; Enter untuk baris baru.</span></div>' +
      "</div>" +
      '<datalist id="kegiatan-list">' + KEGIATAN_UTAMA.concat(["Mengerjakan administrasi BK", "Piket ketertiban", "Koordinasi dengan Tim BK", "Panggilan orang tua"]).map(function (k) { return '<option value="' + U.escape(k) + '"></option>'; }).join("") + "</datalist>" +
      '<datalist id="pekerjaan-list">' + PEKERJAAN_UMUM.map(function (k) { return '<option value="' + U.escape(k) + '"></option>'; }).join("") + "</datalist>";
  }

  /* ---------------- RENDER HARI / KEGIATAN / PEKERJAAN ---------------- */
  function dayHtml(day, di, noAwal) {
    var dayLabel = day.tanggal ? U.formatDateLong(day.tanggal) : "Tanggal belum dipilih";
    return '<div class="rep-day" data-day="' + di + '">' +
      '<div class="rep-day-head">' +
        '<span class="rep-day-no">' + (di + 1) + "</span>" +
        '<input type="date" data-day-field="tanggal" value="' + U.escape(day.tanggal || "") + '" title="Tanggal hari ini">' +
        '<span class="rep-day-title">' + U.escape(dayLabel) + "</span>" +
        '<span class="rep-day-spacer"></span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="add-activity">' + U.icon("plus", 15) + "<span>Kegiatan</span></button>" +
        (state.items.length > 1 ? '<button type="button" class="icon-btn icon-danger" data-action="remove-day" title="Hapus hari">' + U.icon("trash", 16) + "</button>" : "") +
      "</div>" +
      '<div class="rep-day-body">' +
        (day.activities.length
          ? day.activities.map(function (act, ai) { return activityHtml(act, di, ai); }).join("")
          : '<p class="muted-sm">Belum ada kegiatan. Klik “Kegiatan” untuk menambah.</p>') +
      "</div>" +
    "</div>";
  }

  function activityHtml(act, di, ai) {
    return '<div class="rep-kegiatan" data-activity="' + ai + '">' +
      '<div class="rep-kegiatan-head">' +
        '<span class="rep-kegiatan-no">' + (ai + 1) + ".</span>" +
        '<textarea class="input-table" rows="2" data-act-field="kegiatan" list="kegiatan-list" placeholder="Nama kegiatan…">' + U.escape(act.kegiatan || "") + "</textarea>" +
        '<div class="rep-kegiatan-tools">' +
          '<button type="button" class="icon-btn icon-danger" data-action="remove-activity" title="Hapus kegiatan">' + U.icon("trash", 16) + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="rep-pekerjaan">' +
        (act.works || []).map(function (w, wi) { return workHtml(w, di, ai, wi); }).join("") +
      "</div>" +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-work" data-action="add-work">' + U.icon("plus", 14) + "<span>Tambah pekerjaan</span></button>" +
    "</div>";
  }

  function workHtml(w, di, ai, wi) {
    return '<div class="rep-pekerjaan-row" data-work="' + wi + '">' +
      '<span class="rep-bullet">–</span>' +
      '<textarea class="input-table" rows="1" data-work-field="text" list="pekerjaan-list" placeholder="Uraian pekerjaan…">' + U.escape(w.text || "") + "</textarea>" +
      ((state.items[di] && state.items[di].activities[ai] && state.items[di].activities[ai].works.length > 1)
        ? '<button type="button" class="icon-btn" data-action="remove-work" title="Hapus pekerjaan">' + U.icon("x", 15) + "</button>"
        : "") +
    "</div>";
  }

  function renderDays() {
    var box = U.$("#rep-days", state.container);
    if (!box) return;
    box.innerHTML = state.items.map(function (day, di) { return dayHtml(day, di); }).join("");
    var rows = previewRows(state.items);
    var count = U.$("#rep-item-count", state.container);
    if (count) count.textContent = state.items.length + " hari · " + rows.length + " kegiatan";
  }

  function renderEditor() {
    state.container.innerHTML = editorShell();
    bindEditor();
    renderDays();
    syncEditorTitle();
  }

  /* Judul dan status simpan mengikuti isi editor. */
  function syncEditorTitle() {
    var title = U.$(".editor-title h1", state.container);
    if (title) title.textContent = state.editing && state.editing.id ? "Edit Laporan Kerja" : "Laporan Kerja Baru";
    var box = U.$("#rep-identity-box", state.container);
    if (box) {
      var isNew = !(state.editing && state.editing.id);
      if (box.getAttribute("data-is-new") !== (isNew ? "1" : "0")) {
        box.setAttribute("data-is-new", isNew ? "1" : "0");
        if (isNew) box.setAttribute("open", "open");
      }
    }
  }

  /* ---------------- EVENT EDITOR ---------------- */
  function bindEditor() {
    var c = state.container;
    U.$("#rep-back", c).addEventListener("click", async function () {
      if (state.editorDirty) {
        var ok = await U.confirm("Perubahan pada laporan belum disimpan. Yakin ingin keluar?", {
          title: "Keluar dari Editor", confirmLabel: "Ya, Keluar", danger: true
        });
        if (!ok) return;
      }
      if (window.location.hash === "#/laporan") renderList();
      else window.location.hash = "#/laporan";
    });
    U.$("#rep-save", c).addEventListener("click", save);
    U.$("#rep-word", c).addEventListener("click", function () { exportEditor("word", this); });
    U.$("#rep-pdf", c).addEventListener("click", function () { exportEditor("pdf", this); });
    U.$("#rep-preview", c).addEventListener("click", openPreview);
    U.$("#rep-add-day", c).addEventListener("click", function () {
      var last = state.items[state.items.length - 1];
      var next = last && last.tanggal ? U.addDays(last.tanggal, 1) : U.todayISO();
      state.items.push(newDay(next));
      state.editorDirty = true;
      renderDays();
      var days = U.$$(".rep-day", c);
      if (days.length) days[days.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // Identitas
    function setIdent(input) {
      state.editing[input.dataset.field] = input.value;
      state.editorDirty = true;
    }
    U.on(U.$("#rep-identity", c), "input", "[data-field]", function (e, input) { setIdent(input); });
    U.on(U.$("#rep-identity", c), "change", "[data-field]", function (e, input) { setIdent(input); });

    var daysBox = U.$("#rep-days", c);

    // Isi teks: kegiatan / pekerjaan / tanggal
    daysBox.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.dataset) return;
      var dayEl = t.closest(".rep-day");
      if (!dayEl) return;
      var di = Number(dayEl.dataset.day);
      var day = state.items[di];
      if (!day) return;

      if (t.dataset.dayField === "tanggal") {
        day.tanggal = t.value;
        var title = dayEl.querySelector(".rep-day-title");
        if (title) title.textContent = day.tanggal ? U.formatDateLong(day.tanggal) : "Tanggal belum dipilih";
        state.editorDirty = true;
        return;
      }

      var actEl = t.closest("[data-activity]");
      if (!actEl) return;
      var ai = Number(actEl.dataset.activity);
      var act = day.activities[ai];
      if (!act) return;

      if (t.dataset.actField === "kegiatan") {
        act.kegiatan = t.value;
        state.editorDirty = true;
        return;
      }
      var workEl = t.closest("[data-work]");
      if (workEl && t.dataset.workField === "text") {
        var wi = Number(workEl.dataset.work);
        if (act.works[wi]) act.works[wi].text = t.value;
        state.editorDirty = true;
      }
    });

    daysBox.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.dataset && t.dataset.dayField === "tanggal") {
        var dayEl = t.closest(".rep-day");
        if (!dayEl) return;
        var day = state.items[Number(dayEl.dataset.day)];
        if (!day) return;
        day.tanggal = t.value;
        var title = dayEl.querySelector(".rep-day-title");
        if (title) title.textContent = day.tanggal ? U.formatDateLong(day.tanggal) : "Tanggal belum dipilih";
        state.editorDirty = true;
      }
    });

    // Tombol tambah/hapus
    daysBox.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.dataset.action;
      var dayEl = btn.closest(".rep-day");
      if (!dayEl) return;
      var di = Number(dayEl.dataset.day);
      var day = state.items[di];
      if (!day) return;
      var actEl = btn.closest("[data-activity]");
      var ai = actEl ? Number(actEl.dataset.activity) : -1;
      var act = ai >= 0 ? day.activities[ai] : null;

      if (action === "add-activity") {
        day.activities.push(newActivity());
      } else if (action === "remove-activity") {
        day.activities.splice(ai, 1);
      } else if (action === "add-work") {
        if (act) act.works.push(newWork(""));
      } else if (action === "remove-work") {
        var workEl = btn.closest("[data-work]");
        if (act && workEl) {
          var wi = Number(workEl.dataset.work);
          act.works.splice(wi, 1);
          if (!act.works.length) act.works.push(newWork(""));
        }
      } else if (action === "remove-day") {
        if (state.items.length <= 1) return;
        state.items.splice(di, 1);
      } else {
        return;
      }
      state.editorDirty = true;
      renderDays();
    });
  }

  /* ---------------- PRATINJAU ---------------- */
  function openPreview() {
    var r = state.editing;
    var rows = previewRows(state.items);
    var bulanLabel = r.bulan ? U.monthLabelFromDate(r.bulan) : "-";
    var ttd = r.tanggal_ttd ? U.formatDateID(r.tanggal_ttd) : U.formatDateID(U.todayISO());
    var body = '<div class="rep-preview" id="rp-wrap">' +
      '<table>' +
        '<tr><td class="rp-title" colspan="4">Laporan Kerja</td></tr>' +
        "<tr><td colspan=\"4\" style=\"border:none;height:8px\"></td></tr>" +
        "<tr>" +
          "<td><strong>Nama</strong></td><td>" + U.escape(r.nama || "") + "</td>" +
          "<td><strong>NIP</strong></td><td>" + U.escape(stripNip(r.nip) || "") + "</td>" +
        "</tr><tr>" +
          "<td><strong>Level Jabatan</strong></td><td>" + U.escape(r.level_jabatan || "") + "</td>" +
          "<td><strong>Pangkat</strong></td><td>" + U.escape(r.pangkat || "") + "</td>" +
        "</tr><tr>" +
          "<td><strong>Golongan Ruang</strong></td><td>" + U.escape(r.golongan_ruang || "") + "</td>" +
          "<td><strong>Tugas Tambahan</strong></td><td>" + U.escape(r.tugas_tambahan || "") + "</td>" +
        "</tr><tr>" +
          "<td><strong>Bulan</strong></td><td colspan=\"3\">" + U.escape(bulanLabel) + "</td>" +
        "</tr>" +
        "<tr><td colspan=\"4\" style=\"border:none;height:8px\"></td></tr>" +
        "<tr><th>No</th><th>Kegiatan</th><th>Pekerjaan</th><th>Tanggal</th></tr>" +
        rows.map(function (row) {
          return "<tr>" +
            '<td class="rp-center">' + U.escape(row.no) + "</td>" +
            "<td>" + row.kegiatanLines.map(function (l) { return U.escape(l); }).join("<br>") + "</td>" +
            "<td>" + (row.workLines.length ? row.workLines.map(function (l) { return U.escape(l); }).join("<br>") : "&nbsp;") + "</td>" +
            '<td class="rp-center">' + U.escape(row.tanggal ? U.formatTanggalPendek(row.tanggal) : "") + "</td>" +
          "</tr>";
        }).join("") +
        "<tr><td colspan=\"4\" style=\"border:none;height:14px\"></td></tr>" +
        "<tr>" +
          '<td colspan="2" class="rp-center">Mengetahui,<br>Kepala ' + U.escape(schoolLabel()) + "<br><br><br><br>" +
            "<strong>" + U.escape(r.kepala_nama || "") + "</strong><br>" + U.escape(nipText(r.kepala_nip)) + "</td>" +
          '<td colspan="2" class="rp-center">' + U.escape((r.kota || "") + ", " + ttd) + "<br>" + U.escape(r.guru_jabatan || "") +
            "<br><br><br><br><strong>" + U.escape(r.nama || "") + "</strong><br>" + U.escape(nipText(r.nip)) + "</td>" +
        "</tr>" +
      "</table></div>";

    U.modal({
      title: "Pratinjau Laporan",
      subtitle: "Tampilan ini menyerupai hasil Word/PDF.",
      size: "lg",
      body: body,
      actions: [
        { label: "Tutup", class: "btn-secondary" },
        { label: "Unduh Word", class: "btn-secondary", icon: "file", close: false, onClick: function (close, o, b) { close(); exportEditor("word", null); } },
        { label: "Unduh PDF", class: "btn-primary", icon: "printer", close: false, onClick: function (close, o, b) { close(); exportEditor("pdf", null); } }
      ]
    });
  }

  function schoolLabel() {
    var s = settings();
    return s.nama_madrasah || window.BK_CONFIG.SCHOOL_NAME;
  }

  function nipText(v) {
    var n = stripNip(v);
    return n ? "NIP. " + n : "";
  }

  /* ---------------- SIMPAN / EKSPOR ---------------- */
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
    return { report: report, items: flatten(state.items), days: state.items };
  }

  function validate(data) {
    if (!data.report.nama) { U.toast("Nama pegawai wajib diisi.", "warning"); return false; }
    if (!data.report.bulan) { U.toast("Bulan laporan wajib dipilih.", "warning"); return false; }
    if (!data.items.length) { U.toast("Tambahkan minimal satu kegiatan.", "warning"); return false; }

    for (var d = 0; d < data.days.length; d++) {
      var day = data.days[d];
      if (!day.tanggal) { U.toast("Tanggal hari ke-" + (d + 1) + " belum diisi.", "warning"); return false; }
      for (var a = 0; a < day.activities.length; a++) {
        var act = day.activities[a];
        var hasText = String(act.kegiatan || "").trim() !== "";
        var hasWork = (act.works || []).some(function (w) { return String(w.text || "").trim() !== ""; });
        if (!hasText && !hasWork) continue;
        if (!hasText) {
          U.toast("Nama kegiatan hari ke-" + (d + 1) + " nomor " + (a + 1) + " belum diisi.", "warning");
          return false;
        }
        var isHoliday = /libur/i.test(act.kegiatan);
        if (!hasWork && !isHoliday) {
          U.toast("Isi minimal satu pekerjaan untuk kegiatan “" + String(act.kegiatan).slice(0, 40) + "…”.", "warning");
          return false;
        }
      }
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
      var savedId = await API.saveReport(data.report, data.items);
      if (savedId) state.editing.id = savedId;
      state.editorDirty = false;
      state.loaded = false;
      state.saving = false;
      U.toast("Laporan kerja berhasil disimpan.", "success");
      if (window.location.hash !== "#/laporan") window.location.hash = "#/laporan";
      else { renderList(); loadReports(true); }
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
      var payload = { no: data.items.map(function (r) { return r.no_urut; }) };
      // Kirim struktur hari (lebih kaya) ke exporter; jatuh kembali ke items bila tidak didukung.
      var grouped = data.days.map(function (day) {
        return {
          tanggal: day.tanggal,
          activities: day.activities.map(function (a) {
            return {
              kegiatan: String(a.kegiatan || "").trim(),
              works: (a.works || []).map(function (w) { return String(w.text || "").trim(); }).filter(Boolean)
            };
          }).filter(function (a) { return a.kegiatan || a.works.length; })
        };
      });
      if (kind === "word") await EX.reportWord(data.report, data.items, { days: grouped });
      else EX.reportPdf(data.report, data.items, { days: grouped });
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