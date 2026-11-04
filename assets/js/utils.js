/* ============================================================
   Utilitas umum: DOM, tanggal, modal, toast, ikon
   ============================================================ */
(function () {
  "use strict";

  var U = {};

  /* ---------- DOM ---------- */
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  U.escape = function (value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  U.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "dataset") Object.keys(attrs[k]).forEach(function (d) { node.dataset[d] = attrs[k][d]; });
        else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  };

  U.on = function (root, eventName, selector, handler) {
    if (!root) return;
    root.addEventListener(eventName, function (e) {
      var target = e.target.closest(selector);
      if (target && root.contains(target)) handler(e, target);
    });
  };

  U.debounce = function (fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  };

  U.uid = function () {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  };

  /* ---------- Ikon (inline SVG) ---------- */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    calendarCheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    filePlus: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',
    chevronUp: '<polyline points="18 15 12 9 6 15"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>'
  };

  U.icon = function (name, size) {
    var path = ICONS[name] || ICONS.info;
    var s = size || 20;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>";
  };

  /* ---------- Tanggal ---------- */
  var MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  U.MONTHS = MONTHS;
  U.DAYS = DAYS;

  U.todayISO = function () {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  };

  U.firstDayOfMonthISO = function (date) {
    var d = date ? new Date(date + "T00:00:00") : new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
  };

  U.lastDayOfMonthISO = function (date) {
    var d = date ? new Date(date + "T00:00:00") : new Date();
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.getFullYear() + "-" + String(last.getMonth() + 1).padStart(2, "0") + "-" + String(last.getDate()).padStart(2, "0");
  };

  U.parseISO = function (iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };

  U.formatDateLong = function (iso) {
    var d = U.parseISO(iso);
    if (!d) return "-";
    return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  };

  U.formatDateID = function (iso) {
    var d = U.parseISO(iso);
    if (!d) return "-";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  };

  U.formatDateShort = function (iso) {
    var d = U.parseISO(iso);
    if (!d) return "-";
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  };

  U.formatTanggalPendek = function (iso) {
    var d = U.parseISO(iso);
    if (!d) return "-";
    return d.getDate() + " - " + String(d.getMonth() + 1).padStart(2, "0") + " - " + d.getFullYear();
  };

  U.monthKey = function (iso) { return iso ? String(iso).slice(0, 7) : ""; };

  U.monthLabel = function (ym) {
    if (!ym) return "-";
    var p = String(ym).slice(0, 7).split("-");
    if (p.length < 2) return ym;
    return MONTHS[Number(p[1]) - 1] + " " + p[0];
  };

  U.monthLabelFromDate = function (iso) {
    var d = U.parseISO(iso);
    if (!d) return "-";
    return MONTHS[d.getMonth()] + " " + d.getFullYear();
  };

  U.nowLabel = function () {
    var d = new Date();
    return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  };

  /* ---------- Label status ---------- */
  U.statusLabel = function (status) { return status === "masuk" ? "Masuk" : "Tidak Masuk"; };
  U.alasanLabel = function (k) {
    return { alpa: "Alpa", sakit: "Sakit", izin: "Izin" }[k] || "-";
  };
  U.capitalize = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; };

  U.initials = function (name) {
    if (!name) return "BK";
    var parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "BK";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  U.slug = function (s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  /* ---------- Toast ---------- */
  U.toast = function (message, type, timeout) {
    var wrap = U.$("#toast-container");
    if (!wrap) {
      wrap = U.el("div", { id: "toast-container", class: "toast-container" });
      document.body.appendChild(wrap);
    }
    type = type || "success";
    var iconName = type === "success" ? "checkCircle" : type === "error" ? "alert" : type === "warning" ? "alert" : "info";
    var node = U.el("div", { class: "toast toast-" + type, html: '<span class="toast-icon">' + U.icon(iconName, 19) + '</span><span class="toast-msg">' + U.escape(message) + "</span>" });
    wrap.appendChild(node);
    requestAnimationFrame(function () { node.classList.add("show"); });
    setTimeout(function () {
      node.classList.remove("show");
      setTimeout(function () { node.remove(); }, 250);
    }, timeout || 3800);
  };

  /* ---------- Modal ---------- */
  var activeModal = null;
  U.modal = function (opts) {
    opts = opts || {};
    if (activeModal) activeModal.close();

    var overlay = U.el("div", { class: "modal-overlay" });
    var card = U.el("div", { class: "modal-card " + (opts.size ? "modal-" + opts.size : "") });
    var head = U.el("div", { class: "modal-head", html:
      '<div class="modal-title-wrap"><h3>' + U.escape(opts.title || "") + "</h3>" +
      (opts.subtitle ? '<p class="modal-subtitle">' + U.escape(opts.subtitle) + "</p>" : "") +
      '</div><button type="button" class="icon-btn modal-close" aria-label="Tutup">' + U.icon("x", 18) + "</button>" });
    var body = U.el("div", { class: "modal-body" });
    if (opts.body) {
      if (typeof opts.body === "string") body.innerHTML = opts.body;
      else body.appendChild(opts.body);
    }
    var foot = U.el("div", { class: "modal-foot" });

    function close() {
      overlay.classList.remove("show");
      document.body.classList.remove("modal-open");
      setTimeout(function () { overlay.remove(); }, 180);
      document.removeEventListener("keydown", onKey);
      if (activeModal && activeModal.overlay === overlay) activeModal = null;
      if (opts.onClose) opts.onClose();
    }

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    head.querySelector(".modal-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);

    (opts.actions || []).forEach(function (a) {
      var btn = U.el("button", {
        type: "button",
        class: "btn " + (a.class || "btn-secondary"),
        html: (a.icon ? U.icon(a.icon, 17) : "") + "<span>" + U.escape(a.label) + "</span>"
      });
      btn.addEventListener("click", function () {
        var keep = a.onClick ? a.onClick(close, overlay, body) : undefined;
        if (a.close !== false && keep !== false) close();
      });
      foot.appendChild(btn);
    });

    card.appendChild(head);
    card.appendChild(body);
    if (foot.children.length) card.appendChild(foot);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
    requestAnimationFrame(function () { overlay.classList.add("show"); });

    activeModal = { overlay: overlay, close: close, body: body };
    if (opts.onMount) opts.onMount(body, close);
    setTimeout(function () {
      var focusable = body.querySelector("input:not([type=hidden]), select, textarea, button");
      if (focusable) focusable.focus();
    }, 120);
    return activeModal;
  };

  U.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = U.modal({
        title: opts.title || "Konfirmasi",
        subtitle: opts.subtitle || "",
        size: "sm",
        body: '<p class="confirm-text">' + U.escape(message) + "</p>",
        actions: [
          { label: opts.cancelLabel || "Batal", class: "btn-secondary", onClick: function () { resolve(false); } },
          { label: opts.confirmLabel || "Ya, Lanjutkan", class: opts.danger === false ? "btn-primary" : "btn-danger", onClick: function () { resolve(true); } }
        ],
        onClose: function () { resolve(false); }
      });
      return m;
    });
  };

  /* ---------- Loading overlay ---------- */
  U.loading = function (show, text) {
    var node = U.$("#global-loading");
    if (!node) return;
    if (show) {
      var label = node.querySelector(".loading-text");
      if (label && text) label.textContent = text;
      node.classList.remove("hidden");
    } else {
      node.classList.add("hidden");
    }
  };

  U.buttonLoading = function (btn, loading, label) {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      if (btn.classList.contains("icon-btn")) {
        btn.innerHTML = '<span class="spinner"></span>';
      } else {
        btn.innerHTML = '<span class="spinner spinner-sm"></span><span>Memproses…</span>';
      }
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) btn.innerHTML = label || btn.dataset.originalHtml;
    }
  };

  /* ---------- Download ---------- */
  U.downloadBlob = function (blob, filename) {
    if (window.saveAs) { window.saveAs(blob, filename); return; }
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  U.filename = function (parts) {
    return parts.filter(Boolean).join("_").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  };

  /* ---------- Empty state ---------- */
  U.emptyState = function (iconName, title, text, actionHtml) {
    return '<div class="empty-state">' +
      '<div class="empty-icon">' + U.icon(iconName || "info", 30) + "</div>" +
      "<h4>" + U.escape(title || "Belum ada data") + "</h4>" +
      "<p>" + U.escape(text || "") + "</p>" +
      (actionHtml ? '<div class="empty-action">' + actionHtml + "</div>" : "") +
      "</div>";
  };

  /* ---------- Misc ---------- */
  U.sortStudents = function (list) {
    return list.slice().sort(function (a, b) {
      if (a.kelas !== b.kelas) return String(a.kelas).localeCompare(String(b.kelas), "id", { numeric: true });
      var na = a.no_urut == null ? 9999 : a.no_urut;
      var nb = b.no_urut == null ? 9999 : b.no_urut;
      if (na !== nb) return na - nb;
      return String(a.nama).localeCompare(String(b.nama), "id");
    });
  };

  U.uniqueClasses = function (students) {
    var set = {};
    (students || []).forEach(function (s) { if (s.kelas) set[s.kelas] = true; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, "id", { numeric: true }); });
  };

  U.groupBy = function (list, keyFn) {
    return (list || []).reduce(function (acc, item) {
      var k = keyFn(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  };

  U.percent = function (part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 1000) / 10;
  };

  /* ---------- Akademik ---------- */
  U.TINGKAT_LABEL = { 7: "Kelas VII", 8: "Kelas VIII", 9: "Kelas IX" };
  U.TINGKAT_ROMAN = { 7: "VII", 8: "VIII", 9: "IX" };
  U.SEMESTER_LABEL = { ganjil: "Semester Ganjil", genap: "Semester Genap" };

  U.tahunAjaranLabel = function (year) {
    if (!year) return "-";
    if (year.nama) return year.nama;
    if (!year.tahun_awal) return "-";
    return year.tahun_awal + "/" + (year.tahun_awal + 1);
  };

  U.semesterLabel = function (sem) {
    if (!sem) return "-";
    return (sem.jenis === "genap" ? "Genap" : "Ganjil") + (sem.urutan ? "" : "");
  };

  U.kelasTingkat = function (kelas) {
    var k = String(kelas || "").toUpperCase().replace(/[\s.]/g, "");
    if (/^(IX|9)/.test(k)) return 9;
    if (/^(VIII|8)/.test(k)) return 8;
    return 7;
  };

  U.formatBytes = function (bytes) {
    var b = Number(bytes) || 0;
    if (b < 1024) return b + " B";
    return (Math.round((b / 1024) * 10) / 10) + " KB";
  };

  U.rangeDays = function (from, to) {
    var a = U.parseISO(from);
    var b = U.parseISO(to);
    if (!a || !b) return 0;
    var diff = Math.round((b - a) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  };

  U.addDays = function (iso, n) {
    var d = U.parseISO(iso);
    if (!d) return iso;
    d.setDate(d.getDate() + Number(n || 0));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  U.inRange = function (iso, from, to) {
    if (!iso) return false;
    return (!from || iso >= from) && (!to || iso <= to);
  };

  /* ---------- Kompres gambar ----------
     Memperkecil gambar di browser (canvas) sampai ukuran byte
     maksimal tercapai. Dipakai untuk foto siswa (maks. 100 KB). */
  U.compressImage = function (file, maxBytes, opts) {
    var o = opts || {};
    var limit = maxBytes || 102400;
    var maxDim = o.maxDimension || 900;
    var startQuality = o.quality || 0.85;

    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error("File tidak ditemukan.")); return; }
      if (!/^image\//.test(file.type || "")) {
        reject(new Error("File harus berupa gambar (JPG, PNG, atau WEBP)."));
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("File tidak dapat dibaca.")); };
      reader.onload = function (ev) {
        var img = new Image();
        img.onerror = function () { reject(new Error("Gambar tidak dapat diproses.")); };
        img.onload = function () {
          var attempts = [];
          var dims = [maxDim, Math.round(maxDim * 0.8), Math.round(maxDim * 0.6), Math.round(maxDim * 0.45), 320];
          var qualities = [startQuality, 0.72, 0.6, 0.48, 0.38, 0.3];
          dims.forEach(function (dim) {
            qualities.forEach(function (q) { attempts.push({ dim: dim, quality: q }); });
          });

          var idx = 0;
          function tryNext() {
            if (idx >= attempts.length) {
              reject(new Error("Gambar tidak dapat dikompres di bawah " + U.formatBytes(limit) + "."));
              return;
            }
            var a = attempts[idx++];
            var scale = Math.min(1, a.dim / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            canvas.toBlob(function (blob) {
              if (!blob) { tryNext(); return; }
              if (blob.size <= limit) {
                resolve({ blob: blob, width: w, height: h, quality: a.quality, size: blob.size });
              } else {
                tryNext();
              }
            }, a.quality >= 0.95 ? "image/png" : "image/jpeg", a.quality);
          }
          tryNext();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  /* ---------- Preview foto (avatar) ---------- */
  U.avatarHtml = function (student, size) {
    var cls = "avatar" + (size ? " " + size : "");
    var url = student && window.API && API.getPhotoUrl ? API.getPhotoUrl(student) : "";
    if (url) {
      return '<span class="' + cls + ' avatar-photo"><img src="' + U.escape(url) + '" alt="' + U.escape(student.nama || "Foto siswa") + '" loading="lazy"></span>';
    }
    return '<span class="' + cls + '">' + U.escape(U.initials(student && student.nama)) + "</span>";
  };

  window.U = U;
})();