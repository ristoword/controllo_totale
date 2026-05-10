/**
 * shared/ai-widget.js
 * Universal AI floating chat widget for CONTROLLO TOTALE.
 *
 * Usage: add to any page (except staff/me):
 *   <link rel="stylesheet" href="/shared/ai-widget.css">
 *   <script src="/shared/ai-widget.js" data-module="sala"></script>
 *
 * Supported data-module values:
 *   sala, cucina, bar, pizzeria, cassa, magazzino (warehouse), supervisor,
 *   staff-hr (turni), archivio, prenotazioni, fornitori, haccp,
 *   menu-admin (creative), daily-menu (kitchen), dashboard (supervisor),
 *   asporto, catering, turni
 */

(function () {
  "use strict";

  // ─────────────────────────────────────────────
  //  Config
  // ─────────────────────────────────────────────
  const MODULE_TO_DEPT = {
    sala:         "sala",
    cucina:       "kitchen",
    bar:          "bar",
    pizzeria:     "pizzeria",
    cassa:        "cash",
    magazzino:    "warehouse",
    supervisor:   "supervisor",
    "staff-hr":   "turni",
    archivio:     "archivio",
    prenotazioni: "prenotazioni",
    fornitori:    "fornitori",
    haccp:        "haccp",
    "menu-admin": "creative",
    "daily-menu": "kitchen",
    dashboard:    "supervisor",
    asporto:      "asporto",
    catering:     "catering",
    turni:        "turni",
  };

  const MODULE_LABELS = {
    sala:         "Sala",
    cucina:       "Cucina",
    bar:          "Bar",
    pizzeria:     "Pizzeria",
    cassa:        "Cassa",
    magazzino:    "Magazzino",
    supervisor:   "Supervisor",
    "staff-hr":   "Staff HR",
    archivio:     "Archivio",
    prenotazioni: "Prenotazioni",
    fornitori:    "Fornitori",
    haccp:        "HACCP",
    "menu-admin": "Menu",
    "daily-menu": "Menu Giornaliero",
    dashboard:    "Dashboard",
    asporto:      "Asporto",
    catering:     "Catering",
    turni:        "Turni",
  };

  const QUICK_PROMPTS = {
    sala: [
      "Com'è la situazione tavoli adesso?",
      "Quanti ordini attivi ci sono?",
      "Quali tavoli aspettano il conto?",
      "Suggerisci come ottimizzare il servizio",
    ],
    cucina: [
      "Cosa devo preparare adesso?",
      "Ci sono prodotti in scadenza?",
      "Quali piatti sono in ritardo?",
      "Mostra la prep list del giorno",
    ],
    bar: [
      "Quali drink vanno di più oggi?",
      "Cosa sta finendo al bar?",
      "Suggerisci un cocktail del giorno",
      "Ordini bar aperti adesso",
    ],
    pizzeria: [
      "Quanti ordini pizza ci sono in coda?",
      "Ingredienti in esaurimento?",
      "Suggerisci una pizza speciale oggi",
      "Ottimizzazione forno attuale",
    ],
    cash: [
      "Riepilogo incassi di oggi",
      "Quali metodi di pagamento si usano di più?",
      "Ci sono anomalie sugli scontrini?",
      "Scontrino medio rispetto alla settimana scorsa",
    ],
    warehouse: [
      "Cosa devo riordinare oggi?",
      "Prodotti sotto scorta minima",
      "Cosa sta per scadere?",
      "Lista acquisti ottimizzata",
    ],
    supervisor: [
      "Riepilogo della giornata",
      "Top piatti venduti oggi",
      "Analisi margini per reparto",
      "Previsioni per domani",
    ],
    turni: [
      "Chi manca nei turni questa settimana?",
      "Costo del personale stimato",
      "Reparti sotto organico",
      "Ottimizza i turni di domani",
    ],
    archivio: [
      "Trend vendite ultimo mese",
      "Confronto con settimana scorsa",
      "Giorni di punta storici",
      "Piatti più venduti nel periodo",
    ],
    prenotazioni: [
      "Quante prenotazioni ci sono oggi?",
      "Orari di punta previsti",
      "Rischio overbooking?",
      "Preparativi per il gruppo più grande",
    ],
    fornitori: [
      "Lista acquisti da fare oggi",
      "Fornitori con consegne in ritardo",
      "Prodotti con costo aumentato",
      "Priorità ordini urgenti",
    ],
    haccp: [
      "Controlli temperature da registrare",
      "Prodotti in zona critica",
      "Non conformità rilevate",
      "Prossime scadenze igieniche",
    ],
    creative: [
      "Proponi un menu del giorno",
      "Nuovi piatti con ingredienti disponibili",
      "Ricette anti-spreco",
      "Abbinamenti vino per il menu attuale",
    ],
    kitchen: [
      "Cosa devo preparare adesso?",
      "Menu del giorno pronto?",
      "Prodotti in scadenza da usare",
      "Ottimizzazioni per il servizio",
    ],
    asporto: [
      "Ordini asporto in coda",
      "Tempi di attesa stimati",
      "Prodotti più richiesti per asporto",
      "Suggerisci promozione take-away",
    ],
    catering: [
      "Prossimo evento catering",
      "Lista acquisti per l'evento",
      "Prep list e timeline",
      "Criticità da risolvere",
    ],
  };

  // ─────────────────────────────────────────────
  //  Module detection
  // ─────────────────────────────────────────────
  function detectModule() {
    const script = document.currentScript ||
      document.querySelector('script[data-module]') ||
      document.querySelector('script[src*="ai-widget"]');
    if (script && script.dataset.module) return script.dataset.module;
    const path = window.location.pathname.toLowerCase();
    for (const mod of Object.keys(MODULE_TO_DEPT)) {
      if (path.includes(mod)) return mod;
    }
    return "dashboard";
  }

  const MODULE = detectModule();
  const DEPT   = MODULE_TO_DEPT[MODULE] || "supervisor";
  const LABEL  = MODULE_LABELS[MODULE] || MODULE;
  const PROMPTS = QUICK_PROMPTS[DEPT] || QUICK_PROMPTS["supervisor"];

  // ─────────────────────────────────────────────
  //  State
  // ─────────────────────────────────────────────
  let isOpen    = false;
  let isLoading = false;
  let messages  = [];  // { role: 'user'|'assistant', content, raw? }

  // ─────────────────────────────────────────────
  //  DOM creation
  // ─────────────────────────────────────────────
  function injectStyles() {
    if (document.querySelector('link[href*="ai-widget.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/shared/ai-widget.css";
    document.head.appendChild(link);
  }

  function buildDOM() {
    // FAB
    const fab = document.createElement("button");
    fab.id = "ai-fab";
    fab.setAttribute("aria-label", "Apri assistente AI");
    fab.setAttribute("title", "Assistente AI");
    fab.innerHTML = `🤖<span id="ai-fab-badge" style="display:none">!</span>`;
    document.body.appendChild(fab);

    // PANEL
    const panel = document.createElement("div");
    panel.id = "ai-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", `Assistente AI – ${LABEL}`);
    panel.hidden = true;

    panel.innerHTML = `
      <div class="ai-panel-head">
        <div class="ai-panel-head-left">
          <div class="ai-panel-icon">🤖</div>
          <div>
            <div class="ai-panel-title">Assistente AI</div>
            <div class="ai-panel-dept">${escH(LABEL)}</div>
          </div>
        </div>
        <button class="ai-panel-close" id="ai-panel-close" aria-label="Chiudi">✕</button>
      </div>
      <div class="ai-quick-prompts" id="ai-quick-prompts"></div>
      <div class="ai-messages" id="ai-messages"></div>
      <div class="ai-input-bar">
        <input type="text" class="ai-input" id="ai-input"
          placeholder="Scrivi una domanda…" autocomplete="off" maxlength="400" />
        <button class="ai-clear-btn" id="ai-clear-btn" title="Cancella chat">🗑</button>
        <button class="ai-send-btn" id="ai-send-btn" aria-label="Invia" disabled>➤</button>
      </div>`;
    document.body.appendChild(panel);
  }

  // ─────────────────────────────────────────────
  //  Quick prompts render
  // ─────────────────────────────────────────────
  function renderQuickPrompts() {
    const container = document.getElementById("ai-quick-prompts");
    if (!container) return;
    container.innerHTML = PROMPTS.map((p) =>
      `<button class="ai-qp-btn" data-q="${escAttr(p)}">${escH(p)}</button>`
    ).join("");
    container.querySelectorAll(".ai-qp-btn").forEach((btn) => {
      btn.addEventListener("click", () => sendMessage(btn.dataset.q));
    });
  }

  // ─────────────────────────────────────────────
  //  Messages render
  // ─────────────────────────────────────────────
  function renderMessages() {
    const container = document.getElementById("ai-messages");
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="ai-empty-state">
          <div class="ai-empty-icon">🤖</div>
          <p>Ciao! Sono l'assistente AI di <strong>${escH(LABEL)}</strong>.</p>
          <p style="color:var(--ai-muted);font-size:12px">Usa i pulsanti rapidi in alto o scrivi una domanda.</p>
        </div>`;
      return;
    }

    container.innerHTML = messages.map((msg) => {
      if (msg.role === "user") {
        return `<div class="ai-msg-user">${escH(msg.content)}</div>`;
      }
      if (msg.role === "thinking") {
        return `<div class="ai-msg-thinking">
          <div class="ai-thinking-dots"><span></span><span></span><span></span></div>
          AI sta elaborando…
        </div>`;
      }
      if (msg.role === "error") {
        return `<div class="ai-msg-error">⚠ ${escH(msg.content)}</div>`;
      }
      // assistant
      return renderAssistantMsg(msg);
    }).join("");

    // scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  function renderAssistantMsg(msg) {
    const r = msg.raw || {};
    const summary = r.summary || r.answer || msg.content || "";
    const title   = r.title || "";
    const insights = Array.isArray(r.insights) ? r.insights : [];
    const warnings = Array.isArray(r.warnings) ? r.warnings.filter(Boolean) : [];
    const actions  = Array.isArray(r.actions)  ? r.actions  : [];
    const dataPoints = r.dataPoints && typeof r.dataPoints === "object" ? r.dataPoints : {};
    const dpKeys = Object.keys(dataPoints);

    let html = `<div class="ai-msg-assistant"><div class="ai-msg-card">`;
    if (title) html += `<div class="ai-msg-card-title">${escH(title)}</div>`;
    if (summary) html += `<div class="ai-msg-summary">${escH(summary)}</div>`;

    if (insights.length > 0) {
      html += `<div class="ai-insights">` +
        insights.map((i) => `<div class="ai-insight-item">${escH(String(i))}</div>`).join("") +
        `</div>`;
    }

    if (dpKeys.length > 0) {
      html += `<div class="ai-data-points">` +
        dpKeys.map((k) => `<span class="ai-dp"><strong>${escH(k)}:</strong> ${escH(String(dataPoints[k]))}</span>`).join("") +
        `</div>`;
    }

    if (warnings.length > 0) {
      html += `<div class="ai-warnings">` +
        warnings.map((w) => `<div class="ai-warning-item">${escH(String(w))}</div>`).join("") +
        `</div>`;
    }

    if (actions.length > 0) {
      html += `<div class="ai-actions-row">` +
        actions.map((a) =>
          `<button class="ai-action-chip${a.dangerous ? " dangerous" : ""}" data-action-label="${escAttr(a.label || "")}" title="${escAttr(a.description || "")}">${escH(a.label || a.id || "Azione")}</button>`
        ).join("") +
        `</div>`;
    }

    html += `</div></div>`;
    return html;
  }

  // ─────────────────────────────────────────────
  //  API call
  // ─────────────────────────────────────────────
  async function callAI(question) {
    const resp = await fetch(`/api/ai/${encodeURIComponent(DEPT)}/query`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-RW-Module": MODULE,
      },
      body: JSON.stringify({ question, mode: "read" }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || err.message || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  // ─────────────────────────────────────────────
  //  Send message
  // ─────────────────────────────────────────────
  async function sendMessage(question) {
    const q = (question || "").trim();
    if (!q || isLoading) return;

    isLoading = true;
    setSendDisabled(true);

    // push user bubble + thinking
    messages.push({ role: "user", content: q });
    messages.push({ role: "thinking" });
    renderMessages();
    clearInput();

    try {
      const result = await callAI(q);
      // remove thinking
      messages = messages.filter((m) => m.role !== "thinking");

      const summary = result.summary || result.answer || "Risposta ricevuta.";
      messages.push({ role: "assistant", content: summary, raw: result });
    } catch (err) {
      messages = messages.filter((m) => m.role !== "thinking");
      messages.push({ role: "error", content: err.message || "Errore AI" });
    } finally {
      isLoading = false;
      setSendDisabled(false);
      renderMessages();
      // bind action chips
      const container = document.getElementById("ai-messages");
      if (container) {
        container.querySelectorAll(".ai-action-chip").forEach((btn) => {
          btn.addEventListener("click", () => {
            const label = btn.dataset.actionLabel;
            if (label) sendMessage(`Esegui azione: ${label}`);
          });
        });
      }
    }
  }

  // ─────────────────────────────────────────────
  //  UI helpers
  // ─────────────────────────────────────────────
  function openPanel() {
    isOpen = true;
    const panel = document.getElementById("ai-panel");
    const fab   = document.getElementById("ai-fab");
    if (panel) { panel.hidden = false; }
    if (fab) { fab.setAttribute("data-open", "true"); fab.setAttribute("aria-label", "Chiudi assistente AI"); }
    renderMessages();
    setTimeout(() => {
      const input = document.getElementById("ai-input");
      if (input) input.focus();
    }, 120);
  }

  function closePanel() {
    isOpen = false;
    const panel = document.getElementById("ai-panel");
    const fab   = document.getElementById("ai-fab");
    if (panel) { panel.hidden = true; }
    if (fab) { fab.setAttribute("data-open", "false"); fab.setAttribute("aria-label", "Apri assistente AI"); }
  }

  function clearInput() {
    const input = document.getElementById("ai-input");
    if (input) input.value = "";
    setSendDisabled(true);
  }

  function setSendDisabled(val) {
    const btn = document.getElementById("ai-send-btn");
    if (btn) btn.disabled = val;
  }

  // ─────────────────────────────────────────────
  //  Utility
  // ─────────────────────────────────────────────
  function escH(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(s) { return escH(s).replace(/'/g, "&#39;"); }

  // ─────────────────────────────────────────────
  //  Init
  // ─────────────────────────────────────────────
  function init() {
    injectStyles();
    buildDOM();
    renderQuickPrompts();
    renderMessages();

    // FAB click
    document.getElementById("ai-fab").addEventListener("click", () => {
      isOpen ? closePanel() : openPanel();
    });

    // Close btn
    document.getElementById("ai-panel-close").addEventListener("click", closePanel);

    // Input
    const input = document.getElementById("ai-input");
    input.addEventListener("input", () => {
      setSendDisabled(!input.value.trim() || isLoading);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && input.value.trim()) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });

    // Send btn
    document.getElementById("ai-send-btn").addEventListener("click", () => {
      const val = (input.value || "").trim();
      if (val) sendMessage(val);
    });

    // Clear btn
    document.getElementById("ai-clear-btn").addEventListener("click", () => {
      messages = [];
      renderMessages();
    });

    // ESC to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) closePanel();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
