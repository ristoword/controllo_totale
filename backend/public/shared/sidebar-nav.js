/**
 * Shared sidebar navigation with role-based menu filtering.
 *
 * Include after auth-guard.js. Listens for rw:auth-ready to get user role,
 * then renders only the menu items the role is allowed to see.
 *
 * Role hierarchy:
 *   super_admin  → everything
 *   owner        → everything except super-admin tools
 *   supervisor   → everything except owner/super-admin sections
 *   managers (kitchen_manager, sala_manager, bar_manager, cash_manager, magazzino_manager)
 *                → like supervisor minus supervisor/owner-only items
 *   staff (sala, cucina, bar, pizzeria, cassa, magazzino, staff)
 *                → own department modules + turni + profile, no sensitive modules
 */
(function () {
  "use strict";

  var MENU_ITEMS = [
    { href: "/",                            icon: "📊", key: "dashboard",          label: "Dashboard",            roles: ["super_admin","owner","supervisor","manager","staff"] },
    { href: "/owner-console",               icon: "👑", key: "owner_area",         label: "Area Owner",           roles: ["super_admin","owner"] },
    { href: "/sala/sala.html",              icon: "🍽", key: "sala",               label: "Sala",                 roles: ["super_admin","owner","supervisor","manager","sala","sala_manager"] },
    { href: "/sala/sala-fullscreen.html",   icon: "🖥", key: "sala_fullscreen",    label: "Sala Fullscreen",      roles: ["super_admin","owner","supervisor","manager","sala","sala_manager"] },
    { href: "/cucina/cucina.html",          icon: "🔥", key: "cucina",             label: "Cucina",               roles: ["super_admin","owner","supervisor","manager","cucina","kitchen","kitchen_manager"] },
    { href: "/pizzeria/pizzeria.html",      icon: "🍕", key: "pizzeria",           label: "Pizzeria",             roles: ["super_admin","owner","supervisor","manager","pizzeria"] },
    { href: "/bar/bar.html",               icon: "🍸", key: "bar",                label: "Bar",                  roles: ["super_admin","owner","supervisor","manager","bar","bar_manager"] },
    { href: "/cantina",                     icon: "🍷", key: "cantina",            label: "Cantina",              roles: ["super_admin","owner","supervisor","manager","sala","sala_manager","bar","bar_manager"] },
    { href: "/situazione-giorno",           icon: "📡", key: "situazione_giorno",  label: "Situazione del Giorno",roles: ["super_admin","owner","supervisor","manager"] },
    { href: "/risto-comandi",               icon: "🎤", key: "risto_comandi",      label: "Risto Comandi",        roles: ["super_admin","owner","supervisor","manager","staff"] },
    { href: "/cassa/cassa.html",            icon: "💳", key: "cassa",              label: "Cassa",                roles: ["super_admin","owner","supervisor","manager","cassa","cashier","cash_manager"] },
    { href: "/cassa/chiusura.html",         icon: "📋", key: "chiusura_z",         label: "Chiusura Z",           roles: ["super_admin","owner","supervisor","cassa","cashier","cash_manager"] },
    { href: "/magazzino/magazzino.html",    icon: "📦", key: "magazzino",          label: "Magazzino",            roles: ["super_admin","owner","supervisor","manager","magazzino","magazzino_manager"] },
    { href: "/fornitori/fornitori.html",    icon: "🚚", key: "fornitori",          label: "Fornitori",            roles: ["super_admin","owner","supervisor","magazzino","magazzino_manager"] },
    { href: "/qr-tables/qr-tables.html",   icon: "📱", key: "qr_tables",          label: "QR Tavoli",            roles: ["super_admin","owner","supervisor","manager","sala","sala_manager"] },
    { href: "/catering/catering.html",      icon: "🎉", key: "catering",           label: "Catering",             roles: ["super_admin","owner","supervisor","manager"] },
    { href: "/prenotazioni/prenotazioni.html",icon:"📅",key: "prenotazioni",       label: "Prenotazioni",         roles: ["super_admin","owner","supervisor","manager","sala","sala_manager"] },
    { href: "/asporto/asporto.html",        icon: "🛍", key: "asporto",            label: "Asporto",              roles: ["super_admin","owner","supervisor","manager","sala","sala_manager","cassa","cashier"] },
    { href: "/supervisor/supervisor.html",  icon: "🧭", key: "supervisor",         label: "Supervisor",           roles: ["super_admin","owner","supervisor"] },
    { href: "/staff/staff.html",            icon: "👤", key: "staff",              label: "Staff",                roles: ["super_admin","owner","supervisor","manager"] },
    { href: "/turni/turni.html",            icon: "📋", key: "turni",              label: "Turni",                roles: ["super_admin","owner","supervisor","manager","staff"] },
    { href: "/staff-hr/index.html",         icon: "👥", key: "staff_hr",           label: "Staff HR",             roles: ["super_admin","owner","supervisor"] },
    { href: "/staff/me/index.html",         icon: "🙋", key: "my_profile",         label: "Il mio profilo",       roles: ["super_admin","owner","supervisor","manager","staff"] },
    { href: "/supervisor/customers/customers.html", icon:"⭐", key: "customers",   label: "Clienti",              roles: ["super_admin","owner","supervisor","manager"] },
    { href: "/hardware/hardware.html",      icon: "🖨", key: "hardware",           label: "Hardware / Stampa",    roles: ["super_admin","owner","supervisor"] },
    { href: "/menu-admin/menu-admin.html",  icon: "📝", key: "menu_admin",         label: "Menu Admin",           roles: ["super_admin","owner","supervisor","manager","cucina","kitchen","kitchen_manager"] },
    { href: "/daily-menu/daily-menu.html",  icon: "🍽", key: "daily_menu",         label: "Menu del Giorno",      roles: ["super_admin","owner","supervisor","manager","cucina","kitchen","kitchen_manager"] },
    { href: "/cucina/food-cost.html",       icon: "💰", key: "food_cost",          label: "Food Cost",            roles: ["super_admin","owner","supervisor","cucina","kitchen","kitchen_manager"] },
    { href: "/haccp/haccp.html",            icon: "🧪", key: "haccp",              label: "HACCP",                roles: ["super_admin","owner","supervisor","manager","cucina","kitchen","kitchen_manager"] },
    { href: "/archivio/archivio.html",      icon: "🗃", key: "archivio",           label: "Archivio",             roles: ["super_admin","owner","supervisor"] },
    { href: "/archivio/comande.html",       icon: "📃", key: "archivio_orders",    label: "Archivio comande",     roles: ["super_admin","owner","supervisor","cassa","cashier","cash_manager"] },
    { href: "/ai-assistente",               icon: "🤖", key: "ai_assistente",      label: "AI Assistente",        roles: ["super_admin","owner","supervisor","manager","staff"] },
    { href: "/manuale/manuale.html",        icon: "📖", key: "manuale",            label: "Manuale",              roles: ["super_admin","owner","supervisor","manager","staff"] },
    { href: "/sessions/sessions.html",      icon: "🔐", key: "sessions",           label: "Sessioni",             roles: ["super_admin","owner","supervisor"] },
  ];

  var ROLE_ALIASES = {
    kitchen: "cucina",
    cashier: "cassa",
    cash_manager: "manager",
    kitchen_manager: "manager",
    sala_manager: "manager",
    bar_manager: "manager",
    magazzino_manager: "manager",
  };

  function resolveRoleLevel(rawRole) {
    var r = String(rawRole || "").toLowerCase();
    if (r === "super_admin") return "super_admin";
    if (r === "owner") return "owner";
    if (r === "supervisor") return "supervisor";
    if (["kitchen_manager","sala_manager","bar_manager","cash_manager","magazzino_manager"].indexOf(r) !== -1) return "manager";
    return "staff";
  }

  function isAllowed(item, rawRole) {
    var r = String(rawRole || "").toLowerCase();
    if (r === "super_admin" || r === "owner") return true;
    var level = resolveRoleLevel(r);
    if (item.roles.indexOf(level) !== -1) return true;
    if (item.roles.indexOf(r) !== -1) return true;
    var alias = ROLE_ALIASES[r];
    if (alias && item.roles.indexOf(alias) !== -1) return true;
    return false;
  }

  function getCurrentPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function isActive(href) {
    var current = getCurrentPath();
    var target = href.replace(/\/+$/, "") || "/";
    if (current === target) return true;
    if (target !== "/" && current.indexOf(target.replace(/\/[^/]+$/, "")) === 0) return true;
    return false;
  }

  function t(key, fallback) {
    if (window.rwT) return window.rwT(key) || fallback;
    if (window.ControlloTotaleI18n && window.ControlloTotaleI18n.t) return window.ControlloTotaleI18n.t(key) || fallback;
    return fallback;
  }

  function ensureSidebarStyles() {
    if (document.getElementById("rw-sidebar-base-css")) return;
    var sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    var computed = window.getComputedStyle(sidebar);
    var bg = computed.backgroundColor;
    var hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
    if (hasBg) return;
    var link = document.createElement("link");
    link.id = "rw-sidebar-base-css";
    link.rel = "stylesheet";
    link.href = "/shared/sidebar-base.css";
    var firstLink = document.head.querySelector('link[rel="stylesheet"]');
    if (firstLink) {
      document.head.insertBefore(link, firstLink);
    } else {
      document.head.appendChild(link);
    }
  }

  function renderSidebar(role) {
    var sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    ensureSidebarStyles();

    var items = MENU_ITEMS.filter(function (item) {
      return isAllowed(item, role);
    });

    var html = "";

    html += '<button class="hamburger-btn" id="hamburger-btn" aria-label="Menu">';
    html += "<span></span><span></span><span></span></button>";

    html += '<div class="brand">';
    html += '<div class="brand-logo">CT</div>';
    html += '<div class="brand-text">';
    html += '<div class="brand-title">CONTROLLO TOTALE</div>';
    html += '<div class="brand-subtitle" data-i18n="brand_subtitle">Control Center</div>';
    html += "</div></div>";

    html += '<nav class="side-nav">';
    items.forEach(function (item) {
      var active = isActive(item.href) ? " active" : "";
      var label = t(item.key, item.label);
      html += '<a class="side-nav-item' + active + '" href="' + item.href + '" data-i18n="' + item.key + '">';
      html += item.icon + " " + label + "</a>";
    });
    html += "</nav>";

    html += '<div class="side-footer">';
    html += '<div class="side-footer-text" data-i18n="footer_text">&copy; 2026 Controllo Totale</div>';
    html += '<div class="side-footer-sub" data-i18n="footer_sub">Kitchen-First System</div>';
    html += "</div>";

    sidebar.innerHTML = html;

    var hamburger = sidebar.querySelector("#hamburger-btn");
    var backdrop = document.getElementById("sidebar-backdrop");
    if (hamburger) {
      hamburger.addEventListener("click", function () {
        var isOpen = sidebar.classList.toggle("open");
        hamburger.classList.toggle("active", isOpen);
        if (backdrop) backdrop.style.display = isOpen ? "block" : "none";
        document.body.style.overflow = isOpen ? "hidden" : "";
      });
    }
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        sidebar.classList.remove("open");
        if (hamburger) hamburger.classList.remove("active");
        backdrop.style.display = "none";
        document.body.style.overflow = "";
      });
    }

    sidebar.querySelectorAll(".side-nav-item").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.innerWidth <= 720) {
          sidebar.classList.remove("open");
          if (hamburger) hamburger.classList.remove("active");
          if (backdrop) backdrop.style.display = "none";
          document.body.style.overflow = "";
        }
      });
    });

    if (window.ControlloTotaleI18n && window.ControlloTotaleI18n.applyTranslations) {
      window.ControlloTotaleI18n.applyTranslations(sidebar);
    }
  }

  function boot() {
    var auth = null;
    try {
      var raw = localStorage.getItem("rw_auth");
      if (raw) auth = JSON.parse(raw);
    } catch (_) {}
    renderSidebar(auth ? auth.role : "staff");
  }

  window.addEventListener("rw:auth-ready", function (ev) {
    var user = ev.detail || {};
    renderSidebar(user.role || "staff");
  });

  window.addEventListener("i18n:updated", function () {
    var sidebar = document.querySelector(".sidebar");
    if (sidebar && window.ControlloTotaleI18n && window.ControlloTotaleI18n.applyTranslations) {
      window.ControlloTotaleI18n.applyTranslations(sidebar);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.RWSidebarNav = { renderSidebar: renderSidebar, MENU_ITEMS: MENU_ITEMS };
})();
