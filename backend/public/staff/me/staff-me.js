// Area personale dipendente — solo dati della sessione corrente
(function () {
  "use strict";

  let profile = null;

  function $(id) {
    return document.getElementById(id);
  }

  function showMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg-me " + (ok ? "ok" : "err");
    el.style.display = text ? "block" : "none";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleString("it-IT");
    } catch (_) {
      return iso;
    }
  }

  function fmtDateOnly(iso) {
    if (!iso) return "—";
    const s = String(iso).slice(0, 10);
    try {
      const d = new Date(s + "T12:00:00");
      return d.toLocaleDateString("it-IT");
    } catch (_) {
      return s;
    }
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

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

  function renderReadonlyProfile() {
    const el = $("readonly-profile");
    if (!el || !profile) return;
    const p = profile.personal || {};
    const w = profile.work || {};
    const sal = profile.salary || {};
    const lb = profile.leaveBalances || {};
    const disc = profile.discipline || {};
    const warnings = Array.isArray(disc.warnings) ? disc.warnings : [];
    const mgrNotes = Array.isArray(disc.managerNotes) ? disc.managerNotes : [];
    const warnHtml = warnings.length
      ? `<h3 style="margin:14px 0 8px;font-size:0.95rem;">Richiami</h3><ul style="margin:0;padding-left:18px;">${warnings.map((w) => "<li>" + escapeHtml(fmtDateOnly(w.date)) + " — " + escapeHtml(w.text || w.note || "") + "</li>").join("")}</ul>`
      : "";
    const notesHtml = mgrNotes.length
      ? `<h3 style="margin:14px 0 8px;font-size:0.95rem;">Note del responsabile</h3><ul style="margin:0;padding-left:18px;">${mgrNotes.map((n) => "<li>" + escapeHtml(fmtDateOnly(n.date)) + " — " + escapeHtml(n.text || n.note || "") + "</li>").join("")}</ul>`
      : "";
    el.innerHTML = `
      <div class="readonly-block">
        <div class="row"><span class="k">Ruolo</span><span>${escapeHtml(profile.role || "—")}</span></div>
        <div class="row"><span class="k">Reparto</span><span>${escapeHtml(w.department || w.role || "—")}</span></div>
        <div class="row"><span class="k">Nome</span><span>${escapeHtml([p.name, p.surname].filter(Boolean).join(" ") || profile.username || "—")}</span></div>
        <div class="row"><span class="k">Assunzione / inizio</span><span>${escapeHtml(p.hireDate || (profile.createdAt ? String(profile.createdAt).slice(0, 10) : "—"))}</span></div>
        <div class="row"><span class="k">Tipo contratto</span><span>${escapeHtml(w.contractType || profile.employmentType || "—")}</span></div>
        <div class="row"><span class="k">Ore settimanali (scheda)</span><span>${w.weeklyHours != null ? escapeHtml(String(w.weeklyHours)) : "—"}</span></div>
        <div class="row"><span class="k">Compenso orario (scheda)</span><span>${sal.hourlyRate != null ? "€ " + Number(sal.hourlyRate).toFixed(2) : profile.hourlyRate != null ? "€ " + Number(profile.hourlyRate).toFixed(2) : "—"}</span></div>
        <div class="row"><span class="k">Ferie maturate (sistema)</span><span>${lb.ferieMaturate != null ? lb.ferieMaturate : "—"}</span></div>
      </div>
      ${warnHtml}${notesHtml}
      <p class="small-note">Stipendi e dati contrattuali completi restano visibili anche a owner/supervisor dalla scheda staff.</p>
    `;
    $("field-email").value = p.email || profile.email || "";
    $("field-phone").value = p.phone || "";
    $("field-address").value = p.address || "";
    $("field-name").value = p.name || profile.name || "";
    $("field-surname").value = p.surname || profile.surname || "";
  }

  async function loadProfile() {
    showMsg($("msg-dati"), "", true);
    try {
      profile = await api("/api/staff/me");
      renderReadonlyProfile();
    } catch (e) {
      showMsg($("msg-dati"), e.message || "Impossibile caricare il profilo.", false);
    }
  }

  async function saveProfile() {
    const body = {
      email: $("field-email").value.trim(),
      phone: $("field-phone").value.trim(),
      address: $("field-address").value.trim(),
      name: $("field-name").value.trim(),
      surname: $("field-surname").value.trim(),
    };
    showMsg($("msg-dati"), "Salvataggio…", true);
    try {
      profile = await api("/api/staff/me", { method: "PATCH", body: JSON.stringify(body) });
      showMsg($("msg-dati"), "Dati aggiornati.", true);
      renderReadonlyProfile();
    } catch (e) {
      showMsg($("msg-dati"), e.message || "Errore salvataggio.", false);
    }
  }

  function rangePreset(key) {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const hireRaw = profile && profile.personal && profile.personal.hireDate;
    const hire = hireRaw ? new Date(hireRaw + "T12:00:00") : new Date(today.getFullYear(), 0, 1);
    const startOfWeek = new Date(today);
    {
      const dow = today.getDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      startOfWeek.setDate(today.getDate() + offset);
    }
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const threeMonthsEnd = new Date(today);
    threeMonthsEnd.setMonth(threeMonthsEnd.getMonth() + 3);

    switch (key) {
      case "week":
        return { from: iso(startOfWeek), to: iso(endOfWeek) };
      case "month":
        return { from: iso(startMonth), to: iso(endMonth) };
      case "next":
        return { from: iso(nextMonthStart), to: iso(nextMonthEnd) };
      case "prev":
        return { from: iso(prevMonthStart), to: iso(prevMonthEnd) };
      case "hire":
        return { from: iso(hire), to: iso(today) };
      case "future":
        return { from: iso(today), to: iso(threeMonthsEnd) };
      default:
        return { from: $("shift-from").value, to: $("shift-to").value };
    }
  }

  async function loadShifts() {
    const tbody = $("tbody-shifts");
    const msg = $("msg-shifts");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan=\"5\">Caricamento…</td></tr>";
    let from = $("shift-from").value;
    let to = $("shift-to").value;
    if (!from || !to) {
      const r = rangePreset("month");
      from = r.from;
      to = r.to;
      $("shift-from").value = from;
      $("shift-to").value = to;
    }
    try {
      const list = await api(`/api/staff/me/shifts?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}`);
      if (!list.length) {
        tbody.innerHTML = "<tr><td colspan=\"5\">Nessun turno nel periodo.</td></tr>";
        if (msg) msg.textContent = "";
        return;
      }
      tbody.innerHTML = list
        .map(
          (s) => `
        <tr>
          <td>${escapeHtml(s.date || "—")}</td>
          <td>${escapeHtml(s.start || "—")} – ${escapeHtml(s.end || "—")}</td>
          <td>${escapeHtml(s.type || s.role || "—")}</td>
          <td>${escapeHtml(s.status || "—")}</td>
          <td>${escapeHtml(s.notes || "—")}</td>
        </tr>`
        )
        .join("");
      if (msg) msg.textContent = list.length + " turni nel periodo.";
    } catch (e) {
      tbody.innerHTML = "<tr><td colspan=\"5\">" + escapeHtml(e.message) + "</td></tr>";
      if (msg) msg.textContent = "";
    }
  }

  function bindShiftPresets() {
    ["preset-week", "preset-month", "preset-next", "preset-prev", "preset-hire", "preset-future"].forEach((id) => {
      const b = $(id);
      if (!b) return;
      b.addEventListener("click", () => {
        const key = id.replace("preset-", "");
        const map = { week: "week", month: "month", next: "next", prev: "prev", hire: "hire", future: "future" };
        const r = rangePreset(map[key] || "month");
        $("shift-from").value = r.from;
        $("shift-to").value = r.to;
        loadShifts();
      });
    });
  }

  async function loadHours() {
    const el = $("hours-summary");
    if (!el) return;
    el.textContent = "Caricamento…";
    try {
      const h = await api("/api/staff/me/hours/summary");
      el.innerHTML = `
        <div class="readonly-block">
          <div class="row"><span class="k">Ore mese (da turni)</span><span>${h.hoursMonth != null ? Number(h.hoursMonth).toFixed(1) + " h" : "—"}</span></div>
          <div class="row"><span class="k">Ore contratto mensili</span><span>${h.monthlyContractHours != null ? h.monthlyContractHours : "—"}</span></div>
          <div class="row"><span class="k">Residue (stima)</span><span>${h.monthlyHoursRemaining != null ? Number(h.monthlyHoursRemaining).toFixed(1) + " h" : "—"}</span></div>
          <div class="row"><span class="k">Straordinari</span><span>${h.overtime != null ? h.overtime : "—"}</span></div>
        </div>`;
    } catch (e) {
      el.textContent = e.message || "Errore";
    }
  }

  async function loadAttendance() {
    const tbody = $("tbody-attendance");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan=\"5\">Caricamento…</td></tr>";
    try {
      const [todayData, hist] = await Promise.all([
        api("/api/attendance/me/today"),
        api("/api/attendance/me"),
      ]);
      const hasOpen = todayData.hasOpenShift;
      const openShift = todayData.openShift;

      // Update clock status
      const statusText = $("clock-status-text");
      if (statusText) {
        if (hasOpen && openShift) {
          const entrata = fmtDate(openShift.clockInAt);
          statusText.textContent = "Turno aperto — entrato alle " + entrata;
          statusText.style.color = "var(--ok)";
        } else {
          statusText.textContent = "Nessun turno aperto.";
          statusText.style.color = "var(--muted)";
        }
      }

      // Enable/disable clock buttons
      const btnIn = $("btn-clock-in");
      const btnOut = $("btn-clock-out");
      if (btnIn) { btnIn.disabled = hasOpen; }
      if (btnOut) { btnOut.disabled = !hasOpen; }

      $("attn-today").textContent = hasOpen
        ? "Turno aperto (timbratura attiva)"
        : "Nessun turno aperto al momento.";

      const rows = (Array.isArray(hist) ? hist : []).slice(-40).reverse();
      if (!rows.length) {
        tbody.innerHTML = "<tr><td colspan=\"5\">Nessuna timbratura registrata.</td></tr>";
        return;
      }
      tbody.innerHTML = rows
        .map((r) => {
          const ci = r.clockInAt || r.date;
          const co = r.clockOutAt;
          const ms = ci && co ? new Date(co).getTime() - new Date(ci).getTime() : 0;
          const hours = ms > 0 ? (ms / 3600000).toFixed(1) + "h" : "—";
          return `<tr>
            <td>${fmtDateOnly(ci)}</td>
            <td>${fmtDate(ci)}</td>
            <td>${fmtDate(co)}</td>
            <td><strong style="color:var(--accent)">${hours}</strong></td>
            <td>${r.status || "—"}</td>
          </tr>`;
        })
        .join("");
    } catch (e) {
      tbody.innerHTML = "<tr><td colspan=\"5\">" + escapeHtml(e.message) + "</td></tr>";
    }
  }

  async function clockIn() {
    const btn = $("btn-clock-in");
    const msgEl = $("msg-clock");
    if (btn) btn.disabled = true;
    try {
      await api("/api/attendance/me/clock-in", { method: "POST", body: JSON.stringify({}) });
      showMsg(msgEl, "Timbratura entrata registrata.", true);
      await loadAttendance();
    } catch (e) {
      showMsg(msgEl, e.message || "Errore timbratura.", false);
      if (btn) btn.disabled = false;
    }
  }

  async function clockOut() {
    const btn = $("btn-clock-out");
    const msgEl = $("msg-clock");
    if (btn) btn.disabled = true;
    try {
      await api("/api/attendance/me/clock-out", { method: "POST", body: JSON.stringify({}) });
      showMsg(msgEl, "Timbratura uscita registrata.", true);
      await loadAttendance();
    } catch (e) {
      showMsg(msgEl, e.message || "Errore timbratura.", false);
      if (btn) btn.disabled = false;
    }
  }

  async function loadLeave() {
    const tbody = $("tbody-leave");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan=\"5\">Caricamento…</td></tr>";
    try {
      const [list, bal] = await Promise.all([api("/api/leave/me"), api("/api/leave/balances/me")]);
      $("leave-balances").textContent =
        `Ferie maturate ${bal.ferieMaturate ?? 0} · usate ${bal.ferieUsate ?? 0} · permessi usati ${bal.permessiUsati ?? 0} · malattia giorni ${bal.malattiaGiorni ?? 0}`;
      if (!list.length) {
        tbody.innerHTML = "<tr><td colspan=\"5\">Nessuna richiesta.</td></tr>";
        return;
      }
      const map = { ferie: "Ferie", permesso: "Permesso", malattia: "Malattia" };
      tbody.innerHTML = list
        .map(
          (r) => `
        <tr>
          <td>${escapeHtml(map[r.type] || r.type || "—")}</td>
          <td>${escapeHtml(r.startDate)} → ${escapeHtml(r.endDate)}</td>
          <td>${escapeHtml(r.status || "—")}</td>
          <td>${escapeHtml((r.reason || "").slice(0, 80))}</td>
          <td>${r.days != null ? r.days : "—"}</td>
        </tr>`
        )
        .join("");
    } catch (e) {
      tbody.innerHTML = "<tr><td colspan=\"5\">" + escapeHtml(e.message) + "</td></tr>";
    }
  }

  async function submitLeave() {
    const msg = $("msg-leave");
    const type = $("leave-type").value;
    const startDate = $("leave-start").value;
    const endDate = $("leave-end").value;
    let reason = ($("leave-reason").value || "").trim();
    if (type === "permesso" && $("leave-special").checked) {
      reason = (reason ? reason + " — " : "") + "Richiesta giornata speciale / motivo libero";
    }
    if (!startDate || !endDate) {
      showMsg(msg, "Indica date di inizio e fine.", false);
      return;
    }
    try {
      await api("/api/leave/me", {
        method: "POST",
        body: JSON.stringify({ type, startDate, endDate, reason }),
      });
      showMsg(msg, "Richiesta inviata. L’owner riceverà la notifica in Gestione staff.", true);
      $("leave-reason").value = "";
      $("leave-special").checked = false;
      await loadLeave();
    } catch (e) {
      showMsg(msg, e.message || "Errore", false);
    }
  }

  async function loadStaffRequests() {
    const el = $("staff-requests");
    if (!el) return;
    el.innerHTML = "Caricamento…";
    try {
      const list = await api("/api/staff/me/requests");
      if (!list.length) {
        el.innerHTML = "<p class=\"small-note\">Nessuna richiesta HR (cambi turno, ferie da modulo legacy).</p>";
        return;
      }
      el.innerHTML =
        '<table class="table-me"><thead><tr><th>Data</th><th>Tipo</th><th>Stato</th><th>Note</th></tr></thead><tbody>' +
        list
          .map(
            (r) =>
              `<tr><td>${escapeHtml(fmtDateOnly(r.date || r.createdAt))}</td><td>${escapeHtml(r.type || "—")}</td><td>${escapeHtml(r.status || "—")}</td><td>${escapeHtml((r.reason || r.notes || "").slice(0, 120))}</td></tr>`
          )
          .join("") +
        "</tbody></table>";
    } catch (e) {
      el.textContent = e.message || "Errore";
    }
  }

  function showPanel(name) {
    document.querySelectorAll(".panel-me").forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
    document.querySelectorAll(".tab-me").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    if (name === "turni") loadShifts();
    if (name === "presenze") loadAttendance();
    if (name === "assenze") {
      loadLeave();
      loadStaffRequests();
    }
    if (name === "ore") loadHours();
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadProfile();

    $("btn-save-dati")?.addEventListener("click", saveProfile);
    $("btn-refresh-shifts")?.addEventListener("click", loadShifts);
    $("shift-from")?.addEventListener("change", loadShifts);
    $("shift-to")?.addEventListener("change", loadShifts);
    bindShiftPresets();

    $("btn-submit-leave")?.addEventListener("click", submitLeave);
    $("btn-clock-in")?.addEventListener("click", clockIn);
    $("btn-clock-out")?.addEventListener("click", clockOut);

    document.querySelectorAll(".tab-me").forEach((t) => {
      t.addEventListener("click", () => showPanel(t.dataset.tab));
    });

    const today = new Date();
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    if ($("shift-from")) $("shift-from").value = startMonth.toISOString().slice(0, 10);
    if ($("shift-to")) $("shift-to").value = endMonth.toISOString().slice(0, 10);
  });
})();
