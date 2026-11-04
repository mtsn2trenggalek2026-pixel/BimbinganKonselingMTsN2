/* ============================================================
   Halaman Tahun Ajaran & Semester
   ------------------------------------------------------------
   Satu tahun ajaran = Semester Ganjil + Semester Genap.
   Setiap semester menyimpan jumlah hari efektif (hari masuk)
   sebagai dasar persentase kehadiran.
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    years: [],
    semesters: [],
    showArchived: false,
    loading: false,
    token: 0
  };

  function semestersOf(yearId) {
    return state.semesters
      .filter(function (s) { return s.academic_year_id === yearId; })
      .sort(function (a, b) { return a.urutan - b.urutan; });
  }

  function statusBadge(status) {
    if (status === "aktif") return '<span class="badge badge-success">Semester berjalan</span>';
    if (status === "selesai") return '<span class="badge badge-neutral">Selesai</span>';
    return '<span class="badge badge-info">Belum dimulai</span>';
  }

  function semesterCard(year, sem, readOnly) {
    var prevDone = sem.urutan === 1 ? year.is_aktif !== false : (semestersOf(year.id)[0] || {}).status === "selesai";
    var canStart = sem.status === "draft" && prevDone && !readOnly;
    var canFinish = sem.status === "aktif" && !readOnly;

    return '<div class="sem-card ' + (sem.status === "aktif" ? "is-active" : "") + '">' +
      '<div class="sem-head"><div><strong>' + U.escape(U.SEMESTER_LABEL[sem.jenis]) + "</strong>" +
        '<small>' + U.escape(U.formatDateID(sem.tanggal_mulai)) + " – " + U.escape(U.formatDateID(sem.tanggal_selesai)) + "</small></div>" +
        statusBadge(sem.status) + "</div>" +
      '<div class="sem-grid">' +
        '<div class="sem-stat"><span>Hari efektif</span><strong>' + (sem.hari_efektif || 0) + " hari</strong>" +
          (readOnly ? "" : '<button type="button" class="link-btn" data-act="edit-sem" data-id="' + U.escape(sem.id) + '">Ubah jadwal &amp; hari</button>') +
        "</div>" +
        '<div class="sem-stat"><span>Rentang</span><strong>' + U.rangeDays(sem.tanggal_mulai, sem.tanggal_selesai) + " hari kalender</strong><small>Mulai " + U.escape(U.formatDateID(sem.tanggal_mulai)) + "</small></div>" +
      "</div>" +
      '<div class="sem-actions">' +
        (canStart ? '<button type="button" class="btn btn-primary btn-sm" data-act="start-sem" data-id="' + U.escape(sem.id) + '">' + U.icon("arrowRight", 16) + "<span>Mulai semester ini</span></button>" : "") +
        (canFinish ? '<button type="button" class="btn btn-secondary btn-sm" data-act="finish-sem" data-id="' + U.escape(sem.id) + '">' + U.icon("checkCircle", 16) + "<span>Selesaikan &amp; lanjut</span></button>" : "") +
        (sem.status === "selesai" ? '<span class="sem-note">' + U.icon("checkCircle", 15) + " Semester telah selesai</span>" : "") +
        (!canStart && sem.status === "draft" && !readOnly ? '<span class="sem-note muted">Selesaikan semester ganjil terlebih dahulu.</span>' : "") +
        (readOnly ? "" : '<button type="button" class="btn btn-ghost btn-sm sem-delete" data-act="delete-sem" data-id="' + U.escape(sem.id) + '">' + U.icon("trash", 15) + "<span>Hapus semester</span></button>") +
      "</div>" +
    "</div>";
  }

  function yearCard(y) {
    var sems = semestersOf(y.id);
    var archived = y.is_aktif === false;
    var editable = !archived && API.isAdmin();
    return '<div class="card year-card ' + (archived ? "is-archived" : "") + '">' +
      '<div class="year-head">' +
        '<div class="year-title">' +
          '<span class="year-mark">' + U.escape(String(y.tahun_awal).slice(2)) + "</span>" +
          "<div><h3>" + U.escape(U.tahunAjaranLabel(y)) + "</h3>" +
            '<p>' + U.escape(U.formatDateID(y.tanggal_mulai)) + " – " + U.escape(U.formatDateID(y.tanggal_selesai)) + "</p></div>" +
        "</div>" +
        '<div class="year-flags">' +
          (archived ? '<span class="badge badge-neutral">Arsip</span>' : '<span class="badge badge-success">Aktif</span>') +
          '<a class="btn btn-ghost btn-sm" href="#/tingkat?tahun=' + encodeURIComponent(y.id) + '">' + U.icon("book", 16) + "<span>Kelas</span></a>" +
          (editable ? '<button type="button" class="btn btn-ghost btn-sm" data-act="archive-year" data-id="' + U.escape(y.id) + '">' + U.icon("edit", 16) + "<span>Ubah</span></button>" : "") +
          (editable ? '<button type="button" class="btn btn-ghost btn-sm btn-delete" data-act="delete-year" data-id="' + U.escape(y.id) + '">' + U.icon("trash", 16) + "<span>Hapus</span></button>" : "") +
        "</div>" +
      "</div>" +
      '<div class="sem-row">' +
        (sems.length ? sems.map(function (s) { return semesterCard(y, s, !editable); }).join("") :
          '<div class="sem-empty">Semester belum dibuat.</div>') +
      "</div>" +
    "</div>";
  }

  function shell() {
    var years = state.years.filter(function (y) {
      return state.showArchived || y.is_aktif !== false;
    });

    return '<div class="page-head">' +
        '<div><h1>Tahun Ajaran &amp; Semester</h1><p>Setiap tahun ajaran terdiri dari <strong>Semester Ganjil</strong> dan <strong>Semester Genap</strong>. Isi jumlah hari masuk (hari efektif) per semester untuk menghitung persentase kehadiran.</p></div>' +
        '<div class="page-actions">' +
          '<label class="check-label"><input type="checkbox" id="year-archived"' + (state.showArchived ? " checked" : "") + '> Tampilkan arsip</label>' +
          '<button type="button" class="btn btn-secondary" id="year-archive-old">' + U.icon("clock", 17) + "<span>Arsipkan &gt; 5 tahun</span></button>" +
          '<button type="button" class="btn btn-ghost" id="year-diag" title="Periksa apakah fungsi hapus sudah ada di database">' + U.icon("checkCircle", 17) + "<span>Periksa Database</span></button>" +
          '<button type="button" class="btn btn-primary" id="year-add">' + U.icon("plus", 17) + "<span>Tahun Ajaran Baru</span></button>" +
        "</div>" +
      "</div>" +
      '<div class="notice notice-info">' + U.icon("info", 18) +
        "<span>Satu tahun ajaran berjalan <strong>Juli – Juni</strong>: Jul–Des = Semester Ganjil, Jan–Jun = Semester Genap. Data 5 tahun terakhir tetap tersimpan; tahun yang lebih lama otomatis diarsipkan (tidak dihapus).</span></div>" +
      '<div id="year-list" class="year-list">' +
        (state.loading ? loadingBlock() : (years.length ? years.map(yearCard).join("") : U.emptyState("calendar", "Belum ada tahun ajaran", "Tambahkan tahun ajaran pertama untuk memulai."))) +
      "</div>";
  }

  function loadingBlock() {
    return '<div class="card"><div class="table-loading"><span class="spinner"></span><span>Memuat tahun ajaran…</span></div></div>';
  }

  function paint() {
    if (!state.container) return;
    var list = U.$("#year-list", state.container);
    if (list) {
      var years = state.years.filter(function (y) {
        return state.showArchived || y.is_aktif !== false;
      });
      list.innerHTML = state.loading ? loadingBlock() :
        (years.length ? years.map(yearCard).join("") : U.emptyState("calendar", "Belum ada tahun ajaran", "Tambahkan tahun ajaran pertama untuk memulai."));
    }
  }

  async function load() {
    var token = ++state.token;
    state.loading = true;
    paint();
    try {
      var res = await Promise.all([
        API.getAcademicYears(true),
        API.getSemesters(true)
      ]);
      if (token !== state.token) return;
      state.years = res[0] || [];
      state.semesters = res[1] || [];
      state.loading = false;
      paint();
      await App.refreshAcademic();
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      paint();
      U.toast(API.errorMessage(err), "error");
    }
  }

  function semDefaults(year) {
    var awal = Number(year && year.tahun_awal) || new Date().getFullYear();
    return {
      ganjil: { tanggal_mulai: awal + "-07-15", tanggal_selesai: awal + "-12-31", hari_efektif: 90 },
      genap: { tanggal_mulai: awal + 1 + "-01-01", tanggal_selesai: awal + 1 + "-06-30", hari_efektif: 90 }
    };
  }

  function openYearForm(year, sems) {
    var isEdit = Boolean(year);
    var y = year || { tahun_awal: new Date().getFullYear(), nama: "", tanggal_mulai: "", tanggal_selesai: "" };
    var defaults = semDefaults(y);
    var ganjil = (sems && sems[0]) || defaults.ganjil;
    var genap = (sems && sems[1]) || defaults.genap;

    function semBlock(key, label, sem, awalHari) {
      return '<fieldset class="sem-fieldset"><legend>' + label + "</legend>" +
        '<div class="form-grid form-grid-2">' +
          '<div class="field"><label for="sem-' + key + '-mulai">Tanggal mulai</label><input type="date" id="sem-' + key + '-mulai" value="' + U.escape((sem.tanggal_mulai || awalHari[0] || "").slice(0, 10)) + '"></div>' +
          '<div class="field"><label for="sem-' + key + '-selesai">Tanggal selesai</label><input type="date" id="sem-' + key + '-selesai" value="' + U.escape((sem.tanggal_selesai || awalHari[1] || "").slice(0, 10)) + '"></div>' +
          '<div class="field"><label for="sem-' + key + '-hari">Jumlah hari masuk (efektif)</label><input type="number" min="1" max="366" id="sem-' + key + '-hari" value="' + (sem.hari_efektif || 90) + '"><span class="form-hint">Dasar persentase kehadiran semester ini.</span></div>' +
        "</div></fieldset>";
    }

    var body = '<form id="year-form" class="form-stack" autocomplete="off">' +
      '<div class="form-grid form-grid-2">' +
        '<div class="field"><label for="yf-awal">Tahun awal <span class="req">*</span></label><input type="number" id="yf-awal" min="2000" max="2100" value="' + (y.tahun_awal || "") + '"' + (isEdit ? " disabled" : "") + '><span class="form-hint">Contoh 2026 = tahun ajaran 2026/2027.</span></div>' +
        '<div class="field"><label for="yf-nama">Nama tahun ajaran</label><input type="text" id="yf-nama" value="' + U.escape(y.nama || "") + '" placeholder="Tahun Ajaran 2026/2027"></div>' +
        '<div class="field"><label for="yf-mulai">Berlaku mulai</label><input type="date" id="yf-mulai" value="' + U.escape((y.tanggal_mulai || defaults.ganjil.tanggal_mulai).slice(0, 10)) + '"></div>' +
        '<div class="field"><label for="yf-selesai">Berlaku sampai</label><input type="date" id="yf-selesai" value="' + U.escape((y.tanggal_selesai || defaults.genap.tanggal_selesai).slice(0, 10)) + '"></div>' +
      "</div>" +
      semBlock("ganjil", "Semester Ganjil", ganjil, [defaults.ganjil.tanggal_mulai, defaults.ganjil.tanggal_selesai]) +
      semBlock("genap", "Semester Genap", genap, [defaults.genap.tanggal_mulai, defaults.genap.tanggal_selesai]) +
      '<div class="field"><label for="yf-catatan">Catatan</label><input type="text" id="yf-catatan" value="' + U.escape(y.catatan || "") + '" placeholder="Opsional"></div>' +
      "</form>";

    if (isEdit && API.isAdmin()) {
      body += '<div class="form-divider"></div><button type="button" class="btn btn-danger btn-sm" id="yf-archive">' + U.icon("clock", 16) + "<span>Arsipkan tahun ajaran ini (nonaktif)</span></button>" +
        '<p class="form-hint">Data tetap tersimpan dan dapat ditampilkan kembali lewat "Tampilkan arsip".</p>';
    }

    U.modal({
      title: isEdit ? "Ubah Tahun Ajaran" : "Tahun Ajaran Baru",
      subtitle: isEdit ? U.tahunAjaranLabel(y) : "Otomatis dibuatkan Semester Ganjil dan Semester Genap.",
      size: "lg",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: isEdit ? "Simpan Perubahan" : "Simpan Tahun Ajaran",
          class: "btn-primary",
          icon: "save",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var payload = {
              id: isEdit ? y.id : "",
              tahun_awal: Number(U.$("#yf-awal", bodyEl).value),
              nama: U.$("#yf-nama", bodyEl).value.trim() || (isEdit ? y.nama : ""),
              tanggal_mulai: U.$("#yf-mulai", bodyEl).value,
              tanggal_selesai: U.$("#yf-selesai", bodyEl).value,
              catatan: U.$("#yf-catatan", bodyEl).value.trim()
            };
            if (!payload.tahun_awal) { U.toast("Tahun awal wajib diisi.", "warning"); return; }

            var g = {
              tanggal_mulai: U.$("#sem-ganjil-mulai", bodyEl).value,
              tanggal_selesai: U.$("#sem-ganjil-selesai", bodyEl).value,
              hari_efektif: Number(U.$("#sem-ganjil-hari", bodyEl).value),
              status: (ganjil && ganjil.status) || "draft"
            };
            var n = {
              tanggal_mulai: U.$("#sem-genap-mulai", bodyEl).value,
              tanggal_selesai: U.$("#sem-genap-selesai", bodyEl).value,
              hari_efektif: Number(U.$("#sem-genap-hari", bodyEl).value),
              status: (genap && genap.status) || "draft"
            };

            if (g.tanggal_mulai && g.tanggal_selesai && g.tanggal_selesai < g.tanggal_mulai) {
              U.toast("Tanggal selesai semester ganjil lebih awal dari tanggal mulai.", "warning"); return;
            }
            if (n.tanggal_mulai && n.tanggal_selesai && n.tanggal_selesai < n.tanggal_mulai) {
              U.toast("Tanggal selesai semester genap lebih awal dari tanggal mulai.", "warning"); return;
            }

            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              await API.saveAcademicYear(payload, g, n);
              U.toast(isEdit ? "Tahun ajaran diperbarui." : "Tahun ajaran dan kedua semester dibuat.", "success");
              close();
              await load();
            } catch (err) {
              U.toast(API.errorMessage(err), "error");
            } finally {
              if (btn) U.buttonLoading(btn, false);
            }
          }
        }
      ],
      onMount: function (bodyEl) {
        var archiveBtn = U.$("#yf-archive", bodyEl);
        if (archiveBtn) {
          archiveBtn.addEventListener("click", async function () {
            var ok = await U.confirm("Arsipkan tahun ajaran " + U.tahunAjaranLabel(y) + "? Data tidak dihapus dan masih dapat dilihat lewat filter arsip.", {
              title: "Arsipkan Tahun Ajaran", confirmLabel: "Ya, Arsipkan", danger: true
            });
            if (!ok) return;
            try {
              await API.updateAcademicYear(y.id, { is_aktif: false });
              U.toast("Tahun ajaran diarsipkan.", "success");
              U.$(".modal-close", document).click();
              await load();
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
          });
        }
      }
    });
  }

  function openSemesterForm(sem) {
    var body = '<form class="form-stack" autocomplete="off">' +
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Jumlah hari masuk ditentukan panitia/madrasah untuk semester ini. Absensi tidak dibatasi jumlahnya; angka ini dipakai sebagai pembagi persentase kehadiran.</span></div>" +
      '<div class="form-grid form-grid-2">' +
        '<div class="field"><label for="sf-mulai">Tanggal mulai</label><input type="date" id="sf-mulai" value="' + U.escape((sem.tanggal_mulai || "").slice(0, 10)) + '"></div>' +
        '<div class="field"><label for="sf-selesai">Tanggal selesai</label><input type="date" id="sf-selesai" value="' + U.escape((sem.tanggal_selesai || "").slice(0, 10)) + '"></div>' +
        '<div class="field"><label for="sf-hari">Hari masuk (efektif)</label><input type="number" id="sf-hari" min="1" max="366" value="' + (sem.hari_efektif || 90) + '"></div>' +
      "</div></form>";

    U.modal({
      title: "Atur " + (U.SEMESTER_LABEL[sem.jenis] || "Semester"),
      subtitle: "Jadwal dan jumlah hari masuk.",
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
            var patch = {
              tanggal_mulai: U.$("#sf-mulai", bodyEl).value,
              tanggal_selesai: U.$("#sf-selesai", bodyEl).value,
              hari_efektif: Number(U.$("#sf-hari", bodyEl).value)
            };
            if (!patch.tanggal_mulai || !patch.tanggal_selesai) { U.toast("Tanggal mulai dan selesai wajib diisi.", "warning"); return; }
            if (patch.tanggal_selesai < patch.tanggal_mulai) { U.toast("Tanggal selesai lebih awal dari tanggal mulai.", "warning"); return; }
            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              await API.updateSemester(sem.id, patch);
              U.toast("Semester diperbarui.", "success");
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

  async function startSemester(sem) {
    var year = state.years.filter(function (y) { return y.id === sem.academic_year_id; })[0] || {};
    var ok = await U.confirm(
      "Mulai " + U.SEMESTER_LABEL[sem.jenis] + " " + U.tahunAjaranLabel(year) + "? Semester ini akan menjadi semester berjalan dan absensi baru dicatat pada semester ini.",
      { title: "Mulai Semester", confirmLabel: "Ya, Mulai", danger: false }
    );
    if (!ok) return;
    try {
      await API.setActiveSemester(sem.id);
      U.toast("Semester berjalan diperbarui.", "success");
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  async function finishSemester(sem) {
    var year = state.years.filter(function (y) { return y.id === sem.academic_year_id; })[0] || {};
    var next = sem.jenis === "ganjil"
      ? "Semester Genap " + U.tahunAjaranLabel(year)
      : "Semester Ganjil tahun ajaran berikutnya";
    var ok = await U.confirm(
      "Selesaikan " + U.SEMESTER_LABEL[sem.jenis] + " " + U.tahunAjaranLabel(year) + "? Semester ditandai selesai dan dilanjutkan ke " + next + ". Absensi lama tetap tersimpan.",
      { title: "Selesaikan Semester", confirmLabel: "Ya, Selesaikan", danger: false }
    );
    if (!ok) return;
    try {
      var res = await API.finishSemester(sem.id);
      var nextLabel = res && res.jenis ? U.SEMESTER_LABEL[res.jenis] : "semester berikutnya";
      U.toast("Semester selesai. Lanjut ke " + nextLabel + ".", "success", 5000);
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  async function deleteSemester(sem) {
    var year = state.years.filter(function (y) { return y.id === sem.academic_year_id; })[0] || {};
    var ok = await U.confirm(
      "Hapus " + U.SEMESTER_LABEL[sem.jenis] + " " + U.tahunAjaranLabel(year) + " secara permanen? " +
      "Riwayat absensi semester ini tetap tersimpan, tetapi tidak lagi terhubung ke semester.",
      { title: "Hapus Semester", confirmLabel: "Ya, Hapus", danger: true }
    );
    if (!ok) return;
    try {
      var res = await API.deleteSemester(sem.id);
      U.toast("Semester dihapus." + (res && res.absensi_dilepas ? " " + res.absensi_dilepas + " catatan absensi dipertahankan." : ""), "success", 5000);
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error", 8000);
    }
  }

  async function deleteYear(y) {
    var sems = semestersOf(y.id);
    var ok = await U.confirm(
      "Hapus tahun ajaran " + U.tahunAjaranLabel(y) + " secara permanen? " +
      sems.length + " semester, rombel, riwayat kelas, dan catatan kelulusan tahun ini ikut terhapus. " +
      "Riwayat absensi dan laporan kerja tetap disimpan.",
      { title: "Hapus Tahun Ajaran", confirmLabel: "Ya, Hapus", danger: true }
    );
    if (!ok) return;
    try {
      var res = await API.deleteAcademicYear(y.id);
      U.toast("Tahun ajaran dihapus." + (res && res.absensi_dilepas ? " " + res.absensi_dilepas + " catatan absensi dipertahankan." : ""), "success", 5000);
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error", 8000);
    }
  }

  async function archiveOld() {
    var ok = await U.confirm(
      "Arsipkan tahun ajaran yang lebih tua dari 5 tahun? Data tidak dihapus, hanya menjadi nonaktif dan tetap bisa dibuka lewat \"Tampilkan arsip\".",
      { title: "Arsipkan Data Lama", confirmLabel: "Ya, Arsipkan", danger: true }
    );
    if (!ok) return;
    try {
      var n = await API.archiveOldYears();
      U.toast((n || 0) + " tahun ajaran diarsipkan.", "success");
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  function bind(container) {
    U.$("#year-add", container).addEventListener("click", function () { openYearForm(null, null); });
    U.$("#year-archived", container).addEventListener("change", function (e) {
      state.showArchived = e.target.checked;
      paint();
    });
    U.$("#year-archive-old", container).addEventListener("click", archiveOld);

    // Diagnosa: pastikan fungsi hapus tersedia di database.
    var diag = U.$("#year-diag", container);
    if (diag) {
      diag.addEventListener("click", async function () {
        U.buttonLoading(diag, true);
        try {
          var ok = await API.checkDeleteFunctions();
          U.toast(ok.delete_semester && ok.delete_academic_year
            ? "Fungsi hapus tahun ajaran & semester tersedia."
            : "Fungsi belum tersedia. Jalankan supabase/update-hapus-tahun-semester.sql di SQL Editor.", 
            ok.delete_semester && ok.delete_academic_year ? "success" : "error", 9000);
        } catch (err) {
          U.toast("Gagal memeriksa: " + API.errorMessage(err), "error", 8000);
        } finally {
          U.buttonLoading(diag, false);
        }
      });
    }

    U.on(container, "click", "[data-act]", async function (e, btn) {
      var act = btn.dataset.act;
      var id = btn.dataset.id;
      var year = state.years.filter(function (y) { return y.id === id; })[0];
      if (act === "delete-year" && year) {
        deleteYear(year);
      } else if (act === "delete-sem") {
        var delSem = state.semesters.filter(function (s) { return s.id === id; })[0];
        if (delSem) deleteSemester(delSem);
      } else if (act === "edit-sem") {
        var sem = state.semesters.filter(function (s) { return s.id === id; })[0];
        if (sem) openSemesterForm(sem);
      } else if (act === "start-sem") {
        var s1 = state.semesters.filter(function (s) { return s.id === id; })[0];
        if (s1) startSemester(s1);
      } else if (act === "finish-sem") {
        var s2 = state.semesters.filter(function (s) { return s.id === id; })[0];
        if (s2) finishSemester(s2);
      } else if (act === "archive-year" && year) {
        openYearForm(year, semestersOf(year.id));
      }
    });
  }

  function render(container) {
    state.container = container;
    state.showArchived = false;
    state.loading = true;
    container.innerHTML = shell();
    bind(container);
    load();
  }

  window.Pages = window.Pages || {};
  window.Pages.years = { render: render };
})();
