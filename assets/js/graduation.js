/* ============================================================
   Halaman Kelulusan & Sekolah Lanjutan
   ------------------------------------------------------------
   Rekapitulasi siswa kelas IX per tahun ajaran:
     - status lulus / tidak lulus,
     - sekolah lanjutan (SMA, MA, SMK, MAK, pesantren),
     - jalur masuk dan persentase kehadiran selama kelas IX,
     - ekspor Excel & PDF.
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    yearId: "",
    search: "",
    jenis: "",
    years: [],
    year: null,
    students: [],
    history: [],
    graduations: [],
    summary: {},
    attendance: {},
    activeSem: null,
    loading: false,
    token: 0
  };

  function studentById(id) {
    return state.students.filter(function (s) { return s.id === id; })[0] || null;
  }

  function kelas9For(studentId) {
    return state.history.filter(function (h) {
      return h.student_id === studentId && Number(h.tingkat) === 9;
    })[0] || null;
  }

  function rows() {
    var gByStudent = {};
    state.graduations.forEach(function (g) { gByStudent[g.student_id] = g; });

    // Semua siswa tingkat IX pada tahun ajaran ini.
    var ids = {};
    state.history.forEach(function (h) {
      if (Number(h.tingkat) === 9) ids[h.student_id] = true;
    });
    state.graduations.forEach(function (g) { ids[g.student_id] = true; });

    var q = state.search.trim().toLowerCase();

    return Object.keys(ids).map(function (id) {
      var s = studentById(id);
      if (!s) return null;
      var g = gByStudent[id] || null;
      var h = kelas9For(id);
      var a = state.attendance[id] || { hadir: 0, total: 0 };
      var dasar = Math.max(Number(state.activeSem ? state.activeSem.hari_efektif : 0), a.total);
      return {
        id: id,
        student: s,
        graduation: g,
        kelas: (h && h.kelas) || s.kelas,
        status: g ? g.status : (h ? h.status : "-"),
        sekolah_lanjutan: g ? g.sekolah_lanjutan || "" : "",
        jenis_sekolah: g ? g.jenis_sekolah || "" : "",
        jalur: g ? g.jalur || "" : "",
        kota_sekolah: g ? g.kota_sekolah || "" : "",
        hadir: a.hadir,
        total: a.total,
        persen: U.percent(a.hadir, dasar)
      };
    }).filter(Boolean).filter(function (r) {
      if (state.jenis && String(r.jenis_sekolah || "") !== state.jenis) return false;
      if (!q) return true;
      return String(r.student.nama).toLowerCase().indexOf(q) !== -1 ||
        String(r.sekolah_lanjutan || "").toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      return String(a.kelas).localeCompare(String(b.kelas), "id", { numeric: true }) ||
        String(a.student.nama).localeCompare(String(b.student.nama), "id");
    });
  }

  function statusBadge(r) {
    if (r.status === "lulus") return '<span class="badge badge-success">Lulus</span>';
    if (r.status === "tidak_lulus") return '<span class="badge badge-alpa">Tidak lulus</span>';
    if (r.status === "mengulang") return '<span class="badge badge-sakit">Mengulang</span>';
    if (r.status === "pindah" || r.status === "keluar") return '<span class="badge badge-neutral">' + U.capitalize(r.status) + "</span>";
    return '<span class="badge badge-neutral">Belum dicatat</span>';
  }

  function shell() {
    var all = rows();
    var lulus = all.filter(function (r) { return r.status === "lulus"; }).length;
    var lanjut = all.filter(function (r) { return r.sekolah_lanjutan; }).length;
    var noLanjut = all.filter(function (r) { return !r.sekolah_lanjutan; }).length;
    var sudahSekolah = all.filter(function (r) { return r.sekolah_lanjutan; }).length;

    return '<div class="page-head">' +
        '<div><h1>Kelulusan &amp; Sekolah Lanjutan</h1><p>Rekapitulasi siswa kelas IX: status kelulusan dan sekolah lanjutan yang ditempuh.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="gr-excel">' + U.icon("download", 17) + "<span>Excel</span></button>" +
          '<button type="button" class="btn btn-secondary" id="gr-pdf">' + U.icon("printer", 17) + "<span>PDF</span></button>" +
        "</div>" +
      "</div>" +
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field"><label for="gr-year">Tahun ajaran kelulusan</label><select id="gr-year">' +
            state.years.map(function (y) {
              return '<option value="' + U.escape(y.id) + '"' + (y.id === state.yearId ? " selected" : "") + ">" + U.escape(U.tahunAjaranLabel(y)) + (y.is_aktif === false ? " (arsip)" : "") + "</option>";
            }).join("") +
          "</select></div>" +
          '<div class="field grow"><label for="gr-search">Cari siswa / sekolah</label><div class="input-with-icon">' + U.icon("search", 17) + '<input type="search" id="gr-search" value="' + U.escape(state.search) + '" placeholder="Nama siswa atau sekolah…" autocomplete="off"></div></div>' +
          '<div class="field"><label for="gr-jenis">Jenis sekolah</label><select id="gr-jenis">' +
            ["", "SMA", "MA", "SMK", "MAK", "Pondok Pesantren", "Lainnya"].map(function (j) {
              return '<option value="' + U.escape(j) + '"' + (state.jenis === j ? " selected" : "") + ">" + (j || "Semua jenis") + "</option>";
            }).join("") +
          "</select></div>" +
        "</div>" +
      "</div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Siswa kelas IX</span><strong>' + all.length + "</strong><small>siswa</small></div>" +
        '<div class="summary-card tone-green"><span class="summary-label">Lulus</span><strong>' + lulus + "</strong><small>siswa</small></div>" +
        '<div class="summary-card tone-blue"><span class="summary-label">Sudah tercatat lanjut</span><strong>' + sudahSekolah + "</strong><small>siswa</small></div>" +
        '<div class="summary-card tone-amber"><span class="summary-label">Belum tercatat</span><strong>' + noLanjut + "</strong><small>siswa</small></div>" +
      "</div>" +
      '<div class="dash-grid-2">' +
        distributionCard("Sekolah lanjutan", (state.summary && state.summary.sekolah) || []) +
        distributionCard("Jenis sekolah", (state.summary && state.summary.jalur) || [], true) +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count" id="gr-count">' + all.length + " siswa</span></div>" +
          '<div class="table-toolbar-right"><span class="table-muted">' + (state.activeSem ? "Kehadiran dari " + state.activeSem.hari_efektif + " hari efektif " + U.SEMESTER_LABEL[state.activeSem.jenis] : "Semester berjalan belum diatur") + "</span></div></div>" +
        '<div class="table-wrap"><table class="data-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Kelas IX</th><th class="col-center">Status</th>' +
          '<th>Sekolah Lanjutan</th><th class="col-center">Jenis</th><th class="col-center">Jalur</th><th class="col-center">% Hadir</th><th class="col-actions">Aksi</th>' +
        "</tr></thead><tbody id=\"gr-tbody\">" + bodyRows(all) + "</tbody></table></div>" +
      "</div>";
  }

  function distributionCard(title, items, jalur) {
    var total = items.reduce(function (a, b) { return a + Number(b.jumlah || 0); }, 0);
    return '<div class="card"><div class="card-head"><div><h3>' + U.escape(title) + "</h3><p>" + (jalur ? "Jalur masuk sekolah" : "Tujuan sekolah siswa kelas IX") + "</p></div></div>" +
      '<div class="dist-list">' +
        (items.length ? items.map(function (it) {
          var label = jalur ? it.jalur : it.sekolah;
          var pct = total ? Math.round((Number(it.jumlah) / total) * 100) : 0;
          return '<div class="class-bar-row"><div class="class-bar-label"><span>' + U.escape(label) + "</span><small>" + it.jumlah + " siswa</small></div>" +
            '<div class="class-bar-track"><div class="class-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="class-bar-pct">' + pct + "%</div></div>";
        }).join("") : '<div class="mini-empty">' + U.icon("clipboard", 24) + "<p>Belum ada data.</p></div>") +
      "</div></div>";
  }

  function bodyRows(list) {
    if (state.loading) {
      return '<tr><td colspan="10"><div class="table-loading"><span class="spinner"></span><span>Memuat rekap kelulusan…</span></div></td></tr>';
    }
    if (!list.length) {
      return '<tr><td colspan="10">' + U.emptyState("clipboard", "Belum ada data kelulusan", "Tandai siswa kelas IX sebagai lulus melalui halaman Kelas VII · VIII · IX atau tombol Catat di sini.") + "</td></tr>";
    }
    return list.map(function (r, i) {
      return '<tr data-id="' + U.escape(r.id) + '">' +
        '<td class="col-no">' + (i + 1) + "</td>" +
        '<td><div class="student-cell">' + U.avatarHtml(r.student, "avatar-xs") +
          '<div class="student-cell-text"><strong>' + U.escape(r.student.nama) + "</strong>" + (r.student.nis ? '<small>NIS ' + U.escape(r.student.nis) + "</small>" : "") + "</div></div></td>" +
        '<td class="col-center"><span class="badge badge-gender ' + (r.student.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(r.student.jenis_kelamin) + "</span></td>" +
        '<td class="col-center"><span class="class-pill">' + U.escape(r.kelas || "-") + "</span></td>" +
        '<td class="col-center">' + statusBadge(r) + "</td>" +
        '<td>' + (r.sekolah_lanjutan
          ? '<strong>' + U.escape(r.sekolah_lanjutan) + "</strong>" + (r.kota_sekolah ? '<small class="muted-sm">' + U.escape(r.kota_sekolah) + "</small>" : "")
          : '<span class="muted-sm">— belum diisi —</span>') + "</td>" +
        '<td class="col-center">' + (r.jenis_sekolah ? '<span class="badge badge-info">' + U.escape(r.jenis_sekolah) + "</span>" : "—") + "</td>" +
        '<td class="col-center muted-sm">' + U.escape(r.jalur || "—") + "</td>" +
        '<td class="col-center"><div class="percent-cell"><div class="percent-track"><div class="percent-fill" style="width:' + Math.min(100, r.persen) + '%"></div></div><span>' + r.persen + "%</span></div></td>" +
        '<td class="col-actions">' + (API.isAdmin()
          ? '<div class="action-group"><button type="button" class="icon-btn" data-act="edit" title="Edit kelulusan">' + U.icon("edit", 16) + "</button>" +
            (r.graduation ? '<button type="button" class="icon-btn icon-danger" data-act="delete" title="Hapus catatan">' + U.icon("trash", 16) + "</button>" : "") + "</div>"
          : "") + "</td>" +
      "</tr>";
    }).join("");
  }

  async function load() {
    var token = ++state.token;
    state.loading = true;
    try {
      var res = await Promise.all([
        API.getGraduations(state.yearId, true),
        API.getStudentHistory(state.yearId),
        API.getStudents(true),
        API.getGraduationSummary(state.yearId),
        API.getSemesters(true)
      ]);
      if (token !== state.token) return;
      state.graduations = res[0] || [];
      state.history = res[1] || [];
      state.students = res[2] || [];
      state.summary = res[3] || {};
      var sems = res[4] || [];
      state.activeSem = sems.filter(function (s) {
        return s.academic_year_id === state.yearId && s.status === "aktif";
      })[0] || null;

      if (state.activeSem && state.activeSem.tanggal_mulai && state.activeSem.tanggal_selesai) {
        var att = await API.getAttendanceRange(state.activeSem.tanggal_mulai, state.activeSem.tanggal_selesai, {
          academicYearId: state.yearId,
          semesterId: state.activeSem.id
        });
        if (token !== state.token) return;
        var map = {};
        (att || []).forEach(function (a) {
          var m = map[a.student_id] || (map[a.student_id] = { hadir: 0, total: 0 });
          m.total++;
          if (a.status === "masuk") m.hadir++;
        });
        state.attendance = map;
      } else {
        state.attendance = {};
      }

      state.loading = false;
      if (token !== state.token) return;
      state.container.innerHTML = shell();
      bind(state.container);
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      U.toast(API.errorMessage(err), "error");
      var tbody = U.$("#gr-tbody", state.container);
      if (tbody) tbody.innerHTML = '<tr><td colspan="10"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(API.errorMessage(err)) + "</span></div></td></tr>";
    }
  }

  function openForm(r) {
    var g = r && r.graduation ? r.graduation : {};
    var statusVal = g.status || (r && r.status === "lulus" ? "lulus" : "lulus");
    var body = '<form class="form-stack">' +
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Catatan kelulusan <strong>" + U.escape(r ? r.student.nama : "") + "</strong> · " + U.escape(state.year ? U.tahunAjaranLabel(state.year) : "") + "</span></div>" +
      '<div class="form-grid form-grid-2">' +
        '<div class="field"><label for="gf-status">Status</label><select id="gf-status">' +
          [["lulus", "Lulus"], ["tidak_lulus", "Tidak lulus"], ["mengulang", "Mengulang"]].map(function (o) {
            return '<option value="' + o[0] + '"' + (statusVal === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field"><label for="gf-tanggal">Tanggal lulus</label><input type="date" id="gf-tanggal" value="' + U.escape((g.tanggal_lulus || ((state.year ? state.year.tahun_awal + 1 : new Date().getFullYear()) + "-06-30")).slice(0, 10)) + '"></div>' +
        '<div class="field span-2"><label for="gf-sekolah">Sekolah lanjutan</label><input type="text" id="gf-sekolah" value="' + U.escape(g.sekolah_lanjutan || "") + '" placeholder="Contoh: MAN 1 Trenggalek"></div>' +
        '<div class="field"><label for="gf-jenis">Jenis sekolah</label><select id="gf-jenis">' +
          ["", "SMA", "MA", "SMK", "MAK", "Pondok Pesantren", "Lainnya"].map(function (j) {
            return '<option value="' + U.escape(j) + '"' + ((g.jenis_sekolah || "") === j ? " selected" : "") + ">" + (j || "— Pilih —") + "</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field"><label for="gf-jalur">Jalur masuk</label><input type="text" id="gf-jalur" value="' + U.escape(g.jalur || "") + '" placeholder="Zonasi / Prestasi / Afirmasi"></div>' +
        '<div class="field"><label for="gf-kota">Kota sekolah</label><input type="text" id="gf-kota" value="' + U.escape(g.kota_sekolah || "Trenggalek") + '"></div>' +
        '<div class="field"><label for="gf-npsn">NPSN</label><input type="text" id="gf-npsn" value="' + U.escape(g.npsn || "") + '"></div>' +
        '<div class="field span-2"><label for="gf-catatan">Catatan</label><input type="text" id="gf-catatan" value="' + U.escape(g.catatan || "") + '"></div>' +
      "</div></form>";

    U.modal({
      title: "Catatan Kelulusan",
      subtitle: r ? r.student.nama : "",
      size: "md",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Simpan",
          class: "btn-primary",
          icon: "save",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              var statusVal = U.$("#gf-status", bodyEl).value;
              await API.saveGraduation({
                student_id: r.id,
                academic_year_id: state.yearId,
                status: statusVal,
                sekolah_lanjutan: U.$("#gf-sekolah", bodyEl).value,
                jenis_sekolah: U.$("#gf-jenis", bodyEl).value,
                jalur: U.$("#gf-jalur", bodyEl).value,
                kota_sekolah: U.$("#gf-kota", bodyEl).value,
                npsn: U.$("#gf-npsn", bodyEl).value,
                catatan: U.$("#gf-catatan", bodyEl).value,
                tanggal_lulus: U.$("#gf-tanggal", bodyEl).value
              });
              var h = kelas9For(r.id);
              await API.saveStudentHistory({
                student_id: r.id,
                academic_year_id: state.yearId,
                tingkat: 9,
                class_group_id: h ? h.class_group_id : null,
                kelas: r.kelas || (h ? h.kelas : r.student.kelas),
                status: statusVal === "lulus" ? "lulus" : "tetap"
              });
              U.toast("Catatan kelulusan disimpan.", "success");
              close();
              await load();
            } catch (err) {
              U.toast(API.errorMessage(err), "error");
            } finally {
              if (btn) U.buttonLoading(btn, false);
            }
          }
        }
      ]
    });
  }

  async function remove(r) {
    var ok = await U.confirm("Hapus catatan kelulusan " + r.student.nama + "? Status kelas IX yang sudah lulus tidak otomatis berubah.", {
      title: "Hapus Catatan", confirmLabel: "Ya, Hapus", danger: true
    });
    if (!ok) return;
    try {
      await API.deleteGraduation(r.graduation.id);
      U.toast("Catatan dihapus.", "success");
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  function exportRows() {
    return rows().map(function (r) {
      return {
        nama: r.student.nama,
        jenis_kelamin: r.student.jenis_kelamin,
        kelas: r.kelas,
        status: r.status,
        sekolah_lanjutan: r.sekolah_lanjutan,
        jenis_sekolah: r.jenis_sekolah,
        jalur: r.jalur,
        kota_sekolah: r.kota_sekolah,
        hadir: r.hadir,
        total: r.total,
        persen: r.persen
      };
    });
  }

  function doExport(kind) {
    var list = exportRows();
    if (!list.length) { U.toast("Tidak ada data untuk diekspor.", "warning"); return; }
    var meta = {
      tahun: state.year ? U.tahunAjaranLabel(state.year) : "",
      jenis: state.jenis,
      hariEfektif: state.activeSem ? state.activeSem.hari_efektif : 0
    };
    try {
      if (kind === "excel") EX.graduationExcel(list, meta);
      else EX.graduationPdf(list, meta);
    } catch (err) {
      U.toast("Gagal membuat file: " + (err.message || err), "error");
    }
  }

  function bind(container) {
    U.$("#gr-year", container).addEventListener("change", function (e) {
      state.yearId = e.target.value;
      state.year = state.years.filter(function (y) { return y.id === state.yearId; })[0] || null;
      load();
    });
    U.$("#gr-search", container).addEventListener("input", U.debounce(function (e) {
      state.search = e.target.value || "";
      paintRows();
    }, 160));
    U.$("#gr-jenis", container).addEventListener("change", function (e) {
      state.jenis = e.target.value;
      paintRows();
    });
    U.$("#gr-excel", container).addEventListener("click", function () { doExport("excel"); });
    U.$("#gr-pdf", container).addEventListener("click", function () { doExport("pdf"); });

    U.on(U.$("#gr-tbody", container), "click", "[data-act]", function (e, btn) {
      var tr = btn.closest("tr[data-id]");
      if (!tr) return;
      var r = rows().filter(function (x) { return x.id === tr.dataset.id; })[0];
      if (!r) return;
      if (btn.dataset.act === "edit") openForm(r);
      else if (btn.dataset.act === "delete") remove(r);
    });
  }

  function paintRows() {
    var tbody = U.$("#gr-tbody", state.container);
    if (!tbody) return;
    var list = rows();
    tbody.innerHTML = bodyRows(list);
    var count = U.$("#gr-count", state.container);
    if (count) count.textContent = list.length + " siswa";
  }

  function render(container) {
    state.container = container;
    state.years = (window.APP_STATE.academicYears || []).slice();
    state.search = "";
    state.jenis = "";
    state.loading = true;
    var active = window.APP_STATE.activeYear;
    state.yearId = active ? active.id : (state.years[0] ? state.years[0].id : "");
    state.year = state.years.filter(function (y) { return y.id === state.yearId; })[0] || null;

    if (!state.yearId) {
      container.innerHTML = '<div class="card setup-card">' + U.emptyState("calendar", "Belum ada tahun ajaran", "Tambahkan tahun ajaran terlebih dahulu.") + "</div>";
      return;
    }
    container.innerHTML = shell();
    bind(container);
    load();
  }

  window.Pages = window.Pages || {};
  window.Pages.graduation = { render: render };
})();
