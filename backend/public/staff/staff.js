// Staff management — RistoWord layout
(function () {
  "use strict";

  let staffList = [];
  let dailySummary = null;
  let attendanceList = [];
  let leaveList = [];
  let editingStaffId = null;
  let leaveFilterStatus = "";
  let activeTab = "dipendenti";

  function $(id) { return document.getElementById(id); }

  function t(key) {
    if (typeof window.rwT === "function") return window.rwT(key);
    return key;
  }

  function esc(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  /* ─── API helpers ──────────────────────── */
  async function fetchJSON(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
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

  function showMsg(elId, text, ok) {
    const el = $(elId);
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg-bar" + (text ? (ok ? " ok" : " err") : "");
  }

  /* ─── Role labels ──────────────────────── */
  const ROLE_MAP = {
    chef: "Chef", sous_chef: "Sous Chef", capopartita: "Capopartita",
    demi_chef: "Demi Chef", comis_cucina: "Comis Cucina", lavapiatti: "Lavapiatti",
    inserviente: "Inserviente", maitre: "Maître", chef_de_rang: "Chef de Rang",
    demi_chef_sala: "Demi Chef Sala", comis_sala: "Comis Sala", cameriere: "Cameriere",
    barman: "Barman", bartender: "Bartender", comis_bar: "Comis Bar",
    capo_pizzaiolo: "Capo Pizzaiolo", pizzaiolo: "Pizzaiolo", comis_pizzeria: "Comis Pizzeria",
    cassiere: "Cassiere", supervisor: "Supervisor", responsabile: "Responsabile",
    magazziniere: "Magazziniere", staff: "Staff", owner: "Owner",
    sala: "Sala", cucina: "Cucina", bar: "Bar", magazzino: "Magazzino",
    pizzeria: "Pizzeria", cassa: "Cassa",
  };

  function roleLabel(r) { return ROLE_MAP[(r || "").toLowerCase()] || r || "—"; }

  function userName(u) {
    return [u.name, u.surname].filter(Boolean).join(" ") || u.username || "—";
  }

  function userNameById(id) {
    const u = staffList.find((x) => String(x.id) === String(id));
    return u ? userName(u) : "—";
  }

  /* ─── Time helpers ─────────────────────── */
  function formatTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); }
    catch (_) { return iso; }
  }

  function formatMinutes(mins) {
    if (mins == null) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? h + "h " + (m > 0 ? m + "m" : "") : m + "m";
  }

  /* ─── Load staff ───────────────────────── */
  async function loadStaff() {
    showMsg("staff-message", "Caricamento...", true);
    try {
      const data = await fetchJSON("/api/staff");
      staffList = Array.isArray(data) ? data : (data.staff || []);
      showMsg("staff-message", "");
    } catch (e) {
      showMsg("staff-message", e.message, false);
      staffList = [];
    }
    await loadPresenze();
    await loadLeaveRequests();
    renderKpi();
    renderTable();
    renderRoleTable();
    renderAccessTable();
    populateLeaveStaffSelect();
    updateRoleHoursLabel();
  }

  function populateLeaveStaffSelect() {
    const sel = $("leave-staff");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">' + esc(t("staff.filterAll")) + "</option>";
    staffList.filter((u) => u.active !== false).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = userName(u);
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  function updateRoleHoursLabel() {
    const el = $("role-hours-label");
    if (!el) return;
    const totalHours = staffList.reduce((sum, u) => sum + (u.hoursWeek || u.weeklyHours || 0), 0);
    el.textContent = totalHours > 0 ? "🕐 " + totalHours + " " + t("staff.hoursWeek") : "";
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".staff-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".staff-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === "panel-" + tab);
    });
    if (tab === "presenze") loadPresenze();
  }

  /* ─── KPIs ─────────────────────────────── */
  function renderKpi() {
    $("kpi-total").textContent = staffList.length;
    $("kpi-active").textContent = staffList.filter((u) => u.active !== false).length;

    const ferieCount = leaveList.filter((l) => l.status === "approved" && l.type === "ferie").length;
    const malattiaCount = leaveList.filter((l) => l.status === "approved" && l.type === "malattia").length;
    $("kpi-ferie").textContent = ferieCount;
    $("kpi-malattia").textContent = malattiaCount;

    $("kpi-anomaly").textContent = dailySummary ? (dailySummary.anomaliesCount || 0) : 0;

    const totalHours = staffList.reduce((sum, u) => sum + (u.hoursWeek || u.weeklyHours || 0), 0);
    $("kpi-hours").textContent = totalHours > 0 ? totalHours : "—";
  }

  /* ─── Staff Table ──────────────────────── */
  function renderTable() {
    const tbody = $("staff-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!staffList.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">' + esc(t("staff.noEmployees")) + "</td></tr>";
      return;
    }

    staffList.forEach((u) => {
      const tr = document.createElement("tr");
      const name = userName(u);
      const hasAccount = u.username ? true : false;
      const linkedBadge = hasAccount ? '<span class="badge-linked">LINKED</span>' : '';

      const active = u.active !== false;
      const statusLabel = active ? t("staff.status_active") : t("staff.status_suspended");
      const statusCls = active ? "badge-ok" : "badge-danger";

      const hoursWeek = u.hoursWeek || u.weeklyHours || "—";

      tr.innerHTML = `
        <td><strong>${esc(name)}</strong>${linkedBadge}</td>
        <td><span class="badge badge-muted">${esc(roleLabel(u.role))}</span></td>
        <td><span class="badge ${statusCls}">${esc(statusLabel)}</span></td>
        <td>${esc(String(hoursWeek))}</td>
        <td class="actions">
          <button class="btn-xs" data-action="edit" data-id="${esc(u.id)}">✎</button>
          <button class="btn-xs" data-action="toggle" data-id="${esc(u.id)}">${active ? "Disattiva" : "Attiva"}</button>
        </td>
      `;
      tr.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          if (btn.dataset.action === "edit") startEdit(id);
          else if (btn.dataset.action === "toggle") toggleActive(id);
        });
      });
      tbody.appendChild(tr);
    });
  }

  /* ─── Role Table ───────────────────────── */
  function renderRoleTable() {
    const tbody = $("role-tbody");
    if (!tbody) return;
    const counts = {};
    staffList.forEach((u) => {
      const r = roleLabel(u.role);
      counts[r] = (counts[r] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    tbody.innerHTML = "";
    if (!sorted.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty-cell">Nessun dato.</td></tr>';
      return;
    }
    sorted.forEach(([role, count]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${esc(role)}</td><td style="text-align:right;font-weight:700;color:var(--accent)">${count}</td>`;
      tbody.appendChild(tr);
    });
  }

  /* ─── Access accounts (cards) ────────── */
  function renderAccessTable() {
    const cardsEl = $("access-cards");
    const tbody = $("access-tbody");
    const withAccounts = staffList.filter((u) => u.username);

    if (cardsEl) {
      cardsEl.innerHTML = "";
      if (!withAccounts.length) {
        cardsEl.innerHTML = '<p class="access-empty">' + esc(t("staff.noAccounts")) + "</p>";
      } else {
        withAccounts.forEach((u) => {
          const card = document.createElement("div");
          card.className = "access-card";
          card.innerHTML = `
            <div class="access-card-info">
              <strong>${esc(userName(u))}</strong>
              <div class="access-card-meta">
                <span><code>@${esc(u.username)}</code></span>
                <span>${esc(roleLabel(u.role))}</span>
                <span>${esc(u.email || "—")}</span>
              </div>
            </div>
            <div class="access-card-actions">
              <button class="btn-xs danger" data-action="delete-access" data-id="${esc(u.id)}" title="${esc(t("cancel"))}">🗑</button>
            </div>
          `;
          card.querySelector("[data-action='delete-access']")?.addEventListener("click", () => deleteStaff(u.id));
          cardsEl.appendChild(card);
        });
      }
    }

    if (!tbody) return;
    tbody.innerHTML = "";
    if (!withAccounts.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Nessun account creato.</td></tr>';
      return;
    }
    withAccounts.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(userName(u))}</td>
        <td><code>${esc(u.username)}</code></td>
        <td><span class="badge badge-muted">${esc(roleLabel(u.role))}</span></td>
        <td class="actions">
          <button class="btn-xs" data-action="reset-pw" data-id="${esc(u.id)}">Reset password</button>
          <button class="btn-xs danger" data-action="delete-access" data-id="${esc(u.id)}">Elimina</button>
        </td>
      `;
      tr.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          if (btn.dataset.action === "reset-pw") resetPassword(id);
          else if (btn.dataset.action === "delete-access") deleteStaff(id);
        });
      });
      tbody.appendChild(tr);
    });
  }

  /* ─── Add/Edit Staff ───────────────────── */
  function clearForm() {
    editingStaffId = null;
    const title = $("form-title");
    const sub = $("form-subtitle");
    if (title) title.textContent = t("staff.addEmployee");
    if (sub) sub.textContent = t("staff.addEmployee_sub");
    const saveBtn = $("btn-save-staff");
    if (saveBtn) saveBtn.innerHTML = "💾 <span>" + esc(t("save")) + "</span>";
    $("btn-form-reset").style.display = "none";
    $("link-account-section").style.display = "none";
    ["field-name", "field-surname", "field-phone", "field-email",
     "field-hiredate", "field-salary", "field-hours", "field-notes"].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    $("field-role").value = "staff";
    showMsg("form-message", "");
  }

  function startEdit(id) {
    const u = staffList.find((x) => String(x.id) === String(id));
    if (!u) return;
    editingStaffId = id;
    $("form-title").textContent = t("edit") + " " + t("staff.employee").toLowerCase();
    $("form-subtitle").textContent = userName(u);
    $("btn-save-staff").innerHTML = "💾 <span>" + esc(t("save")) + "</span>";
    $("btn-form-reset").style.display = "inline-flex";
    $("link-account-section").style.display = "block";

    $("field-name").value = u.name || "";
    $("field-surname").value = u.surname || "";
    $("field-role").value = u.role || "staff";
    $("field-phone").value = u.phone || (u.personal && u.personal.phone) || "";
    $("field-email").value = u.email || (u.personal && u.personal.email) || "";
    $("field-hiredate").value = u.hireDate || (u.personal && u.personal.hireDate) || "";
    $("field-salary").value = u.salary || (u.salary && u.salary.monthlySalary) || "";
    $("field-hours").value = u.hoursWeek || u.weeklyHours || "";
    $("field-notes").value = u.notes || "";

    showMsg("form-message", "");
    switchTab("dipendenti");
    $("card-employee-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveStaff() {
    const name = $("field-name").value.trim();
    const surname = $("field-surname").value.trim();
    const role = $("field-role").value;
    const phone = $("field-phone").value.trim();
    const email = $("field-email").value.trim();
    const hireDate = $("field-hiredate").value;
    const salary = $("field-salary").value ? parseFloat($("field-salary").value) : undefined;
    const hoursWeek = $("field-hours").value ? parseFloat($("field-hours").value) : undefined;
    const notes = $("field-notes").value.trim();

    if (!name) {
      showMsg("form-message", "Inserisci il nome.", false);
      return;
    }

    const body = { name, surname, role, phone, email, hireDate, salary, hoursWeek, weeklyHours: hoursWeek, notes };

    showMsg("form-message", "Salvataggio...", true);
    try {
      if (editingStaffId) {
        await fetchJSON("/api/staff/" + editingStaffId, { method: "PATCH", body: JSON.stringify(body) });
        showMsg("form-message", "Dipendente aggiornato.", true);
      } else {
        await fetchJSON("/api/staff", { method: "POST", body: JSON.stringify(body) });
        showMsg("form-message", "Dipendente creato.", true);
        clearForm();
      }
      await loadStaff();
    } catch (e) {
      showMsg("form-message", e.message, false);
    }
  }

  async function toggleActive(id) {
    const u = staffList.find((x) => String(x.id) === String(id));
    if (!u) return;
    try {
      await fetchJSON("/api/staff/" + id, { method: "PATCH", body: JSON.stringify({ active: !u.active }) });
      await loadStaff();
    } catch (e) {
      alert(e.message);
    }
  }

  async function resetPassword(id) {
    try {
      const data = await fetchJSON("/api/staff/" + id + "/reset-password", { method: "POST" });
      const pwd = data.temporaryPassword || "";
      alert("Nuova password temporanea: " + pwd + "\n\nL'utente dovrà cambiarla al primo accesso.");
    } catch (e) {
      alert(e.message);
    }
  }

  async function deleteStaff(id) {
    if (!confirm("Eliminare questo account staff?")) return;
    try {
      await fetchJSON("/api/staff/" + id, { method: "DELETE" });
      await loadStaff();
    } catch (e) {
      alert(e.message);
    }
  }

  /* ─── Create access account ────────────── */
  async function createAccess() {
    const name = $("acc-name").value.trim();
    const username = $("acc-username").value.trim();
    const password = $("acc-password").value;
    const role = $("acc-role").value;
    const email = $("acc-email").value.trim();

    if (!username) { showMsg("access-message", "Inserisci username.", false); return; }
    if (!password || password.length < 6) { showMsg("access-message", "Password: minimo 6 caratteri.", false); return; }

    showMsg("access-message", "Creazione...", true);
    try {
      await fetchJSON("/api/staff", { method: "POST", body: JSON.stringify({ name, username, password, role, email }) });
      showMsg("access-message", "Account creato.", true);
      $("acc-name").value = "";
      $("acc-username").value = "";
      $("acc-password").value = "";
      $("acc-email").value = "";
      await loadStaff();
    } catch (e) {
      showMsg("access-message", e.message, false);
    }
  }

  /* ─── Link account to existing employee ── */
  async function linkAccount() {
    if (!editingStaffId) return;
    const username = $("link-username").value.trim();
    const password = $("link-password").value;
    if (!username) { showMsg("link-message", "Inserisci username.", false); return; }
    if (!password || password.length < 6) { showMsg("link-message", "Password: minimo 6 caratteri.", false); return; }

    showMsg("link-message", "Collegamento...", true);
    try {
      await fetchJSON("/api/staff/" + editingStaffId, {
        method: "PATCH",
        body: JSON.stringify({ username, password }),
      });
      showMsg("link-message", "Account collegato.", true);
      $("link-username").value = "";
      $("link-password").value = "";
      await loadStaff();
    } catch (e) {
      showMsg("link-message", e.message, false);
    }
  }

  /* ─── Presenze (Clock in/out) ──────────── */
  async function loadPresenze() {
    const dateEl = $("presenze-date");
    const date = (dateEl && dateEl.value) || new Date().toISOString().slice(0, 10);
    try {
      const [sumRes, listData] = await Promise.all([
        fetchJSON("/api/attendance/daily-summary?date=" + encodeURIComponent(date)).catch(() => null),
        fetchJSON("/api/attendance?dateFrom=" + date + "&dateTo=" + date).catch(() => []),
      ]);
      dailySummary = sumRes;
      attendanceList = Array.isArray(listData) ? listData : [];
    } catch (_) {
      dailySummary = null;
      attendanceList = [];
    }
    renderPresenzeTable();
    renderPresenzeSummary();
  }

  function getRecordsForDay() {
    return dailySummary && Array.isArray(dailySummary.records) ? dailySummary.records : attendanceList;
  }

  function getOpenRecord(userId) {
    return getRecordsForDay().find((r) => String(r.userId) === String(userId) && r.status === "open");
  }

  function getWorkedMinutesToday(userId) {
    return getRecordsForDay()
      .filter((r) => String(r.userId) === String(userId))
      .reduce((sum, r) => sum + (r.workedMinutes || 0), 0);
  }

  function renderPresenzeTable() {
    const tbody = $("presenze-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const activeStaff = staffList.filter((u) => u.active !== false);
    if (!activeStaff.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">' + esc(t("staff.noAttendance")) + "</td></tr>";
      return;
    }

    activeStaff.forEach((u) => {
      const open = getOpenRecord(u.id);
      const mins = getWorkedMinutesToday(u.id);
      const hoursStr = (mins / 60).toFixed(2) + "h";
      let shiftHtml;
      if (open) {
        const time = formatTime(open.clockInAt);
        shiftHtml = '<span class="shift-in">' + esc(t("staff.inShift")) + " " + esc(time) + "</span>";
      } else {
        shiftHtml = '<span class="shift-out">' + esc(t("staff.outOfShift")) + "</span>";
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${esc(userName(u))}</strong></td>
        <td>${shiftHtml}</td>
        <td><strong style="color:var(--accent,#f97316)">${hoursStr}</strong></td>
        <td class="actions">
          <button class="btn-xs btn-clock-in" data-action="login" data-id="${esc(u.id)}" ${open ? "disabled" : ""}>${esc(t("staff.login"))}</button>
          <button class="btn-xs btn-clock-out" data-action="logout" data-id="${esc(u.id)}" ${open ? "" : "disabled"}>${esc(t("staff.logout"))}</button>
        </td>
      `;

      tr.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
        const rec = getOpenRecord(u.id);
        if (!rec) return;
        try {
          await fetchJSON("/api/attendance/" + rec.id + "/close", { method: "PATCH", body: JSON.stringify({}) });
          await loadPresenze();
          renderKpi();
        } catch (e) { alert(e.message); }
      });

      tr.querySelector("[data-action='login']")?.addEventListener("click", async () => {
        if (getOpenRecord(u.id)) return;
        try {
          await fetchJSON("/api/attendance/me/clock-in", {
            method: "POST",
            body: JSON.stringify({ staffId: u.id }),
          });
          await loadPresenze();
          renderKpi();
        } catch (e) { alert(e.message); }
      });

      tbody.appendChild(tr);
    });
  }

  function renderPresenzeSummary() {
    const el = $("presenze-summary");
    if (!el || !dailySummary) { if (el) el.innerHTML = ""; return; }
    const cost = dailySummary.estimatedLaborCost != null ? dailySummary.estimatedLaborCost.toFixed(2) : "—";
    const hours = dailySummary.totalWorkedHours != null ? dailySummary.totalWorkedHours.toFixed(1) : "0";
    el.innerHTML = `<p style="margin:0">Ore lavorate: <strong>${hours}</strong> h · Costo stimato: <strong>€ ${cost}</strong></p>`;
  }

  /* ─── Leave Requests ───────────────────── */
  async function loadLeaveRequests() {
    try {
      const q = new URLSearchParams();
      if (leaveFilterStatus) q.set("status", leaveFilterStatus);
      const data = await fetchJSON("/api/leave?" + q.toString());
      leaveList = Array.isArray(data) ? data : [];
    } catch (_) {
      leaveList = [];
    }
    renderLeaveTable();
  }

  function renderLeaveTable() {
    const tbody = $("leave-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtered = leaveFilterStatus
      ? leaveList.filter((l) => l.status === leaveFilterStatus)
      : leaveList;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">' + esc(t("staff.noRequests")) + "</td></tr>";
      return;
    }

    const typeMap = {
      ferie: t("staff.leaveType.ferie"),
      permesso: t("staff.leaveType.permesso"),
      malattia: t("staff.leaveType.malattia"),
    };
    const statusMap = {
      pending: { label: t("staff.status_pending"), cls: "badge-accent" },
      approved: { label: t("staff.status_approved"), cls: "badge-ok" },
      rejected: { label: t("staff.status_rejected"), cls: "badge-danger" },
      cancelled: { label: t("cancel"), cls: "badge-muted" },
    };

    filtered.forEach((r) => {
      const tr = document.createElement("tr");
      const name = [r.name, r.surname].filter(Boolean).join(" ") || r.username || r.userId;
      const st = statusMap[r.status] || statusMap.pending;

      tr.innerHTML = `
        <td>${esc(name)}</td>
        <td>${esc(typeMap[r.type] || r.type || "—")}</td>
        <td>${esc(r.startDate || "—")}</td>
        <td>${esc(r.endDate || "—")}</td>
        <td><span class="badge ${st.cls}">${esc(st.label)}</span></td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.reason || "")}">${esc((r.reason || "—").slice(0, 30))}</td>
        <td class="actions">
          ${r.status === "pending" ? `
            <button class="btn-xs" data-action="approve" data-id="${esc(r.id)}" style="border-color:rgba(61,214,140,.4);color:var(--ok)">Approva</button>
            <button class="btn-xs danger" data-action="reject" data-id="${esc(r.id)}">Rifiuta</button>
          ` : ""}
        </td>
      `;
      tr.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const endpoint = btn.dataset.action === "approve" ? "approve" : "reject";
            await fetchJSON("/api/leave/" + btn.dataset.id + "/" + endpoint, { method: "POST", body: JSON.stringify({}) });
            await loadLeaveRequests();
            renderKpi();
          } catch (e) { alert(e.message); }
        });
      });
      tbody.appendChild(tr);
    });
  }

  /* ─── Leave request form (owner) ───────── */
  async function submitLeaveRequest() {
    const userId = $("leave-staff")?.value;
    const type = $("leave-type")?.value || "ferie";
    const startDate = $("leave-from")?.value;
    const endDate = $("leave-to")?.value;
    const reason = $("leave-notes")?.value?.trim() || "";

    if (!userId) {
      showMsg("leave-form-msg", "Seleziona un dipendente.", false);
      return;
    }
    if (!startDate || !endDate) {
      showMsg("leave-form-msg", "Inserisci le date.", false);
      return;
    }

    showMsg("leave-form-msg", "Invio...", true);
    try {
      await fetchJSON("/api/leave/owner", {
        method: "POST",
        body: JSON.stringify({ userId, type, startDate, endDate, reason }),
      });
      showMsg("leave-form-msg", "Richiesta inviata.", true);
      $("leave-notes").value = "";
      await loadLeaveRequests();
      renderKpi();
    } catch (e) {
      showMsg("leave-form-msg", e.message, false);
    }
  }

  /* ─── QR / Badges (placeholder) ────────── */
  function initQrBadges() {
    $("btn-gen-qr")?.addEventListener("click", () => alert("Funzionalità QR badge in sviluppo."));
    $("btn-nfc-tag")?.addEventListener("click", () => alert("Funzionalità NFC tag in sviluppo."));
    $("btn-print-badges")?.addEventListener("click", () => {
      if (!staffList.length) { alert("Nessun dipendente."); return; }
      alert("Stampa badge per " + staffList.length + " dipendenti — funzionalità in sviluppo.");
    });
  }

  /* ─── Init ─────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    const dateInput = $("presenze-date");
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    const leaveFrom = $("leave-from");
    const leaveTo = $("leave-to");
    const today = new Date().toISOString().slice(0, 10);
    if (leaveFrom) leaveFrom.value = today;
    if (leaveTo) leaveTo.value = today;

    document.querySelectorAll(".staff-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    document.querySelector(".staff-tab[data-tab='accessi']")?.addEventListener("click", renderAccessTable);

    loadStaff();

    $("btn-refresh")?.addEventListener("click", loadStaff);
    $("btn-save-staff")?.addEventListener("click", saveStaff);
    $("btn-form-reset")?.addEventListener("click", clearForm);
    $("btn-create-access")?.addEventListener("click", createAccess);
    $("btn-link-account")?.addEventListener("click", linkAccount);
    $("btn-presenze-refresh")?.addEventListener("click", loadPresenze);
    $("btn-leave-send")?.addEventListener("click", submitLeaveRequest);
    if (dateInput) dateInput.addEventListener("change", loadPresenze);

    document.querySelector("[data-i18n='staff.badge.copyNfc']")?.addEventListener("click", () => {
      navigator.clipboard?.writeText("https://ristoword.com/clock").then(() => alert("Link copiato."));
    });

    // Leave filter tabs
    document.querySelectorAll("#leave-tabs .filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("#leave-tabs .filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        leaveFilterStatus = tab.dataset.status;
        renderLeaveTable();
      });
    });

    initQrBadges();
  });
})();
