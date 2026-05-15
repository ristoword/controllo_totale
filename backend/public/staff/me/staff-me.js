// Staff Me — Controllo Totale (RISTOSAAS design)
(function () {
  "use strict";

  let profile = null;

  function $(id) { return document.getElementById(id); }

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

  function showMsg(elId, text, ok) {
    const el = $(elId);
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg-bar" + (text ? (ok ? " ok" : " err") : "");
  }

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

  function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join("");
  }

  /* ─── Load Profile ─────────────────────── */
  async function loadProfile() {
    try {
      profile = await api("/api/staff/me");
      renderProfile();
    } catch (e) {
      $("profile-name").textContent = "Errore caricamento profilo";
      $("avatar").textContent = "?";
    }
  }

  function renderProfile() {
    if (!profile) return;
    const p = profile.personal || {};
    const name = [p.name || profile.name, p.surname || profile.surname].filter(Boolean).join(" ") || profile.username || "—";
    const role = profile.role || "—";

    $("profile-name").textContent = name;
    $("profile-role").textContent = role;
    $("avatar").textContent = getInitials(name);

    $("info-email").textContent = p.email || profile.email || "—";
    $("info-hire").textContent = fmtDate(p.hireDate || profile.hireDate || profile.createdAt);

    const w = profile.work || {};
    const hours = w.weeklyHours || profile.hoursWeek || profile.weeklyHours;
    $("info-hours").textContent = hours != null ? hours + "h" : "—";
  }

  /* ─── Clock In/Out ─────────────────────── */
  async function loadAttendance() {
    try {
      const [todayData, hist] = await Promise.all([
        api("/api/attendance/me/today"),
        api("/api/attendance/me"),
      ]);

      const hasOpen = todayData.hasOpenShift;
      const openShift = todayData.openShift;
      const statusText = $("clock-status-text");

      if (hasOpen && openShift) {
        const entrata = fmtTime(openShift.clockInAt);
        statusText.textContent = "Turno aperto — entrato alle " + entrata;
        statusText.style.color = "var(--ok)";
      } else {
        statusText.textContent = "Nessun turno aperto.";
        statusText.style.color = "var(--text-muted)";
      }

      $("btn-clock-in").disabled = hasOpen;
      $("btn-clock-out").disabled = !hasOpen;

      // Attendance history
      const rows = (Array.isArray(hist) ? hist : []).slice(-40).reverse();
      const tbody = $("tbody-attendance");

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Nessuna timbratura registrata.</td></tr>';
      } else {
        tbody.innerHTML = "";
        let monthTotal = 0;

        rows.forEach((r) => {
          const ci = r.clockInAt || r.date;
          const co = r.clockOutAt;
          const ms = ci && co ? new Date(co).getTime() - new Date(ci).getTime() : 0;
          const hours = ms > 0 ? ms / 3600000 : 0;
          monthTotal += hours;

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${esc(fmtDate(ci))}</td>
            <td>${esc(fmtTime(ci))}</td>
            <td>${esc(fmtTime(co))}</td>
            <td><strong style="color:var(--accent)">${hours > 0 ? hours.toFixed(1) + "h" : "—"}</strong></td>
          `;
          tbody.appendChild(tr);
        });

        $("month-hours-total").textContent = monthTotal.toFixed(1) + "h";
      }
    } catch (e) {
      $("tbody-attendance").innerHTML = '<tr><td colspan="4" class="empty-cell">' + esc(e.message) + '</td></tr>';
    }
  }

  async function clockIn() {
    $("btn-clock-in").disabled = true;
    try {
      await api("/api/attendance/me/clock-in", { method: "POST", body: JSON.stringify({}) });
      showMsg("msg-clock", "Timbratura entrata registrata.", true);
      await loadAttendance();
    } catch (e) {
      showMsg("msg-clock", e.message, false);
      $("btn-clock-in").disabled = false;
    }
  }

  async function clockOut() {
    $("btn-clock-out").disabled = true;
    try {
      await api("/api/attendance/me/clock-out", { method: "POST", body: JSON.stringify({}) });
      showMsg("msg-clock", "Timbratura uscita registrata.", true);
      await loadAttendance();
    } catch (e) {
      showMsg("msg-clock", e.message, false);
      $("btn-clock-out").disabled = false;
    }
  }

  /* ─── Init ─────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    loadAttendance();

    $("btn-clock-in")?.addEventListener("click", clockIn);
    $("btn-clock-out")?.addEventListener("click", clockOut);
  });
})();
