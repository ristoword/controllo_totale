(function () {
  "use strict";

  function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function initials(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function localeTag() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en" ? "en-GB" : lang + "-" + lang.toUpperCase();
  }

  function formatTodayDate() {
    return new Date().toLocaleDateString(localeTag(), {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function displayName(user) {
    if (!user) return "";
    if (user.displayName) return user.displayName;
    if (user.name) return user.name;
    var u = String(user.username || "").trim();
    if (!u) return "";
    return capitalize(u.split(/[._@-]/)[0]);
  }

  function initShellHeader(user) {
    var greet = document.getElementById("rw-greeting");
    var dateEl = document.getElementById("rw-date");
    var avatar = document.getElementById("rw-avatar");
    if (greet) {
      var name = displayName(user);
      var tpl = (window.rwT && window.rwT("rw_hello")) || "Ciao, {name}";
      greet.textContent = tpl.replace("{name}", name || "—");
    }
    if (dateEl) dateEl.textContent = formatTodayDate();
    if (avatar) avatar.textContent = initials(displayName(user) || user?.username || "?");

    window.addEventListener("i18n:updated", function () {
      if (greet) {
        var n = displayName(user);
        var t = (window.rwT && window.rwT("rw_hello")) || "Ciao, {name}";
        greet.textContent = t.replace("{name}", n || "—");
      }
      if (dateEl) dateEl.textContent = formatTodayDate();
    });
  }

  function bootHeader() {
    var cached = window.RW_AuthGuard && window.RW_AuthGuard.getStoredAuth
      ? window.RW_AuthGuard.getStoredAuth()
      : null;
    if (cached && cached.user) {
      initShellHeader({ username: cached.user });
    }
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (user) {
        if (user) initShellHeader(user);
      })
      .catch(function () {});
  }

  document.addEventListener("rw:auth-ready", function (ev) {
    initShellHeader(ev.detail || {});
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootHeader);
  } else {
    bootHeader();
  }

  window.RWShell = { initShellHeader: initShellHeader, formatTodayDate: formatTodayDate };
})();
