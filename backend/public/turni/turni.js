// Turni — Controllo Totale (RISTOSAAS design)
(function () {
  "use strict";

  /* ─── State ─────────────────────────────── */
  let weekStart = getWeekStart(new Date());
  let monthYear = new Date().getFullYear();
  let monthMonth = new Date().getMonth();
  let staffList = [];
  let shiftsData = [];
  let monthShifts = [];
  let editingShiftId = null;
  let selectedType = "work";
  let filterArea = "";
  let activeTab = "settimana";

  const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  const DAYS_IT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

  /* ─── Helpers ───────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function toIso(d) { return d.toISOString().slice(0, 10); }
  function pad2(n) { return String(n).padStart(2, "0"); }

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function todayIso() { return toIso(new Date()); }

  function formatWeekLabel(start, end) {
    const opts = { day: "numeric", month: "short" };
    return start.toLocaleDateString("it-IT", opts) + " – " + end.toLocaleDateString("it-IT", { ...opts, year: "numeric" });
  }

  function formatDayHeader(date) {
    const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return days[date.getDay()] + " " + date.getDate() + " " + months[date.getMonth()];
  }

  function computeHours(shift) {
    if (!shift.start || !shift.end) return 0;
    const [sh, sm] = shift.start.split(":").map(Number);
    const [eh, em] = shift.end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins / 60 : 0;
  }

  function chipClass(type) {
    const t = type || "work";
    return "shift-chip type-" + t;
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
    return s ? ((s.name || "") + " " + (s.surname || "")).trim() : "—";
  }

  function esc(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  /* ─── API ───────────────────────────────── */
  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
      ...opts,
    });
    if (res.status === 401) {
      window.location.replace("/login/login.html");
      throw new Error("Unauthorized");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || "Errore");
    return data;
  }

  async function loadStaff() {
    try {
      const data = await api("/api/staff");
      staffList = Array.isArray(data) ? data : (data.staff || []);
    } catch (_) { staffList = []; }
    fillStaffSelect();
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
    renderSummary();
  }

  async function loadMonthShifts() {
    const from = `${monthYear}-${pad2(monthMonth + 1)}-01`;
    const lastDay = new Date(monthYear, monthMonth + 1, 0).getDate();
    const to = `${monthYear}-${pad2(monthMonth + 1)}-${pad2(lastDay)}`;
    try {
      const data = await api(`/api/staff/shifts/by-range?dateFrom=${from}&dateTo=${to}`);
      monthShifts = Array.isArray(data) ? data : (data.shifts || []);
    } catch (_) { monthShifts = []; }
    renderMonthCalendar();
    renderSummary();
  }

  /* ─── Tab Switching ─────────────────────── */
  function initTabs() {
    qsa(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        qsa(".tab").forEach((t) => t.classList.remove("active"));
        qsa(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.dataset.tab;
        const panel = $("panel-" + activeTab);
        if (panel) panel.classList.add("active");
        if (activeTab === "mese") loadMonthShifts();
        if (activeTab === "riepilogo") renderSummary();
      });
    });
  }

  /* ─── Area Filter ───────────────────────── */
  function initAreaFilters() {
    qsa("#area-filters .area-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        qsa("#area-filters .area-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filterArea = btn.dataset.area;
        if (activeTab === "settimana") renderWeekGrid();
        if (activeTab === "mese") renderMonthCalendar();
        renderSummary();
      });
    });
  }

  /* ─── WEEK VIEW ─────────────────────────── */
  function renderWeekGrid() {
    const today = todayIso();
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekDayIsos = weekDays.map(toIso);

    const headerRow = $("week-header-row");
    headerRow.innerHTML = '<th class="col-staff">Operatore</th>';
    weekDays.forEach((d, i) => {
      const iso = weekDayIsos[i];
      const th = document.createElement("th");
      if (iso === today) th.className = "today-col";
      th.textContent = formatDayHeader(d);
      headerRow.appendChild(th);
    });

    let filtered = shiftsData;
    if (filterArea) filtered = filtered.filter((s) => (s.area || s.department || "") === filterArea);

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
      td.colSpan = 8; td.className = "empty-state";
      td.style.cssText = "text-align:center;padding:30px;color:var(--text-muted)";
      td.textContent = "Nessun turno pianificato per questa settimana.";
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }

    keys.forEach((key) => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.className = "staff-name-cell";
      if (key === "__free__") {
        tdName.textContent = "— Libero —"; tdName.style.color = "var(--text-muted)";
      } else {
        tdName.textContent = staffName(key);
      }
      tr.appendChild(tdName);

      weekDayIsos.forEach((dayIso) => {
        const td = document.createElement("td");
        if (dayIso === today) td.className = "today-col";
        const dayShifts = rows[key][dayIso] || [];

        dayShifts.forEach((s) => {
          const chip = document.createElement("button");
          chip.className = chipClass(s.type || "work");
          chip.textContent = chipLabel(s);
          chip.addEventListener("click", () => openEditModal(s));
          td.appendChild(chip);
        });

        const addBtn = document.createElement("button");
        addBtn.className = "add-shift-btn"; addBtn.title = "Aggiungi turno"; addBtn.textContent = "+";
        addBtn.addEventListener("click", () => openAddModal(dayIso, key !== "__free__" ? key : ""));
        td.appendChild(addBtn);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // "Add operator" row
    const trNew = document.createElement("tr");
    const tdNewName = document.createElement("td");
    tdNewName.className = "staff-name-cell";
    tdNewName.style.cssText = "color:var(--text-muted);font-style:italic";
    tdNewName.textContent = "Aggiungi operatore…";
    trNew.appendChild(tdNewName);
    weekDayIsos.forEach((dayIso) => {
      const td = document.createElement("td");
      if (dayIso === today) td.className = "today-col";
      const addBtn = document.createElement("button");
      addBtn.className = "add-shift-btn"; addBtn.title = "Aggiungi turno"; addBtn.textContent = "+";
      addBtn.addEventListener("click", () => openAddModal(dayIso, ""));
      td.appendChild(addBtn); trNew.appendChild(td);
    });
    tbody.appendChild(trNew);
  }

  /* ─── MONTH VIEW ────────────────────────── */
  function renderMonthCalendar() {
    const container = $("month-calendar");
    container.innerHTML = "";

    let filtered = monthShifts;
    if (filterArea) filtered = filtered.filter((s) => (s.area || s.department || "") === filterArea);

    const byDay = {};
    filtered.forEach((s) => {
      if (!byDay[s.date]) byDay[s.date] = [];
      byDay[s.date].push(s);
    });

    const firstDay = new Date(monthYear, monthMonth, 1);
    const lastDay = new Date(monthYear, monthMonth + 1, 0);
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const todayStr = todayIso();

    const hdr = document.createElement("div");
    hdr.className = "cal-grid-header";
    DAYS_IT.forEach((d) => {
      const div = document.createElement("div");
      div.className = "day-name"; div.textContent = d;
      hdr.appendChild(div);
    });
    container.appendChild(hdr);

    const grid = document.createElement("div");
    grid.className = "cal-grid";
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement("div");
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        cell.className = "cal-cell empty";
      } else {
        const iso = `${monthYear}-${pad2(monthMonth + 1)}-${pad2(dayNum)}`;
        cell.className = "cal-cell" + (iso === todayStr ? " today" : "");
        const dayLabel = document.createElement("div");
        dayLabel.className = "cal-day-num"; dayLabel.textContent = dayNum;
        cell.appendChild(dayLabel);

        (byDay[iso] || []).forEach((s) => {
          const chip = document.createElement("span");
          chip.className = chipClass(s.type || "work");
          chip.style.cssText = "font-size:9px;padding:2px 4px;margin-bottom:1px;cursor:pointer";
          const name = s.staffId ? staffName(s.staffId) : (s.staffName || "");
          chip.textContent = (name.split(" ")[0] || "?") + (s.start && s.type === "work" ? " " + s.start : "");
          chip.title = name + " · " + chipLabel(s);
          chip.addEventListener("click", () => openEditModal(s));
          cell.appendChild(chip);
        });
      }
      grid.appendChild(cell);
    }
    container.appendChild(grid);
  }

  /* ─── RIEPILOGO ─────────────────────────── */
  function renderSummary() {
    const allShifts = activeTab === "mese" ? monthShifts : shiftsData;
    let filtered = allShifts;
    if (filterArea) filtered = filtered.filter((s) => (s.area || s.department || "") === filterArea);

    const byStaff = {};
    filtered.forEach((s) => {
      const key = s.staffId || s.staffName || "__free__";
      if (!byStaff[key]) byStaff[key] = { hours: 0, workDays: 0, ferie: 0, malattia: 0, permesso: 0, riposo: 0 };
      const t = s.type || "work";
      if (t === "work") {
        byStaff[key].hours += computeHours(s);
        byStaff[key].workDays++;
      } else {
        byStaff[key][t] = (byStaff[key][t] || 0) + 1;
      }
    });

    const tbody = $("summary-tbody");
    const entries = Object.entries(byStaff);
    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Nessun dato.</td></tr>';
      return;
    }

    tbody.innerHTML = "";
    entries.forEach(([key, data]) => {
      const member = staffList.find((s) => s.id === key);
      const name = member ? ((member.name || "") + " " + (member.surname || "")).trim() : key;
      const role = member ? member.role : "—";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(name)}</strong></td>
        <td><span class="badge badge-muted">${esc(role)}</span></td>
        <td><strong style="color:var(--accent)">${data.hours.toFixed(1)}h</strong></td>
        <td>${data.workDays}</td>
        <td>${data.ferie > 0 ? `<span class="badge badge-blue">${data.ferie}</span>` : "—"}</td>
        <td>${data.malattia > 0 ? `<span class="badge badge-danger">${data.malattia}</span>` : "—"}</td>
        <td>${data.permesso > 0 ? `<span class="badge badge-warn">${data.permesso}</span>` : "—"}</td>
        <td>${data.riposo > 0 ? `<span class="badge badge-muted">${data.riposo}</span>` : "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ─── Week / Month navigation ──────────── */
  function setWeek(date) {
    weekStart = getWeekStart(date);
    const weekEnd = addDays(weekStart, 6);
    $("week-label").textContent = formatWeekLabel(weekStart, weekEnd);
    loadShifts();
  }

  function setMonth(year, month) {
    monthYear = year; monthMonth = month;
    $("month-label").textContent = MONTHS_IT[month] + " " + year;
    loadMonthShifts();
  }

  /* ─── Modal ─────────────────────────────── */
  function fillStaffSelect() {
    const sel = $("f-staff");
    sel.innerHTML = '<option value="">— scegli dallo staff —</option>';
    staffList.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = ((s.name || "") + " " + (s.surname || "")).trim() + " (" + (s.role || "") + ")";
      sel.appendChild(opt);
    });
  }

  function setActiveType(type) {
    selectedType = type;
    qsa(".type-btn").forEach((btn) => {
      btn.className = "type-btn";
      if (btn.dataset.type === type) btn.classList.add("active", type === "work" ? "work" : type);
    });
    $("time-fields").style.display = (type === "work") ? "grid" : "none";
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
      if (s) $("f-staffname").value = ((s.name || "") + " " + (s.surname || "")).trim();
    }
    $("f-start").value = "08:00"; $("f-end").value = "16:00";
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
      date, area, department: area, type,
      status: type === "work" ? "scheduled" : type,
      start: type === "work" ? start : "",
      end: type === "work" ? end : "",
      notes,
    };

    const saveBtn = $("btn-modal-save");
    saveBtn.disabled = true; saveBtn.textContent = "Salvataggio…";

    try {
      if (editingShiftId) {
        await api(`/api/staff/shifts/${editingShiftId}`, { method: "PATCH", body: JSON.stringify(payload) });
        showMsg("Turno aggiornato.", true);
      } else {
        await api("/api/staff/shifts", { method: "POST", body: JSON.stringify(payload) });
        showMsg("Turno creato.", true);
      }
      closeModal();
      if (activeTab === "mese") loadMonthShifts(); else loadShifts();
    } catch (e) {
      showModalError(e.message);
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = "Salva turno";
    }
  }

  async function deleteShift() {
    if (!editingShiftId || !confirm("Eliminare questo turno?")) return;
    try {
      await api(`/api/staff/shifts/${editingShiftId}`, { method: "DELETE" });
      showMsg("Turno eliminato.", true);
      closeModal();
      if (activeTab === "mese") loadMonthShifts(); else loadShifts();
    } catch (e) { showModalError(e.message); }
  }

  function showModalError(msg) {
    const el = $("modal-error"); el.textContent = msg; el.style.display = "block";
  }

  function showMsg(msg, ok) {
    const el = $("msg-global");
    el.textContent = msg;
    el.className = "msg-bar " + (ok ? "ok" : "err");
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  }

  /* ─── Export CSV ─────────────────────────── */
  function exportCsv() {
    const allShifts = activeTab === "mese" ? monthShifts : shiftsData;
    const rows = [["Data", "Operatore", "Area", "Tipo", "Inizio", "Fine", "Ore", "Note"]];
    const typeLabel = { work: "Lavoro", ferie: "Ferie", malattia: "Malattia", permesso: "Permesso", riposo: "Riposo" };
    allShifts.forEach((s) => {
      const name = s.staffId ? staffName(s.staffId) : (s.staffName || "");
      rows.push([
        s.date || "", name, s.area || s.department || "",
        typeLabel[s.type || "work"] || s.type || "",
        s.start || "", s.end || "", computeHours(s).toFixed(1), s.notes || "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `turni_${activeTab}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  /* ─── Init ──────────────────────────────── */
  function init() {
    initTabs();
    initAreaFilters();

    setWeek(new Date());
    setMonth(monthYear, monthMonth);

    $("btn-prev-week").addEventListener("click", () => setWeek(addDays(weekStart, -7)));
    $("btn-next-week").addEventListener("click", () => setWeek(addDays(weekStart, 7)));
    $("btn-today").addEventListener("click", () => setWeek(new Date()));
    $("btn-prev-month").addEventListener("click", () => {
      if (monthMonth === 0) { monthMonth = 11; monthYear--; } else monthMonth--;
      setMonth(monthYear, monthMonth);
    });
    $("btn-next-month").addEventListener("click", () => {
      if (monthMonth === 11) { monthMonth = 0; monthYear++; } else monthMonth++;
      setMonth(monthYear, monthMonth);
    });

    $("btn-refresh").addEventListener("click", () => {
      if (activeTab === "mese") loadMonthShifts(); else loadShifts();
    });
    $("btn-add-shift").addEventListener("click", () => openAddModal(todayIso(), ""));
    $("btn-sync-staff").addEventListener("click", async () => {
      await loadStaff();
      showMsg("Staff sincronizzato.", true);
    });
    $("btn-export").addEventListener("click", exportCsv);

    $("btn-modal-close").addEventListener("click", closeModal);
    $("btn-modal-cancel").addEventListener("click", closeModal);
    $("btn-modal-save").addEventListener("click", saveShift);
    $("btn-modal-delete").addEventListener("click", deleteShift);

    qsa(".type-btn").forEach((btn) => {
      btn.addEventListener("click", () => setActiveType(btn.dataset.type));
    });

    $("f-staff").addEventListener("change", (e) => {
      const id = e.target.value;
      if (id) {
        const s = staffList.find((m) => m.id === id);
        if (s) $("f-staffname").value = ((s.name || "") + " " + (s.surname || "")).trim();
      }
    });

    $("modal-shift").addEventListener("click", (e) => {
      if (e.target === $("modal-shift")) closeModal();
    });

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
