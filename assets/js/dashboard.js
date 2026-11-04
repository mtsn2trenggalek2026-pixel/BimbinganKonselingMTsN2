/* ============================================================
   Halaman Dasbor
   ============================================================ */
(function () {
  "use strict";

  function statCard(icon, label, value, sub, tone) {
    return '<div class="stat-card">' +
      '<div class="stat-icon tone-' + (tone || "teal") + '">' + U.icon(icon, 22) + "</div>" +
      '<div class="stat-body"><span class="stat-label">' + U.escape(label) + "</span>" +
      '<strong class="stat-value">' + value + "</strong>" +
      (sub ? '<span class="stat-sub">' + sub + "</span>" : "") +
      "</div></div>";
  }

  function render(container) {
    var students = window.APP_STATE.students || [];
    var today = U.todayISO();
    var profile = window.APP_STATE.profile || {};
    var userName = profile.full_name || (window.APP_STATE.user && window.APP_STATE.user.email) || "Guru BK";

    container.innerHTML =
      '<div class="welcome-banner">' +
        '<div class="welcome-text">' +
          "<span class=\"eyebrow\">" + U.escape(U.formatDateLong(today)) + "</span>" +
          "<h2>Selamat datang, " + U.escape(String(userName).split("@")[0]) + " 👋</h2>" +
          "<p>Kelola absensi dan laporan kerja Bimbingan Konseling dalam satu tempat.</p>" +
        "</div>" +
        '<div class="welcome-art" aria-hidden="true">' +
          '<div class="art-circle c1"></div><div class="art-circle c2"></div>' +
          '<div class="art-card"><span class="art-icon">' + U.icon("clipboard", 26) + "</span><span>BK<br><small>MTsN 2 Trenggalek</small></span></div>" +
        "</div>" +
      "</div>" +
      '<div class="quick-actions">' +
        '<a class="quick-action" href="#/absensi"><span class="qa-icon tone-teal">' + U.icon("calendarCheck", 20) + "</span><span><strong>Input Absensi</strong><small>Catat kehadiran hari ini</small></span>" + U.icon("arrowRight", 17) + "</a>" +
        '<a class="quick-action" href="#/laporan?new=1"><span class="qa-icon tone-amber">' + U.icon("filePlus", 20) + "</span><span><strong>Buat Laporan Kerja</strong><small>Laporan siap cetak</small></span>" + U.icon("arrowRight", 17) + "</a>" +
        '<a class="quick-action" href="#/rekap"><span class="qa-icon tone-blue">' + U.icon("chart", 20) + "</span><span><strong>Rekap Absensi</strong><small>Lihat rekap periode</small></span>" + U.icon("arrowRight", 17) + "</a>" +
        '<a class="quick-action" href="#/siswa"><span class="qa-icon tone-violet">' + U.icon("users", 20) + "</span><span><strong>Data Siswa</strong><small>Kelola daftar siswa</small></span>" + U.icon("arrowRight", 17) + "</a>" +
      "</div>" +
      '<div id="dashboard-stats" class="stats-grid">' +
        statCard("users", "Total Siswa", '<span class="skeleton-text">—</span>', "siswa aktif", "teal") +
        statCard("checkCircle", "Hadir Hari Ini", '<span class="skeleton-text">—</span>', "memuat…", "green") +
        statCard("alert", "Tidak Masuk", '<span class="skeleton-text">—</span>', "memuat…", "red") +
        statCard("file", "Laporan Bulan Ini", '<span class="skeleton-text">—</span>', "memuat…", "amber") +
      "</div>" +
      '<div class="dashboard-grid">' +
        '<div class="card"><div class="card-head"><div><h3>Absensi per Kelas</h3><p>Kehadiran hari ini</p></div><a href="#/absensi" class="link-sm">Lihat absensi ' + U.icon("arrowRight", 14) + "</a></div><div id=\"class-bars\" class=\"class-bars\"><div class=\"skeleton-block\"></div></div></div>" +
        '<div class="card"><div class="card-head"><div><h3>Siswa Tidak Masuk</h3><p>Hari ini</p></div><a href="#/absensi" class="link-sm">Detail ' + U.icon("arrowRight", 14) + "</a></div><div id=\"absent-list\" class=\"mini-list\"><div class=\"skeleton-block\"></div></div></div>" +
      "</div>" +
      '<div class="card"><div class="card-head"><div><h3>Laporan Kerja Terbaru</h3><p>Dokumen yang tersimpan</p></div><a href="#/laporan" class="link-sm">Semua laporan ' + U.icon("arrowRight", 14) + "</a></div><div id=\"recent-reports\" class=\"mini-list\"><div class=\"skeleton-block\"></div></div></div>";

    load(container, students, today);
  }

  async function load(container, students, today) {
    try {
      var results = await Promise.all([
        API.getAttendanceByDate(today),
        API.getReports()
      ]);
      var att = results[0] || [];
      var reports = results[1] || [];

      var studentById = {};
      students.forEach(function (s) { studentById[s.id] = s; });

      var hadir = att.filter(function (a) { return a.status === "masuk"; }).length;
      var tidak = att.filter(function (a) { return a.status === "tidak_masuk"; });
      var alpa = tidak.filter(function (a) { return a.keterangan === "alpa"; }).length;
      var sakit = tidak.filter(function (a) { return a.keterangan === "sakit"; }).length;
      var izin = tidak.filter(function (a) { return a.keterangan === "izin"; }).length;
      var currentMonth = U.monthKey(today);
      var reportsThisMonth = reports.filter(function (r) { return U.monthKey(r.bulan) === currentMonth; }).length;

      var stats = U.$("#dashboard-stats", container);
      stats.innerHTML =
        statCard("users", "Total Siswa", students.length, "siswa aktif", "teal") +
        statCard("checkCircle", "Hadir Hari Ini", hadir, att.length ? "dari " + att.length + " tercatat" : "belum ada absensi", "green") +
        statCard("alert", "Tidak Masuk", tidak.length, "Alpa " + alpa + " · Sakit " + sakit + " · Izin " + izin, "red") +
        statCard("file", "Laporan Bulan Ini", reportsThisMonth, "dokumen tersimpan", "amber");

      // Bar per kelas
      var byClass = U.groupBy(students, function (s) { return s.kelas; });
      var classes = Object.keys(byClass).sort(function (a, b) { return a.localeCompare(b, "id", { numeric: true }); });
      var bars = U.$("#class-bars", container);
      if (!classes.length) {
        bars.innerHTML = U.emptyState("users", "Belum ada data siswa", "Tambahkan siswa terlebih dahulu.");
      } else {
        bars.innerHTML = classes.map(function (kelas) {
          var list = byClass[kelas];
          var ids = {};
          list.forEach(function (s) { ids[s.id] = true; });
          var recs = att.filter(function (a) { return ids[a.student_id]; });
          var h = recs.filter(function (a) { return a.status === "masuk"; }).length;
          var pct = list.length ? Math.round((h / list.length) * 100) : 0;
          var recorded = recs.length > 0;
          return '<div class="class-bar-row">' +
            '<div class="class-bar-label"><span>' + U.escape(kelas) + "</span><small>" + h + "/" + list.length + "</small></div>" +
            '<div class="class-bar-track"><div class="class-bar-fill ' + (recorded ? "" : "muted") + '" style="width:' + (recorded ? pct : 0) + '%"></div></div>' +
            '<div class="class-bar-pct">' + (recorded ? pct + "%" : "—") + "</div>" +
          "</div>";
        }).join("");
      }

      // Daftar tidak masuk
      var absentList = U.$("#absent-list", container);
      if (!tidak.length) {
        absentList.innerHTML = '<div class="mini-empty">' + U.icon("checkCircle", 26) + "<p>Tidak ada siswa tidak masuk hari ini.</p></div>";
      } else {
        absentList.innerHTML = tidak.slice(0, 6).map(function (a) {
          var s = studentById[a.student_id] || {};
          return '<div class="mini-item">' +
            '<span class="avatar avatar-sm">' + U.escape(U.initials(s.nama || "?")) + "</span>" +
            '<div class="mini-item-main"><strong>' + U.escape(s.nama || "Siswa") + "</strong><small>" + U.escape(s.kelas || "-") + "</small></div>" +
            '<span class="badge badge-' + (a.keterangan || "alpa") + '">' + U.escape(U.alasanLabel(a.keterangan)) + "</span>" +
          "</div>";
        }).join("") + (tidak.length > 6 ? '<div class="mini-more">+' + (tidak.length - 6) + " siswa lainnya</div>" : "");
      }

      // Laporan terbaru
      var recent = U.$("#recent-reports", container);
      if (!reports.length) {
        recent.innerHTML = '<div class="mini-empty">' + U.icon("file", 26) + '<p>Belum ada laporan kerja. <a href="#/laporan?new=1">Buat laporan pertama</a>.</p></div>';
      } else {
        recent.innerHTML = reports.slice(0, 4).map(function (r) {
          var count = r.work_report_items && r.work_report_items[0] ? r.work_report_items[0].count : 0;
          return '<div class="mini-item">' +
            '<span class="avatar avatar-sm tone-amber">' + U.icon("file", 16) + "</span>" +
            '<div class="mini-item-main"><strong>Laporan ' + U.escape(U.monthLabelFromDate(r.bulan)) + "</strong><small>" + U.escape(r.nama || "-") + " · " + count + " kegiatan</small></div>" +
            '<a class="btn btn-ghost btn-sm" href="#/laporan?edit=' + encodeURIComponent(r.id) + '">Buka ' + U.icon("arrowRight", 14) + "</a>" +
          "</div>";
        }).join("");
      }

      if (!att.length) {
        var banner = U.el("div", {
          class: "notice notice-warning",
          html: U.icon("info", 18) + "<span>Belum ada absensi untuk hari ini. </span><a href=\"#/absensi\" class=\"notice-link\">Input sekarang →</a>"
        });
        var bannerTarget = U.$("#dashboard-stats", container);
        bannerTarget.parentNode.insertBefore(banner, bannerTarget);
      }
    } catch (err) {
      var msg = API.errorMessage(err);
      U.$("#dashboard-stats", container).innerHTML = '<div class="notice notice-danger">' + U.icon("alert", 18) + "<span>" + U.escape(msg) + "</span></div>";
      U.$("#class-bars", container).innerHTML = "";
      U.$("#absent-list", container).innerHTML = "";
      U.$("#recent-reports", container).innerHTML = "";
      U.toast(msg, "error");
    }
  }

  window.Pages = window.Pages || {};
  window.Pages.dashboard = { render: render };
})();