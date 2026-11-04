/* ============================================================
   Halaman Data Siswa
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    search: "",
    kelas: "",
    tingkat: "",
    includeInactive: false,
    students: [],
    loading: false,
    token: 0
  };

  function canEdit() { return API.isAdmin(); }

  function shell() {
    var classes = U.uniqueClasses(state.students);
    var edit = canEdit();
    return '' +
      '<div class="page-head">' +
        '<div><h1>Data Siswa</h1><p>Daftar seluruh siswa yang menjadi tanggungan BK. Data ini dipakai pada absensi dan rekap kehadiran.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="stu-template">' + U.icon("download", 17) + "<span>Template</span></button>" +
          (edit ? '<button type="button" class="btn btn-secondary" id="stu-import">' + U.icon("upload", 17) + "<span>Import Excel</span></button>" : "") +
          (edit ? '<button type="button" class="btn btn-primary" id="stu-add">' + U.icon("plus", 17) + "<span>Tambah Siswa</span></button>" : "") +
        "</div>" +
      "</div>" +
      (!edit ? '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Akun Guru BK hanya dapat melihat data. Tambah, ubah, dan hapus data siswa dilakukan admin.</span></div>" : "") +
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field grow"><label for="stu-search">Cari siswa</label><div class="input-with-icon">' + U.icon("search", 17) + '<input type="search" id="stu-search" placeholder="Ketik nama atau NIS…" autocomplete="off"></div></div>' +
          '<div class="field"><label for="stu-tingkat">Tingkat</label><select id="stu-tingkat"><option value="">Semua Tingkat</option>' +
            [7, 8, 9].map(function (t) { return '<option value="' + t + '">Kelas ' + U.TINGKAT_ROMAN[t] + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field"><label for="stu-kelas">Kelas</label><select id="stu-kelas"><option value="">Semua Kelas</option>' +
            classes.map(function (k) { return '<option value="' + U.escape(k) + '">' + U.escape(k) + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field field-check"><label class="check-label"><input type="checkbox" id="stu-inactive"> Tampilkan nonaktif</label></div>' +
          '<div class="field field-action"><button type="button" class="btn btn-secondary" id="stu-export">' + U.icon("download", 17) + "<span>Ekspor</span></button></div>" +
        "</div>" +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count" id="stu-count">0 siswa</span></div>' +
          '<div class="table-toolbar-right"><span class="table-muted">Foto siswa maksimal 100 KB (dikompres otomatis).</span></div></div>' +
        '<div class="table-wrap"><table class="data-table student-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama Siswa</th><th class="col-center">L/P</th><th class="col-center">Kelas</th>' +
          '<th class="col-center">NIS</th><th class="col-center">Angkatan</th><th class="col-center">Foto</th><th class="col-center">Status</th><th class="col-actions">Aksi</th>' +
        "</tr></thead><tbody id=\"stu-tbody\"><tr><td colspan=\"9\">" + loadingRow("Memuat data siswa…") + "</td></tr></tbody></table></div>" +
      "</div>";
  }

  function loadingRow(text) {
    return '<div class="table-loading"><span class="spinner"></span><span>' + U.escape(text || "Memuat…") + "</span></div>";
  }

  function filtered() {
    var q = state.search.trim().toLowerCase();
    return U.sortStudents(state.students).filter(function (s) {
      if (state.kelas && s.kelas !== state.kelas) return false;
      if (state.tingkat && U.kelasTingkat(s.kelas) !== Number(state.tingkat)) return false;
      if (!q) return true;
      return String(s.nama).toLowerCase().indexOf(q) !== -1 || String(s.nis || "").toLowerCase().indexOf(q) !== -1;
    });
  }

  function paint() {
    var list = filtered();
    var tbody = U.$("#stu-tbody", state.container);
    if (!tbody) return;
    if (state.loading) { tbody.innerHTML = '<tr><td colspan="9">' + loadingRow("Memuat data siswa…") + "</td></tr>"; return; }
    var edit = canEdit();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9">' + U.emptyState("users", "Tidak ada siswa", "Ubah filter atau tambahkan siswa baru.") + "</td></tr>";
    } else {
      tbody.innerHTML = list.map(function (s, i) {
        return '<tr data-id="' + U.escape(s.id) + '">' +
          '<td class="col-no">' + (i + 1) + "</td>" +
          '<td><div class="student-cell">' + U.avatarHtml(s, "avatar-xs") +
            '<div class="student-cell-text"><strong>' + U.escape(s.nama) + "</strong>" +
            (s.nis ? "<small>NIS " + U.escape(s.nis) + "</small>" : "") + "</div></div></td>" +
          '<td class="col-center"><span class="badge badge-gender ' + (s.jenis_kelamin === "P" ? "female" : "male") + '">' + U.escape(s.jenis_kelamin) + "</span></td>" +
          '<td class="col-center"><span class="class-pill">' + U.escape(s.kelas) + "</span></td>" +
          '<td class="col-center muted-sm">' + U.escape(s.nis || "—") + "</td>" +
          '<td class="col-center muted-sm">' + (s.angkatan || "—") + "</td>" +
          '<td class="col-center">' + (s.foto_path
            ? '<span class="badge badge-success">' + U.formatBytes(s.foto_ukuran || 0) + "</span>"
            : '<span class="badge badge-neutral">Belum</span>') + "</td>" +
          '<td class="col-center">' + (s.aktif ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-neutral">Nonaktif</span>') + "</td>" +
          '<td class="col-actions"><div class="action-group">' +
            (edit ? '<button type="button" class="icon-btn" data-action="photo" title="Unggah foto (maks. 100 KB)">' + U.icon("upload", 16) + "</button>" : "") +
            (edit ? '<button type="button" class="icon-btn" data-action="edit" title="Edit siswa">' + U.icon("edit", 16) + "</button>" : "") +
            (edit ? '<button type="button" class="icon-btn ' + (s.aktif ? "icon-danger" : "icon-success") + '" data-action="toggle" title="' + (s.aktif ? "Nonaktifkan" : "Aktifkan") + '">' + U.icon(s.aktif ? "x" : "check", 16) + "</button>" : "") +
          "</div></td>" +
        "</tr>";
      }).join("");
    }
    var count = U.$("#stu-count", state.container);
    if (count) count.textContent = list.length + " siswa" + (state.kelas ? " · " + state.kelas : "");
  }

  async function load(includeInactive) {
    var token = ++state.token;
    state.loading = true;
    paint();
    try {
      var data = await API.getStudents(includeInactive);
      if (token !== state.token) return;
      state.students = U.sortStudents(data || []);
      state.loading = false;
      paint();
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      var tbody = U.$("#stu-tbody", state.container);
      if (tbody) tbody.innerHTML = '<tr><td colspan="9"><div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(API.errorMessage(err)) + "</span></div></td></tr>";
      U.toast(API.errorMessage(err), "error");
    }
  }

  function classDatalist() {
    var classes = U.uniqueClasses(state.students);
    return '<datalist id="kelas-list">' + classes.map(function (k) { return '<option value="' + U.escape(k) + '"></option>'; }).join("") + "</datalist>";
  }

  function openForm(student) {
    var isEdit = Boolean(student);
    var s = student || { nama: "", jenis_kelamin: "L", kelas: "", nis: "", no_urut: "", aktif: true, angkatan: "" };
    var thisYear = (window.APP_STATE.activeYear && window.APP_STATE.activeYear.tahun_awal) || new Date().getFullYear();
    var body = '' +
      '<form id="student-form" class="form-stack" autocomplete="off">' +
        '<div class="form-grid">' +
          '<div class="field span-2"><label for="sf-nama">Nama lengkap <span class="req">*</span></label><input type="text" id="sf-nama" value="' + U.escape(s.nama) + '" required></div>' +
          '<div class="field"><label for="sf-jk">Jenis kelamin <span class="req">*</span></label><select id="sf-jk"><option value="L"' + (s.jenis_kelamin === "L" ? " selected" : "") + '>Laki-laki (L)</option><option value="P"' + (s.jenis_kelamin === "P" ? " selected" : "") + '>Perempuan (P)</option></select></div>' +
          '<div class="field"><label for="sf-kelas">Kelas <span class="req">*</span></label><input type="text" id="sf-kelas" list="kelas-list" value="' + U.escape(s.kelas) + '" placeholder="Contoh: VIII-A" required>' + classDatalist() + "</div>" +
          '<div class="field"><label for="sf-nis">NIS</label><input type="text" id="sf-nis" value="' + U.escape(s.nis || "") + '" placeholder="Opsional"></div>' +
          '<div class="field"><label for="sf-nourut">Nomor urut di kelas</label><input type="number" id="sf-nourut" min="1" value="' + (s.no_urut == null ? "" : s.no_urut) + '" placeholder="Opsional"></div>' +
          '<div class="field"><label for="sf-angkatan">Angkatan (tahun masuk)</label><input type="number" id="sf-angkatan" min="2000" max="2100" value="' + U.escape(s.angkatan || ((s.kelas) ? thisYear - (U.kelasTingkat(s.kelas) - 7) : thisYear)) + '"><span class="form-hint">Tahun masuk kelas VII.</span></div>' +
          (isEdit ? '<div class="field"><label for="sf-aktif">Status</label><select id="sf-aktif"><option value="true"' + (s.aktif ? " selected" : "") + '>Aktif</option><option value="false"' + (!s.aktif ? " selected" : "") + '>Nonaktif</option></select></div>' : "") +
        "</div>" +
        (isEdit ? '<div class="form-divider"></div><div class="photo-field">' +
          '<div class="photo-preview">' + (s.foto_path ? '<img src="' + U.escape(API.getPhotoUrl(s)) + '" alt="Foto">' : '<span>' + U.icon("user", 26) + "</span>") + "</div>" +
          '<div class="photo-actions"><strong>Foto siswa</strong><small>' + (s.foto_path ? "Ukuran tersimpan: " + U.formatBytes(s.foto_ukuran || 0) : "Belum ada foto") + " · maksimal 100 KB</small>" +
            '<div class="photo-buttons"><input type="file" id="sf-foto" accept="image/*" class="hidden"><button type="button" class="btn btn-secondary btn-sm" id="sf-pick">' + U.icon("upload", 15) + "<span>Pilih Foto</span></button>" +
            (s.foto_path ? '<button type="button" class="btn btn-ghost btn-sm" id="sf-del-foto">' + U.icon("trash", 15) + "<span>Hapus</span></button>" : "") +
            "</div><span id=\"sf-foto-status\" class=\"form-hint\"></span>" +
          "</div></div>" : "") +
        (isEdit ? '<p class="form-hint">Menonaktifkan siswa akan menyembunyikannya dari absensi, tetapi riwayat tetap tersimpan.</p>' : '<p class="form-hint">Nama dan kelas harus unik. Jika siswa sudah ada, gunakan fitur import untuk memperbarui.</p>') +
      "</form>";

    var pendingPhoto = null;

    var actions = [{ label: "Batal", class: "btn-secondary" }];
    if (isEdit) {
      actions.push({
        label: "Hapus",
        class: "btn-danger",
        icon: "trash",
        close: false,
        onClick: async function (close) {
          var ok = await U.confirm("Hapus siswa ini secara permanen? Riwayat absensinya juga akan terhapus.", {
            title: "Hapus Siswa", confirmLabel: "Ya, Hapus", danger: true
          });
          if (!ok) return;
          try {
            await API.deleteStudent(s.id);
            U.toast("Siswa berhasil dihapus.", "success");
            close();
            await refreshList();
          } catch (err) { U.toast(API.errorMessage(err), "error"); }
        }
      });
    }
    actions.push({
      label: "Simpan",
      class: "btn-primary",
      icon: "save",
      close: false,
      onClick: async function (close, overlay, bodyEl) {
        var nama = U.$("#sf-nama", bodyEl).value.trim();
        var jk = U.$("#sf-jk", bodyEl).value;
        var kelas = U.$("#sf-kelas", bodyEl).value.trim();
        var nis = U.$("#sf-nis", bodyEl).value.trim();
        var noUrutRaw = U.$("#sf-nourut", bodyEl).value;
        if (!nama) { U.toast("Nama siswa wajib diisi.", "warning"); return; }
        if (!kelas) { U.toast("Kelas wajib diisi.", "warning"); return; }
        var payload = {
          nama: nama,
          jenis_kelamin: jk,
          kelas: kelas,
          nis: nis || null,
          no_urut: noUrutRaw ? Number(noUrutRaw) : null,
          tingkat: U.kelasTingkat(kelas),
          angkatan: U.$("#sf-angkatan", bodyEl).value ? Number(U.$("#sf-angkatan", bodyEl).value) : null,
          aktif: isEdit ? U.$("#sf-aktif", bodyEl).value === "true" : true
        };
        var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
        if (btn) U.buttonLoading(btn, true);
        try {
          var saved = isEdit ? await API.updateStudent(s.id, payload) : await API.createStudent(payload);
          if (isEdit && pendingPhoto) {
            if (btn) U.buttonLoading(btn, true);
            await API.uploadStudentPhoto(s.id, pendingPhoto.blob, "jpg");
            U.toast("Data siswa dan foto diperbarui (" + U.formatBytes(pendingPhoto.blob.size) + ").", "success");
          } else {
            U.toast(isEdit ? "Data siswa diperbarui." : "Siswa baru ditambahkan.", "success");
          }
          // Simpan riwayat kelas pada tahun ajaran berjalan.
          var activeYear = window.APP_STATE.activeYear;
          if (activeYear && saved) {
            var klas = (await API.getClassGroups(activeYear.id, true)).filter(function (c) {
              return c.nama === payload.kelas;
            })[0];
            try {
              await API.saveStudentHistory({
                student_id: saved.id,
                academic_year_id: activeYear.id,
                tingkat: U.kelasTingkat(payload.kelas),
                class_group_id: klas ? klas.id : null,
                kelas: payload.kelas,
                status: "aktif"
              });
            } catch (e) { /* riwayat opsional */ }
          }
          close();
          await refreshList();
        } catch (err) {
          U.toast(API.errorMessage(err), "error");
        } finally {
          if (btn) U.buttonLoading(btn, false);
        }
      }
    });

    U.modal({
      title: isEdit ? "Edit Siswa" : "Tambah Siswa",
      subtitle: isEdit ? s.nama : "Masukkan data siswa baru.",
      body: body,
      actions: actions,
      size: "md",
      onMount: function (bodyEl) {
        var input = U.$("#sf-foto", bodyEl);
        var pick = U.$("#sf-pick", bodyEl);
        var status = U.$("#sf-foto-status", bodyEl);
        var preview = U.$(".photo-preview", bodyEl);
        if (!input || !pick) return;

        pick.addEventListener("click", function () { input.click(); });

        input.addEventListener("change", async function () {
          var file = input.files && input.files[0];
          if (!file) return;
          if (status) status.textContent = "Mengompres foto…";
          try {
            var result = await U.compressImage(file, 102400, { maxDimension: 900, quality: 0.85 });
            pendingPhoto = { blob: result.blob, width: result.width, height: result.height };
            if (status) {
              status.textContent = "Foto siap: " + result.width + "×" + result.height + " · " + U.formatBytes(result.blob.size) +
                " (asli " + U.formatBytes(file.size) + "). Klik Simpan untuk mengunggah.";
            }
            if (preview) {
              var url = URL.createObjectURL(result.blob);
              preview.innerHTML = '<img src="' + url + '" alt="Pratinjau foto">';
            }
          } catch (err) {
            pendingPhoto = null;
            if (status) status.textContent = err.message || String(err);
            U.toast(err.message || "Foto gagal diproses.", "error");
          }
        });

        var del = U.$("#sf-del-foto", bodyEl);
        if (del) {
          del.addEventListener("click", async function () {
            var ok = await U.confirm("Hapus foto siswa ini?", { title: "Hapus Foto", confirmLabel: "Ya, Hapus", danger: true });
            if (!ok) return;
            try {
              await API.deleteStudentPhoto(s);
              U.toast("Foto dihapus.", "success");
              refreshList();
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
          });
        }
      }
    });
  }

  async function refreshList() {
    state.students = U.sortStudents((await API.getStudents(state.includeInactive)) || []);
    await App.refreshStudentsAll();
    paint();
  }

  async function toggleActive(id) {
    var s = state.students.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var ok = await U.confirm(s.aktif ? "Nonaktifkan siswa ini? Data absensi lama tetap tersimpan." : "Aktifkan kembali siswa ini?", {
      title: s.aktif ? "Nonaktifkan Siswa" : "Aktifkan Siswa",
      confirmLabel: s.aktif ? "Ya, Nonaktifkan" : "Ya, Aktifkan",
      danger: false
    });
    if (!ok) return;
    try {
      await API.updateStudent(id, { aktif: !s.aktif });
      U.toast(s.aktif ? "Siswa dinonaktifkan." : "Siswa diaktifkan kembali.", "success");
      await refreshList();
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  function openImport() {
    var body = '' +
      '<div class="import-steps">' +
        '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Gunakan file Excel dengan kolom <strong>NAMA</strong>, <strong>L/P</strong>, <strong>KELAS</strong>, dan opsional <strong>NIS</strong>. Baris judul boleh ada atau tidak.</span></div>" +
        '<div class="field"><label for="imp-file">Pilih file Excel (.xlsx / .xls / .csv)</label><input type="file" id="imp-file" accept=".xlsx,.xls,.csv"></div>' +
        '<div id="imp-preview" class="import-preview"></div>' +
      "</div>";
    var parsed = [];

    U.modal({
      title: "Import Data Siswa",
      subtitle: "Tambahkan atau perbarui banyak siswa sekaligus.",
      body: body,
      size: "lg",
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Import Sekarang",
          class: "btn-primary",
          icon: "upload",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            if (!parsed.length) { U.toast("Pilih file dan pastikan ada data valid.", "warning"); return; }
            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              await API.importStudents(parsed);
              U.toast(parsed.length + " siswa berhasil diimport/diperbarui.", "success");
              close();
              await refreshList();
            } catch (err) {
              U.toast(API.errorMessage(err), "error");
            } finally {
              if (btn) U.buttonLoading(btn, false);
            }
          }
        }
      ],
      onMount: function (bodyEl) {
        var input = U.$("#imp-file", bodyEl);
        input.addEventListener("change", function () {
          parsed = [];
          var preview = U.$("#imp-preview", bodyEl);
          var file = input.files && input.files[0];
          if (!file) { preview.innerHTML = ""; return; }
          var reader = new FileReader();
          reader.onload = function (ev) {
            try {
              var wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
              var ws = wb.Sheets[wb.SheetNames[0]];
              var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                  var result = parseRows(rows);
              parsed = result.valid;
              // Lengkapi tingkat & angkatan dari tahun ajaran berjalan.
              var activeYear = window.APP_STATE.activeYear;
              var baseYear = activeYear ? activeYear.tahun_awal : new Date().getFullYear();
              parsed.forEach(function (p) {
                p.tingkat = U.kelasTingkat(p.kelas);
                p.angkatan = baseYear - (p.tingkat - 7);
              });
              preview.innerHTML = renderPreview(result, parsed);
            } catch (err) {
              preview.innerHTML = '<div class="notice notice-danger">' + U.icon("alert", 18) + "<span>File tidak dapat dibaca: " + U.escape(err.message || err) + "</span></div>";
            }
          };
          reader.readAsArrayBuffer(file);
        });
      }
    });
  }

  function normalizeHeader(v) {
    return String(v || "").trim().toUpperCase().replace(/[._-]/g, " ").replace(/\s+/g, " ");
  }

  function normalizeJK(v) {
    var s = String(v || "").trim().toUpperCase();
    if (s === "L" || s === "LAKI-LAKI" || s === "LAKI LAKI" || s === "LAKILAKI" || s === "PRIA") return "L";
    if (s === "P" || s === "PEREMPUAN" || s === "WANITA") return "P";
    return "";
  }

  function parseRows(rows) {
    if (!rows || !rows.length) return { valid: [], invalid: 0, total: 0, header: null };
    var headerIndex = -1;
    for (var r = 0; r < Math.min(rows.length, 10); r++) {
      var norm = (rows[r] || []).map(normalizeHeader);
      var hasNama = norm.some(function (h) { return h.indexOf("NAMA") !== -1; });
      if (hasNama && norm.indexOf("KELAS") !== -1) { headerIndex = r; break; }
    }
    var hasHeader = headerIndex !== -1;
    var header = hasHeader ? rows[headerIndex].map(normalizeHeader) : [];
    var idx = { nama: 1, jk: 2, kelas: 3, nis: 4, no: 0 };
    if (hasHeader) {
      idx.nama = header.findIndex(function (h) { return h.indexOf("NAMA") !== -1; });
      idx.kelas = header.indexOf("KELAS");
      idx.jk = header.findIndex(function (h) { return h === "L/P" || h === "JK" || h.indexOf("JENIS KELAMIN") !== -1; });
      idx.nis = header.indexOf("NIS");
      idx.no = header.findIndex(function (h) { return h === "NO" || h === "NO."; });
    }
    var data = hasHeader ? rows.slice(headerIndex + 1) : rows;
    var valid = [];
    var invalid = 0;
    data.forEach(function (row) {
      if (!row || !row.length) return;
      var nama = String(row[idx.nama] == null ? "" : row[idx.nama]).trim();
      if (!nama) return;
      var jk = normalizeJK(row[idx.jk]);
      var kelas = String(row[idx.kelas] == null ? "" : row[idx.kelas]).trim();
      if (!jk || !kelas) { invalid++; return; }
      var no = idx.no >= 0 ? Number(row[idx.no]) : null;
      valid.push({
        nama: nama,
        jenis_kelamin: jk,
        kelas: kelas,
        nis: idx.nis >= 0 ? String(row[idx.nis] == null ? "" : row[idx.nis]).trim() || null : null,
        no_urut: isFinite(no) && no > 0 ? no : null,
        aktif: true
      });
    });
    return { valid: valid, invalid: invalid, total: data.length, header: hasHeader };
  }

  function renderPreview(result, parsed) {
    if (!parsed.length) {
      return '<div class="notice notice-warning">' + U.icon("alert", 18) + "<span>Tidak ada data valid yang ditemukan. Periksa kolom NAMA, L/P, dan KELAS.</span></div>";
    }
    var rows = parsed.slice(0, 5).map(function (s, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + U.escape(s.nama) + "</td><td>" + U.escape(s.jenis_kelamin) + "</td><td>" + U.escape(s.kelas) + "</td><td>" + U.escape(s.nis || "—") + "</td></tr>";
    }).join("");
    return '<div class="notice notice-success">' + U.icon("checkCircle", 18) + "<span><strong>" + parsed.length + " siswa</strong> siap diimport" + (result.invalid ? " · " + result.invalid + " baris dilewati karena data tidak lengkap" : "") + ".</span></div>" +
      '<div class="table-wrap preview-table"><table class="data-table"><thead><tr><th>#</th><th>Nama</th><th>L/P</th><th>Kelas</th><th>NIS</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (parsed.length > 5 ? '<p class="form-hint">Menampilkan 5 baris pertama dari ' + parsed.length + " baris.</p>" : "");
  }

  function bind() {
    var c = state.container;
    U.$("#stu-search", c).addEventListener("input", U.debounce(function (e) {
      state.search = e.target.value || "";
      paint();
    }, 180));
    U.$("#stu-kelas", c).addEventListener("change", function (e) {
      state.kelas = e.target.value;
      paint();
    });
    U.$("#stu-inactive", c).addEventListener("change", function (e) {
      state.includeInactive = e.target.checked;
      load(state.includeInactive);
    });
    U.$("#stu-tingkat", c).addEventListener("change", function (e) {
      state.tingkat = e.target.value;
      state.kelas = "";
      U.$("#stu-kelas", c).value = "";
      paint();
    });
    U.on(U.$("#stu-tbody", c), "click", '[data-action="photo"]', function (e, btn) {
      var id = btn.closest("tr").dataset.id;
      var s = state.students.filter(function (x) { return x.id === id; })[0];
      if (s) openForm(s);
    });
    U.$("#stu-add", c).addEventListener("click", function () { openForm(null); });
    U.$("#stu-import", c).addEventListener("click", openImport);
    U.$("#stu-template", c).addEventListener("click", function () { EX.studentsTemplate(); });
    U.$("#stu-export", c).addEventListener("click", function () {
      var list = filtered();
      if (!list.length) { U.toast("Tidak ada data untuk diekspor.", "warning"); return; }
      EX.studentsExcel(list);
    });
    U.on(U.$("#stu-tbody", c), "click", '[data-action="edit"]', function (e, btn) {
      var id = btn.closest("tr").dataset.id;
      var s = state.students.filter(function (x) { return x.id === id; })[0];
      if (s) openForm(s);
    });
    U.on(U.$("#stu-tbody", c), "click", '[data-action="toggle"]', function (e, btn) {
      toggleActive(btn.closest("tr").dataset.id);
    });
  }

  function render(container) {
    state.container = container;
    state.search = "";
    state.kelas = "";
    state.tingkat = "";
    state.includeInactive = false;
    state.students = (window.APP_STATE.students || []).slice();
    state.loading = false;
    state.token++;
    container.innerHTML = shell();
    bind();
    paint();
    load(false);
  }

  window.Pages = window.Pages || {};
  window.Pages.students = { render: render };
})();