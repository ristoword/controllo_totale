/**
 * Controllo Totale i18n — frontend-only internationalization
 * Loads JSON from /i18n/{lang}.json and replaces text on elements with data-i18n attribute.
 * Supports data-i18n-placeholder for input placeholders.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "rw_lang";
  const SUPPORTED = ["it", "en", "de", "fr", "es", "nl"];
  const DEFAULT_LANG = "it";

  let translations = {};
  let currentLang = DEFAULT_LANG;

  function getSavedLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (_) {}
    return DEFAULT_LANG;
  }

  function setSavedLang(lang) {
    try {
      if (SUPPORTED.includes(lang)) {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch (_) {}
  }

  async function loadTranslations(lang) {
    const url = "/i18n/" + lang + ".json";
    const res = await fetch(url);
    if (!res.ok) throw new Error("i18n load failed: " + res.status);
    return res.json();
  }

  function isLoggedIn() {
    try {
      const raw = localStorage.getItem("rw_auth");
      if (!raw) return false;
      const auth = JSON.parse(raw);
      return !!(auth && auth.user);
    } catch (_) {
      return false;
    }
  }

  function applyTranslations() {
    const loggedIn = isLoggedIn();
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      if (el.id === "user-name-label" && loggedIn) return;
      const key = el.getAttribute("data-i18n");
      const t = translations[key];
      if (t !== undefined && t !== null) {
        el.textContent = t;
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      const key = el.getAttribute("data-i18n-placeholder");
      const t = translations[key];
      if (t !== undefined && t !== null) {
        el.placeholder = t;
      }
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      const key = el.getAttribute("data-i18n-title");
      const t = translations[key];
      if (t !== undefined && t !== null) {
        el.title = t;
      }
    });
    document.documentElement.lang = currentLang;
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("i18n:updated", { detail: { lang: currentLang } }));
    }
  }

  async function switchLanguage(lang) {
    if (!SUPPORTED.includes(lang)) return;
    try {
      translations = await loadTranslations(lang);
      currentLang = lang;
      setSavedLang(lang);
      applyTranslations();
      updateLangSelector();
    } catch (err) {
      console.warn("i18n: failed to load " + lang, err);
    }
  }

  function updateLangSelector() {
    document.querySelectorAll(".lang-option").forEach(function (btn) {
      const l = btn.getAttribute("data-lang");
      if (l === currentLang) {
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      }
    });
    var floatLabel = document.getElementById("i18n-float-label");
    if (floatLabel) floatLabel.textContent = LANG_LABELS[currentLang] || currentLang.toUpperCase();
  }

  const LANG_LABELS = {
    it: "Italiano",
    en: "English",
    de: "Deutsch",
    fr: "Français",
    es: "Español",
    nl: "Nederlands",
  };

  function buildLangButtons(container) {
    container.innerHTML = "";
    ["it", "en", "de", "fr", "es", "nl"].forEach(function (code) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lang-option" + (code === currentLang ? " active" : "");
      btn.setAttribute("data-lang", code);
      btn.setAttribute("aria-pressed", code === currentLang ? "true" : "false");
      btn.setAttribute("aria-label", LANG_LABELS[code] || code.toUpperCase());
      btn.textContent = LANG_LABELS[code] || code.toUpperCase();
      btn.addEventListener("click", function () {
        switchLanguage(code);
      });
      container.appendChild(btn);
    });
  }

  function injectFloatingSelector() {
    var floater = document.getElementById("i18n-float-selector");
    if (floater) return;
    var style = document.createElement("style");
    style.textContent = [
      "#i18n-float-selector{position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;flex-direction:column;align-items:flex-end;gap:4px;}",
      "#i18n-float-toggle{background:#1e293b;color:#f8fafc;border:none;border-radius:20px;padding:6px 14px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,.35);}",
      "#i18n-float-toggle:hover{background:#334155;}",
      "#i18n-float-dropdown{display:none;flex-direction:column;gap:3px;background:#1e293b;border-radius:10px;padding:8px;box-shadow:0 4px 16px rgba(0,0,0,.4);}",
      "#i18n-float-dropdown.open{display:flex;}",
      "#i18n-float-dropdown .lang-option{background:transparent;color:#cbd5e1;border:none;border-radius:6px;padding:5px 12px;font-size:13px;cursor:pointer;text-align:left;}",
      "#i18n-float-dropdown .lang-option:hover{background:#334155;color:#f8fafc;}",
      "#i18n-float-dropdown .lang-option.active{background:#3b82f6;color:#fff;}",
    ].join("\n");
    document.head.appendChild(style);

    floater = document.createElement("div");
    floater.id = "i18n-float-selector";

    var toggle = document.createElement("button");
    toggle.id = "i18n-float-toggle";
    toggle.type = "button";
    toggle.innerHTML = "🌐 <span id='i18n-float-label'>" + (LANG_LABELS[currentLang] || currentLang.toUpperCase()) + "</span>";

    var dropdown = document.createElement("div");
    dropdown.id = "i18n-float-dropdown";
    buildLangButtons(dropdown);

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });
    document.addEventListener("click", function () {
      dropdown.classList.remove("open");
    });

    floater.appendChild(dropdown);
    floater.appendChild(toggle);
    document.body.appendChild(floater);
  }

  function initLangSelector() {
    const container = document.getElementById("lang-selector");
    if (container) {
      buildLangButtons(container);
    } else {
      injectFloatingSelector();
    }
  }

  async function init() {
    currentLang = getSavedLang();
    try {
      translations = await loadTranslations(currentLang);
    } catch (_) {
      if (currentLang !== DEFAULT_LANG) {
        currentLang = DEFAULT_LANG;
        try {
          translations = await loadTranslations(DEFAULT_LANG);
        } catch (e) {
          return;
        }
      } else {
        return;
      }
    }
    applyTranslations();
    initLangSelector();
  }

  window.ControlloTotaleI18n = {
    getLang: function () {
      return currentLang;
    },
    setLang: switchLanguage,
    t: function (key) {
      return translations[key] !== undefined ? translations[key] : key;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
