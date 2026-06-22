(function () {
  "use strict";

  async function loadSessions() {
    var list = document.getElementById("sessions-list");
    var kpiTotal = document.getElementById("kpi-total");
    if (!list) return;

    try {
      var res = await fetch("/api/sessions", { credentials: "same-origin" });
      if (!res.ok) throw new Error();
      var data = await res.json();
      var sessions = data.sessions || [];
      if (kpiTotal) kpiTotal.textContent = String(sessions.length);

      if (sessions.length === 0) {
        list.innerHTML = '<div class="placeholder">Nessuna sessione attiva</div>';
        return;
      }

      list.innerHTML = "";
      sessions.forEach(function (s) {
        var card = document.createElement("div");
        card.className = "session-card" + (s.current ? " current" : "");

        var expires = s.expiresAt ? new Date(s.expiresAt).toLocaleString("it-IT") : "—";
        card.innerHTML =
          '<div class="session-info">' +
          '<span class="session-user">' + escapeHtml(s.user) + (s.role ? " (" + s.role + ")" : "") + "</span>" +
          '<span class="session-meta">Scade: ' + expires + "</span>" +
          (s.current ? '<span class="session-badge">Sessione corrente</span>' : "") +
          "</div>" +
          (s.current
            ? ""
            : '<button class="btn-revoke" data-id="' + s.id + '">Revoca</button>');

        list.appendChild(card);
      });

      list.querySelectorAll(".btn-revoke").forEach(function (btn) {
        btn.addEventListener("click", function () {
          revokeSession(btn.getAttribute("data-id"), btn);
        });
      });
    } catch (_) {
      list.innerHTML = '<div class="placeholder">Errore nel caricamento sessioni</div>';
    }
  }

  async function revokeSession(id, btn) {
    if (!confirm("Revocare questa sessione?")) return;
    btn.disabled = true;
    try {
      var res = await fetch("/api/sessions/" + id, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error();
      loadSessions();
    } catch (_) {
      btn.disabled = false;
      alert("Errore nella revoca");
    }
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  var hasAuth = !!document.querySelector('script[src*="auth-guard"]');
  document.addEventListener("rw:auth-ready", function () { loadSessions(); }, { once: true });
  if (!hasAuth) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { loadSessions(); }, { once: true });
    } else {
      loadSessions();
    }
  }
})();
