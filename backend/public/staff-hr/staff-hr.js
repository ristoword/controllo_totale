// Staff HR — Controllo Totale (RISTOSAAS design)
(function () {
  "use strict";

  let staffList = [];
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let calFilterStaff = "";
  let calShifts = [];
  let attendanceRecords = [];

  const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  const DAYS_IT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

  function $(id) { return document.getElementById(id); }
  function euro(n) { return "€ " + Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pad2(n) { return String(n).padStart(2, "0"); }

  function esc(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); }
    catch (_) { return iso; }
  }

  function diffHours(start, end) {
    if (!start || !end) return 0;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return ms > 0 ? ms / 3_600_000 : 0;
  }

  function todayIso() { return new Date().toISOString().slice(0, 10); }

  function monthRange(year, month) {
    const from = `${year}-${pad2(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${pad2(month + 1)}-${pad2(lastDay)}`;
    return { from, to };
  }

  /* ─── API ──────────────────────────────── */
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

  /* ─── Staff list ───────────────────────── */
  async function loadStaff() {
    try {
      const data = await api("/api/staff");
      staffList = Array.isArray(data) ? data : (data.staff || []);
    } catch (_) { staffList = []; }
    fillCalStaffFilter();
  }

  function staffName(s) {
    return ((s.name || "") + " " + (s.surname || "")).trim() || s.username || "—";
  }

  function staffNameById(id) {
    const s = staffList.find((m) => m.id === id);
    return s ? staffName(s) : "—";
  }

  function fillCalStaffFilter() {
    const sel = $("cal-staff-filter");
    sel.innerHTML = '<option value="">Tutto il personale</option>';
    staffList.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = staffName(s);
      sel.appendChild(opt);
    });
  }

  /* ─── Tab switching ────────────────────── */
  function initTabs() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const panel = $("panel-" + btn.dataset.tab);
        if (panel) panel.classList.add("active");
        if (btn.dataset.tab === "ferie") loadCalendar();
        if (btn.dataset.tab === "ore") loadHours();
        if (btn.dataset.tab === "costi") loadCosts();
      });
    });
  }

  /* ─── PRESENZE ─────────────────────────── */
  function initPresenze() {
    $("attendance-date").value = todayIso();
    $("btn-load-attendance").addEventListener("click", loadAttendance);
    loadAttendance();
  }

  async function loadAttendance() {
    const date = $("attendance-date").value || todayIso();
    try {
      const data = await api(`/api/attendance?dateFrom=${date}&dateTo=${date}`);
      attendanceRecords = Array.isArray(data) ? data : (data.records || data.attendance || []);
      renderAttendance(attendanceRecords);
      updatePresenzaKpis(attendanceRecords);
      renderClockCards();
    } catch (e) {
      try {
        const summary = await api(`/api/attendance/daily-summary?date=${date}`);
        const records = summary.records || summary.staff || [];
        renderAttendance(records);
        updatePresenzaKpisFromSummary(summary);
      } catch (e2) {
        showMsg("Impossibile caricare le presenze: " + e2.message, false);
        $("attendance-tbody").innerHTML = '<tr><td colspan="6" class="empty-cell">Nessun dato disponibile.</td></tr>';
      }
    }
  }

  function renderAttendance(records) {
    const tbody = $("attendance-tbody");
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Nessuna presenza registrata.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    records.forEach((r) => {
      const member = staffList.find((s) => s.id === r.userId || s.id === r.staffId);
      const name = r.name || r.userName || (member ? staffName(member) : "—");
      const role = r.role || (member ? member.role : "—");
      const clockIn = r.clockInAt || r.clockIn || r.start || null;
      const clockOut = r.clockOutAt || r.clockOut || r.end || null;
      const hours = clockIn ? diffHours(clockIn, clockOut || new Date().toISOString()) : 0;
      const status = r.status || (clockOut ? "chiuso" : clockIn ? "aperto" : "assente");
      const badgeClass = status === "chiuso" || status === "closed" ? "badge-ok"
        : status === "aperto" || status === "open" ? "badge-warn" : "badge-muted";
      const statusLabel = { chiuso: "Chiuso", closed: "Chiuso", aperto: "In servizio", open: "In servizio", assente: "Assente", anomaly: "Anomalia" }[status] || status;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(name)}</strong></td>
        <td><span class="badge badge-muted">${esc(role)}</span></td>
        <td>${esc(fmtTime(clockIn))}</td>
        <td>${esc(fmtTime(clockOut))}</td>
        <td><strong style="color:var(--accent)">${hours.toFixed(1)}h</strong></td>
        <td>
          ${(!clockOut && clockIn) ? `<button class="btn ghost small" onclick="window._closeShift('${r.id}')">Chiudi</button>` : ""}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderClockCards() {
    const container = $("clock-cards");
    if (!container) return;
    container.innerHTML = "";
    const activeStaff = staffList.filter((s) => s.active !== false);
    if (!activeStaff.length) return;

    activeStaff.forEach((s) => {
      const record = attendanceRecords.find((r) => (r.userId || r.staffId) === s.id);
      const isOpen = record && !record.clockOutAt && !record.clockOut;
      const card = document.createElement("div");
      card.className = "clock-card";
      card.innerHTML = `
        <div class="clock-card-name">${esc(staffName(s))}</div>
        <div class="clock-card-role">${esc(s.role || "—")}</div>
        <div class="clock-card-actions">
          <button class="btn small${isOpen ? "" : " primary"}" ${isOpen ? "disabled" : ""} onclick="window._manualClockIn('${s.id}')">Entrata</button>
          <button class="btn small" ${!isOpen ? "disabled" : ""} style="${isOpen ? "border-color:var(--ok);color:var(--ok)" : ""}" onclick="window._manualClockOut('${s.id}')">Uscita</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function updatePresenzaKpis(records) {
    const active = staffList.filter((s) => s.active !== false).length;
    const clocks = records.length;
    const totalHours = records.reduce((acc, r) => {
      const ci = r.clockInAt || r.clockIn;
      const co = r.clockOutAt || r.clockOut;
      return acc + (ci ? diffHours(ci, co || new Date().toISOString()) : 0);
    }, 0);

    $("kpi-active-staff").textContent = active;
    $("kpi-clock-count").textContent = clocks;
    $("kpi-hours-today").textContent = totalHours.toFixed(1) + "h";
  }

  function updatePresenzaKpisFromSummary(s) {
    $("kpi-active-staff").textContent = s.activeCount || staffList.filter((m) => m.active !== false).length;
    $("kpi-clock-count").textContent = s.totalRecords || "—";
    $("kpi-hours-today").textContent = (s.totalWorkedHours || s.totalHours || 0).toFixed(1) + "h";
  }

  window._closeShift = async function (id) {
    if (!confirm("Chiudere questo turno?")) return;
    try {
      await api(`/api/attendance/${id}/close`, { method: "PATCH", body: JSON.stringify({ clockOutAt: new Date().toISOString() }) });
      showMsg("Turno chiuso.", true);
      loadAttendance();
    } catch (e) { showMsg(e.message, false); }
  };

  window._manualClockIn = async function (staffId) {
    showMsg("Registrazione entrata...", true);
    try {
      await api("/api/attendance/me/clock-in", { method: "POST", body: JSON.stringify({ staffId }) });
      showMsg("Entrata registrata.", true);
      loadAttendance();
    } catch (e) { showMsg(e.message, false); }
  };

  window._manualClockOut = async function (staffId) {
    showMsg("Registrazione uscita...", true);
    try {
      await api("/api/attendance/me/clock-out", { method: "POST", body: JSON.stringify({ staffId }) });
      showMsg("Uscita registrata.", true);
      loadAttendance();
    } catch (e) { showMsg(e.message, false); }
  };

  /* ─── ORE ──────────────────────────────── */
  function initOre() {
    const now = new Date();
    $("month-picker").value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    $("btn-load-hours").addEventListener("click", loadHours);
    $("btn-export-hours").addEventListener("click", exportHoursCsv);
  }

  let hoursData = [];
  async function loadHours() {
    const monthVal = $("month-picker").value;
    if (!monthVal) { showMsg("Seleziona un mese.", false); return; }
    const [year, month] = monthVal.split("-").map(Number);
    const { from, to } = monthRange(year, month - 1);

    try {
      const data = await api(`/api/staff/reports/hours?dateFrom=${from}&dateTo=${to}`);
      renderHours(Array.isArray(data) ? data : (data.staff || data.rows || []));
    } catch (_) {
      try {
        const shifts = await api(`/api/staff/shifts/by-range?dateFrom=${from}&dateTo=${to}`);
        const shiftArr = Array.isArray(shifts) ? shifts : [];
        const byStaff = {};
        shiftArr.forEach((s) => {
          const key = s.staffId || "__unknown__";
          if (!byStaff[key]) byStaff[key] = { staffId: key, shifts: 0, hoursWorked: 0 };
          byStaff[key].shifts++;
          if (s.type === "work" || !s.type) byStaff[key].hoursWorked += computeShiftHours(s);
        });
        const rows = Object.values(byStaff).map((r) => {
          const sm = staffList.find((s) => s.id === r.staffId);
          return {
            name: sm ? staffName(sm) : "—",
            role: sm ? sm.role : "—",
            shifts: r.shifts,
            hoursWorked: r.hoursWorked,
            hourlyRate: sm ? (sm.hourlyRate || 0) : 0,
          };
        });
        renderHours(rows);
      } catch (e2) {
        showMsg("Impossibile caricare le ore: " + e2.message, false);
      }
    }
  }

  function computeShiftHours(s) {
    if (!s.start || !s.end) return 0;
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins / 60 : 0;
  }

  function renderHours(rows) {
    hoursData = rows;
    const tbody = $("hours-tbody");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Nessun dato.</td></tr>';
      $("hours-totals").style.display = "none";
      $("kpi-month-hours").textContent = "—";
      $("kpi-avg-hours").textContent = "—";
      $("kpi-shift-count").textContent = "—";
      return;
    }
    tbody.innerHTML = "";
    let totalHours = 0, totalShifts = 0, totalPay = 0;
    rows.forEach((r) => {
      const hw = Number(r.hoursWorked || r.totalHours || 0);
      const rate = Number(r.hourlyRate || r.rate || 0);
      const pay = rate > 0 ? hw * rate : 0;
      totalHours += hw; totalShifts += (r.shifts || r.shiftsCount || 0); totalPay += pay;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(r.name || r.staffName || "—")}</strong></td>
        <td><span class="badge badge-muted">${esc(r.role || "—")}</span></td>
        <td><strong style="color:var(--accent)">${hw.toFixed(1)}h</strong></td>
        <td>${rate > 0 ? euro(pay) : '<span style="color:var(--text-muted)">N/D</span>'}</td>
      `;
      tbody.appendChild(tr);
    });

    $("kpi-month-hours").textContent = totalHours.toFixed(1) + "h";
    $("kpi-avg-hours").textContent = rows.length > 0 ? (totalHours / rows.length).toFixed(1) + "h" : "—";
    $("kpi-shift-count").textContent = totalShifts;

    const tot = $("hours-totals");
    tot.style.display = "flex";
    tot.innerHTML = `<span>Totale ore: <strong>${totalHours.toFixed(1)}h</strong></span> <span>Retribuzione: <strong>${totalPay > 0 ? euro(totalPay) : "N/D"}</strong></span>`;
  }

  function exportHoursCsv() {
    const rows = [["Dipendente","Ruolo","Ore","Retribuzione"]];
    hoursData.forEach((r) => {
      const hw = Number(r.hoursWorked || r.totalHours || 0);
      const rate = Number(r.hourlyRate || r.rate || 0);
      rows.push([r.name || r.staffName || "", r.role || "", hw.toFixed(2), (hw * rate).toFixed(2)]);
    });
    downloadCsv(rows, "ore_personale.csv");
  }

  /* ─── FERIE CALENDAR ───────────────────── */
  function initFerie() {
    $("btn-cal-prev").addEventListener("click", () => {
      if (calMonth === 0) { calMonth = 11; calYear--; } else calMonth--;
      loadCalendar();
    });
    $("btn-cal-next").addEventListener("click", () => {
      if (calMonth === 11) { calMonth = 0; calYear++; } else calMonth++;
      loadCalendar();
    });
    $("cal-staff-filter").addEventListener("change", (e) => {
      calFilterStaff = e.target.value;
      renderCalendar();
      renderFerieSummary();
    });
  }

  async function loadCalendar() {
    const { from, to } = monthRange(calYear, calMonth);
    $("cal-month-label").textContent = MONTHS_IT[calMonth] + " " + calYear;
    try {
      const data = await api(`/api/staff/shifts/by-range?dateFrom=${from}&dateTo=${to}`);
      calShifts = Array.isArray(data) ? data : [];
      calShifts = calShifts.filter((s) => ["ferie","malattia","permesso","riposo"].includes(s.type || s.status || ""));
    } catch (_) { calShifts = []; }
    renderCalendar();
    renderFerieSummary();
    renderPendingRequests();
  }

  function renderCalendar() {
    const filtered = calFilterStaff ? calShifts.filter((s) => s.staffId === calFilterStaff) : calShifts;
    const byDay = {};
    filtered.forEach((s) => {
      const d = s.date;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(s);
    });

    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const todayStr = todayIso();

    const cal = $("ferie-calendar");
    cal.innerHTML = "";

    const hdr = document.createElement("div");
    hdr.className = "cal-grid-header";
    DAYS_IT.forEach((d) => {
      const div = document.createElement("div");
      div.className = "day-name";
      div.textContent = d;
      hdr.appendChild(div);
    });
    cal.appendChild(hdr);

    const grid = document.createElement("div");
    grid.className = "cal-grid";
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement("div");
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        cell.className = "cal-cell empty";
      } else {
        const iso = `${calYear}-${pad2(calMonth + 1)}-${pad2(dayNum)}`;
        cell.className = "cal-cell" + (iso === todayStr ? " today" : "");
        const dayLabel = document.createElement("div");
        dayLabel.className = "cal-day-num";
        dayLabel.textContent = dayNum;
        cell.appendChild(dayLabel);
        (byDay[iso] || []).forEach((s) => {
          const ev = document.createElement("span");
          ev.className = "cal-event " + (s.type || "ferie");
          const member = staffList.find((m) => m.id === s.staffId);
          const name = s.staffName || (member ? member.name : "?");
          ev.textContent = name.split(" ")[0];
          ev.title = (member ? staffName(member) : name) + " · " + s.type;
          cell.appendChild(ev);
        });
      }
      grid.appendChild(cell);
    }
    cal.appendChild(grid);
  }

  function renderFerieSummary() {
    const filtered = calFilterStaff ? calShifts.filter((s) => s.staffId === calFilterStaff) : calShifts;
    const byStaff = {};
    filtered.forEach((s) => {
      const key = s.staffId || s.staffName || "—";
      if (!byStaff[key]) byStaff[key] = { key, ferie:0, malattia:0, permesso:0, riposo:0 };
      byStaff[key][s.type] = (byStaff[key][s.type] || 0) + 1;
    });
    const tbody = $("ferie-summary-tbody");
    const rows = Object.values(byStaff);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Nessuna assenza nel mese.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    rows.forEach((r) => {
      const sm = staffList.find((s) => s.id === r.key);
      const name = sm ? staffName(sm) : r.key;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(name)}</strong></td>
        <td>${r.ferie > 0 ? `<span style="color:var(--blue)">${r.ferie}g</span>` : "—"}</td>
        <td>${r.malattia > 0 ? `<span style="color:var(--danger)">${r.malattia}g</span>` : "—"}</td>
        <td>${r.permesso > 0 ? `<span style="color:var(--warn)">${r.permesso}g</span>` : "—"}</td>
        <td>${r.riposo > 0 ? `<span style="color:#94a3b8">${r.riposo}g</span>` : "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderPendingRequests() {
    api("/api/leave?status=pending")
      .then((data) => {
        const reqs = Array.isArray(data) ? data : (data.requests || []);
        const card = $("pending-card");
        const list = $("pending-list");
        if (!reqs.length) { card.style.display = "none"; return; }
        card.style.display = "block";
        list.innerHTML = "";
        reqs.forEach((req) => {
          const row = document.createElement("div");
          row.className = "pending-row";
          const name = [req.name, req.surname].filter(Boolean).join(" ") || req.username || "—";
          row.innerHTML = `
            <div>
              <strong>${esc(name)}</strong>
              <span style="margin-left:8px;font-size:12px;color:var(--text-muted)">${esc(req.type || "")} · ${esc(req.startDate || "")} → ${esc(req.endDate || "")}</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn ghost small" style="color:var(--ok);border-color:rgba(61,214,140,.3);" onclick="window._approveLeave('${req.id}')">✓ Approva</button>
              <button class="btn danger small" onclick="window._rejectLeave('${req.id}')">✗ Rifiuta</button>
            </div>
          `;
          list.appendChild(row);
        });
      })
      .catch(() => { $("pending-card").style.display = "none"; });
  }

  window._approveLeave = async function (id) {
    try {
      await api(`/api/leave/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
      showMsg("Richiesta approvata.", true);
      loadCalendar();
    } catch (e) { showMsg(e.message, false); }
  };

  window._rejectLeave = async function (id) {
    try {
      await api(`/api/leave/${id}/reject`, { method: "POST", body: JSON.stringify({}) });
      showMsg("Richiesta rifiutata.", true);
      loadCalendar();
    } catch (e) { showMsg(e.message, false); }
  };

  /* ─── COSTI ────────────────────────────── */
  async function loadCosts() {
    const activeStaff = staffList.filter((s) => s.active !== false);
    const totalSalary = activeStaff.reduce((sum, s) => sum + (s.salary || s.monthlySalary || 0), 0);
    const totalHours = activeStaff.reduce((sum, s) => sum + (s.hoursWeek || s.weeklyHours || 0), 0);

    $("kpi-cost-total").textContent = totalSalary > 0 ? euro(totalSalary) : "N/D";
    $("kpi-cost-hours").textContent = totalHours > 0 ? totalHours + "h/sett" : "—";
  }

  /* ─── Utils ────────────────────────────── */
  function showMsg(msg, ok) {
    const el = $("msg-global");
    el.textContent = msg;
    el.className = "msg-bar " + (ok ? "ok" : "err");
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  }

  function downloadCsv(rows, filename) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
  }

  /* ─── Init ─────────────────────────────── */
  async function init() {
    initTabs();
    await loadStaff();
    initPresenze();
    initOre();
    initFerie();

    $("btn-refresh").addEventListener("click", () => {
      const activeTab = document.querySelector(".tab.active");
      if (activeTab) activeTab.click();
    });

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((u) => {
        if (u && (u.name || u.username)) {
          $("user-label").textContent = (u.name || u.username) + " · " + (u.role || "");
        }
      })
      .catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", init);
})();
