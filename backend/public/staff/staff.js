// Staff management — Controllo Totale (RISTOSAAS design)
(function () {
  "use strict";

  let staffList = [];
  let dailySummary = null;
  let attendanceList = [];
  let leaveList = [];
  let editingStaffId = null;
  let leaveFilterStatus = "";

  function $(id) { return document.getElementById(id); }

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
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Nessun dipendente.</td></tr>';
      return;
    }

    staffList.forEach((u) => {
      const tr = document.createElement("tr");
      const name = userName(u);
      const hasAccount = u.username ? true : false;
      const linkedBadge = hasAccount ? '<span class="badge-linked">LINKED</span>' : '';

      const statusMap = {
        true: { label: "Attivo", cls: "badge-ok" },
        false: { label: "Sospeso", cls: "badge-danger" },
      };
      const active = u.active !== false;
      const status = statusMap[active] || statusMap[true];

      const hoursWeek = u.hoursWeek || u.weeklyHours || "—";

      tr.innerHTML = `
        <td><strong>${esc(name)}</strong>${linkedBadge}</td>
        <td><span class="badge badge-muted">${esc(roleLabel(u.role))}</span></td>
        <td><span class="badge ${status.cls}">${esc(status.label)}</span></td>
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

  /* ─── Access Table ─────────────────────── */
  function renderAccessTable() {
    const tbody = $("access-tbody");
    if (!tbody) return;
    const withAccounts = staffList.filter((u) => u.username);
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
    $("form-title").textContent = "Aggiungi dipendente";
    $("form-subtitle").textContent = "Nuovo membro dello staff";
    $("btn-save-staff").textContent = "Aggiungi dipendente";
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
    $("form-title").textContent = "Modifica dipendente";
    $("form-subtitle").textContent = userName(u);
    $("btn-save-staff").textContent = "Salva modifiche";
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
    $("card-employee-form").scrollIntoView({ behavior: "smooth", block: "start" });
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

  function renderPresenzeTable() {
    const tbody = $("presenze-tbody");
    if (!tbody) return;
    const records = dailySummary && Array.isArray(dailySummary.records) ? dailySummary.records : attendanceList;
    tbody.innerHTML = "";

    if (!records || records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Nessuna presenza.</td></tr>';
      return;
    }

    records.forEach((r) => {
      const tr = document.createElement("tr");
      const name = userNameById(r.userId);
      const isOpen = r.status === "open";
      const statusLabel = isOpen ? "In servizio" : r.status === "anomaly" ? "Anomalia" : "Chiuso";
      const badgeCls = isOpen ? "badge-ok" : r.status === "anomaly" ? "badge-danger" : "badge-muted";
      const ore = r.workedMinutes != null ? formatMinutes(r.workedMinutes) : "—";

      tr.innerHTML = `
        <td><strong>${esc(name)}</strong></td>
        <td><span class="badge ${badgeCls}">${esc(statusLabel)}</span></td>
        <td><strong style="color:var(--accent)">${ore}</strong></td>
        <td class="actions">
          ${isOpen ? `<button class="btn-xs" data-action="close" data-id="${esc(r.id)}">Chiudi</button>` : ""}
          ${r.anomalyType ? `<button class="btn-xs" data-action="reset-anom" data-id="${esc(r.id)}">Reset</button>` : ""}
        </td>
      `;
      tr.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          try {
            if (btn.dataset.action === "close") {
              await fetchJSON("/api/attendance/" + id + "/close", { method: "PATCH", body: JSON.stringify({}) });
            } else {
              await fetchJSON("/api/attendance/" + id + "/anomaly", { method: "PATCH", body: JSON.stringify({ clear: true }) });
            }
            await loadPresenze();
            renderKpi();
          } catch (e) { alert(e.message); }
        });
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
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Nessuna richiesta.</td></tr>';
      return;
    }

    const typeMap = { ferie: "Ferie", permesso: "Permesso", malattia: "Malattia" };
    const statusMap = {
      pending: { label: "In attesa", cls: "badge-accent" },
      approved: { label: "Approvata", cls: "badge-ok" },
      rejected: { label: "Rifiutata", cls: "badge-danger" },
      cancelled: { label: "Annullata", cls: "badge-muted" },
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

    loadStaff();

    $("btn-refresh")?.addEventListener("click", loadStaff);
    $("btn-save-staff")?.addEventListener("click", saveStaff);
    $("btn-form-reset")?.addEventListener("click", clearForm);
    $("btn-create-access")?.addEventListener("click", createAccess);
    $("btn-link-account")?.addEventListener("click", linkAccount);
    $("btn-presenze-refresh")?.addEventListener("click", loadPresenze);
    if (dateInput) dateInput.addEventListener("change", loadPresenze);

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
