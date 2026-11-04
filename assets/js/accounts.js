/* ============================================================
   Halaman Akun Admin (khusus Superadmin)
   ------------------------------------------------------------
   Superadmin dapat:
     - membuat akun admin / superadmin / guru BK,
     - mengubah nama, peran, status aktif, dan reset password,
     - menonaktifkan / mengaktifkan akun,
     - menghapus akun.
   Akun nonaktif tidak dapat login (profil aktif = false).
   ============================================================ */
(function () {
  "use strict";

  var state = {
    container: null,
    accounts: [],
    search: "",
    role: "",
    loading: false,
    token: 0
  };

  function myId() {
    return (window.APP_STATE.user && window.APP_STATE.user.id) || "";
  }

  function filtered() {
    var q = state.search.trim().toLowerCase();
    return state.accounts.filter(function (a) {
      if (state.role && a.role !== state.role) return false;
      if (!q) return true;
      return String(a.full_name || "").toLowerCase().indexOf(q) !== -1 ||
        String(a.email || "").toLowerCase().indexOf(q) !== -1;
    });
  }

  function roleBadge(role) {
    var label = API.roleLabel(role);
    if (role === "superadmin") return '<span class="badge badge-super">' + label + "</span>";
    if (role === "admin") return '<span class="badge badge-admin">' + label + "</span>";
    if (role === "guru_piket") return '<span class="badge badge-info">' + label + "</span>";
    if (role === "wali_kelas") return '<span class="badge badge-success">' + label + "</span>";
    return '<span class="badge badge-neutral">' + label + "</span>";
  }

  function shell() {
    var counts = {};
    state.accounts.forEach(function (a) {
      counts[a.role] = (counts[a.role] || 0) + 1;
    });
    var active = state.accounts.filter(function (a) { return a.aktif; }).length;

    return '<div class="page-head">' +
        '<div><h1>Akun Admin</h1><p>Kelola akun pengguna aplikasi. Hanya <strong>superadmin</strong> yang dapat membuat, mengubah, menonaktifkan, dan menghapus akun.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-secondary" id="acc-wali-map">' + U.icon("book", 17) + "<span>Daftar Wali Kelas</span></button>" +
          '<button type="button" class="btn btn-primary" id="acc-add">' + U.icon("plus", 17) + "<span>Akun Baru</span></button>" +
        "</div>" +
      "</div>" +
      '<div class="summary-grid">' +
        '<div class="summary-card tone-teal"><span class="summary-label">Total akun</span><strong>' + state.accounts.length + "</strong><small>akun</small></div>" +
        '<div class="summary-card tone-green"><span class="summary-label">Aktif</span><strong>' + active + "</strong><small>dapat login</small></div>" +
        '<div class="summary-card tone-blue"><span class="summary-label">Superadmin</span><strong>' + (counts.superadmin || 0) + "</strong><small>akun</small></div>" +
        '<div class="summary-card tone-amber"><span class="summary-label">Admin</span><strong>' + ((counts.admin || 0) + (counts.guru_bk || 0)) + "</strong><small>admin &amp; guru BK</small></div>" +
      "</div>" +
      '<div class="card filter-card">' +
        '<div class="filter-row">' +
          '<div class="field grow"><label for="acc-search">Cari akun</label><div class="input-with-icon">' + U.icon("search", 17) + '<input type="search" id="acc-search" value="' + U.escape(state.search) + '" placeholder="Nama atau email…" autocomplete="off"></div></div>' +
          '<div class="field"><label for="acc-role">Peran</label><select id="acc-role">' +
            ["", "superadmin", "admin", "guru_bk", "guru_piket", "wali_kelas"].map(function (r) {
              return '<option value="' + r + '"' + (state.role === r ? " selected" : "") + ">" + (r ? API.roleLabel(r) : "Semua peran") + "</option>";
            }).join("") +
          "</select></div>" +
        "</div>" +
      "</div>" +
      '<div class="card table-card">' +
        '<div class="table-toolbar"><div class="table-toolbar-left"><span class="table-count" id="acc-count">' + filtered().length + " akun</span></div>" +
          '<div class="table-toolbar-right"><span class="table-muted">Password minimal 8 karakter. Password disimpan terenkripsi di Supabase.</span></div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr>' +
          '<th class="col-no">No</th><th>Nama &amp; Email</th><th class="col-center">Peran</th><th class="col-center">Status</th>' +
          '<th>Login terakhir</th><th class="col-actions">Aksi</th>' +
        "</tr></thead><tbody id=\"acc-tbody\">" + bodyRows() + "</tbody></table></div>" +
      "</div>";
  }

  function bodyRows() {
    if (state.loading) {
      return '<tr><td colspan="6"><div class="table-loading"><span class="spinner"></span><span>Memuat akun…</span></div></td></tr>';
    }
    var list = filtered();
    if (!list.length) {
      return '<tr><td colspan="6">' + U.emptyState("users", "Belum ada akun", "Buat akun admin pertama untuk memulai.") + "</td></tr>";
    }
    return list.map(function (a, i) {
      var self = a.id === myId();
      return '<tr data-id="' + U.escape(a.id) + '">' +
        '<td class="col-no">' + (i + 1) + "</td>" +
        '<td><div class="student-cell"><span class="avatar avatar-xs">' + U.escape(U.initials(a.full_name || a.email)) + "</span>" +
          '<div class="student-cell-text"><strong>' + U.escape(a.full_name || "-") + (self ? ' <span class="badge badge-info">Anda</span>' : "") + "</strong>" +
          "<small>" + U.escape(a.email || "-") + "</small></div></div></td>" +
        '<td class="col-center">' + roleBadge(a.role) + "</td>" +
        '<td class="col-center">' + (a.aktif === false
          ? '<span class="badge badge-neutral">Nonaktif</span>'
          : '<span class="badge badge-success">Aktif</span>') + "</td>" +
        '<td class="muted-sm">' + (a.last_login ? U.escape(U.formatDateID(String(a.last_login).slice(0, 10))) + " · " + U.escape(String(a.last_login).slice(11, 16)) : "—") + "</td>" +
        '<td class="col-actions"><div class="action-group">' +
          '<button type="button" class="icon-btn" data-act="edit" title="Ubah akun">' + U.icon("edit", 16) + "</button>" +
          '<button type="button" class="icon-btn" data-act="password" title="Reset password">' + U.icon("lock", 16) + "</button>" +
          '<button type="button" class="icon-btn" data-act="kelas" title="Atur rombel wali kelas">' + U.icon("book", 16) + "</button>" +
          (self ? "" :
            '<button type="button" class="icon-btn ' + (a.aktif === false ? "icon-success" : "icon-danger") + '" data-act="toggle" title="' + (a.aktif === false ? "Aktifkan" : "Nonaktifkan") + '">' +
            U.icon(a.aktif === false ? "check" : "x", 16) + "</button>" +
            '<button type="button" class="icon-btn icon-danger" data-act="delete" title="Hapus akun">' + U.icon("trash", 16) + "</button>") +
        "</div></td>" +
      "</tr>";
    }).join("");
  }

  async function load() {
    var token = ++state.token;
    state.loading = true;
    paint();
    try {
      var list = await API.listAccounts();
      if (token !== state.token) return;
      state.accounts = list || [];
      state.loading = false;
      paint();
    } catch (err) {
      if (token !== state.token) return;
      state.loading = false;
      paint();
      U.toast(API.errorMessage(err), "error");
    }
  }

  function paint() {
    if (!state.container) return;
    var tbody = U.$("#acc-tbody", state.container);
    if (tbody) tbody.innerHTML = bodyRows();
    var count = U.$("#acc-count", state.container);
    if (count) count.textContent = filtered().length + " akun";
  }

  function openCreate() {
    var body = '<form class="form-stack" autocomplete="off">' +
      '<div class="form-grid form-grid-2">' +
        '<div class="field span-2"><label for="ac-nama">Nama lengkap <span class="req">*</span></label><input type="text" id="ac-nama" autocomplete="off" placeholder="Nama dan gelar"></div>' +
        '<div class="field span-2"><label for="ac-email">Email <span class="req">*</span></label><input type="email" id="ac-email" autocomplete="off" placeholder="nama@mtsn2trenggalek.sch.id"></div>' +
        '<div class="field"><label for="ac-password">Password <span class="req">*</span></label><input type="text" id="ac-password" autocomplete="new-password" placeholder="Minimal 8 karakter"></div>' +
        '<div class="field"><label for="ac-role">Peran</label><select id="ac-role">' +
          '<option value="admin" selected>Admin — kelola seluruh data</option>' +
          '<option value="superadmin">Superadmin — kelola akun juga</option>' +
          '<option value="guru_bk">Guru BK — absensi, data siswa &amp; laporan</option>' +
          '<option value="guru_piket">Guru Piket — hanya mengabsen siswa</option>' +
          '<option value="wali_kelas">Wali Kelas — melihat siswa kelasnya</option>' +
        "</select></div>" +
      "</div>" +
      '<p class="form-hint">Akun langsung aktif dan dapat digunakan untuk login. Sampaikan email &amp; password kepada pemilik akun.</p>' +
      "</form>";

    U.modal({
      title: "Buat Akun Baru",
      subtitle: "Akun disimpan di Supabase Auth dan langsung aktif.",
      size: "md",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Buat Akun",
          class: "btn-primary",
          icon: "plus",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var nama = U.$("#ac-nama", bodyEl).value.trim();
            var email = U.$("#ac-email", bodyEl).value.trim();
            var password = U.$("#ac-password", bodyEl).value;
            var role = U.$("#ac-role", bodyEl).value;
            if (!nama || !email) { U.toast("Nama dan email wajib diisi.", "warning"); return; }
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { U.toast("Format email tidak valid.", "warning"); return; }
            if (password.length < 8) { U.toast("Password minimal 8 karakter.", "warning"); return; }

            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              await API.createAccount(email, password, nama, role);
              U.toast("Akun " + email + " berhasil dibuat.", "success", 5000);
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

  function openEdit(a) {
    var self = a.id === myId();
    var body = '<form class="form-stack" autocomplete="off">' +
      '<div class="form-grid form-grid-2">' +
        '<div class="field span-2"><label for="ae-nama">Nama lengkap</label><input type="text" id="ae-nama" value="' + U.escape(a.full_name || "") + '"></div>' +
        '<div class="field span-2"><label for="ae-email">Email</label><input type="text" id="ae-email" value="' + U.escape(a.email || "") + '" disabled></div>' +
        '<div class="field"><label for="ae-role">Peran</label><select id="ae-role"' + (self ? " disabled" : "") + ">" +
          ["superadmin", "admin", "guru_bk", "guru_piket", "wali_kelas"].map(function (r) {
            return '<option value="' + r + '"' + (a.role === r ? " selected" : "") + ">" + API.roleLabel(r) + "</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field"><label for="ae-aktif">Status</label><select id="ae-aktif"' + (self ? " disabled" : "") + ">" +
          '<option value="true"' + (a.aktif !== false ? " selected" : "") + ">Aktif</option>" +
          '<option value="false"' + (a.aktif === false ? " selected" : "") + ">Nonaktif</option>" +
        "</select></div>" +
      "</div>" +
      (self ? '<p class="form-hint">Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.</p>' : "") +
      "</form>";

    U.modal({
      title: "Ubah Akun",
      subtitle: a.email || "",
      size: "md",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Simpan Perubahan",
          class: "btn-primary",
          icon: "save",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var patch = { full_name: U.$("#ae-nama", bodyEl).value.trim() };
            if (!self) {
              patch.role = U.$("#ae-role", bodyEl).value;
              patch.aktif = U.$("#ae-aktif", bodyEl).value === "true";
            }
            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              await API.updateAccount(a.id, patch);
              U.toast("Akun diperbarui.", "success");
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

  function openPassword(a) {
    var body = '<form class="form-stack" autocomplete="off">' +
      '<div class="notice notice-info">' + U.icon("info", 18) + "<span>Reset password untuk <strong>" + U.escape(a.email || "") + "</strong>. Password lama tidak dapat dilihat.</span></div>" +
      '<div class="form-grid form-grid-2">' +
        '<div class="field"><label for="ap-1">Password baru</label><input type="text" id="ap-1" autocomplete="new-password" placeholder="Minimal 8 karakter"></div>' +
        '<div class="field"><label for="ap-2">Ulangi password</label><input type="text" id="ap-2" autocomplete="new-password"></div>' +
      "</div></form>";

    U.modal({
      title: "Reset Password",
      size: "sm",
      body: body,
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Simpan Password",
          class: "btn-primary",
          icon: "lock",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var p1 = U.$("#ap-1", bodyEl).value;
            var p2 = U.$("#ap-2", bodyEl).value;
            if (p1.length < 8) { U.toast("Password minimal 8 karakter.", "warning"); return; }
            if (p1 !== p2) { U.toast("Ulangi password belum sama.", "warning"); return; }
            try {
              await API.updateAccount(a.id, { password: p1 });
              U.toast("Password berhasil diperbarui.", "success");
              close();
            } catch (err) {
              U.toast(API.errorMessage(err), "error");
            }
          }
        }
      ]
    });
  }

  async function toggle(a) {
    var next = a.aktif === false;
    var ok = await U.confirm(
      next ? "Aktifkan kembali akun " + (a.email || a.full_name) + "?" :
        "Nonaktifkan akun " + (a.email || a.full_name) + "? Akun tidak dapat login, data tetap tersimpan.",
      { title: next ? "Aktifkan Akun" : "Nonaktifkan Akun", confirmLabel: next ? "Ya, Aktifkan" : "Ya, Nonaktifkan", danger: !next }
    );
    if (!ok) return;
    try {
      await API.updateAccount(a.id, { aktif: next });
      U.toast(next ? "Akun diaktifkan." : "Akun dinonaktifkan.", "success");
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  async function remove(a) {
    var ok = await U.confirm("Hapus akun " + (a.email || a.full_name) + " secara permanen? Tindakan ini tidak dapat dibatalkan.", {
      title: "Hapus Akun", confirmLabel: "Ya, Hapus", danger: true
    });
    if (!ok) return;
    try {
      await API.deleteAccount(a.id);
      U.toast("Akun dihapus.", "success");
      await load();
    } catch (err) {
      U.toast(API.errorMessage(err), "error");
    }
  }

  function bind(container) {
    U.$("#acc-add", container).addEventListener("click", openCreate);
    U.$("#acc-search", container).addEventListener("input", U.debounce(function (e) {
      state.search = e.target.value || "";
      paint();
    }, 160));
    U.$("#acc-role", container).addEventListener("change", function (e) {
      state.role = e.target.value;
      paint();
    });
    U.on(U.$("#acc-tbody", container), "click", "[data-act]", function (e, btn) {
      var id = btn.closest("tr").dataset.id;
      var a = state.accounts.filter(function (x) { return x.id === id; })[0];
      if (!a) return;
      var act = btn.dataset.act;
      if (act === "edit") openEdit(a);
      else if (act === "password") openPassword(a);
      else if (act === "toggle") toggle(a);
      else if (act === "delete") remove(a);
      else if (act === "kelas") openWaliKelas(a);
    });
    var wkBtn = U.$("#acc-wali-map", container);
    if (wkBtn) wkBtn.addEventListener("click", openPetaKelas);
  }

  /* ---------------- WALI KELAS ---------------- */

  async function openWaliKelas(account) {
    U.loading(true, "Memuat rombel…");
    try {
      var years = (window.APP_STATE.academicYears || []).slice();
      var classes = [];
      for (var i = 0; i < years.length; i++) {
        var list = await API.getClassGroups(years[i].id, true);
        (list || []).forEach(function (c) {
          if (c.is_aktif === false) return;
          var y = years.filter(function (x) { return x.id === c.academic_year_id; })[0];
          c._tahun = y ? U.tahunAjaranLabel(y) : "";
          classes.push(c);
        });
      }
      var all = await API.getSemuaWaliKelas();
      var mine = (all || []).filter(function (w) { return w.user_id === account.id; });

      var body = '<div class="form-stack">' +
        '<div class="notice notice-info">' + U.icon("info", 18) + "<span><strong>" + U.escape(account.full_name || account.email) +
          "</strong> dapat melihat siswa pada rombel yang dipilih di bawah. Login sebagai peran <strong>Wali Kelas</strong>.</span></div>" +
        '<div class="field"><label for="wk-pick">Tambah rombel</label><select id="wk-pick">' +
          classes.map(function (c) {
            return '<option value="' + U.escape(c.id) + '">' + U.escape(c.nama) + " · " + U.escape(c._tahun) + "</option>";
          }).join("") +
        "</select></div>" +
        (mine.length
          ? '<div class="wk-map-list">' + mine.map(function (w) {
              var c = classes.filter(function (x) { return x.id === w.class_group_id; })[0];
              var y = years.filter(function (x) { return x.id === w.academic_year_id; })[0];
              return '<div class="wk-map-item"><span>' + U.escape(c ? c.nama : "-") + " · " + U.escape(y ? U.tahunAjaranLabel(y) : "-") +
                "</span><button type=\"button\" class=\"icon-btn icon-danger\" data-wk-del=\"" + U.escape(w.id) + '" title="Hapus">' + U.icon("trash", 15) + "</button></div>";
            }).join("") + "</div>"
          : '<p class="form-hint">Belum ada rombel untuk akun ini.</p>') +
        "</div>";

      U.modal({
        title: "Atur Wali Kelas",
        subtitle: account.email || "",
        size: "md",
        body: body,
        actions: [
          { label: "Tutup", class: "btn-secondary" },
          {
            label: "Tambahkan",
            class: "btn-primary",
            icon: "plus",
            close: false,
            onClick: async function (close2, o, b) {
              var sel = U.$("#wk-pick", b);
              if (!sel || !sel.value) return;
              try {
                await API.setWaliKelas(account.id, sel.value);
                U.toast("Rombel ditambahkan untuk wali kelas.", "success");
                close2();
                openWaliKelas(account);
              } catch (err) { U.toast(API.errorMessage(err), "error"); }
            }
          }
        ],
        onMount: function (b) {
          U.on(b, "click", "[data-wk-del]", async function (e, btn) {
            try {
              await API.deleteWaliKelas(btn.getAttribute("data-wk-del"));
              U.toast("Rombel dilepas.", "success");
              U.$(".modal-close", document).click();
              openWaliKelas(account);
            } catch (err) { U.toast(API.errorMessage(err), "error"); }
          });
        }
      });
    } catch (err) {
      U.toast(API.errorMessage(err), "error", 8000);
    } finally {
      U.loading(false);
    }
  }

  async function openPetaKelas() {
    U.loading(true, "Memuat wali kelas…");
    try {
      var all = await API.getSemuaWaliKelas();
      var classes = await API.getClassGroups(null, true);
      var body = '<div class="form-stack">' +
        (all.length
          ? '<div class="wk-map-list">' + all.map(function (w) {
              var a = state.accounts.filter(function (x) { return x.id === w.user_id; })[0] || {};
              var c = classes.filter(function (x) { return x.id === w.class_group_id; })[0] || {};
              return '<div class="wk-map-item"><span><strong>' + U.escape(a.full_name || a.email || "-") + "</strong><small>" +
                U.escape(c.nama || "-") + "</small></span></div>";
            }).join("") + "</div>"
          : '<p class="form-hint">Belum ada wali kelas yang dipetakan.</p>') +
        '<p class="form-hint">Atur dari tombol <strong>kelas</strong> pada baris akun berperan Wali Kelas.</p></div>';
      U.modal({
        title: "Wali Kelas",
        subtitle: "Daftar akun wali kelas beserta rombelnya.",
        size: "md",
        body: body,
        actions: [{ label: "Tutup", class: "btn-secondary" }]
      });
    } catch (err) {
      U.toast(API.errorMessage(err), "error", 8000);
    } finally {
      U.loading(false);
    }
  }

  function render(container) {
    if (!API.isSuperadmin()) {
      container.innerHTML = '<div class="card setup-card">' + U.emptyState("lock", "Akses ditolak", "Halaman ini hanya dapat dibuka oleh superadmin.") + "</div>";
      return;
    }
    state.container = container;
    state.search = "";
    state.role = "";
    state.accounts = [];
    state.loading = true;
    container.innerHTML = shell();
    bind(container);
    load();
  }

  window.Pages = window.Pages || {};
  window.Pages.accounts = { render: render };
})();
