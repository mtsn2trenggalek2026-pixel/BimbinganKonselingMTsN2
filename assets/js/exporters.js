/* ============================================================
   Ekspor: Excel (XLSX), PDF (jsPDF), Word (docx)
   ============================================================ */
(function () {
  "use strict";

  var EX = {};

  function settings() {
    return (window.APP_STATE && window.APP_STATE.settings) || {};
  }

  function schoolName() {
    return settings().nama_madrasah || window.BK_CONFIG.SCHOOL_NAME || "MTsN 2 Trenggalek";
  }

  function kepalaNama() {
    return settings().kepala_nama || window.BK_CONFIG.DEFAULT_KEPALA_NAMA;
  }

  function kepalaNip() {
    return settings().kepala_nip || window.BK_CONFIG.DEFAULT_KEPALA_NIP;
  }

  function guruNama(report) {
    return (report && report.nama) || settings().guru_nama || window.BK_CONFIG.DEFAULT_GURU_NAMA;
  }

  function guruNip(report) {
    return (report && report.nip) || settings().guru_nip || window.BK_CONFIG.DEFAULT_GURU_NIP;
  }

  function guruJabatan(report) {
    return (report && report.guru_jabatan) || settings().guru_jabatan || window.BK_CONFIG.DEFAULT_GURU_JABATAN;
  }

  function cleanNip(value) {
    return String(value || "").replace(/^\s*NIP\.?\s*/i, "").trim();
  }

  function nipLabel(value) {
    var v = cleanNip(value);
    return v ? "NIP. " + v : "";
  }

  function kota() {
    return settings().kota || window.BK_CONFIG.DEFAULT_KOTA;
  }

  function ymdNow() { return U.todayISO(); }

  /* ============================================================
     EXCEL — ABSENSI HARIAN
     ============================================================ */
  EX.attendanceExcel = function (rows, meta) {
    meta = meta || {};
    var XLSX = window.XLSX;
    var title = "ABSENSI KEHADIRAN SISWA";
    var sub = schoolName().toUpperCase();
    var tanggal = meta.tanggal || ymdNow();
    var kelasLabel = meta.kelas ? "Kelas: " + meta.kelas : "Semua Kelas";

    var data = [
      [title],
      [sub],
      ["Tanggal: " + U.formatDateLong(tanggal)],
      [kelasLabel],
      [],
      ["No", "Nama Siswa", "L/P", "Kelas", "Kehadiran", "Keterangan", "Catatan"]
    ];

    var counts = { masuk: 0, alpa: 0, sakit: 0, izin: 0 };
    rows.forEach(function (r, i) {
      var ket = r.status === "tidak_masuk" ? U.alasanLabel(r.keterangan) : "-";
      if (r.status === "masuk") counts.masuk++;
      else if (r.keterangan) counts[r.keterangan] = (counts[r.keterangan] || 0) + 1;
      data.push([
        i + 1,
        r.nama,
        r.jenis_kelamin,
        r.kelas,
        r.status === "masuk" ? "Masuk" : "Tidak Masuk",
        ket,
        r.catatan || ""
      ]);
    });

    data.push([]);
    data.push(["Rekap", "Hadir: " + counts.masuk, "Alpa: " + counts.alpa, "Sakit: " + counts.sakit, "Izin: " + counts.izin]);
    data.push([]);
    data.push(["", "", "", "", "", "", ""]);
    data.push(["Mengetahui,", "", "", "", kota() + ", " + U.formatDateID(meta.tanggalTTD || ymdNow()), "", ""]);
    data.push(["Kepala " + schoolName(), "", "", "", guruJabatan(), "", ""]);
    data.push([kepalaNama(), "", "", "", guruNama(), "", ""]);
    data.push([nipLabel(kepalaNip()), "", "", "", nipLabel(guruNip()), "", ""]);

    var ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 38 }, { wch: 6 }, { wch: 10 }, { wch: 13 }, { wch: 12 }, { wch: 24 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }
    ];

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, U.filename(["Absensi", meta.kelas || "Semua Kelas", tanggal]) + ".xlsx");
  };

  /* ============================================================
     EXCEL — REKAP PERIODE
     ============================================================ */
  EX.recapExcel = function (rows, meta) {
    meta = meta || {};
    var XLSX = window.XLSX;
    var from = meta.from || U.firstDayOfMonthISO();
    var to = meta.to || ymdNow();
    var kelasLabel = meta.kelas ? "Kelas: " + meta.kelas : "Semua Kelas";

    var data = [
      ["REKAP ABSENSI KEHADIRAN SISWA"],
      [schoolName().toUpperCase()],
      ["Periode: " + U.formatDateID(from) + " s.d. " + U.formatDateID(to)],
      [kelasLabel],
      [],
      ["No", "Nama Siswa", "L/P", "Kelas", "Hadir", "Alpa", "Sakit", "Izin", "Total Hari", "% Kehadiran"]
    ];

    var total = { hadir: 0, alpa: 0, sakit: 0, izin: 0, hari: 0 };
    rows.forEach(function (r, i) {
      total.hadir += r.hadir; total.alpa += r.alpa; total.sakit += r.sakit; total.izin += r.izin; total.hari += r.total;
      data.push([i + 1, r.nama, r.jenis_kelamin, r.kelas, r.hadir, r.alpa, r.sakit, r.izin, r.total, r.persen + "%"]);
    });
    data.push([]);
    data.push(["", "JUMLAH", "", "", total.hadir, total.alpa, total.sakit, total.izin, total.hari, U.percent(total.hadir, total.hari) + "%"]);
    data.push([]);
    data.push(["Mengetahui,", "", "", "", kota() + ", " + U.formatDateID(meta.tanggalTTD || ymdNow()), "", "", "", "", ""]);
    data.push(["Kepala " + schoolName(), "", "", "", guruJabatan(), "", "", "", "", ""]);
    data.push([kepalaNama(), "", "", "", guruNama(), "", "", "", "", ""]);
    data.push([nipLabel(kepalaNip()), "", "", "", nipLabel(guruNip()), "", "", "", "", ""]);

    var ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 38 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }
    ];

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
    XLSX.writeFile(wb, U.filename(["Rekap Absensi", meta.kelas || "Semua Kelas", from + "_" + to]) + ".xlsx");
  };

  /* ============================================================
     PDF — ABSENSI HARIAN
     ============================================================ */
  function pdfHeader(doc, title, lines) {
    var pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(schoolName().toUpperCase(), pageW / 2, 15, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("BIMBINGAN DAN KONSELING", pageW / 2, 20, { align: "center" });
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.6);
    doc.line(15, 23, pageW - 15, 23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, pageW / 2, 30, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    (lines || []).forEach(function (line, i) {
      doc.text(line, pageW / 2, 36 + i * 5, { align: "center" });
    });
  }

  function pdfFooter(doc) {
    var total = doc.getNumberOfPages();
    for (var i = 1; i <= total; i++) {
      doc.setPage(i);
      var w = doc.internal.pageSize.getWidth();
      var h = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text("Halaman " + i + " dari " + total, w / 2, h - 8, { align: "center" });
    }
  }

  function pdfSignature(doc, startY, report) {
    var pageH = doc.internal.pageSize.getHeight();
    var ttd = (report && (report.tanggal_ttd || report.tanggalTTD)) || ymdNow();
    var rightLabel = kota() + ", " + U.formatDateID(ttd);
    var need = 48;
    if (startY + need > pageH - 16) { doc.addPage(); startY = 20; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(20);
    var leftX = 48;
    var rightX = doc.internal.pageSize.getWidth() - 48;
    var y = startY + 8;
    var leftLines = ["Mengetahui,", "Kepala " + schoolName(), "", "", kepalaNama(), nipLabel(kepalaNip())];
    var rightLines = [rightLabel, guruJabatan(report), "", "", guruNama(report), nipLabel(guruNip(report))];
    leftLines.forEach(function (l, i) { doc.text(l, leftX, y + i * 5, { align: "center" }); });
    rightLines.forEach(function (l, i) { doc.text(l, rightX, y + i * 5, { align: "center" }); });
    return y + leftLines.length * 5;
  }

  EX.attendancePdf = function (rows, meta) {
    meta = meta || {};
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var tanggal = meta.tanggal || ymdNow();
    var kelasLabel = meta.kelas ? "Kelas: " + meta.kelas : "Semua Kelas";
    pdfHeader(doc, "ABSENSI KEHADIRAN SISWA", ["Tanggal: " + U.formatDateLong(tanggal), kelasLabel]);

    var counts = { masuk: 0, alpa: 0, sakit: 0, izin: 0 };
    var body = rows.map(function (r, i) {
      var ket = r.status === "tidak_masuk" ? U.alasanLabel(r.keterangan) : "-";
      if (r.status === "masuk") counts.masuk++;
      else if (r.keterangan) counts[r.keterangan] = (counts[r.keterangan] || 0) + 1;
      return [i + 1, r.nama, r.jenis_kelamin, r.kelas, r.status === "masuk" ? "Masuk" : "Tidak Masuk", ket, r.catatan || ""];
    });

    doc.autoTable({
      startY: 47,
      head: [["No", "Nama Siswa", "L/P", "Kelas", "Kehadiran", "Keterangan", "Catatan"]],
      body: body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, lineColor: [130, 130, 130], lineWidth: 0.1, textColor: [25, 25, 25], valign: "middle" },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [246, 250, 249] },
      columnStyles: {
        0: { halign: "center", cellWidth: 9 },
        1: { cellWidth: 60 },
        2: { halign: "center", cellWidth: 10 },
        3: { halign: "center", cellWidth: 17 },
        4: { halign: "center", cellWidth: 24 },
        5: { halign: "center", cellWidth: 23 },
        6: { cellWidth: 37 }
      },
      margin: { left: 15, right: 15, top: 15, bottom: 16 },
      didDrawPage: function () {
        // header hanya di halaman pertama (sudah digambar manual)
      }
    });

    var y = doc.lastAutoTable.finalY + 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Ringkasan: Hadir " + counts.masuk + "  •  Alpa " + counts.alpa + "  •  Sakit " + counts.sakit + "  •  Izin " + counts.izin + "  •  Total " + rows.length + " siswa", 15, y);
    pdfSignature(doc, y + 4, meta);
    pdfFooter(doc);
    doc.save(U.filename(["Absensi", meta.kelas || "Semua Kelas", tanggal]) + ".pdf");
  };

  /* ============================================================
     PDF — REKAP PERIODE
     ============================================================ */
  EX.recapPdf = function (rows, meta) {
    meta = meta || {};
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    var from = meta.from || U.firstDayOfMonthISO();
    var to = meta.to || ymdNow();
    var kelasLabel = meta.kelas ? "Kelas: " + meta.kelas : "Semua Kelas";
    pdfHeader(doc, "REKAP ABSENSI KEHADIRAN SISWA", ["Periode: " + U.formatDateID(from) + " s.d. " + U.formatDateID(to), kelasLabel]);

    var total = { hadir: 0, alpa: 0, sakit: 0, izin: 0, hari: 0 };
    var body = rows.map(function (r, i) {
      total.hadir += r.hadir; total.alpa += r.alpa; total.sakit += r.sakit; total.izin += r.izin; total.hari += r.total;
      return [i + 1, r.nama, r.jenis_kelamin, r.kelas, r.hadir, r.alpa, r.sakit, r.izin, r.total, r.persen + "%"];
    });
    body.push(["", "JUMLAH", "", "", total.hadir, total.alpa, total.sakit, total.izin, total.hari, U.percent(total.hadir, total.hari) + "%"]);

    doc.autoTable({
      startY: 47,
      head: [["No", "Nama Siswa", "L/P", "Kelas", "Hadir", "Alpa", "Sakit", "Izin", "Total Hari", "% Kehadiran"]],
      body: body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: [130, 130, 130], lineWidth: 0.1, textColor: [25, 25, 25], valign: "middle" },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [246, 250, 249] },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { cellWidth: 90 },
        2: { halign: "center", cellWidth: 14 },
        3: { halign: "center", cellWidth: 24 },
        4: { halign: "center", cellWidth: 20 },
        5: { halign: "center", cellWidth: 20 },
        6: { halign: "center", cellWidth: 20 },
        7: { halign: "center", cellWidth: 20 },
        8: { halign: "center", cellWidth: 24 },
        9: { halign: "center", cellWidth: 31 }
      },
      margin: { left: 15, right: 15, top: 15, bottom: 16 }
    });

    var y = doc.lastAutoTable.finalY + 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Ringkasan: Hadir " + total.hadir + "  •  Alpa " + total.alpa + "  •  Sakit " + total.sakit + "  •  Izin " + total.izin + "  •  Total catatan " + total.hari, 15, y);
    pdfSignature(doc, y + 4, meta);
    pdfFooter(doc);
    doc.save(U.filename(["Rekap Absensi", meta.kelas || "Semua Kelas", from + "_" + to]) + ".pdf");
  };

  /* ============================================================
     WORD — LAPORAN KERJA
     ============================================================ */
  function docxLib() {
    if (window.docx) return window.docx;
    throw new Error("Pustaka Word (docx) gagal dimuat.");
  }

  function splitLines(text) {
    return String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
  }

  function docxParagraph(text, opts) {
    var D = docxLib();
    opts = opts || {};
    return new D.Paragraph({
      alignment: opts.align || D.AlignmentType.LEFT,
      spacing: opts.spacing || { after: 0, line: 240 },
      children: [new D.TextRun({
        text: text == null ? "" : String(text),
        font: opts.font || "Arial",
        size: opts.size || 24,
        bold: Boolean(opts.bold),
        italics: Boolean(opts.italic)
      })]
    });
  }

  function docxCellParagraphs(text, opts) {
    opts = opts || {};
    var lines = splitLines(text);
    if (!lines.length) lines = [""];
    return lines.map(function (line) {
      return docxParagraph(line, opts);
    });
  }

  var DOCX_BORDER = function () {
    var D = docxLib();
    return {
      top: { style: D.BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: D.BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: D.BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: D.BorderStyle.SINGLE, size: 4, color: "000000" },
      insideHorizontal: { style: D.BorderStyle.SINGLE, size: 4, color: "000000" },
      insideVertical: { style: D.BorderStyle.SINGLE, size: 4, color: "000000" }
    };
  };

  EX.reportWord = async function (report, items, meta) {
    meta = meta || {};
    var D = docxLib();
    var bulanLabel = report.bulan ? U.monthLabelFromDate(report.bulan) : "-";

    var identityRows = [
      ["Nama", report.nama || ""],
      ["NIP", cleanNip(report.nip || "")],
      ["Level Jabatan", report.level_jabatan || ""],
      ["Pangkat", report.pangkat || ""],
      ["Golongan Ruang", report.golongan_ruang || ""],
      ["Tugas Tambahan", report.tugas_tambahan || ""],
      ["Bulan", bulanLabel]
    ].map(function (row) {
      return new D.TableRow({
        children: [
          new D.TableCell({
            width: { size: 4035, type: D.WidthType.DXA },
            verticalAlign: D.VerticalAlign.CENTER,
            children: [docxParagraph(row[0], { size: 24 })]
          }),
          new D.TableCell({
            width: { size: 6114, type: D.WidthType.DXA },
            verticalAlign: D.VerticalAlign.CENTER,
            children: [docxParagraph(row[1], { size: 24 })]
          })
        ]
      });
    });

    var identityTable = new D.Table({
      width: { size: 10149, type: D.WidthType.DXA },
      columnWidths: [4035, 6114],
      borders: DOCX_BORDER(),
      rows: identityRows
    });

    var headerRow = new D.TableRow({
      tableHeader: true,
      children: [
        new D.TableCell({ width: { size: 704, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, children: [docxParagraph("No", { align: D.AlignmentType.CENTER, bold: true, size: 28 })] }),
        new D.TableCell({ width: { size: 3280, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, children: [docxParagraph("Kegiatan", { align: D.AlignmentType.CENTER, bold: true, size: 28 })] }),
        new D.TableCell({ width: { size: 3974, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, children: [docxParagraph("Pekerjaan", { align: D.AlignmentType.CENTER, bold: true, size: 28 })] }),
        new D.TableCell({ width: { size: 1818, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, children: [docxParagraph("Tanggal", { align: D.AlignmentType.CENTER, bold: true, size: 28 })] })
      ]
    });

    var itemRows = (items || []).map(function (item, i) {
      return new D.TableRow({
        children: [
          new D.TableCell({ width: { size: 704, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, children: [docxParagraph((item.no_urut || i + 1) + ".", { align: D.AlignmentType.LEFT, size: 24 })] }),
          new D.TableCell({ width: { size: 3280, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, children: docxCellParagraphs(item.kegiatan, { size: 24 }) }),
          new D.TableCell({ width: { size: 3974, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.TOP, children: docxCellParagraphs(item.pekerjaan, { size: 24 }) }),
          new D.TableCell({ width: { size: 1818, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.TOP, children: [docxParagraph(U.formatTanggalPendek(item.tanggal), { size: 24 })] })
        ]
      });
    });

    var workTable = new D.Table({
      width: { size: 9776, type: D.WidthType.DXA },
      columnWidths: [704, 3280, 3974, 1818],
      borders: DOCX_BORDER(),
      rows: [headerRow].concat(itemRows)
    });

    var ttdDate = report.tanggal_ttd ? U.formatDateID(report.tanggal_ttd) : U.formatDateID(U.todayISO());
    var leftLines = ["Mengetahui,", "Kepala " + schoolName(), "", "", kepalaNama(), nipLabel(kepalaNip())];
    var rightLines = [kota() + ", " + ttdDate, guruJabatan(report), "", "", guruNama(report), nipLabel(guruNip(report))];

    function signatureCell(lines, width) {
      return new D.TableCell({
        width: { size: width, type: D.WidthType.DXA },
        children: lines.map(function (line) {
          var isName = line === kepalaNama() || line === guruNama(report);
          return docxParagraph(line || " ", { align: D.AlignmentType.CENTER, size: 24, bold: isName });
        })
      });
    }

    var signatureTable = new D.Table({
      width: { size: 10149, type: D.WidthType.DXA },
      columnWidths: [4035, 6114],
      borders: {
        top: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" }
      },
      rows: [new D.TableRow({ children: [signatureCell(leftLines, 4035), signatureCell(rightLines, 6114)] })]
    });

    var children = [
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [new D.TextRun({ text: "Laporan Kerja", font: "Arial", size: 32, bold: true })]
      }),
      identityTable,
      new D.Paragraph({ spacing: { before: 0, after: 0 }, children: [] }),
      workTable,
      new D.Paragraph({ spacing: { before: 360, after: 0 }, children: [] }),
      signatureTable
    ];

    var doc = new D.Document({
      styles: {
        default: {
          document: { run: { font: "Arial", size: 24 } }
        }
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 794, right: 851, bottom: 851, left: 1134 }
          }
        },
        children: children
      }]
    });

    var blob = await D.Packer.toBlob(doc);
    U.downloadBlob(blob, U.filename(["Laporan Kerja", bulanLabel, report.nama || "Guru BK"]) + ".docx");
  };

  /* ============================================================
     PDF — LAPORAN KERJA
     ============================================================ */
  EX.reportPdf = function (report, items, meta) {
    meta = meta || {};
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth();
    var bulanLabel = report.bulan ? U.monthLabelFromDate(report.bulan) : "-";

    // Judul
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Laporan Kerja", pageW / 2, 18, { align: "center" });

    // Tabel identitas
    var identity = [
      ["Nama", report.nama || ""],
      ["NIP", cleanNip(report.nip || "")],
      ["Level Jabatan", report.level_jabatan || ""],
      ["Pangkat", report.pangkat || ""],
      ["Golongan Ruang", report.golongan_ruang || ""],
      ["Tugas Tambahan", report.tugas_tambahan || ""],
      ["Bulan", bulanLabel]
    ];
    doc.autoTable({
      startY: 24,
      body: identity,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 2.4, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: [20, 20, 20], valign: "middle" },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 125 } },
      margin: { left: 15, right: 15 }
    });

    var bodyItems = (items || []).map(function (item, i) {
      return [(item.no_urut || i + 1) + ".", item.kegiatan || "", item.pekerjaan || "", U.formatTanggalPendek(item.tanggal)];
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY,
      head: [["No", "Kegiatan", "Pekerjaan", "Tanggal"]],
      body: bodyItems,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: [20, 20, 20], valign: "middle", overflow: "linebreak" },
      headStyles: { fontStyle: "bold", halign: "center", fontSize: 10, fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 85 },
        3: { cellWidth: 28, halign: "center" }
      },
      margin: { left: 15, right: 15, top: 15, bottom: 16 }
    });

    var y = doc.lastAutoTable.finalY;
    var ttdDate = report.tanggal_ttd ? U.formatDateID(report.tanggal_ttd) : U.formatDateID(U.todayISO());
    var pageH = doc.internal.pageSize.getHeight();
    if (y + 52 > pageH - 16) { doc.addPage(); y = 15; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    var leftX = 50;
    var rightX = pageW - 50;
    var start = y + 12;
    var left = ["Mengetahui,", "Kepala " + schoolName(), "", "", kepalaNama(), nipLabel(kepalaNip())];
    var right = [kota() + ", " + ttdDate, guruJabatan(report), "", "", guruNama(report), nipLabel(guruNip(report))];
    left.forEach(function (l, i) { doc.text(l, leftX, start + i * 5, { align: "center" }); });
    right.forEach(function (l, i) { doc.text(l, rightX, start + i * 5, { align: "center" }); });

    pdfFooter(doc);
    doc.save(U.filename(["Laporan Kerja", bulanLabel, report.nama || "Guru BK"]) + ".pdf");
  };

  /* ============================================================
     EXCEL — DATA SISWA (template impor & ekspor)
     ============================================================ */
  EX.studentsTemplate = function () {
    var XLSX = window.XLSX;
    var data = [
      ["NO", "NAMA", "L/P", "KELAS", "NIS"],
      [1, "CONTOH NAMA SISWA", "L", "VIII-A", ""],
      [2, "CONTOH NAMA SISWI", "P", "VIII-A", ""]
    ];
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 38 }, { wch: 6 }, { wch: 10 }, { wch: 16 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
  };

  EX.studentsExcel = function (students) {
    var XLSX = window.XLSX;
    var data = [["NO", "NAMA", "L/P", "KELAS", "NIS", "STATUS"]];
    students.forEach(function (s, i) {
      data.push([i + 1, s.nama, s.jenis_kelamin, s.kelas, s.nis || "", s.aktif ? "Aktif" : "Nonaktif"]);
    });
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 38 }, { wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, "Data_Siswa_BK_MTsN_2_Trenggalek.xlsx");
  };

  window.EX = EX;
})();