/* ============================================================
   Halaman Kelas VII · VIII · IX
   ------------------------------------------------------------
   Tampilan dirancang agar mudah dipakai guru:
     - tab tingkat yang jelas + ringkasan per rombel,
     - filter rombel berupa tombol (bukan dropdown sempit),
     - tabel ringkas (nama, L/P, NIS, hadir, alpa/sakit/izin,
       persentase) yang menyesuaikan layar HP,
     - menu aksi per siswa (pindah rombel, catat lulus).
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    yearId: "",
    tingkat: 7,
    kelas: "",
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

  /* ---------------- BANTU ---------------- */

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
    var byId = {};
    historyFor(tingkat).forEach(function (h) { byId[h.student_id] = h; });
    var list = state.students.filter(function (s) { return byId[s.id]; }).map(function (s) {
      var h = byId[s.id];
      return Object.assign({}, s, {
        _history: h,
        kelas: h.kelas || s.kelas,
        status_kelas: h.status
      });
    });
    return U.sortStudents(list);
  }

  function visibleStudents() {
    var q = state.search.trim().toLowerCase();
    return studentsOf(state.tingkat).filter(function (s) {
      if (state.kelas && s.kelas !== state.kelas) return false;
      if (!q) return true;
      return String(s.nama).toLowerCase().indexOf(q) !== -1 ||
        String(s.nis || "").toLowerCase().indexOf(q) !== -1;
    });
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

  function tone(persen) {
    if (persen >= 90) return "good";
    if (persen >= 75) return "warn";
    return "bad";
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
    var v = map[status] || ["badge-neutral", status || "Aktif"];
    return '<span class="badge ' + v[0] + '">' + U.escape(v[1]) + "</span>";
  }

  function tingkatStats(t) {
    var list = studentsOf(t);
    var hadir = 0, dasar = 0;
    list.forEach(function (s) {
      var k = kehadiranFor(s.id);
      hadir += k.hadir;
      dasar += k.dasar;
    });
    return {
      siswa: list.length,
      rombel: classesFor(t).length,
      persen: U.percent(hadir, dasar)
    };
  }

  /* ---------------- RENDER ---------------- */

  function levelCard(t) {
    var st = tingkatStats(t);
    var cls = classesFor(t);
    var selected = Number(state.tingkat) === t;
    return '<button type="button" class="lvl-card' + (selected ? " is-selected" : "") + '" data-tingkat="' + t + '">' +
      '<span class="lvl-roman">' + U.TINGKAT_ROMAN[t] + "</span>" +
      '<span class="lvl-info">' +
        "<strong>Kelas " + U.TINGKAT_ROMAN[t] + "</strong>" +
        "<small>" + st.siswa + " siswa · " + st.rombel + " rombel</small>" +
        '<span class="lvl-bar"><i style="width:' + Math.min(100, st.persen) + '%"></i></span>' +
      "</span>" +
      '<span class="lvl-pct">' + (st.siswa ? st.persen + "%" : "—") + "</span>" +
    "</button>";
  }

  function rombelSelect() {
    var cls = classesFor(state.tingkat);
    return '<select id="lvl-kelas" title="Filter rombel">' +
      '<option value="">Semua rombel</option>' +
      cls.map(function (c) {
        return '<option value="' + U.escape(c.nama) + '"' + (state.kelas === c.nama ? " selected" : "") + ">" + U.escape(c.nama) + "</option>";
      }).join("") +
    "</select>";
  }

  function rowHtml(s, i) {
    var k = kehadiranFor(s.id);
    return '<tr data-id="' + U.escape(s.id) + '">' +
      '<td class="col-no">' + (i + 1) + "</td>" +
      '<td class="cell-name"><div class="student-cell">' + U.avatarHtml(s, "avatar-xs") +
        '<div class="student-cell-text"><strong>' + U.escape(s.nama) + "</strong>" +
        '<small class="cell-sub">' + U.escape(s.kelas) + (s.nis ? " · NIS " + U.escape(s.nis) : "") + "</small></div></div></td>" +
      '<td class="col-center cell-jk"><span class="badge badge-gender ' + (s.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(s.jenis_kelamin) + "</span></td>" +
      '<td class="col-center cell-status">' + statusBadge(s.status_kelas) + "</td>" +
      '<td class="col-center cell-hadir"><span class="num-strong text-green">' + k.hadir + "</span>" +
        (k.target ? '<small class="cell-sub">/ ' + k.target + " hari</small>" : "") + "</td>" +
      '<td class="col-center cell-alpha"><span class="num text-red">' + k.alpa + "</span>" +
        '<small class="cell-sub">S ' + k.sakit + " · I " + k.izin + "</small></td>" +
      '<td class="col-center cell-pct">' +
        '<span class="pill-pct ' + tone(k.persen) + '">' + (k.total ? k.persen + "%" : "—") + "</span>" +
      "</td>" +
      '<td class="col-actions"><div class="action-group">' +
        (Number(state.tingkat) === 9 && API.isAdmin()
          ? '<button type="button" class="icon-btn" data-act="graduate" title="Catat kelulusan">' + U.icon("checkCircle", 16) + "</button>"
          : "") +
        (API.isAdmin() ? '<button type="button" class="icon-btn" data-act="move" title="Pindah rombel / ubah status">' + U.icon("edit", 16) + "</button>" : "") +
      "</div></td>" +
    "</tr>";
  }

  function bodyRows() {
    if (state.loading) {
      return '<tr><td colspan="8"><div class="table-loading"><span class="spinner"></span><span>Memuat data kelas…</span></div></td></tr>';
    }
    var list = visibleStudents();
    if (!list.length) {
      return '<tr><td colspan="8">' + U.emptyState("users", "Belum ada siswa",
        classesFor(state.tingkat).length
          ? "Ubah kata pencarian atau tambahkan siswa baru."
          : "Tambahkan rombel untuk tingkat ini terlebih dahulu.") + "</td></tr>";
    }
    return list.map(rowHtml).join("");
  }

  function renderShell() {
    var list = visibleStudents();
    var all = studentsOf(state.tingkat);
    var semLabel = state.activeSem
      ? U.SEMESTER_LABEL[state.activeSem.jenis] + " · " + state.activeSem.hari_efektif + " hari efektif"
      : "Semester berjalan belum diatur";
    var hadir = 0, dasar = 0;
    all.forEach(function (s) {
      var k = kehadiranFor(s.id);
      hadir += k.hadir; dasar += k.dasar;
    });

    return '<div class="page-head">' +
        '<div><h1>Kelas</h1><p>Pilih tingkat untuk melihat siswa serta kehadiran semester berjalan.</p></div>' +
        '<div class="page-actions">' +
          (API.isAdmin()
            ? '<button type="button" class="btn btn-ghost" id="lvl-tahun">' + U.icon("calendar", 17) + "<span>Tahun &amp; Semester</span></button>" +
              '<button type="button" class="btn btn-ghost" id="lvl-lulus">' + U.icon("clipboard", 17) + "<span>Kelulusan</span></button>"
            : "") +
          '<button type="button" class="btn btn-secondary" id="lvl-excel">' + U.icon("download", 17) + "<span>Excel</span></button>" +
          (API.isAdmin() ? '<button type="button" class="btn btn-primary" id="lvl-add">' + U.icon("plus", 17) + "<span>Tambah Siswa</span></button>" : "") +
        "</div>" +
      "</div>" +

      '<div class="lvl-toolbar">' +
        '<div class="lvl-year">' +
          '<label for="lvl-year">Tahun ajaran</label>' +
          '<select id="lvl-year"' + (API.isAdmin() ? "" : " disabled") + ">" +
            state.years.map(function (y) {
              return '<option value="' + U.escape(y.id) + '"' + (y.id === state.yearId ? " selected" : "") + ">" +
                U.escape(U.tahunAjaranLabel(y)) + (y.is_aktif === false ? " (arsip)" : "") + "</option>";
            }).join("") +
          "</select>" +
        "</div>" +
        (API.isAdmin()
          ? '<button type="button" class="btn btn-soft btn-sm" id="lvl-promote">' + U.icon("arrowRight", 16) + "<span>Kenaikan Kelas</span></button>" +
            '<button type="button" class="btn btn-ghost btn-sm" id="lvl-add-class">' + U.icon("plus", 16) + "<span>Rombel</span></button>"
          : "") +
        '<span class="lvl-sem">' + U.icon("calendar", 15) + "<span>" + U.escape(semLabel) + "</span></span>" +
      "</div>" +

      '<div class="lvl-grid">' + [7, 8, 9].map(levelCard).join("") + "</div>" +

      '<div class="lvl-panel">' +
        '<div class="lvl-panel-head">' +
          "<div><h2>Kelas " + U.TINGKAT_ROMAN[state.tingkat] + "</h2>" +
            '<p>' + all.length + " siswa terdaftar · kehadiran tingkat " + (all.length ? U.percent(hadir, dasar) : 0) + "%</p></div>" +
          '<div class="search-box">' + U.icon("search", 16) +
            '<input type="search" id="lvl-search" value="' + U.escape(state.search) + '" placeholder="Cari nama atau NIS…" autocomplete="off">' +
          "</div>" +
        "</div>" +
        '<div class="student-list-head">' +
          '<span class="table-count" id="lvl-count">' + list.length + " siswa</span>" +
          '<span class="lvl-head-tools">' + rombelSelect() +
            '<span class="table-muted">Hadir dibandingkan hari efektif semester</span></span>' +
        "</div>" +
        '<div class="table-wrap"><table class="data-table lvl-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Status</th>' +
          '<th class="col-center">Hadir</th><th class="col-center">Alpa / S / I</th><th class="col-center">%</th><th class="col-actions"></th>' +
        "</tr></thead><tbody id=\"lvl-tbody\">" + bodyRows() + "</tbody></table></div>" +
      "</div>";
  }

  function paintRows() {
    if (!state.container) return;
    var tbody = U.$("#lvl-tbody", state.container);
    if (tbody) tbody.innerHTML = bodyRows();
    var count = U.$("#lvl-count", state.container);
    if (count) count.textContent = visibleStudents().length + " siswa";
  }

  /* ---------------- DATA ---------------- */

  async function load() {
    var token = ++state.token;
    state.loading = true;
    paintRows();
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

      if (state.activeSem && state.activeSem.tanggal_mulai) {
        var att = await API.getAttendanceRange(state.activeSem.tanggal_mulai, state.activeSem.tanggal_selesai, {
          academicYearId: state.yearId,
          semesterId: state.activeSem.id
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
      paintRows();
      U.toast(API.errorMessage(err), "error");
    }
  }

  /* ---------------- DIALOG ---------------- */

  function openAddStudent() {
    var clsList = classesFor(state.tingkat);
    var selected = state.kelas || (clsList[0] ? clsList[0].nama : "");
    var body = '<form class="form-stack" autocomplete="off">' +
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Siswa masuk ke <strong>" +
        U.escape(state.year ? U.tahunAjaranLabel(state.year) : "") + " · Kelas " + U.TINGKAT_ROMAN[state.tingkat] + "</strong>.</span></div>" +
      '<div class="form-grid form-grid-2">' +
        '<div class="field span-2"><label for="ad-nama">Nama lengkap <span class="req">*</span></label><input type="text" id="ad-nama" required></div>' +
        '<div class="field"><label for="ad-jk">Jenis kelamin</label><select id="ad-jk"><option value="L">Laki-laki (L)</option><option value="P">Perempuan (P)</option></select></div>' +
        '<div class="field"><label for="ad-nis">NIS</label><input type="text" id="ad-nis"></div>' +
        '<div class="field"><label for="ad-kelas">Rombel</label><select id="ad-kelas">' +
          clsList.map(function (c) { return '<option value="' + U.escape(c.id) + '"' + (c.nama === selected ? " selected" : "") + ">" + U.escape(c.nama) + "</option>"; }).join("") +
          (clsList.length ? "" : '<option value="">(belum ada rombel)</option>') +
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
            var cls = clsList.filter(function (c) { return c.id === U.$("#ad-kelas", bodyEl).value; })[0];
            if (!nama) { U.toast("Nama siswa wajib diisi.", "warning"); return; }
            if (!cls) { U.toast("Belum ada rombel untuk tingkat ini.", "warning"); return; }
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
              await App.refreshStudentsAll();
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
          [7, 8, 9].map(function (t) {
            return '<option value="' + t + '"' + (Number((c && c.tingkat) || state.tingkat) === t ? " selected" : "") + ">Kelas " + U.TINGKAT_ROMAN[t] + "</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field"><label for="cl-nama">Nama rombel <span class="req">*</span></label><input type="text" id="cl-nama" value="' + U.escape(c ? c.nama : "") + '" placeholder="Contoh: VII-C"></div>' +
        '<div class="field span-2"><label for="cl-wali">Wali kelas</label><input type="text" id="cl-wali" value="' + U.escape(c && c.wali_kelas ? c.wali_kelas : "") + '"></div>' +
      "</div></form>";

    U.modal({
      title: isEdit ? "Ubah Rombel" : "Tambah Rombel",
      subtitle: state.year ? U.tahunAjaranLabel(state.year) : "",
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
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>" + U.escape(student.nama) +
        " · kelas saat ini <strong>" + U.escape(student.kelas) + "</strong></span></div>" +
      '<div class="field"><label for="mv-kelas">Rombel baru</label><select id="mv-kelas">' +
        clsList.map(function (c) {
          return '<option value="' + U.escape(c.id) + '"' + (c.nama === student.kelas ? " selected" : "") + ">" + U.escape(c.nama) + "</option>";
        }).join("") +
      "</select></div>" +
      '<div class="field"><label for="mv-status">Status kelas</label><select id="mv-status">' +
        [["aktif", "Aktif"], ["naik", "Naik kelas"], ["tetap", "Tetap"], ["lulus", "Lulus"], ["pindah", "Pindah"], ["keluar", "Keluar"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (student._history && student._history.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") +
      "</select></div></form>";

    U.modal({
      title: "Pindah Rombel",
      subtitle: student.nama,
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
              await App.refreshStudentsAll();
              await load();
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
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
        '<div class="field"><label for="gr-npsn">NPSN</label><input type="text" id="gr-npsn"></div>' +
      "</div>" +
      '<p class="form-hint">Siswa ditandai lulus pada ' + U.escape(state.year ? U.tahunAjaranLabel(state.year) : "") + ".</p></form>";

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
              U.toast("Kelulusan dicatat. Lihat menu Kelulusan & Lanjutan.", "success");
              close();
              await load();
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
          }
        }
      ]
    });
  }

  function openPromote() {
    var sorted = state.years.slice().sort(function (a, b) { return b.tahun_awal - a.tahun_awal; });
    var fromYear = sorted.filter(function (y) { return y.id === state.yearId; })[0];
    var body = '<div class="form-stack">' +
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Memindahkan siswa <strong>VII → VIII</strong> dan <strong>VIII → IX</strong> dengan akhiran rombel yang sama. Riwayat kelas lama tetap tersimpan.</span></div>" +
      '<div class="form-grid form-grid-2">' +
        '<div class="field"><label for="pr-from">Dari tahun ajaran</label><select id="pr-from">' +
          sorted.map(function (y) {
            return '<option value="' + U.escape(y.id) + '"' + (y.id === state.yearId ? " selected" : "") + ">" + U.escape(U.tahunAjaranLabel(y)) + "</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field"><label for="pr-to">Ke tahun ajaran</label><select id="pr-to">' +
          sorted.map(function (y) {
            return '<option value="' + U.escape(y.id) + '"' + (y.id === state.yearId ? " disabled" : "") + ">" + U.escape(U.tahunAjaranLabel(y)) + (y.is_aktif === false ? " (arsip)" : "") + "</option>";
          }).join("") +
          '<option value="new" selected="selected">+ Tahun ajaran baru' +
            (fromYear ? " (" + (fromYear.tahun_awal + 1) + "/" + (fromYear.tahun_awal + 2) + ")" : "") + "</option>" +
        "</select></div>" +
      "</div>" +
      '<label class="check-label"><input type="checkbox" id="pr-lulus"> Tandai siswa kelas IX sebagai <strong>LULUS</strong></label>' +
      '<p class="form-hint">Jika dicentang, siswa kelas IX tahun asal ditandai lulus dan muncul di menu Kelulusan &amp; Lanjutan.</p>' +
      "</div>";

    U.modal({
      title: "Kenaikan Kelas",
      subtitle: "Proses otomatis untuk seluruh siswa pada tahun ajaran asal.",
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
              state.years = (window.APP_STATE.academicYears || []).slice();
              state.yearId = toId;
              state.year = state.years.filter(function (y) { return y.id === toId; })[0] || null;
              state.kelas = "";
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

  function exportExcel() {
    var list = visibleStudents();
    if (!list.length) { U.toast("Tidak ada data untuk diekspor.", "warning"); return; }
    var rows = list.map(function (s) {
      var k = kehadiranFor(s.id);
      return {
        nama: s.nama, jenis_kelamin: s.jenis_kelamin, kelas: s.kelas, nis: s.nis || "",
        hadir: k.hadir, alpa: k.alpa, sakit: k.sakit, izin: k.izin, total: k.total, persen: k.persen
      };
    });
    try {
      EX.levelExcel(rows, {
        tahun: state.year ? U.tahunAjaranLabel(state.year) : "",
        semester: state.activeSem ? U.SEMESTER_LABEL[state.activeSem.jenis] : "",
        hariEfektif: state.activeSem ? state.activeSem.hari_efektif : 0,
        tingkat: state.tingkat
      });
    } catch (err) {
      U.toast("Gagal membuat file: " + (err.message || err), "error");
    }
  }

  /* ---------------- EVENT ---------------- */

  function bind(container) {
    var yearSel = U.$("#lvl-year", container);
    if (yearSel) {
      yearSel.addEventListener("change", function (e) {
        state.yearId = e.target.value;
        state.year = state.years.filter(function (y) { return y.id === state.yearId; })[0] || null;
        state.kelas = "";
        load();
      });
    }

    var search = U.$("#lvl-search", container);
    if (search) {
      search.addEventListener("input", U.debounce(function (e) {
        state.search = e.target.value || "";
        paintRows();
      }, 160));
    }

    U.on(container, "click", "[data-tingkat]", function (e, btn) {
      state.tingkat = Number(btn.dataset.tingkat);
      state.kelas = "";
      container.innerHTML = renderShell();
      bind(container);
    });

    var kelasSel = U.$("#lvl-kelas", container);
    if (kelasSel) {
      kelasSel.addEventListener("change", function (e) {
        state.kelas = e.target.value || "";
        paintRows();
      });
    }

    var addBtn = U.$("#lvl-add", container);
    if (addBtn) addBtn.addEventListener("click", openAddStudent);
    var addClass = U.$("#lvl-add-class", container);
    if (addClass) addClass.addEventListener("click", function () { openClassForm(null); });
    var promote = U.$("#lvl-promote", container);
    if (promote) promote.addEventListener("click", openPromote);
    var excel = U.$("#lvl-excel", container);
    if (excel) excel.addEventListener("click", exportExcel);
    var tahunBtn = U.$("#lvl-tahun", container);
    if (tahunBtn) tahunBtn.addEventListener("click", function () { App.navigate("tahun"); });
    var lulusBtn = U.$("#lvl-lulus", container);
    if (lulusBtn) lulusBtn.addEventListener("click", function () { App.navigate("lulus"); });

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
    state.kelas = "";
    state.tingkat = 7;
    state.classes = [];
    state.history = [];
    state.students = (window.APP_STATE.students || []).slice();
    state.attendance = {};
    state.loading = true;

    var q = hashParam("tahun");
    var active = window.APP_STATE.activeYear;
    state.yearId = q && state.years.some(function (y) { return y.id === q; })
      ? q
      : (active ? active.id : (state.years[0] ? state.years[0].id : ""));
    state.year = state.years.filter(function (y) { return y.id === state.yearId; })[0] || null;

    if (!state.yearId) {
      container.innerHTML = '<div class="card setup-card">' + U.emptyState("calendar", "Belum ada tahun ajaran",
        "Tambahkan tahun ajaran terlebih dahulu di menu Tahun & Semester.") + "</div>";
      return;
    }
    container.innerHTML = renderShell();
    bind(container);
    load();
  }

  window.Pages = window.Pages || {};
  window.Pages.level = { render: render };
})();
