// Turni — Controllo Totale
(function () {
  "use strict";

  /* ─── State ─────────────────────────────────── */
  let weekStart = getWeekStart(new Date());
  let staffList = [];
  let shiftsData = [];
  let editingShiftId = null;
  let selectedType = "work";
  let filterArea = "";

  /* ─── Helpers ────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function toIso(d) {
    return d.toISOString().slice(0, 10);
  }

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function isoToDate(iso) {
    return new Date(iso + "T12:00:00");
  }

  function formatWeekLabel(start, end) {
    const opts = { day: "numeric", month: "short" };
    return start.toLocaleDateString("it-IT", opts) + " – " + end.toLocaleDateString("it-IT", { ...opts, year: "numeric" });
  }

  function formatDayHeader(date) {
    const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return days[date.getDay()] + " " + date.getDate() + " " + months[date.getMonth()];
  }

  function todayIso() {
    return toIso(new Date());
  }

  function computeHours(shift) {
    if (!shift.start || !shift.end) return 0;
    const [sh, sm] = shift.start.split(":").map(Number);
    const [eh, em] = shift.end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins / 60 : 0;
  }

  function chipClass(type) {
    const map = { work: "type-work", ferie: "type-ferie", malattia: "type-malattia", permesso: "type-permesso", riposo: "type-riposo" };
    return "shift-chip " + (map[type] || "type-work");
  }

  function chipLabel(shift) {
    const typeLabel = { work: "Lavoro", ferie: "Ferie", malattia: "Malattia", permesso: "Permesso", riposo: "Riposo" };
    const t = shift.type || shift.status || "work";
    const label = typeLabel[t] || t;
    const time = (shift.start && shift.end && t === "work") ? " " + shift.start + "–" + shift.end : "";
    return label + time;
  }

  function staffName(staffId) {
    const s = staffList.find((m) => m.id === staffId);
    if (s) return (s.name || "") + " " + (s.surname || "");
    return "—";
  }

  /* ─── API ────────────────────────────────────── */
  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || "Errore richiesta");
    return data;
  }

  async function loadStaff() {
    try {
      const data = await api("/api/staff");
      staffList = Array.isArray(data) ? data : (data.staff || []);
    } catch (_) {
      staffList = [];
    }
    fillStaffSelect();
    updateKpiStaff();
  }

  async function loadShifts() {
    const from = toIso(weekStart);
    const to = toIso(addDays(weekStart, 6));
    try {
      const data = await api(`/api/staff/shifts/by-range?dateFrom=${from}&dateTo=${to}`);
      shiftsData = Array.isArray(data) ? data : (data.shifts || []);
    } catch (e) {
      shiftsData = [];
      showMsg(e.message, false);
    }
    renderWeekGrid();
    renderShiftList();
    updateKpis();
  }

  /* ─── Render ─────────────────────────────────── */
  function renderWeekGrid() {
    const today = todayIso();
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekDayIsos = weekDays.map(toIso);

    // Update header
    const headerRow = $("week-header-row");
    headerRow.innerHTML = '<th class="col-staff">Operatore</th>';
    weekDays.forEach((d, i) => {
      const iso = weekDayIsos[i];
      const th = document.createElement("th");
      if (iso === today) th.className = "today-col";
      th.innerHTML = formatDayHeader(d);
      headerRow.appendChild(th);
    });

    // Filter shifts
    let filtered = shiftsData;
    if (filterArea) filtered = filtered.filter((s) => (s.area || s.department || "") === filterArea);

    // Group by staffId
    const staffInShifts = new Set();
    filtered.forEach((s) => { if (s.staffId) staffInShifts.add(s.staffId); });

    // Rows: one per staff member who has shifts + "unknown" row
    const rows = {};
    filtered.forEach((s) => {
      const key = s.staffId || "__free__";
      if (!rows[key]) rows[key] = {};
      const dayIso = s.date;
      if (!rows[key][dayIso]) rows[key][dayIso] = [];
      rows[key][dayIso].push(s);
    });

    const tbody = $("week-tbody");
    tbody.innerHTML = "";

    const keys = Object.keys(rows);
    if (keys.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.className = "empty-state";
      td.style.textAlign = "center";
      td.style.padding = "30px";
      td.style.color = "var(--text-muted)";
      td.textContent = "Nessun turno pianificato per questa settimana.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    keys.forEach((key) => {
      const tr = document.createElement("tr");

      // Staff name cell
      const tdName = document.createElement("td");
      tdName.className = "staff-name-cell";
      if (key === "__free__") {
        tdName.textContent = "— Libero —";
        tdName.style.color = "var(--text-muted)";
      } else {
        tdName.textContent = staffName(key);
      }
      tr.appendChild(tdName);

      // Day cells
      weekDayIsos.forEach((dayIso) => {
        const td = document.createElement("td");
        if (dayIso === today) td.className = "today-col";
        const dayShifts = rows[key][dayIso] || [];

        dayShifts.forEach((s) => {
          const chip = document.createElement("button");
          chip.className = chipClass(s.type || "work");
          chip.textContent = chipLabel(s);
          chip.dataset.id = s.id;
          chip.addEventListener("click", () => openEditModal(s));
          td.appendChild(chip);
        });

        // Add button
        const addBtn = document.createElement("button");
        addBtn.className = "add-shift-btn";
        addBtn.title = "Aggiungi turno";
        addBtn.textContent = "+";
        addBtn.dataset.date = dayIso;
        addBtn.dataset.staffId = key !== "__free__" ? key : "";
        addBtn.addEventListener("click", (e) => {
          openAddModal(e.currentTarget.dataset.date, e.currentTarget.dataset.staffId);
        });
        td.appendChild(addBtn);

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    // Add a "new staff" row at the bottom for adding shifts
    const trNew = document.createElement("tr");
    const tdNewName = document.createElement("td");
    tdNewName.className = "staff-name-cell";
    tdNewName.style.color = "var(--text-muted)";
    tdNewName.style.fontStyle = "italic";
    tdNewName.textContent = "Aggiungi operatore…";
    trNew.appendChild(tdNewName);
    weekDayIsos.forEach((dayIso) => {
      const td = document.createElement("td");
      if (dayIso === today) td.className = "today-col";
      const addBtn = document.createElement("button");
      addBtn.className = "add-shift-btn";
      addBtn.title = "Aggiungi turno";
      addBtn.textContent = "+";
      addBtn.dataset.date = dayIso;
      addBtn.addEventListener("click", (e) => openAddModal(e.currentTarget.dataset.date, ""));
      td.appendChild(addBtn);
      trNew.appendChild(td);
    });
    tbody.appendChild(trNew);
  }

  function renderShiftList() {
    const body = $("shift-list-body");
    let filtered = shiftsData;
    if (filterArea) filtered = filtered.filter((s) => (s.area || s.department || "") === filterArea);
    filtered = filtered.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.start || "").localeCompare(b.start || ""));

    if (filtered.length === 0) {
      body.innerHTML = '<div class="empty-state">Nessun turno nella settimana selezionata.</div>';
      return;
    }

    const typeLabel = { work: "Lavoro", ferie: "Ferie", malattia: "Malattia", permesso: "Permesso", riposo: "Riposo" };

    body.innerHTML = "";
    filtered.forEach((s) => {
      const row = document.createElement("div");
      row.className = "shift-row";
      const name = s.staffId ? staffName(s.staffId) : (s.staffName || "—");
      const area = s.area || s.department || "—";
      const type = s.type || "work";
      const t = typeLabel[type] || type;
      const time = (s.start && s.end && type === "work") ? s.start + " – " + s.end : t;

      row.innerHTML = `
        <span class="date-cell">${formatDayShort(s.date)}</span>
        <span class="name-cell">${esc(name)}</span>
        <span><span class="area-badge">${esc(area)}</span></span>
        <span class="time-cell">${esc(time)}</span>
        <span class="time-cell">${computeHours(s).toFixed(1)}h</span>
        <span class="muted" style="font-size:12px;">${esc(s.notes || "")}</span>
        <button class="btn ghost small" data-id="${s.id}" onclick="window._editShift('${s.id}')">Modifica</button>
      `;
      body.appendChild(row);
    });
  }

  function formatDayShort(iso) {
    if (!iso) return "—";
    try {
      const d = isoToDate(iso);
      return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
    } catch (_) { return iso; }
  }

  function esc(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function updateKpis() {
    const filtered = filterArea ? shiftsData.filter((s) => (s.area || s.department || "") === filterArea) : shiftsData;
    $("kpi-total").textContent = filtered.length;
    const hours = filtered.filter((s) => (s.type || "work") === "work").reduce((acc, s) => acc + computeHours(s), 0);
    $("kpi-hours").textContent = hours.toFixed(1) + "h";
    const absences = filtered.filter((s) => ["ferie", "malattia", "permesso", "riposo"].includes(s.type || "")).length;
    $("kpi-absences").textContent = absences;
  }

  function updateKpiStaff() {
    $("kpi-staff").textContent = staffList.length;
  }

  /* ─── Week navigation ─────────────────────────── */
  function setWeek(date) {
    weekStart = getWeekStart(date);
    const weekEnd = addDays(weekStart, 6);
    $("week-label").textContent = formatWeekLabel(weekStart, weekEnd);
    loadShifts();
  }

  /* ─── Modal ──────────────────────────────────── */
  function fillStaffSelect() {
    const sel = $("f-staff");
    sel.innerHTML = '<option value="">— scegli dallo staff —</option>';
    staffList.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = (s.name || "") + " " + (s.surname || "") + " (" + (s.role || s.department || "") + ")";
      sel.appendChild(opt);
    });
  }

  function setActiveType(type) {
    selectedType = type;
    qsa(".type-btn").forEach((btn) => {
      btn.className = "type-btn";
      if (btn.dataset.type === type) {
        btn.classList.add("active", type === "work" ? "work" : type);
      }
    });
    const timeFields = $("time-fields");
    timeFields.style.display = (type === "work") ? "grid" : "none";
  }

  function openAddModal(date, staffId) {
    editingShiftId = null;
    $("modal-title").textContent = "Nuovo turno";
    $("f-date").value = date || todayIso();
    $("f-area").value = filterArea || "cucina";
    $("f-staff").value = staffId || "";
    $("f-staffname").value = "";
    if (staffId) {
      const s = staffList.find((m) => m.id === staffId);
      if (s) $("f-staffname").value = (s.name || "") + " " + (s.surname || "");
    }
    $("f-start").value = "08:00";
    $("f-end").value = "16:00";
    $("f-notes").value = "";
    setActiveType("work");
    $("btn-modal-delete").style.display = "none";
    $("modal-error").style.display = "none";
    $("modal-shift").style.display = "flex";
  }

  function openEditModal(shift) {
    editingShiftId = shift.id;
    $("modal-title").textContent = "Modifica turno";
    $("f-date").value = shift.date || todayIso();
    $("f-area").value = shift.area || shift.department || "cucina";
    $("f-staff").value = shift.staffId || "";
    $("f-staffname").value = shift.staffName || (shift.staffId ? staffName(shift.staffId) : "");
    $("f-start").value = shift.start || "08:00";
    $("f-end").value = shift.end || "16:00";
    $("f-notes").value = shift.notes || "";
    setActiveType(shift.type || "work");
    $("btn-modal-delete").style.display = "inline-flex";
    $("modal-error").style.display = "none";
    $("modal-shift").style.display = "flex";
  }

  window._editShift = function (id) {
    const s = shiftsData.find((x) => x.id === id);
    if (s) openEditModal(s);
  };

  function closeModal() {
    $("modal-shift").style.display = "none";
    editingShiftId = null;
  }

  async function saveShift() {
    const staffId = $("f-staff").value;
    const staffNameVal = $("f-staffname").value.trim();
    const date = $("f-date").value;
    const area = $("f-area").value;
    const type = selectedType;
    const start = $("f-start").value;
    const end = $("f-end").value;
    const notes = $("f-notes").value.trim();

    if (!date) { showModalError("La data è obbligatoria."); return; }
    if (!area) { showModalError("Seleziona un'area."); return; }

    const payload = {
      staffId: staffId || null,
      staffName: staffNameVal || (staffId ? staffName(staffId) : ""),
      date,
      area,
      department: area,
      type,
      status: type === "work" ? "scheduled" : type,
      start: type === "work" ? start : "",
      end: type === "work" ? end : "",
      notes,
    };

    const saveBtn = $("btn-modal-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Salvataggio…";

    try {
      if (editingShiftId) {
        await api(`/api/staff/shifts/${editingShiftId}`, { method: "PATCH", body: JSON.stringify(payload) });
        showMsg("Turno aggiornato.", true);
      } else {
        await api("/api/staff/shifts", { method: "POST", body: JSON.stringify(payload) });
        showMsg("Turno creato.", true);
      }
      closeModal();
      await loadShifts();
    } catch (e) {
      showModalError(e.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Salva turno";
    }
  }

  async function deleteShift() {
    if (!editingShiftId) return;
    if (!confirm("Eliminare questo turno?")) return;
    try {
      await api(`/api/staff/shifts/${editingShiftId}`, { method: "DELETE" });
      showMsg("Turno eliminato.", true);
      closeModal();
      await loadShifts();
    } catch (e) {
      showModalError(e.message);
    }
  }

  function showModalError(msg) {
    const el = $("modal-error");
    el.textContent = msg;
    el.style.display = "block";
  }

  function showMsg(msg, ok) {
    const el = $("msg-global");
    el.textContent = msg;
    el.className = "msg-bar " + (ok ? "ok" : "err");
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  }

  /* ─── Export CSV ─────────────────────────────── */
  function exportCsv() {
    const rows = [["Data", "Operatore", "Area", "Tipo", "Inizio", "Fine", "Ore", "Note"]];
    const typeLabel = { work: "Lavoro", ferie: "Ferie", malattia: "Malattia", permesso: "Permesso", riposo: "Riposo" };
    shiftsData.forEach((s) => {
      const name = s.staffId ? staffName(s.staffId) : (s.staffName || "");
      rows.push([
        s.date || "",
        name,
        s.area || s.department || "",
        typeLabel[s.type || "work"] || s.type || "",
        s.start || "",
        s.end || "",
        computeHours(s).toFixed(1),
        s.notes || "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const from = toIso(weekStart);
    const to = toIso(addDays(weekStart, 6));
    a.download = `turni_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ─── Init ───────────────────────────────────── */
  function init() {
    setWeek(new Date());

    $("btn-prev-week").addEventListener("click", () => setWeek(addDays(weekStart, -7)));
    $("btn-next-week").addEventListener("click", () => setWeek(addDays(weekStart, 7)));
    $("btn-today").addEventListener("click", () => setWeek(new Date()));
    $("btn-refresh").addEventListener("click", () => loadShifts());
    $("btn-add-shift").addEventListener("click", () => openAddModal(todayIso(), ""));
    $("btn-modal-close").addEventListener("click", closeModal);
    $("btn-modal-cancel").addEventListener("click", closeModal);
    $("btn-modal-save").addEventListener("click", saveShift);
    $("btn-modal-delete").addEventListener("click", deleteShift);
    $("btn-export").addEventListener("click", exportCsv);

    $("filter-area").addEventListener("change", (e) => {
      filterArea = e.target.value;
      renderWeekGrid();
      renderShiftList();
      updateKpis();
    });

    // Shift type picker
    qsa(".type-btn").forEach((btn) => {
      btn.addEventListener("click", () => setActiveType(btn.dataset.type));
    });

    // When staff select changes, fill name field
    $("f-staff").addEventListener("change", (e) => {
      const id = e.target.value;
      if (id) {
        const s = staffList.find((m) => m.id === id);
        if (s) $("f-staffname").value = (s.name || "") + " " + (s.surname || "");
      }
    });

    // Close modal on overlay click
    $("modal-shift").addEventListener("click", (e) => {
      if (e.target === $("modal-shift")) closeModal();
    });

    // Load user info
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((u) => {
        if (u && (u.name || u.username)) {
          $("user-label").textContent = (u.name || u.username) + " · " + (u.role || "");
        }
      })
      .catch(() => {});

    loadStaff();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
