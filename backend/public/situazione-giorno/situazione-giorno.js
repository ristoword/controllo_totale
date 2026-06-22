(function () {
  "use strict";

  var lastNarrative = "";
  var speaking = false;

  function $(id) {
    return document.getElementById(id);
  }

  function t(key) {
    if (typeof window.rwT === "function") return window.rwT(key);
    return key;
  }

  function speechLang() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en"
      ? "en-US"
      : lang === "de"
        ? "de-DE"
        : lang === "fr"
          ? "fr-FR"
          : lang === "es"
            ? "es-ES"
            : lang === "nl"
              ? "nl-NL"
              : "it-IT";
  }

  function localeTag() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en" ? "en-GB" : lang + "-" + lang.toUpperCase();
  }

  function fmtMoney(n) {
    return Number(n || 0).toLocaleString(localeTag(), {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function setEmpty(el, key) {
    el.innerHTML = '<p class="empty">' + esc(t(key)) + "</p>";
  }

  function renderBookings(items) {
    var el = $("panel-bookings");
    if (!items || !items.length) {
      setEmpty(el, "situazione_no_bookings");
      return;
    }
    var html = '<ul class="booking-list">';
    items.forEach(function (row) {
      html +=
        '<li class="booking-item">' +
        '<span class="booking-time">' +
        esc(row.time) +
        "</span>" +
        '<div class="booking-meta">' +
        '<div class="booking-name">' +
        esc(row.name) +
        "</div>" +
        '<div class="booking-sub">' +
        esc(row.covers) +
        " " +
        esc(t("situazione_col_covers")) +
        " · " +
        esc(t("situazione_col_table")) +
        " " +
        esc(row.table) +
        "</div>" +
        "</div></li>";
    });
    html += "</ul>";
    el.innerHTML = html;
  }

  function renderStaff(items) {
    var el = $("panel-staff");
    if (!items || !items.length) {
      setEmpty(el, "situazione_no_staff");
      return;
    }
    var html = '<div class="staff-tags">';
    items.forEach(function (s) {
      var role = s.role ? " (" + s.role + ")" : "";
      html += '<span class="staff-tag">' + esc(s.name) + "<span>" + esc(role) + "</span></span>";
    });
    html += "</div>";
    el.innerHTML = html;
  }

  function renderKitchen(prepItems, activeCount) {
    var el = $("panel-kitchen");
    $("badge-prep").textContent = String(activeCount || 0);
    if (!prepItems || !prepItems.length) {
      setEmpty(el, "situazione_no_orders");
      return;
    }
    var html = '<ul class="prep-list">';
    prepItems.forEach(function (it) {
      html +=
        '<li class="prep-item">' +
        '<span class="prep-qty">' +
        esc(it.qty) +
        "×</span>" +
        "<span>" +
        esc(it.name) +
        ' <span style="color:var(--text-muted)">· ' +
        esc(t("situazione_col_table")) +
        " " +
        esc(it.table) +
        "</span></span></li>";
    });
    html += "</ul>";
    el.innerHTML = html;
  }

  function renderTasks(items) {
    var el = $("panel-tasks");
    if (!items || !items.length) {
      setEmpty(el, "situazione_no_tasks");
      return;
    }
    var html = '<ul class="task-list">';
    items.forEach(function (it) {
      html +=
        '<li class="task-item' +
        (it.type === "late" ? " late" : "") +
        '">' +
        esc(it.text) +
        "</li>";
    });
    html += "</ul>";
    el.innerHTML = html;
  }

  function renderAreas(byArea) {
    var el = $("panel-areas");
    if (!byArea || !byArea.length) {
      setEmpty(el, "situazione_no_orders");
      return;
    }
    var html = '<ul class="area-list">';
    byArea.forEach(function (row) {
      html +=
        '<li class="area-item">' +
        '<span class="area-name">' +
        esc(row.area) +
        "</span>" +
        '<span class="area-count">' +
        esc(row.count) +
        "</span></li>";
    });
    html += "</ul>";
    el.innerHTML = html;
  }

  function renderHotel(hotel) {
    var occ = $("hotel-occupancy");
    var detail = $("hotel-detail");
    if (!hotel || !hotel.enabled) {
      occ.textContent = "—";
      detail.textContent = t("situazione_hotel_inactive");
      return;
    }
    occ.textContent =
      hotel.occupied +
      "/" +
      hotel.total +
      " " +
      t("situazione_hotel_rooms");
    detail.textContent =
      t("situazione_hotel_arrivals") +
      ": " +
      hotel.arrivals +
      " · " +
      t("situazione_hotel_departures") +
      ": " +
      hotel.departures +
      " · HK: " +
      hotel.housekeeping;
  }

  async function loadBriefing() {
    $("live-time").textContent = t("situazione_loading");
    try {
      var res = await fetch("/api/operational-briefing", { credentials: "same-origin" });
      if (!res.ok) throw new Error("http " + res.status);
      var data = await res.json();
      var b = data.briefing || {};
      lastNarrative = data.narrative || "";

      $("k-bookings").textContent = String(b.bookings?.count || 0);
      $("k-covers").textContent = String(b.bookings?.covers || 0);
      $("k-staff").textContent = String(b.staff?.onShift || 0);
      $("k-shifts").textContent = String(b.staff?.plannedShifts || 0);
      $("k-orders").textContent = String(b.orders?.active || b.kitchen?.activeOrders || 0);
      $("k-orders-today").textContent = String(b.orders?.todayTotal || 0);
      $("k-tasks").textContent = String(b.tasks?.count || 0);
      $("k-stock").textContent = String(b.tasks?.lowStockCount || b.inventory?.lowStockCount || 0);
      $("k-revenue").textContent = fmtMoney(b.sales?.revenueToday || 0);
      $("k-completed").textContent = String(b.orders?.completedToday || 0);

      var ts = new Date(b.generatedAt || Date.now()).toLocaleTimeString(localeTag());
      $("live-time").textContent = t("situazione_live_data") + " " + ts;

      renderBookings(b.bookings?.items || []);
      renderStaff(b.staff?.items || []);
      renderKitchen(b.kitchen?.prepItems || [], b.orders?.active || 0);
      renderTasks(b.tasks?.items || []);
      renderAreas(b.orders?.byArea || []);
      renderHotel(b.hotel);
    } catch (err) {
      $("live-time").textContent = t("situazione_error");
      console.error(err);
    }
  }

  async function narrateAndSpeak() {
    if (speaking) {
      window.speechSynthesis.cancel();
      speaking = false;
      return;
    }
    if (!window.speechSynthesis) {
      alert(t("tts_unsupported"));
      return;
    }

    var locale = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    try {
      var res = await fetch("/api/operational-briefing/narrate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: locale, enhance: true }),
      });
      if (res.ok) {
        var data = await res.json();
        if (data.narrative) lastNarrative = data.narrative;
      }
    } catch (e) {
      /* template narrative already loaded */
    }

    speak(lastNarrative || t("situazione_no_data"));
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang();
    u.onstart = function () {
      speaking = true;
    };
    u.onend = u.onerror = function () {
      speaking = false;
    };
    window.speechSynthesis.speak(u);
  }

  function init() {
    loadBriefing();
    $("btn-refresh").addEventListener("click", loadBriefing);
    $("btn-speak").addEventListener("click", narrateAndSpeak);
    setInterval(loadBriefing, 60000);
  }

  var booted = false;

  function boot() {
    if (booted) return;
    booted = true;
    init();
  }

  var hasAuthGuard = !!document.querySelector('script[src*="auth-guard"]');

  document.addEventListener("rw:auth-ready", boot, { once: true });

  if (!hasAuthGuard) {
    if (window.ControlloTotaleI18n && window.ControlloTotaleI18n.whenReady) {
      window.ControlloTotaleI18n.whenReady().then(boot);
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }
})();
