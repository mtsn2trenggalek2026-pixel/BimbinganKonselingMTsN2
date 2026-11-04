/* ============================================================
   Halaman Pengaturan
   ============================================================ */
(function () {
  "use strict";

  var state = { container: null, saving: false };

  function stripNip(value) {
    return String(value || "").replace(/^\s*NIP\.?\s*/i, "").trim();
  }

  function s() {
    var st = window.APP_STATE.settings || {};
    return {
      nama_madrasah: st.nama_madrasah || window.BK_CONFIG.SCHOOL_NAME,
      alamat: st.alamat || "",
      kepala_nama: st.kepala_nama || window.BK_CONFIG.DEFAULT_KEPALA_NAMA,
      kepala_nip: stripNip(st.kepala_nip || window.BK_CONFIG.DEFAULT_KEPALA_NIP),
      guru_nama: st.guru_nama || window.BK_CONFIG.DEFAULT_GURU_NAMA,
      guru_nip: stripNip(st.guru_nip || window.BK_CONFIG.DEFAULT_GURU_NIP),
      guru_jabatan: st.guru_jabatan || window.BK_CONFIG.DEFAULT_GURU_JABATAN,
      kota: st.kota || window.BK_CONFIG.DEFAULT_KOTA
    };
  }

  function field(label, id, value, placeholder, span) {
    return '<div class="field ' + (span || "") + '"><label for="' + id + '">' + U.escape(label) + "</label>" +
      '<input type="text" id="' + id + '" value="' + U.escape(value || "") + '" placeholder="' + U.escape(placeholder || "") + '"></div>';
  }

  function render(container) {
    state.container = container;
    var v = s();
    var user = window.APP_STATE.user || {};
    var email = user.email || "-";
    var students = window.APP_STATE.students || [];

    container.innerHTML =
      '<div class="page-head"><div><h1>Pengaturan</h1><p>Identitas madrasah dan penandatangan laporan. Perubahan berlaku untuk laporan berikutnya.</p></div></div>' +
      '<div class="settings-grid">' +
        '<div class="card">' +
          '<div class="card-head"><div><h3>Identitas Madrasah</h3><p>Tampil pada kop absensi dan laporan.</p></div></div>' +
          '<form id="set-form" class="form-stack">' +
            '<div class="form-grid">' +
              field("Nama Madrasah", "set-nama_madrasah", v.nama_madrasah, "MTsN 2 Trenggalek", "span-2") +
              field("Alamat (opsional)", "set-alamat", v.alamat, "Alamat madrasah", "span-2") +
              field("Kota", "set-kota", v.kota, "Trenggalek") +
              field("Jabatan Guru BK", "set-guru_jabatan", v.guru_jabatan, "Guru Bimbingan Konseling") +
            "</div>" +
            '<div class="form-divider"></div>' +
            '<h4 class="form-section-title">Kepala Madrasah (penandatangan kiri)</h4>' +
            '<div class="form-grid">' +
              field("Nama Kepala", "set-kepala_nama", v.kepala_nama, "Nama lengkap dan gelar", "span-2") +
              field("NIP Kepala", "set-kepala_nip", v.kepala_nip, "Nomor induk pegawai", "span-2") +
            "</div>" +
            '<div class="form-divider"></div>' +
            '<h4 class="form-section-title">Guru Bimbingan Konseling (penandatangan kanan)</h4>' +
            '<div class="form-grid">' +
              field("Nama Guru BK", "set-guru_nama", v.guru_nama, "Nama lengkap dan gelar", "span-2") +
              field("NIP Guru BK", "set-guru_nip", v.guru_nip, "Nomor induk pegawai", "span-2") +
            "</div>" +
            '<div class="form-actions"><button type="submit" class="btn btn-primary" id="set-save">' + U.icon("save", 17) + "<span>Simpan Pengaturan</span></button></div>" +
          "</form>" +
        "</div>" +
        '<div class="settings-side">' +
          '<div class="card">' +
            '<div class="card-head"><div><h3>Akun</h3><p>Akun yang sedang digunakan.</p></div></div>' +
            '<div class="account-card"><span class="avatar avatar-lg">' + U.escape(U.initials((window.APP_STATE.profile && window.APP_STATE.profile.full_name) || email)) + "</span>" +
              '<div><strong>' + U.escape((window.APP_STATE.profile && window.APP_STATE.profile.full_name) || "Guru BK") + "</strong><small>" + U.escape(email) + "</small></div></div>" +
            '<div class="account-meta"><div><span>Peran</span><strong>' + U.escape(API.roleLabel(user.role)) + "</strong></div>" +
              '<div><span>Total Siswa Aktif</span><strong>' + students.length + " siswa</strong></div>" +
              '<div><span>Semester berjalan</span><strong>' +
                (window.APP_STATE.activeSemester && window.APP_STATE.activeYear
                  ? U.escape(U.SEMESTER_LABEL[window.APP_STATE.activeSemester.jenis] + " · " + U.tahunAjaranLabel(window.APP_STATE.activeYear))
                  : "Belum diatur") + "</strong></div>" +
              '<div><span>Data akademik</span><strong>' + (window.APP_STATE.academicYears || []).length + " tahun ajaran</strong></div></div>" +
            '<button type="button" class="btn btn-secondary btn-block" id="set-password">' + U.icon("lock", 17) + "<span>Ganti Password</span></button>" +
            '<button type="button" class="btn btn-danger btn-block" id="set-logout">' + U.icon("logout", 17) + "<span>Keluar dari Akun</span></button>" +
          "</div>" +
          '<div class="card">' +
            '<div class="card-head"><div><h3>Data &amp; Template</h3><p>Alat bantu pengelolaan data.</p></div></div>' +
            '<div class="settings-actions">' +
              '<button type="button" class="btn btn-secondary btn-block" id="set-template">' + U.icon("download", 17) + "<span>Unduh Template Import Siswa</span></button>" +
              '<button type="button" class="btn btn-secondary btn-block" id="set-export">' + U.icon("download", 17) + "<span>Ekspor Data Siswa (Excel)</span></button>" +
            "</div>" +
          "</div>" +
          (API.isAdmin() ? '<div class="card">' +
            '<div class="card-head"><div><h3>Pemeliharaan Data</h3><p>Data akademik tetap tersimpan sampai 5 tahun.</p></div></div>' +
            '<div class="settings-actions">' +
              '<button type="button" class="btn btn-secondary btn-block" id="set-archive">' + U.icon("clock", 17) + "<span>Arsipkan Tahun Ajaran &gt; 5 Tahun</span></button>" +
              '<a class="btn btn-secondary btn-block" href="#/tahun">' + U.icon("calendar", 17) + "<span>Kelola Tahun Ajaran &amp; Semester</span></a>" +
              (API.isSuperadmin() ? '<a class="btn btn-secondary btn-block" href="#/akun">' + U.icon("lock", 17) + "<span>Kelola Akun Admin</span></a>" : "") +
            "</div>" +
            '<p class="form-hint">Arsip hanya menonaktifkan tampilan (is_aktif = false). Tidak ada data yang dihapus.</p>' +
          "</div>" : "") +
          '<div class="card">' +
            '<div class="card-head"><div><h3>Tentang Aplikasi</h3><p>Informasi teknis.</p></div></div>' +
            '<div class="about-list">' +
              '<div><span>Versi</span><strong>' + U.escape(window.BK_CONFIG.VERSION) + "</strong></div>" +
              '<div><span>Database</span><code>' + U.escape(window.BK_CONFIG.DB_LABEL || "PostgreSQL (Supabase)") + "</code></div>" +
              '<div><span>Status</span><span class="badge badge-success">Terhubung</span></div>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>";

    bind();
  }

  function openPasswordModal() {
    U.modal({
      title: "Ganti Password",
      subtitle: "Masukkan password saat ini dan password baru (minimal 8 karakter).",
      size: "sm",
      body: '<div class="form-stack">' +
        '<div class="field"><label for="pw-current">Password saat ini</label><input type="password" id="pw-current" autocomplete="current-password"></div>' +
        '<div class="field"><label for="pw-new">Password baru</label><input type="password" id="pw-new" autocomplete="new-password"></div>' +
        '<div class="field"><label for="pw-confirm">Ulangi password baru</label><input type="password" id="pw-confirm" autocomplete="new-password"></div>' +
        '<div id="pw-error" class="auth-error hidden"></div>' +
      "</div>",
      actions: [
        { label: "Batal", class: "btn-secondary" },
        {
          label: "Simpan Password",
          class: "btn-primary",
          icon: "save",
          close: false,
          onClick: async function (close, overlay, bodyEl) {
            var current = U.$("#pw-current", bodyEl).value;
            var next = U.$("#pw-new", bodyEl).value;
            var confirm = U.$("#pw-confirm", bodyEl).value;
            var errBox = U.$("#pw-error", bodyEl);

            errBox.classList.add("hidden");
            if (!current || !next) {
              errBox.textContent = "Semua kolom wajib diisi.";
              errBox.classList.remove("hidden");
              return;
            }
            if (next.length < 8) {
              errBox.textContent = "Password baru minimal 8 karakter.";
              errBox.classList.remove("hidden");
              return;
            }
            if (next !== confirm) {
              errBox.textContent = "Ulangi password baru belum sama.";
              errBox.classList.remove("hidden");
              return;
            }

            var btn = bodyEl.parentNode.querySelector(".modal-foot .btn-primary");
            if (btn) U.buttonLoading(btn, true);
            try {
              await API.changePassword(current, next);
              U.toast("Password berhasil diubah.", "success");
              close();
            } catch (err) {
              errBox.textContent = API.errorMessage(err);
              errBox.classList.remove("hidden");
            } finally {
              if (btn) U.buttonLoading(btn, false);
            }
          }
        }
      ]
    });
  }

  function bind() {
    var c = state.container;
    U.$("#set-form", c).addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = U.$("#set-save", c);
      var patch = {
        nama_madrasah: U.$("#set-nama_madrasah", c).value.trim(),
        alamat: U.$("#set-alamat", c).value.trim() || null,
        kota: U.$("#set-kota", c).value.trim(),
        kepala_nama: U.$("#set-kepala_nama", c).value.trim(),
        kepala_nip: stripNip(U.$("#set-kepala_nip", c).value),
        guru_nama: U.$("#set-guru_nama", c).value.trim(),
        guru_nip: stripNip(U.$("#set-guru_nip", c).value),
        guru_jabatan: U.$("#set-guru_jabatan", c).value.trim()
      };
      if (!patch.nama_madrasah) { U.toast("Nama madrasah wajib diisi.", "warning"); return; }
      U.buttonLoading(btn, true);
      try {
        var saved = await API.saveSettings(patch);
        window.APP_STATE.settings = saved || Object.assign({}, window.APP_STATE.settings, patch);
        U.toast("Pengaturan berhasil disimpan.", "success");
      } catch (err) {
        U.toast(API.errorMessage(err), "error");
      } finally {
        U.buttonLoading(btn, false);
      }
    });
    var archiveBtn = U.$("#set-archive", c);
    if (archiveBtn) {
      archiveBtn.addEventListener("click", async function () {
        var ok = await U.confirm("Arsipkan tahun ajaran yang lebih tua dari 5 tahun? Data tidak dihapus, hanya dinonaktifkan.", {
          title: "Arsipkan Data Lama", confirmLabel: "Ya, Arsipkan", danger: true
        });
        if (!ok) return;
        try {
          var n = await API.archiveOldYears();
          U.toast((n || 0) + " tahun ajaran diarsipkan.", "success");
          await App.refreshAcademic();
        } catch (err) { U.toast(API.errorMessage(err), "error"); }
      });
    }
    U.$("#set-logout", c).addEventListener("click", function () { App.logout(); });
    U.$("#set-password", c).addEventListener("click", openPasswordModal);
    U.$("#set-template", c).addEventListener("click", function () { EX.studentsTemplate(); });
    U.$("#set-export", c).addEventListener("click", function () {
      var list = window.APP_STATE.students || [];
      if (!list.length) { U.toast("Belum ada data siswa.", "warning"); return; }
      EX.studentsExcel(list);
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.settings = { render: render };
})();