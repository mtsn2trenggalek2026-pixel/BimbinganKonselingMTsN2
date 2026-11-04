/* ============================================================
   Halaman Kelas VII · VIII · IX
   ------------------------------------------------------------
   Menampilkan rombel dan siswa per tingkat pada tahun ajaran
   terpilih, termasuk:
     - tambah siswa / rombel,
     - kenaikan kelas otomatis (VII -> VIII -> IX),
     - penandaan lulus kelas IX,
     - rekap kehadiran semester berjalan (dibanding hari efektif).
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    yearId: "",
    tingkat: 7,
    search: "",
    years: [],
    year: null,
    semesters: [],
    classes: [],
    history: [],
    students: [],
    attendance: {},
    activeSem: null,
    loading: false,
    token: 0
  };

  function hashParam(name) {
    var m = (window.location.hash || "").match(new RegExp(name + "=([^&]+)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function classesFor(tingkat) {
    return state.classes
      .filter(function (c) { return Number(c.tingkat) === Number(tingkat) && c.is_aktif !== false; })
      .sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama), "id", { numeric: true }); });
  }

  function historyFor(tingkat) {
    return state.history.filter(function (h) { return Number(h.tingkat) === Number(tingkat); });
  }

  function studentsOf(tingkat) {
    var ids = {};
    historyFor(tingkat).forEach(function (h) { ids[h.student_id] = h; });
    var list = state.students.filter(function (s) { return ids[s.id]; }).map(function (s) {
      var h = ids[s.id];
      return Object.assign({}, s, {
        _history: h,
        kelas: h.kelas || s.kelas,
        status_kelas: h.status
      });
    });
    return U.sortStudents(list);
  }

  function kehadiranFor(studentId) {
    var a = state.attendance[studentId] || { hadir: 0, total: 0, alpa: 0, sakit: 0, izin: 0 };
    var target = state.activeSem ? Number(state.activeSem.hari_efektif) || 0 : 0;
    var dasar = Math.max(target, a.total);
    return {
      hadir: a.hadir,
      alpa: a.alpa,
      sakit: a.sakit,
      izin: a.izin,
      total: a.total,
      target: target,
      dasar: dasar,
      persen: U.percent(a.hadir, dasar)
    };
  }

  function statusBadge(status) {
    var map = {
      aktif: ["badge-info", "Aktif"],
      naik: ["badge-success", "Naik kelas"],
      tetap: ["badge-info", "Tetap"],
      lulus: ["badge-success", "Lulus"],
      pindah: ["badge-neutral", "Pindah"],
      keluar: ["badge-neutral", "Keluar"]
    };
    var v = map[status] || ["badge-neutral", status || "-"];
    return '<span class="badge ' + v[0] + '">' + U.escape(v[1]) + "</span>";
  }

  function levelCard(t) {
    var clsList = classesFor(t);
    var list = studentsOf(t);
    var ids = {};
    list.forEach(function (s) { ids[s.id] = s; });
    return '<div class="level-card' + (Number(state.tingkat) === t ? " is-selected" : "") + '">' +
      '<div class="level-head"><span class="level-roman">' + U.TINGKAT_ROMAN[t] + "</span>" +
        "<div><strong>Kelas " + U.TINGKAT_ROMAN[t] + "</strong><small>" + list.length + " siswa · " + clsList.length + " rombel</small></div></div>" +
      '<div class="level-body">' +
        clsList.map(function (c) {
          var n = list.filter(function (s) { return s.kelas === c.nama; }).length;
          return '<div class="level-row"><span>' + U.escape(c.nama) + "</span><strong>" + n + " siswa</strong></div>";
        }).join("") || '<p class="muted-sm">Belum ada rombel.</p>' +
      "</div></div>";
  }

  function renderShell() {
    var yearLabel = state.year ? U.tahunAjaranLabel(state.year) : "Tahun ajaran";
    var semesterLabel = state.activeSem ? U.SEMESTER_LABEL[state.activeSem.jenis] : "Belum ada semester berjalan";
    var list = studentsOf(state.tingkat);
    var q = state.search.trim().toLowerCase();
    var filtered = list.filter(function (s) {
      return !q || String(s.nama).toLowerCase().indexOf(q) !== -1 || String(s.nis || "").indexOf(q) !== -1;
    });
    var clsList = classesFor(state.tingkat);
    var totalHadir = 0, totalDasar = 0;
    list.forEach(function (s) {
      var k = kehadiranFor(s.id);
      totalHadir += k.hadir; totalDasar += k.dasar;
    });
    var hariMasuk = list.length ? Math.max.apply(null, list.map(function (s) { return kehadiranFor(s.id).total; })) : 0;

    return '<div class="page-head">' +
        '<div><h1>Kelas VII · VIII · IX</h1><p>Kelola siswa per tingkat pada tahun ajaran terpilih. Siswa kelas IX dapat ditandai lulus dan dicatat sekolah lanjutannya.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="lvl-excel">' + U.icon("download", 17) + "<span>Excel</span></button>" +
          (API.isAdmin() ? '<button type="button" class="btn btn-primary" id="lvl-add">' + U.icon("plus", 17) + "<span>Tambah Siswa</span></button>" : "") +
        "</div>" +
      "</div>" +
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field"><label for="lvl-year">Tahun ajaran</label><select id="lvl-year">' +
            state.years.map(function (y) {
              return '<option value="' + U.escape(y.id) + '"' + (y.id === state.yearId ? " selected" : "") + ">" + U.escape(U.tahunAjaranLabel(y)) + (y.is_aktif === false ? " (arsip)" : "") + "</option>";
            }).join("") + "</select></div>" +
          '<div class="field grow"><label for="lvl-search">Cari siswa</label><div class="input-with-icon">' + U.icon("search", 17) + '<input type="search" id="lvl-search" value="' + U.escape(state.search) + '" placeholder="Nama atau NIS…" autocomplete="off"></div></div>' +
          (API.isAdmin() ? '<div class="field field-action"><button type="button" class="btn btn-soft" id="lvl-promote">' + U.icon("arrowRight", 17) + "<span>Kenaikan Kelas</span></button></div>" : "") +
        "</div>" +
      "</div>" +
      '<div class="levels-overview">' + levelCard(7) + levelCard(8) + levelCard(9) + "</div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Tahun ajaran</span><strong class="stat-value-sm">' + U.escape(yearLabel) + "</strong><small>" + U.escape(semesterLabel) + "</small></div>" +
        '<div class="summary-card tone-green"><span class="summary-label">Siswa kelas ' + U.TINGKAT_ROMAN[state.tingkat] + '</span><strong id="lvl-total">' + list.length + "</strong><small>siswa</small></div>" +
        '<div class="summary-card tone-blue"><span class="summary-label">Hari efektif</span><strong id="lvl-hari">' + (state.activeSem ? state.activeSem.hari_efektif : 0) + "</strong><small>hari masuk semester</small></div>" +
        '<div class="summary-card tone-amber"><span class="summary-label">Kehadiran tingkat</span><strong id="lvl-persen">' + U.percent(totalHadir, totalDasar) + '%</strong><small>' + hariMasuk + " hari tercatat</small></div>" +
      "</div>" +
      '<div class="tabs" id="lvl-tabs">' +
        [7, 8, 9].map(function (t) {
          return '<button type="button" class="tab' + (Number(state.tingkat) === t ? " active" : "") + '" data-tingkat="' + t + '">Kelas ' + U.TINGKAT_ROMAN[t] +
            ' <span class="tab-count">' + historyFor(t).length + "</span></button>";
        }).join("") +
        '<div class="tabs-right"><span class="table-muted">' + U.escape(clsList.length + " rombel") + "</span>" +
          (API.isAdmin() ? '<button type="button" class="btn btn-ghost btn-sm" id="lvl-add-class">' + U.icon("plus", 15) + "<span>Rombel</span></button>" : "") +
        "</div>" +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count" id="lvl-count">' + filtered.length + " siswa</span></div>" +
          '<div class="table-toolbar-right"><span class="table-muted">' + U.escape(state.activeSem ? "Persentase dari " + state.activeSem.hari_efektif + " hari efektif " + U.SEMESTER_LABEL[state.activeSem.jenis] : "Semester berjalan belum diatur") + "</span></div></div>" +
        '<div class="table-wrap"><table class="data-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Kelas</th><th class="col-center">Status</th>' +
          '<th class="col-center">Hadir</th><th class="col-center">Alpa</th><th class="col-center">Sakit</th><th class="col-center">Izin</th><th class="col-center">% Hadir</th><th class="col-actions">Aksi</th>' +
        "</tr></thead><tbody id=\"lvl-tbody\">" + bodyRows(filtered) + "</tbody></table></div>" +
      "</div>";
  }

  function bodyRows(list) {
    if (state.loading) {
      return '<tr><td colspan="11"><div class="table-loading"><span class="spinner"></span><span>Memuat data…</span></div></td></tr>';
    }
    if (!list.length) {
      return '<tr><td colspan="11">' + U.emptyState("users", "Belum ada siswa", "Tambahkan siswa atau lakukan kenaikan kelas dari tahun ajaran sebelumnya.") + "</td></tr>";
    }
    return list.map(function (s, i) {
      var k = kehadiranFor(s.id);
      return '<tr data-id="' + U.escape(s.id) + '">' +
        '<td class="col-no">' + (i + 1) + "</td>" +
        '<td><div class="student-cell">' + U.avatarHtml(s, "avatar-xs") +
          '<div class="student-cell-text"><strong>' + U.escape(s.nama) + "</strong>" + (s.nis ? '<small>NIS ' + U.escape(s.nis) + "</small>" : "") + "</div></div></td>" +
        '<td class="col-center"><span class="badge badge-gender ' + (s.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(s.jenis_kelamin) + "</span></td>" +
        '<td class="col-center"><span class="class-pill">' + U.escape(s.kelas) + "</span></td>" +
        '<td class="col-center">' + statusBadge(s.status_kelas) + "</td>" +
        '<td class="col-center num-strong text-green">' + k.hadir + "</td>" +
        '<td class="col-center num text-red">' + k.alpa + "</td>" +
        '<td class="col-center num text-amber">' + k.sakit + "</td>" +
        '<td class="col-center num text-blue">' + k.izin + "</td>" +
        '<td class="col-center"><div class="percent-cell"><div class="percent-track"><div class="percent-fill" style="width:' + Math.min(100, k.persen) + '%"></div></div><span>' + k.persen + "%</span></div></td>" +
        '<td class="col-actions"><div class="action-group">' +
          (Number(state.tingkat) === 9 && API.isAdmin()
            ? '<button type="button" class="icon-btn" data-act="graduate" title="Catat kelulusan">' + U.icon("checkCircle", 16) + "</button>"
            : "") +
          '<button type="button" class="icon-btn" data-act="move" title="Pindah rombel">' + U.icon("edit", 16) + "</button>" +
        "</div></td>" +
      "</tr>";
    }).join("");
  }

  function paintRows() {
    var tbody = U.$("#lvl-tbody", state.container);
    if (!tbody) return;
    var q = state.search.trim().toLowerCase();
    var list = studentsOf(state.tingkat).filter(function (s) {
      return !q || String(s.nama).toLowerCase().indexOf(q) !== -1 || String(s.nis || "").indexOf(q) !== -1;
    });
    tbody.innerHTML = bodyRows(list);
    var count = U.$("#lvl-count", state.container);
    if (count) count.textContent = list.length + " siswa";
  }

  async function load() {
    var token = ++state.token;
    state.loading = true;
    try {
      var res = await Promise.all([
        API.getClassGroups(state.yearId, true),
        API.getStudentHistory(state.yearId),
        API.getStudents(true),
        API.getSemesters(true)
      ]);
      if (token !== state.token) return;
      state.classes = res[0] || [];
      state.history = res[1] || [];
      state.students = res[2] || [];
      state.semesters = res[3] || [];
      state.activeSem = state.semesters.filter(function (s) {
        return s.academic_year_id === state.yearId && s.status === "aktif";
      })[0] || null;

      var sem = state.activeSem;
      if (sem && sem.tanggal_mulai && sem.tanggal_selesai) {
        var att = await API.getAttendanceRange(sem.tanggal_mulai, sem.tanggal_selesai, {
          academicYearId: state.yearId,
          semesterId: sem.id
        });
        if (token !== state.token) return;
        var map = {};
        (att || []).forEach(function (r) {
          var m = map[r.student_id] || (map[r.student_id] = { hadir: 0, alpa: 0, sakit: 0, izin: 0, total: 0 });
          m.total++;
          if (r.status === "masuk") m.hadir++;
          else if (m[r.keterangan] !== undefined) m[r.keterangan]++;
        });
        state.attendance = map;
      } else {
        state.attendance = {};
      }
      state.loading = false;
      if (token !== state.token) return;
      state.container.innerHTML = renderShell();
      bind(state.container);
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      U.toast(API.errorMessage(err), "error");
      var tbody = U.$("#lvl-tbody", state.container);
      if (tbody) tbody.innerHTML = '<tr><td colspan="11"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(API.errorMessage(err)) + "</span></div></td></tr>";
    }
  }

  function openAddStudent() {
    var clsList = classesFor(state.tingkat);
    var body = '<form class="form-stack" autocomplete="off">' +
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Siswa ditambahkan ke <strong>" + U.escape(state.year ? U.tahunAjaranLabel(state.year) : "") + " · Kelas " + U.TINGKAT_ROMAN[state.tingkat] + "</strong>. Banyak siswa sekaligus dapat diimpor lewat Data Siswa → Import.</span></div>" +
      '<div class="form-grid form-grid-2">' +
        '<div class="field span-2"><label for="ad-nama">Nama lengkap <span class="req">*</span></label><input type="text" id="ad-nama" required></div>' +
        '<div class="field"><label for="ad-jk">Jenis kelamin</label><select id="ad-jk"><option value="L">Laki-laki (L)</option><option value="P">Perempuan (P)</option></select></div>' +
        '<div class="field"><label for="ad-nis">NIS</label><input type="text" id="ad-nis"></div>' +
        '<div class="field"><label for="ad-kelas">Rombel</label><select id="ad-kelas">' +
          clsList.map(function (c) { return '<option value="' + U.escape(c.id) + '">' + U.escape(c.nama) + "</option>"; }).join("") +
          (clsList.length ? "" : '<option value="">(Belum ada rombel — tambahkan rombel dulu)</option>') +
        "</select></div>" +
        '<div class="field"><label for="ad-nourut">Nomor urut</label><input type="number" min="1" id="ad-nourut"></div>' +
      "</div></form>";

    U.modal({
      title: "Tambah Siswa Kelas " + U.TINGKAT_ROMAN[state.tingkat],
      subtitle: state.year ? U.tahunAjaranLabel(state.year) : "",
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
            var nama = U.$("#ad-nama", bodyEl).value.trim();
            var classId = U.$("#ad-kelas", bodyEl).value;
            if (!nama) { U.toast("Nama siswa wajib diisi.", "warning"); return; }
            var cls = clsList.filter(function (c) { return c.id === classId; })[0];
            if (!cls) { U.toast("Tambahkan rombel untuk tingkat ini terlebih dahulu.", "warning"); return; }
            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              var student = await API.createStudent({
                nama: nama,
                jenis_kelamin: U.$("#ad-jk", bodyEl).value,
                kelas: cls.nama,
                nis: U.$("#ad-nis", bodyEl).value.trim() || null,
                no_urut: U.$("#ad-nourut", bodyEl).value ? Number(U.$("#ad-nourut", bodyEl).value) : null,
                tingkat: state.tingkat,
                angkatan: (state.year ? state.year.tahun_awal : new Date().getFullYear()) - (state.tingkat - 7)
              });
              await API.saveStudentHistory({
                student_id: student.id,
                academic_year_id: state.yearId,
                tingkat: state.tingkat,
                class_group_id: cls.id,
                kelas: cls.nama,
                status: "aktif"
              });
              U.toast("Siswa ditambahkan ke " + cls.nama + ".", "success");
              close();
              await App.refreshStudents();
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

  function openClassForm(c) {
    var isEdit = Boolean(c);
    var body = '<form class="form-stack" autocomplete="off">' +
      '<div class="form-grid form-grid-2">' +
        '<div class="field"><label for="cl-tingkat">Tingkat</label><select id="cl-tingkat">' +
          [7, 8, 9].map(function (t) { return '<option value="' + t + '"' + (Number(c && c.tingkat || state.tingkat) === t ? " selected" : "") + ">Kelas " + U.TINGKAT_ROMAN[t] + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label for="cl-nama">Nama rombel <span class="req">*</span></label><input type="text" id="cl-nama" value="' + U.escape(c ? c.nama : "") + '" placeholder="Contoh: VII-A"></div>' +
        '<div class="field span-2"><label for="cl-wali">Wali kelas</label><input type="text" id="cl-wali" value="' + U.escape(c && c.wali_kelas ? c.wali_kelas : "") + '"></div>' +
      "</div></form>";

    U.modal({
      title: isEdit ? "Ubah Rombel" : "Tambah Rombel",
      size: "sm",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Simpan",
          class: "btn-primary",
          icon: "save",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var nama = U.$("#cl-nama", bodyEl).value.trim().toUpperCase();
            if (!nama) { U.toast("Nama rombel wajib diisi.", "warning"); return; }
            try {
              await API.saveClassGroup({
                id: isEdit ? c.id : "",
                academic_year_id: state.yearId,
                tingkat: Number(U.$("#cl-tingkat", bodyEl).value),
                nama: nama,
                wali_kelas: U.$("#cl-wali", bodyEl).value.trim()
              });
              U.toast("Rombel disimpan.", "success");
              close();
              await load();
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
          }
        }
      ]
    });
  }

  function openMove(student) {
    var clsList = classesFor(state.tingkat);
    var body = '<form class="form-stack">' +
      '<div class="field"><label for="mv-kelas">Rombel baru untuk ' + U.escape(student.nama) + "</label><select id=\"mv-kelas\">" +
        clsList.map(function (c) { return '<option value="' + U.escape(c.id) + '"' + (c.nama === student.kelas ? " selected" : "") + ">" + U.escape(c.nama) + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="field"><label for="mv-status">Status kelas</label><select id="mv-status">' +
        ["aktif", "naik", "tetap", "lulus", "pindah", "keluar"].map(function (s) {
          return '<option value="' + s + '"' + (student._history && student._history.status === s ? " selected" : "") + ">" + U.capitalize(s) + "</option>";
        }).join("") +
      "</select></div></form>";

    U.modal({
      title: "Pindah / Ubah Status",
      subtitle: student.nama + " · " + student.kelas,
      size: "sm",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Simpan",
          class: "btn-primary",
          icon: "save",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var cls = clsList.filter(function (x) { return x.id === U.$("#mv-kelas", bodyEl).value; })[0];
            if (!cls) return;
            try {
              await API.saveStudentHistory({
                student_id: student.id,
                academic_year_id: state.yearId,
                tingkat: state.tingkat,
                class_group_id: cls.id,
                kelas: cls.nama,
                status: U.$("#mv-status", bodyEl).value
              });
              await API.updateStudent(student.id, { kelas: cls.nama, tingkat: state.tingkat });
              U.toast("Data kelas diperbarui.", "success");
              close();
              await App.refreshStudents();
              await load();
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
          }
        }
      ]
    });
  }

  function openPromote() {
    var years = state.years.slice();
    var sorted = years.slice().sort(function (a, b) { return b.tahun_awal - a.tahun_awal; });
    var fromYear = sorted.filter(function (y) { return y.id === state.yearId; })[0];
    var body = '<div class="form-stack">' +
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Kenaikan kelas memindahkan siswa <strong>VII → VIII</strong> dan <strong>VIII → IX</strong>. Riwayat kelas lama tetap tersimpan per tahun ajaran.</span></div>" +
      '<div class="form-grid form-grid-2">' +
        '<div class="field"><label for="pr-from">Dari tahun ajaran</label><select id="pr-from">' +
          sorted.map(function (y) { return '<option value="' + U.escape(y.id) + '"' + (y.id === state.yearId ? " selected" : "") + ">" + U.escape(U.tahunAjaranLabel(y)) + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label for="pr-to">Ke tahun ajaran</label><select id="pr-to">' +
          sorted.map(function (y) {
            return '<option value="' + U.escape(y.id) + '"' + (y.id === state.yearId ? " disabled" : "") + ">" + U.escape(U.tahunAjaranLabel(y)) + (y.is_aktif === false ? " (arsip)" : "") + "</option>";
          }).join("") +
          '<option value="new" selected>+ Tahun ajaran baru' + (fromYear ? " (" + fromYear.tahun_awal + "/" + (fromYear.tahun_awal + 1) + " → " + (fromYear.tahun_awal + 1) + "/" + (fromYear.tahun_awal + 2) + ")" : "") + "</option>" +
        "</select></div>" +
      "</div>" +
      '<label class="check-label"><input type="checkbox" id="pr-lulus"> Tandai siswa kelas IX sebagai LULUS</label>' +
      '<p class="form-hint">Jika dicentang, siswa kelas IX tahun asal ditandai lulus dan muncul di menu Kelulusan &amp; Lanjutan. Jika tidak, mereka tetap dicatat di kelas IX.</p>' +
      "</div>";

    U.modal({
      title: "Kenaikan Kelas",
      subtitle: "Pindahkan rombel secara otomatis dengan akhiran yang sama (VIII-A → IX-A).",
      size: "md",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Proses Kenaikan",
          class: "btn-primary",
          icon: "arrowRight",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var fromId = U.$("#pr-from", bodyEl).value;
            var toVal = U.$("#pr-to", bodyEl).value;
            if (!fromId || !toVal) { U.toast("Pilih tahun ajaran asal dan tujuan.", "warning"); return; }
            if (fromId === toVal) { U.toast("Tahun ajaran asal dan tujuan harus berbeda.", "warning"); return; }

            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              var toId = toVal;
              if (toVal === "new") {
                var from = state.years.filter(function (y) { return y.id === fromId; })[0];
                toId = await API.saveAcademicYear({ tahun_awal: from.tahun_awal + 1 }, null, null);
              }
              var res = await API.promoteStudents(fromId, toId, U.$("#pr-lulus", bodyEl).checked);
              U.toast("Kenaikan selesai: " + (res.naik || 0) + " siswa naik, " + (res.lulus || 0) + " lulus.", "success", 5000);
              close();
              await App.refreshAcademic();
              state.years = window.APP_STATE.academicYears || state.years;
              state.yearId = toId;
              state.year = state.years.filter(function (y) { return y.id === toId; })[0] || null;
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

  function openGraduate(student) {
    var body = '<form class="form-stack">' +
      '<div class="form-grid form-grid-2">' +
        '<div class="field span-2"><label for="gr-sekolah">Sekolah lanjutan</label><input type="text" id="gr-sekolah" placeholder="Contoh: MAN 1 Trenggalek"></div>' +
        '<div class="field"><label for="gr-jenis">Jenis</label><select id="gr-jenis">' +
          ["", "SMA", "MA", "SMK", "MAK", "Pondok Pesantren", "Lainnya"].map(function (j) {
            return '<option value="' + U.escape(j) + '">' + (j || "— Pilih —") + "</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field"><label for="gr-kota">Kota sekolah</label><input type="text" id="gr-kota" value="Trenggalek"></div>' +
        '<div class="field"><label for="gr-jalur">Jalur masuk</label><input type="text" id="gr-jalur" placeholder="Zonasi / Prestasi / Afirmasi"></div>' +
        '<div class="field"><label for="gr-npsn">NPSN (opsional)</label><input type="text" id="gr-npsn"></div>' +
      "</div>" +
      '<p class="form-hint">Siswa akan ditandai lulus pada ' + U.escape(state.year ? U.tahunAjaranLabel(state.year) : "") + ".</p></div>";

    U.modal({
      title: "Catat Kelulusan",
      subtitle: student.nama + " · " + student.kelas,
      size: "md",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Simpan Kelulusan",
          class: "btn-primary",
          icon: "checkCircle",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            try {
              await API.saveGraduation({
                student_id: student.id,
                academic_year_id: state.yearId,
                status: "lulus",
                sekolah_lanjutan: U.$("#gr-sekolah", bodyEl).value,
                jenis_sekolah: U.$("#gr-jenis", bodyEl).value,
                kota_sekolah: U.$("#gr-kota", bodyEl).value,
                jalur: U.$("#gr-jalur", bodyEl).value,
                npsn: U.$("#gr-npsn", bodyEl).value
              });
              await API.saveStudentHistory({
                student_id: student.id,
                academic_year_id: state.yearId,
                tingkat: 9,
                class_group_id: student._history ? student._history.class_group_id : null,
                kelas: student.kelas,
                status: "lulus"
              });
              U.toast("Kelulusan dicatat. Lanjutkan di menu Kelulusan & Lanjutan.", "success");
              close();
              await load();
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
          }
        }
      ]
    });
  }

  function exportExcel() {
    var list = studentsOf(state.tingkat);
    if (!list.length) { U.toast("Tidak ada data untuk diekspor.", "warning"); return; }
    var rows = list.map(function (s) {
      var k = kehadiranFor(s.id);
      return {
        nama: s.nama,
        jenis_kelamin: s.jenis_kelamin,
        kelas: s.kelas,
        nis: s.nis || "",
        hadir: k.hadir,
        alpa: k.alpa,
        sakit: k.sakit,
        izin: k.izin,
        total: k.total,
        persen: k.persen
      };
    });
    if (EX.levelExcel) {
      EX.levelExcel(rows, {
        tahun: state.year ? U.tahunAjaranLabel(state.year) : "",
        semester: state.activeSem ? U.SEMESTER_LABEL[state.activeSem.jenis] : "",
        hariEfektif: state.activeSem ? state.activeSem.hari_efektif : 0,
        tingkat: state.tingkat
      });
    }
  }

  function bind(container) {
    var yearSel = U.$("#lvl-year", container);
    if (yearSel) {
      yearSel.addEventListener("change", function (e) {
        state.yearId = e.target.value;
        state.year = state.years.filter(function (y) { return y.id === state.yearId; })[0] || null;
        load();
      });
    }
    var search = U.$("#lvl-search", container);
    if (search) search.addEventListener("input", U.debounce(function (e) {
      state.search = e.target.value || "";
      paintRows();
    }, 160));

    U.on(container, "click", "[data-tingkat]", function (e, btn) {
      state.tingkat = Number(btn.dataset.tingkat);
      container.innerHTML = renderShell();
      bind(container);
    });

    var addBtn = U.$("#lvl-add", container);
    if (addBtn) addBtn.addEventListener("click", openAddStudent);
    var addClass = U.$("#lvl-add-class", container);
    if (addClass) addClass.addEventListener("click", function () { openClassForm(null); });
    var promote = U.$("#lvl-promote", container);
    if (promote) promote.addEventListener("click", openPromote);
    U.$("#lvl-excel", container).addEventListener("click", exportExcel);

    U.on(U.$("#lvl-tbody", container), "click", "[data-act]", function (e, btn) {
      var tr = btn.closest("tr[data-id]");
      if (!tr) return;
      var student = studentsOf(state.tingkat).filter(function (s) { return s.id === tr.dataset.id; })[0];
      if (!student) return;
      if (btn.dataset.act === "graduate") openGraduate(student);
      else openMove(student);
    });
  }

  function render(container) {
    state.container = container;
    state.years = (window.APP_STATE.academicYears || []).slice();
    state.search = "";
    var q = hashParam("tahun");
    var active = window.APP_STATE.activeYear;
    state.yearId = (q && state.years.some(function (y) { return y.id === q; })) ? q : (active ? active.id : (state.years[0] ? state.years[0].id : ""));
    state.year = state.years.filter(function (y) { return y.id === state.yearId; })[0] || null;
    state.loading = true;
    state.tingkat = 7;
    state.classes = [];
    state.history = [];
    state.students = (window.APP_STATE.students || []).slice();
    state.attendance = {};

    if (!state.yearId) {
      container.innerHTML = '<div class="card setup-card">' + U.emptyState("calendar", "Belum ada tahun ajaran", "Tambahkan tahun ajaran terlebih dahulu.") + "</div>";
      return;
    }
    container.innerHTML = renderShell();
    bind(container);
    load();
  }

  window.Pages = window.Pages || {};
  window.Pages.level = { render: render };
})();
