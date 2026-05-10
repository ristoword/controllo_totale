// Staff HR — Controllo Totale
(function () {
  "use strict";

  /* ─── State ─────────────────────────────────── */
  let staffList = [];
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth(); // 0-based
  let calFilterStaff = "";
  let calShifts = []; // all shifts loaded for calendar month
  let attendanceRecords = []; // attendance records for selected date

  const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  const DAYS_IT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

  /* ─── Utils ──────────────────────────────────── */
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

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso.slice(0, 10) + "T12:00:00");
      return d.toLocaleDateString("it-IT");
    } catch (_) { return iso; }
  }

  function diffHours(start, end) {
    if (!start || !end) return 0;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return ms > 0 ? ms / 3_600_000 : 0;
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthRange(year, month) {
    const from = `${year}-${pad2(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${pad2(month + 1)}-${pad2(lastDay)}`;
    return { from, to };
  }

  /* ─── API ────────────────────────────────────── */
  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || "Errore");
    return data;
  }

  /* ─── Staff list ─────────────────────────────── */
  async function loadStaff() {
    try {
      const data = await api("/api/staff");
      staffList = Array.isArray(data) ? data : (data.staff || []);
    } catch (_) { staffList = []; }
    fillCalStaffFilter();
  }

  function fillCalStaffFilter() {
    const sel = $("cal-staff-filter");
    sel.innerHTML = '<option value="">Tutto il personale</option>';
    staffList.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = (s.name || "") + " " + (s.surname || "");
      sel.appendChild(opt);
    });
  }

  /* ─── Tab switching ───────────────────────────── */
  function initTabs() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const tabId = btn.dataset.tab;
        const panel = $("panel-" + tabId);
        if (panel) panel.classList.add("active");
        if (tabId === "ferie") loadCalendar();
      });
    });
  }

  /* ─── PRESENZE ───────────────────────────────── */
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
    } catch (e) {
      // Fallback: try daily-summary
      try {
        const summary = await api(`/api/attendance/daily-summary?date=${date}`);
        const records = summary.records || summary.staff || [];
        renderAttendanceSummary(records);
        if (summary.kpi || summary.totals) updatePresenzaKpisFromSummary(summary);
      } catch (e2) {
        showMsg("Impossibile caricare le presenze: " + e2.message, false);
        $("attendance-tbody").innerHTML = '<tr><td colspan="7" class="empty-cell">Nessun dato disponibile.</td></tr>';
      }
    }
  }

  function renderAttendance(records) {
    const tbody = $("attendance-tbody");
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Nessuna presenza registrata per questa data.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    records.forEach((r) => {
      const staffMember = staffList.find((s) => s.id === r.userId || s.id === r.staffId);
      const name = r.name || r.userName || (staffMember ? (staffMember.name + " " + (staffMember.surname || "")) : "—");
      const role = r.role || (staffMember ? staffMember.role : "—");
      const clockIn = r.clockInAt || r.clockIn || r.start || null;
      const clockOut = r.clockOutAt || r.clockOut || r.end || null;
      const hours = clockIn ? diffHours(clockIn, clockOut || new Date().toISOString()) : 0;
      const status = r.status || (clockOut ? "chiuso" : clockIn ? "aperto" : "assente");

      const badgeClass = status === "chiuso" ? "badge-ok" : status === "aperto" ? "badge-warn" : "badge-muted";
      const statusLabel = { chiuso: "Chiuso", aperto: "In servizio", assente: "Assente", anomaly: "Anomalia" }[status] || status;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(name)}</strong></td>
        <td><span class="badge badge-muted">${esc(role)}</span></td>
        <td>${esc(fmtTime(clockIn))}</td>
        <td>${esc(fmtTime(clockOut))}</td>
        <td><strong style="color:var(--accent)">${hours.toFixed(1)}h</strong></td>
        <td><span class="badge ${badgeClass}">${esc(statusLabel)}</span></td>
        <td>
          ${!clockOut && clockIn ? `<button class="btn ghost small" onclick="window._closeShift('${r.id}')">Chiudi</button>` : ""}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAttendanceSummary(records) {
    $("attendance-tbody").innerHTML = "";
    if (!records.length) {
      $("attendance-tbody").innerHTML = '<tr><td colspan="7" class="empty-cell">Nessun dato.</td></tr>';
      return;
    }
    records.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(r.name || r.userName || "—")}</strong></td>
        <td>${esc(r.role || "—")}</td>
        <td>${esc(fmtTime(r.clockInAt || r.clockIn))}</td>
        <td>${esc(fmtTime(r.clockOutAt || r.clockOut))}</td>
        <td><strong style="color:var(--accent)">${(r.hours || r.totalHours || 0).toFixed(1)}h</strong></td>
        <td><span class="badge badge-ok">—</span></td>
        <td></td>
      `;
      $("attendance-tbody").appendChild(tr);
    });
  }

  function updatePresenzaKpis(records) {
    const present = records.filter((r) => (r.clockInAt || r.clockIn) && !(r.clockOutAt || r.clockOut)).length;
    const closed = records.filter((r) => r.clockOutAt || r.clockOut).length;
    const totalHours = records.reduce((acc, r) => {
      const ci = r.clockInAt || r.clockIn;
      const co = r.clockOutAt || r.clockOut;
      return acc + (ci ? diffHours(ci, co || new Date().toISOString()) : 0);
    }, 0);
    const anomalies = records.filter((r) => r.anomaly || r.status === "anomaly").length;

    $("kpi-present").textContent = present;
    $("kpi-closed").textContent = closed;
    $("kpi-hours-today").textContent = totalHours.toFixed(1) + "h";
    $("kpi-anomalies").textContent = anomalies;
  }

  function updatePresenzaKpisFromSummary(s) {
    $("kpi-present").textContent = s.present || s.activeCount || "—";
    $("kpi-closed").textContent = s.closed || s.completedCount || "—";
    $("kpi-hours-today").textContent = (s.totalHours || 0).toFixed(1) + "h";
    $("kpi-anomalies").textContent = s.anomalies || 0;
  }

  window._closeShift = async function (id) {
    if (!confirm("Chiudere questo turno?")) return;
    try {
      await api(`/api/attendance/${id}/close`, { method: "PATCH", body: JSON.stringify({ clockOutAt: new Date().toISOString() }) });
      showMsg("Turno chiuso.", true);
      loadAttendance();
    } catch (e) {
      showMsg(e.message, false);
    }
  };

  /* ─── ORE ────────────────────────────────────── */
  function initOre() {
    const now = new Date();
    $("month-picker").value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    $("btn-load-hours").addEventListener("click", loadHours);
    $("btn-export-hours").addEventListener("click", exportHoursCsv);
  }

  async function loadHours() {
    const monthVal = $("month-picker").value;
    if (!monthVal) { showMsg("Seleziona un mese.", false); return; }
    const [year, month] = monthVal.split("-").map(Number);
    const { from, to } = monthRange(year, month - 1);

    try {
      // Try staff reports endpoint
      const data = await api(`/api/staff/reports/hours?dateFrom=${from}&dateTo=${to}`);
      renderHours(Array.isArray(data) ? data : (data.staff || data.rows || []));
    } catch (_) {
      // Fallback: use shifts data
      try {
        const shifts = await api(`/api/staff/shifts/by-range?dateFrom=${from}&dateTo=${to}`);
        const shiftArr = Array.isArray(shifts) ? shifts : [];
        // Aggregate by staffId
        const byStaff = {};
        shiftArr.forEach((s) => {
          const key = s.staffId || "__unknown__";
          if (!byStaff[key]) byStaff[key] = { staffId: key, shifts: 0, hoursWorked: 0, absences: 0 };
          byStaff[key].shifts++;
          if (s.type === "work" || !s.type) {
            const h = computeShiftHours(s);
            byStaff[key].hoursWorked += h;
          } else {
            byStaff[key].absences++;
          }
        });
        const rows = Object.values(byStaff).map((r) => {
          const sm = staffList.find((s) => s.id === r.staffId);
          return {
            name: sm ? (sm.name + " " + (sm.surname || "")) : "—",
            role: sm ? sm.role : "—",
            shifts: r.shifts,
            hoursWorked: r.hoursWorked,
            hoursContract: sm ? (sm.hoursWeek || 0) * 4 : 0,
            overtime: 0,
            absences: r.absences,
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

  let hoursData = [];
  function renderHours(rows) {
    hoursData = rows;
    const tbody = $("hours-tbody");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Nessun dato.</td></tr>';
      $("hours-totals").style.display = "none";
      return;
    }
    tbody.innerHTML = "";
    let totalHours = 0, totalContract = 0, totalOT = 0, totalAbsences = 0;
    rows.forEach((r) => {
      const hw = Number(r.hoursWorked || r.totalHours || 0);
      const hc = Number(r.hoursContract || r.contractHours || 0);
      const ot = Number(r.overtime || r.overtimeHours || Math.max(0, hw - hc));
      const abs = Number(r.absences || r.absenceDays || 0);
      totalHours += hw; totalContract += hc; totalOT += ot; totalAbsences += abs;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(r.name || r.staffName || "—")}</strong></td>
        <td><span class="badge badge-muted">${esc(r.role || "—")}</span></td>
        <td>${r.shifts || r.shiftsCount || "—"}</td>
        <td><strong style="color:var(--accent)">${hw.toFixed(1)}h</strong></td>
        <td>${hc > 0 ? hc.toFixed(1) + "h" : "—"}</td>
        <td>${ot > 0 ? `<span style="color:var(--warn)">${ot.toFixed(1)}h</span>` : "—"}</td>
        <td>${abs > 0 ? `<span style="color:var(--danger)">${abs}</span>` : "—"}</td>
      `;
      tbody.appendChild(tr);
    });
    const tot = $("hours-totals");
    tot.style.display = "flex";
    tot.innerHTML = `<span>Totale ore: <strong>${totalHours.toFixed(1)}h</strong></span> <span>Contrattuali: <strong>${totalContract.toFixed(1)}h</strong></span> <span>Straordinari: <strong>${totalOT.toFixed(1)}h</strong></span> <span>Assenze: <strong>${totalAbsences}</strong></span>`;
  }

  function exportHoursCsv() {
    const rows = [["Dipendente","Ruolo","Turni","Ore lavorate","Ore contrattuali","Straordinari","Assenze"]];
    hoursData.forEach((r) => {
      rows.push([
        r.name || r.staffName || "",
        r.role || "",
        r.shifts || r.shiftsCount || 0,
        (r.hoursWorked || r.totalHours || 0).toFixed(2),
        (r.hoursContract || r.contractHours || 0).toFixed(2),
        (r.overtime || r.overtimeHours || 0).toFixed(2),
        r.absences || r.absenceDays || 0,
      ]);
    });
    downloadCsv(rows, "ore_personale.csv");
  }

  /* ─── FERIE CALENDAR ─────────────────────────── */
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
    } catch (_) {
      calShifts = [];
    }
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
    const todayIsoStr = todayIso();

    const cal = $("ferie-calendar");
    cal.innerHTML = "";

    // Header
    const hdr = document.createElement("div");
    hdr.className = "cal-grid-header";
    DAYS_IT.forEach((d) => {
      const div = document.createElement("div");
      div.className = "day-name";
      div.textContent = d;
      hdr.appendChild(div);
    });
    cal.appendChild(hdr);

    // Grid
    const grid = document.createElement("div");
    grid.className = "cal-grid";
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement("div");
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        cell.className = "cal-cell empty";
      } else {
        const iso = `${calYear}-${pad2(calMonth + 1)}-${pad2(dayNum)}`;
        cell.className = "cal-cell" + (iso === todayIsoStr ? " today" : "");
        const dayLabel = document.createElement("div");
        dayLabel.className = "cal-day-num";
        dayLabel.textContent = dayNum;
        cell.appendChild(dayLabel);
        (byDay[iso] || []).forEach((s) => {
          const ev = document.createElement("span");
          ev.className = "cal-event " + (s.type || "ferie");
          const staffMember = staffList.find((m) => m.id === s.staffId);
          const name = s.staffName || (staffMember ? staffMember.name : "?");
          ev.textContent = name.split(" ")[0];
          ev.title = name + " · " + s.type;
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
      const name = sm ? (sm.name + " " + (sm.surname || "")) : r.key;
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
    // Requests with status "pending" from leave routes
    api("/api/staff/requests/pending")
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
          const sm = staffList.find((s) => s.id === req.staffId);
          const name = req.staffName || (sm ? sm.name : "—");
          row.innerHTML = `
            <div>
              <strong>${esc(name)}</strong>
              <span style="margin-left:8px;font-size:12px;color:var(--text-muted)">${esc(req.type || req.leaveType || "")} · ${esc(req.from || req.date || "")} → ${esc(req.to || "")}</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn ghost small" style="color:var(--ok);border-color:rgba(61,214,140,.3);" onclick="window._approveRequest('${req.id}')">✓ Approva</button>
              <button class="btn danger small" onclick="window._rejectRequest('${req.id}')">✗ Rifiuta</button>
            </div>
          `;
          list.appendChild(row);
        });
      })
      .catch(() => { $("pending-card").style.display = "none"; });
  }

  window._approveRequest = async function (id) {
    try {
      await api(`/api/staff/requests/${id}/approve`, { method: "PATCH" });
      showMsg("Richiesta approvata.", true);
      loadCalendar();
    } catch (e) { showMsg(e.message, false); }
  };

  window._rejectRequest = async function (id) {
    try {
      await api(`/api/staff/requests/${id}/reject`, { method: "PATCH" });
      showMsg("Richiesta rifiutata.", true);
      loadCalendar();
    } catch (e) { showMsg(e.message, false); }
  };

  /* ─── COSTI ──────────────────────────────────── */
  function initCosti() {
    const now = new Date();
    $("cost-month-picker").value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    $("btn-load-costs").addEventListener("click", loadCosts);
    $("btn-export-costs").addEventListener("click", exportCostsCsv);
  }

  let costsData = [];
  async function loadCosts() {
    const monthVal = $("cost-month-picker").value;
    if (!monthVal) { showMsg("Seleziona un mese.", false); return; }
    const [year, month] = monthVal.split("-").map(Number);
    const { from, to } = monthRange(year, month - 1);

    try {
      const data = await api(`/api/staff/reports/personnel-cost?dateFrom=${from}&dateTo=${to}`);
      costsData = Array.isArray(data) ? data : (data.staff || data.rows || []);
      renderCosts(costsData);
    } catch (_) {
      // Fallback: compute from shifts + staff hourly rates
      try {
        const [shifts, staff] = await Promise.all([
          api(`/api/staff/shifts/by-range?dateFrom=${from}&dateTo=${to}`).then((d) => Array.isArray(d) ? d : []),
          api("/api/staff").then((d) => Array.isArray(d) ? d : []),
        ]);
        const byStaff = {};
        shifts.forEach((s) => {
          if (s.type && s.type !== "work") return;
          const key = s.staffId;
          if (!byStaff[key]) byStaff[key] = { staffId: key, hoursWorked: 0 };
          const h = computeShiftHours(s);
          byStaff[key].hoursWorked += h;
        });
        costsData = staff.filter((s) => byStaff[s.id]).map((s) => ({
          name: (s.name || "") + " " + (s.surname || ""),
          role: s.role || "—",
          hoursWorked: byStaff[s.id] ? byStaff[s.id].hoursWorked : 0,
          hourlyRate: s.hourlyRate || 0,
          totalCost: (byStaff[s.id] ? byStaff[s.id].hoursWorked : 0) * (s.hourlyRate || 0),
          notes: s.notes || "",
        }));
        renderCosts(costsData);
      } catch (e2) {
        showMsg("Impossibile caricare i costi: " + e2.message, false);
      }
    }
  }

  function renderCosts(rows) {
    const tbody = $("costs-tbody");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Nessun dato.</td></tr>';
      $("kpi-cost-total").textContent = "—";
      $("kpi-cost-hours").textContent = "—";
      $("kpi-cost-staff").textContent = "—";
      $("kpi-cost-avg").textContent = "—";
      return;
    }
    tbody.innerHTML = "";
    let totalCost = 0, totalHours = 0;
    rows.forEach((r) => {
      const hw = Number(r.hoursWorked || r.totalHours || 0);
      const rate = Number(r.hourlyRate || r.rate || 0);
      const cost = Number(r.totalCost || r.cost || hw * rate || 0);
      totalCost += cost; totalHours += hw;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(r.name || r.staffName || "—")}</strong></td>
        <td><span class="badge badge-muted">${esc(r.role || "—")}</span></td>
        <td><strong style="color:var(--accent)">${hw.toFixed(1)}h</strong></td>
        <td>${rate > 0 ? euro(rate) + "/h" : '<span style="color:var(--text-muted)">N/D</span>'}</td>
        <td><strong style="color:var(--ok)">${cost > 0 ? euro(cost) : '—'}</strong></td>
        <td style="color:var(--text-muted);font-size:12px;">${esc(r.notes || "")}</td>
      `;
      tbody.appendChild(tr);
    });
    $("kpi-cost-total").textContent = totalCost > 0 ? euro(totalCost) : "N/D (aggiungi tariffe)";
    $("kpi-cost-hours").textContent = totalHours.toFixed(1) + "h";
    $("kpi-cost-staff").textContent = rows.length;
    $("kpi-cost-avg").textContent = (rows.length > 0 && totalCost > 0) ? euro(totalCost / rows.length) : "—";
  }

  function exportCostsCsv() {
    const rows = [["Dipendente","Ruolo","Ore lavorate","Tariffa/h","Costo stimato"]];
    costsData.forEach((r) => {
      rows.push([
        r.name || r.staffName || "",
        r.role || "",
        (r.hoursWorked || r.totalHours || 0).toFixed(2),
        (r.hourlyRate || r.rate || 0).toFixed(2),
        (r.totalCost || r.cost || 0).toFixed(2),
      ]);
    });
    downloadCsv(rows, "costo_personale.csv");
  }

  function computeShiftHours(s) {
    if (!s.start || !s.end) return 0;
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins / 60 : 0;
  }

  /* ─── Utils ──────────────────────────────────── */
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

  /* ─── Init ───────────────────────────────────── */
  async function init() {
    initTabs();
    await loadStaff();
    initPresenze();
    initOre();
    initFerie();
    initCosti();

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
