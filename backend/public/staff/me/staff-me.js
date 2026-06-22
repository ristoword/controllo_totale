// Staff Me — Controllo Totale (RISTOSAAS design)
(function () {
  "use strict";

  let profile = null;

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

  function currentMonthPrefix() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function renderProfile() {
    if (!profile) return;
    const p = profile.personal || {};
    const name = [p.name || profile.name, p.surname || profile.surname].filter(Boolean).join(" ") || profile.username || "—";
    const role = (profile.role || "—").toString().toUpperCase();

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
        statusText.textContent = t("staff.me.shiftOpenAt") + " " + entrata;
        statusText.className = "stamp-mini-value shift-open";
      } else {
        statusText.textContent = t("staff.me.noShiftOpen");
        statusText.className = "stamp-mini-value shift-closed";
      }

      $("btn-clock-in").disabled = hasOpen;
      $("btn-clock-out").disabled = !hasOpen;

      const monthPrefix = currentMonthPrefix();
      const rows = (Array.isArray(hist) ? hist : [])
        .filter((r) => {
          const d = (r.date || r.clockInAt || "").slice(0, 7);
          return d === monthPrefix;
        })
        .sort((a, b) => new Date(b.clockInAt || b.date) - new Date(a.clockInAt || a.date));

      const tbody = $("tbody-attendance");
      let monthTotal = 0;

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">' + esc(t("staff.me.noTimestamp")) + "</td></tr>";
      } else {
        tbody.innerHTML = "";
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
            <td><strong style="color:#f97316">${hours > 0 ? hours.toFixed(1) + "h" : "—"}</strong></td>
          `;
          tbody.appendChild(tr);
        });
      }

      const monthStr = monthTotal.toFixed(1) + "h";
      $("month-hours-total").textContent = monthStr;
      const badge = $("month-badge");
      if (badge) badge.textContent = t("staff.me.thisMonth") + " " + monthStr;
    } catch (e) {
      $("tbody-attendance").innerHTML = '<tr><td colspan="4" class="empty-cell">' + esc(e.message) + '</td></tr>';
    }
  }

  async function clockIn() {
    $("btn-clock-in").disabled = true;
    try {
      await api("/api/attendance/me/clock-in", { method: "POST", body: JSON.stringify({}) });
      showMsg("msg-clock", t("staff.me.clockInOk"), true);
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
      showMsg("msg-clock", t("staff.me.clockOutOk"), true);
      await loadAttendance();
    } catch (e) {
      showMsg("msg-clock", e.message, false);
      $("btn-clock-out").disabled = false;
    }
  }

  /* ─── Init ─────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    const dateLabel = $("me-date-label");
    if (dateLabel) {
      dateLabel.textContent = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
    }

    loadProfile();
    loadAttendance();

    $("btn-clock-in")?.addEventListener("click", clockIn);
    $("btn-clock-out")?.addEventListener("click", clockOut);
  });
})();
