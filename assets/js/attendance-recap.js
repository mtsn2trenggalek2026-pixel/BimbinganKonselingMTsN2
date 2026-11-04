/* ============================================================
   Halaman Rekap Absensi
   ------------------------------------------------------------
   Rekap kehadiran per semester atau rentang tanggal, dengan
   persentase dihitung terhadap jumlah hari efektif semester
   yang diatur di menu Tahun & Semester.
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    mode: "semester",
    semesterId: "",
    tahunId: "",
    from: "",
    to: "",
    kelas: "",
    tingkat: "",
    students: [],
    recordsByStudent: {},
    rows: [],
    semesters: [],
    years: [],
    semester: null,
    year: null,
    loading: false,
    token: 0
  };

  function semesterOptions() {
    return state.semesters.map(function (s) {
      var y = state.years.filter(function (x) { return x.id === s.academic_year_id; })[0];
      return {
        id: s.id,
        label: U.tahunAjaranLabel(y) + " · " + U.SEMESTER_LABEL[s.jenis] + (s.status === "aktif" ? " (berjalan)" : ""),
        sem: s,
        year: y
      };
    });
  }

  function activeOption() {
    var opts = semesterOptions();
    var cur = window.APP_STATE.activeSemester;
    return opts.filter(function (o) { return o.id === state.semesterId; })[0] ||
      opts.filter(function (o) { return cur && o.id === cur.id; })[0] ||
      opts[0] || null;
  }

  function shell() {
    var opts = semesterOptions();
    var opt = activeOption();
    var hariEfektif = opt ? opt.sem.hari_efektif : 0;
    return '' +
      '<div class="page-head">' +
        '<div><h1>Rekap Absensi</h1><p>Rekap kehadiran per semester. Persentase dihitung dari <strong>jumlah hari efektif</strong> semester yang diatur di menu Tahun &amp; Semester.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="rec-excel">' + U.icon("download", 17) + "<span>Excel</span></button>" +
          '<button type="button" class="btn btn-secondary" id="rec-pdf">' + U.icon("printer", 17) + "<span>PDF</span></button>" +
        "</div>" +
      "</div>" +
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field"><label for="rec-mode">Jenis rekap</label><select id="rec-mode">' +
            '<option value="semester"' + (state.mode === "semester" ? " selected" : "") + ">Per semester</option>" +
            '<option value="rentang"' + (state.mode === "rentang" ? " selected" : "") + ">Rentang tanggal</option>" +
          "</select></div>" +
          (state.mode === "semester"
            ? '<div class="field grow"><label for="rec-semester">Semester</label><select id="rec-semester">' +
                opts.map(function (o) {
                  return '<option value="' + U.escape(o.id) + '"' + (opt && o.id === opt.id ? " selected" : "") + ">" + U.escape(o.label) + "</option>";
                }).join("") +
              "</select></div>"
            : '<div class="field"><label for="rec-from">Dari tanggal</label><input type="date" id="rec-from" value="' + state.from + '"></div>' +
              '<div class="field"><label for="rec-to">Sampai tanggal</label><input type="date" id="rec-to" value="' + state.to + '"></div>') +
          '<div class="field"><label for="rec-tingkat">Tingkat</label><select id="rec-tingkat">' +
            '<option value="">Semua Tingkat</option>' +
            [7, 8, 9].map(function (t) { return '<option value="' + t + '"' + (String(state.tingkat) === String(t) ? " selected" : "") + ">Kelas " + U.TINGKAT_ROMAN[t] + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field"><label for="rec-kelas">Kelas</label><select id="rec-kelas"><option value="">Semua Kelas</option>' +
            U.uniqueClasses(state.students).map(function (k) { return '<option value="' + U.escape(k) + '"' + (state.kelas === k ? " selected" : "") + ">" + U.escape(k) + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field field-action"><button type="button" class="btn btn-primary" id="rec-show">' + U.icon("chart", 17) + "<span>Tampilkan</span></button></div>" +
        "</div>" +
      "</div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Hari efektif</span><strong>' + hariEfektif + "</strong><small id=\"rec-hari-note\">hari masuk</small></div>" +
        '<div class="summary-card tone-green"><span class="summary-label">Rata-rata hadir</span><strong id="rec-avg">0%</strong><small>dari hari efektif</small></div>' +
        '<div class="summary-card tone-red"><span class="summary-label">Tidak Masuk</span><strong id="rec-total-tidak">0</strong><small>catatan</small></div>' +
        '<div class="summary-card tone-amber"><span class="summary-label">Hari tercatat</span><strong id="rec-hari-tercatat">0</strong><small id="rec-total-siswa">0 siswa</small></div>' +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count" id="rec-count">0 siswa</span><span class="table-muted" id="rec-period"></span></div>' +
          '<div class="table-toolbar-right"><span class="table-muted">Hadir ÷ hari efektif × 100%</span></div>' +
        "</div>" +
        '<div class="table-wrap"><table class="data-table recap-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Kelas</th>' +
          '<th class="col-center">Hadir</th><th class="col-center">Alpa</th><th class="col-center">Sakit</th><th class="col-center">Izin</th>' +
          '<th class="col-center">Hari tercatat</th><th class="col-center">% Hadir</th>' +
        "</tr></thead><tbody id=\"rec-tbody\"><tr><td colspan=\"10\">" + loadingRow() + "</td></tr></tbody></table></div>" +
      "</div>";
  }

  function loadingRow() {
    return '<div class="table-loading"><span class="spinner"></span><span>Memuat rekap absensi…</span></div>';
  }

  function filteredStudents() {
    return U.sortStudents(state.students).filter(function (s) {
      if (state.kelas) return s.kelas === state.kelas;
      if (state.tingkat) return U.kelasTingkat(s.kelas) === Number(state.tingkat);
      return true;
    });
  }

  function computeRows() {
    var hariEfektif = state.semester ? Number(state.semester.hari_efektif) || 0 : 0;
    return filteredStudents().map(function (s) {
      var recs = state.recordsByStudent[s.id] || [];
      var hadir = 0, alpa = 0, sakit = 0, izin = 0;
      recs.forEach(function (r) {
        if (r.status === "masuk") hadir++;
        else if (r.keterangan === "alpa") alpa++;
        else if (r.keterangan === "sakit") sakit++;
        else if (r.keterangan === "izin") izin++;
      });
      var total = recs.length;
      // Dasar persentase: hari efektif semester (jika ada), minimal hari tercatat.
      var dasar = Math.max(hariEfektif, total);
      return {
        id: s.id,
        nama: s.nama,
        jenis_kelamin: s.jenis_kelamin,
        kelas: s.kelas,
        foto_path: s.foto_path,
        foto_bucket: s.foto_bucket,
        hadir: hadir,
        alpa: alpa,
        sakit: sakit,
        izin: izin,
        total: total,
        target: hariEfektif,
        dasar: dasar,
        persen: U.percent(hadir, dasar)
      };
    });
  }

  function renderTable() {
    var tbody = U.$("#rec-tbody", state.container);
    if (!tbody) return;
    if (state.loading) { tbody.innerHTML = '<tr><td colspan="10">' + loadingRow() + "</td></tr>"; return; }
    var rows = state.rows;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="10">' + U.emptyState("chart", "Belum ada data", "Belum ada siswa atau absensi pada periode ini.") + "</td></tr>";
    } else {
      tbody.innerHTML = rows.map(function (r, i) {
        return '<tr data-id="' + U.escape(r.id) + '">' +
          '<td class="col-no">' + (i + 1) + "</td>" +
          '<td><div class="student-cell">' + U.avatarHtml(r, "avatar-xs") +
            '<div class="student-cell-text"><strong>' + U.escape(r.nama) + "</strong></div></div></td>" +
          '<td class="col-center"><span class="badge badge-gender ' + (r.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(r.jenis_kelamin) + "</span></td>" +
          '<td class="col-center"><span class="class-pill">' + U.escape(r.kelas) + "</span></td>" +
          '<td class="col-center num-strong text-green" data-label="Hadir">' + r.hadir + "</td>" +
          '<td class="col-center num text-red" data-label="Alpa">' + r.alpa + "</td>" +
          '<td class="col-center num text-amber" data-label="Sakit">' + r.sakit + "</td>" +
          '<td class="col-center num text-blue" data-label="Izin">' + r.izin + "</td>" +
          '<td class="col-center num" data-label="Hari tercatat">' + r.total + (r.target ? '<small class="muted-sm"> / ' + r.target + "</small>" : "") + "</td>" +
          '<td class="col-center" data-label="% Hadir"><div class="percent-cell"><div class="percent-track"><div class="percent-fill" style="width:' + Math.min(100, r.persen) + '%"></div></div><span>' + r.persen + "%</span></div></td>" +
        "</tr>";
      }).join("") +
      '<tr class="total-row">' +
        '<td colspan="4">JUMLAH</td>' +
        '<td class="col-center">' + rows.reduce(function (a, r) { return a + r.hadir; }, 0) + "</td>" +
        '<td class="col-center">' + rows.reduce(function (a, r) { return a + r.alpa; }, 0) + "</td>" +
        '<td class="col-center">' + rows.reduce(function (a, r) { return a + r.sakit; }, 0) + "</td>" +
        '<td class="col-center">' + rows.reduce(function (a, r) { return a + r.izin; }, 0) + "</td>" +
        '<td class="col-center">' + rows.reduce(function (a, r) { return a + r.total; }, 0) + "</td>" +
        '<td class="col-center">' + U.percent(rows.reduce(function (a, r) { return a + r.hadir; }, 0), rows.reduce(function (a, r) { return a + r.dasar; }, 0)) + "%</td>" +
      "</tr>";
    }
    updateSummary();
  }

  function updateSummary() {
    var rows = state.rows;
    var hadir = rows.reduce(function (a, r) { return a + r.hadir; }, 0);
    var dasar = rows.reduce(function (a, r) { return a + r.dasar; }, 0);
    var tidak = rows.reduce(function (a, r) { return a + r.alpa + r.sakit + r.izin; }, 0);
    var set = function (sel, val) { var n = U.$(sel, state.container); if (n) n.textContent = val; };
    set("#rec-total-siswa", rows.length + " siswa");
    set("#rec-total-tidak", tidak);
    set("#rec-avg", U.percent(hadir, dasar) + "%");
    set("#rec-count", rows.length + " siswa" + (state.kelas ? " · " + state.kelas : state.tingkat ? " · Kelas " + U.TINGKAT_ROMAN[state.tingkat] : ""));

    var aktif = {};
    rows.forEach(function (r) { (state.recordsByStudent[r.id] || []).forEach(function (x) { aktif[x.tanggal] = true; }); });
    set("#rec-hari-tercatat", Object.keys(aktif).length);
    var note = U.$("#rec-hari-note", state.container);
    if (note) {
      note.textContent = state.semester
        ? U.SEMESTER_LABEL[state.semester.jenis] + " " + (state.year ? U.tahunAjaranLabel(state.year) : "")
        : "total periode";
    }
    var hariNode = U.$("#rec-hari-efektif", state.container);
    if (hariNode) hariNode.textContent = state.semester ? state.semester.hari_efektif : "–";

    var period = U.$("#rec-period", state.container);
    if (period) {
      period.textContent = state.mode === "semester" && state.semester
        ? "Periode " + U.formatDateID(state.semester.tanggal_mulai) + " – " + U.formatDateID(state.semester.tanggal_selesai)
        : "Periode " + U.formatDateID(state.from) + " – " + U.formatDateID(state.to);
    }
  }

  async function load() {
    var opt = activeOption();
    if (state.mode === "semester") {
      if (!opt) { U.toast("Belum ada semester. Atur tahun ajaran terlebih dahulu.", "warning"); return; }
      state.semester = opt.sem;
      state.year = opt.year;
      state.from = opt.sem.tanggal_mulai ? opt.sem.tanggal_mulai.slice(0, 10) : "";
      state.to = opt.sem.tanggal_selesai ? opt.sem.tanggal_selesai.slice(0, 10) : "";
    } else {
      state.semester = null;
      state.year = null;
    }
    if (!state.from || !state.to) { U.toast("Tanggal periode belum lengkap.", "warning"); return; }
    if (state.from > state.to) {
      U.toast("Tanggal awal tidak boleh melebihi tanggal akhir.", "warning");
      return;
    }
    var token = ++state.token;
    state.loading = true;
    state.rows = [];
    renderTable();
    try {
      var records = await API.getAttendanceRange(state.from, state.to, state.semester ? {
        academicYearId: state.semester.academic_year_id,
        semesterId: state.semester.id
      } : {});
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

  function exportRows() {
    return state.rows.map(function (r) {
      return {
        nama: r.nama,
        jenis_kelamin: r.jenis_kelamin,
        kelas: r.kelas,
        hadir: r.hadir,
        alpa: r.alpa,
        sakit: r.sakit,
        izin: r.izin,
        total: r.total,
        persen: r.persen
      };
    });
  }

  function doExport(kind) {
    var rows = exportRows();
    if (!rows.length) { U.toast("Tidak ada data untuk diekspor.", "warning"); return; }
    var meta = {
      from: state.from,
      to: state.to,
      kelas: state.kelas || (state.tingkat ? "Kelas " + U.TINGKAT_ROMAN[state.tingkat] : ""),
      hariEfektif: state.semester ? state.semester.hari_efektif : 0,
      semester: state.semester ? U.SEMESTER_LABEL[state.semester.jenis] : "",
      tahun: state.year ? U.tahunAjaranLabel(state.year) : "",
      tanggalTTD: U.todayISO()
    };
    try {
      if (kind === "excel") EX.recapExcel(rows, meta);
      else EX.recapPdf(rows, meta);
    } catch (err) {
      U.toast("Gagal membuat file: " + (err.message || err), "error");
    }
  }

  function bind(container) {
    U.$("#rec-mode", container).addEventListener("change", function (e) {
      state.mode = e.target.value;
      state.token++;
      container.innerHTML = shell();
      bind(container);
      load();
    });
    var semSel = U.$("#rec-semester", container);
    if (semSel) {
      semSel.addEventListener("change", function (e) {
        state.semesterId = e.target.value;
        state.token++;
        container.innerHTML = shell();
        bind(container);
        load();
      });
    }
    U.$("#rec-show", container).addEventListener("click", function () {
      state.from = U.$("#rec-from", container) ? U.$("#rec-from", container).value : state.from;
      state.to = U.$("#rec-to", container) ? U.$("#rec-to", container).value : state.to;
      load();
    });
    U.$("#rec-tingkat", container).addEventListener("change", function (e) {
      state.tingkat = e.target.value;
      state.kelas = "";
      state.rows = computeRows();
      renderTable();
    });
    U.$("#rec-kelas", container).addEventListener("change", function (e) {
      state.kelas = e.target.value;
      state.rows = computeRows();
      renderTable();
    });
    U.$("#rec-excel", container).addEventListener("click", function () { doExport("excel"); });
    U.$("#rec-pdf", container).addEventListener("click", function () { doExport("pdf"); });
  }

  function render(container) {
    state.container = container;
    state.mode = "semester";
    state.tingkat = "";
    state.kelas = "";
    state.students = (window.APP_STATE.students || []).slice();
    state.years = (window.APP_STATE.academicYears || []).slice();
    state.semesters = (window.APP_STATE.semesters || []).slice();
    state.recordsByStudent = {};
    state.rows = [];
    state.loading = false;
    state.token++;
    state.semesterId = window.APP_STATE.activeSemester ? window.APP_STATE.activeSemester.id : "";

    var opt = activeOption();
    state.from = opt && opt.sem.tanggal_mulai ? opt.sem.tanggal_mulai.slice(0, 10) : U.firstDayOfMonthISO();
    state.to = opt && opt.sem.tanggal_selesai ? opt.sem.tanggal_selesai.slice(0, 10) : U.todayISO();

    container.innerHTML = shell();
    bind(container);
    load();
  }

  window.Pages = window.Pages || {};
  window.Pages.recap = { render: render };
})();
