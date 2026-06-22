// AI Assistente – Controllo Totale
(function () {
  "use strict";

  const MODULES = [
    {
      id: "cantina",
      name: "Cantina",
      subtitle: "Carta vini e margini",
      icon: "🍷",
      accent: "var(--wine)",
      accentBg: "var(--wine-bg)",
      badge: "Gestione",
      href: "/cantina",
      description: "Gestisci la carta vini: CRUD, stock bottiglie, margini acquisto/vendita e insight AI sulla cantina.",
      features: ["Carta vini", "Stock bottiglie", "Margini %", "AI insight", "Filtri colore"],
      chatDept: null,
    },
    {
      id: "situazione-giorno",
      name: "Situazione del Giorno",
      subtitle: "Briefing operativo live",
      icon: "📡",
      accent: "var(--gold)",
      accentBg: "var(--gold-bg)",
      badge: "Oggi",
      href: "/situazione-giorno",
      description: "Briefing della giornata con dati reali: prenotazioni, staff, cucina, incasso e magazzino critico. TTS e voce.",
      features: ["Dati live", "Prenotazioni", "Staff", "TTS briefing", "Magazzino critico"],
      chatDept: null,
    },
    {
      id: "risto-comandi",
      name: "Risto Comandi",
      subtitle: "Assistente vocale operativo",
      icon: "🎤",
      accent: "var(--green)",
      accentBg: "var(--green-bg)",
      badge: "Azioni reali",
      href: "/risto-comandi",
      description: "Parla o scrivi: Risto esegue azioni nel gestionale (stock, cantina, briefing) via AI con function calling.",
      features: ["Voce STT", "Tool magazzino", "Tool cantina", "Briefing", "Chat operativa"],
      chatDept: null,
    },
  ];

  const DEPARTMENTS = [
    {
      id: "cantina-ai",
      name: "AI Cantina",
      subtitle: "Consulenza carta vini",
      icon: "🍾",
      color: "var(--wine)",
      colorBg: "var(--wine-bg)",
      description: "Analisi margini, scorte sotto soglia, suggerimenti pricing e abbinamenti sulla carta vini reale.",
      capabilities: [
        "Margini per vino",
        "Sotto scorta ≤3",
        "Esauriti",
        "Suggerimenti prezzo",
        "Top margini",
        "Abbinamenti",
        "Analisi carta",
        "Insight AI"
      ],
      examples: [
        "Quali vini hanno margine basso?",
        "Cosa è sotto scorta in cantina?",
        "Suggerisci aumento prezzi",
        "Riepilogo carta vini",
      ],
    },
    {
      id: "kitchen",
      name: "AI Cucina",
      subtitle: "Produzione e preparazioni",
      icon: "👨‍🍳",
      color: "var(--orange)",
      colorBg: "var(--orange-bg)",
      description: "Gestisci la linea di produzione con suggerimenti AI in tempo reale basati sugli ordini attivi, scorte e menu.",
      capabilities: [
        "Ordini in attesa",
        "Prep list giornaliera",
        "Piatti in ritardo",
        "Prodotti in scadenza",
        "Semilavorati da preparare",
        "Piatti da spingere/sospendere",
        "Nuove ricette e varianti",
        "Ottimizzazione tempi"
      ],
      examples: [
        "Cosa devo preparare adesso?",
        "Ci sono prodotti in scadenza?",
        "Quali piatti sono in ritardo?",
        "Mostra la prep list del giorno",
      ],
    },
    {
      id: "supervisor",
      name: "AI Supervisor",
      subtitle: "Direzione e analisi",
      icon: "📊",
      color: "var(--accent)",
      colorBg: "var(--accent-bg)",
      description: "Panoramica completa della giornata con analisi vendite, margini, menu engineering e previsioni.",
      capabilities: [
        "Riepilogo giornata",
        "Incasso e coperti",
        "Scontrino medio",
        "Top piatti venduti",
        "Menu engineering",
        "Analisi margini",
        "Forecast vendite",
        "Criticità reparti"
      ],
      examples: [
        "Riepilogo della giornata",
        "Top piatti venduti oggi",
        "Analisi margini per reparto",
        "Previsioni per domani",
      ],
    },
    {
      id: "warehouse",
      name: "AI Magazzino",
      subtitle: "Scorte e acquisti",
      icon: "📦",
      color: "var(--teal)",
      colorBg: "var(--teal-bg)",
      description: "Monitora scorte, identifica sottoscorte e scadenze, ottimizza gli ordini ai fornitori.",
      capabilities: [
        "Sottoscorte critiche",
        "Prodotti in scadenza",
        "Stock fermo",
        "Lista acquisti ottimizzata",
        "Variazioni costo",
        "Menu anti-spreco",
        "Priorità riordino",
        "Trasferimenti reparto"
      ],
      examples: [
        "Cosa devo riordinare oggi?",
        "Prodotti sotto scorta minima",
        "Cosa sta per scadere?",
        "Lista acquisti ottimizzata",
      ],
    },
    {
      id: "cash",
      name: "AI Cassa",
      subtitle: "Incassi e pagamenti",
      icon: "💰",
      color: "var(--green)",
      colorBg: "var(--green-bg)",
      description: "Analizza incassi, metodi di pagamento, anomalie e performance dei turni cassa.",
      capabilities: [
        "Riepilogo incassi",
        "Metodi di pagamento",
        "Sconti e storni",
        "Anomalie scontrini",
        "Scontrino medio",
        "Confronto periodi",
        "Turni fuori media",
        "Andamento giornata"
      ],
      examples: [
        "Riepilogo incassi di oggi",
        "Quali metodi di pagamento si usano di più?",
        "Ci sono anomalie sugli scontrini?",
        "Scontrino medio rispetto alla settimana scorsa",
      ],
    },
    {
      id: "sala",
      name: "AI Sala",
      subtitle: "Servizio e tavoli",
      icon: "🍽️",
      color: "var(--blue)",
      colorBg: "var(--blue-bg)",
      description: "Gestisci il servizio in sala con informazioni su tavoli, ordini attivi, coperti e tempi.",
      capabilities: [
        "Tavoli aperti/occupati",
        "Ordini attivi",
        "Attesa conto",
        "Coperti in sala",
        "Tempi di servizio",
        "Flusso clienti",
        "Upselling suggerimenti",
        "Anomalie servizio"
      ],
      examples: [
        "Com'è la situazione tavoli adesso?",
        "Quanti ordini attivi ci sono?",
        "Quali tavoli aspettano il conto?",
        "Suggerisci come ottimizzare il servizio",
      ],
    },
    {
      id: "bar",
      name: "AI Bar",
      subtitle: "Bevande e cocktail",
      icon: "🍸",
      color: "var(--pink)",
      colorBg: "var(--pink-bg)",
      description: "Analizza ordini bar, scorte bevande, cocktail popolari e suggerisci drink del giorno.",
      capabilities: [
        "Ordini bar aperti",
        "Drink più richiesti",
        "Scorte in esaurimento",
        "Cocktail del giorno",
        "Drink stagionali",
        "Abbinamenti vino",
        "Bottiglie critiche",
        "Promozioni bevande"
      ],
      examples: [
        "Quali drink vanno di più oggi?",
        "Cosa sta finendo al bar?",
        "Suggerisci un cocktail del giorno",
        "Ordini bar aperti adesso",
      ],
    },
    {
      id: "creative",
      name: "AI Menu Creativo",
      subtitle: "Ricette e menu design",
      icon: "✨",
      color: "var(--amber)",
      colorBg: "var(--amber-bg)",
      description: "Crea menu del giorno, piatti stagionali e ricette usando ingredienti disponibili e target food cost.",
      capabilities: [
        "Menu del giorno",
        "Menu stagionali",
        "Nuovi piatti",
        "Ricette anti-spreco",
        "Food cost stimato",
        "Prezzo suggerito",
        "Abbinamenti",
        "Piatti con stock disponibile"
      ],
      examples: [
        "Proponi un menu del giorno",
        "Nuovi piatti con ingredienti disponibili",
        "Ricette anti-spreco",
        "Abbinamenti vino per il menu attuale",
      ],
    },
    {
      id: "pizzeria",
      name: "AI Pizzeria",
      subtitle: "Produzione pizze",
      icon: "🍕",
      color: "var(--red)",
      colorBg: "var(--red-bg)",
      description: "Gestisci la produzione pizze: ordini in coda, impasto, ingredienti e speciali del giorno.",
      capabilities: [
        "Ordini pizza in coda",
        "Ingredienti in esaurimento",
        "Impasto disponibile",
        "Tempi di cottura",
        "Speciali del giorno",
        "Varianti pizza",
        "Ottimizzazione forno",
        "Sottoscorte critiche"
      ],
      examples: [
        "Quanti ordini pizza ci sono in coda?",
        "Ingredienti in esaurimento?",
        "Suggerisci una pizza speciale oggi",
        "Ottimizzazione forno attuale",
      ],
    },
    {
      id: "prenotazioni",
      name: "AI Prenotazioni",
      subtitle: "Ospiti e booking",
      icon: "📅",
      color: "var(--cyan)",
      colorBg: "var(--cyan-bg)",
      description: "Analizza prenotazioni, prevedi picchi, identifica overbooking e ottimizza l'accoglienza.",
      capabilities: [
        "Prenotazioni del giorno",
        "Coperti attesi",
        "Picchi orari",
        "No-show storici",
        "Overbooking alert",
        "Allestimento sala",
        "Preparazione gruppi",
        "Conferme da inviare"
      ],
      examples: [
        "Quante prenotazioni ci sono oggi?",
        "Orari di punta previsti",
        "Rischio overbooking?",
        "Preparativi per il gruppo più grande",
      ],
    },
    {
      id: "fornitori",
      name: "AI Fornitori",
      subtitle: "Acquisti e ordini",
      icon: "🚛",
      color: "var(--teal)",
      colorBg: "var(--teal-bg)",
      description: "Ottimizza gli acquisti: analisi fornitori, lead time, consegne in ritardo e ordini urgenti.",
      capabilities: [
        "Lista acquisti oggi",
        "Fornitori in ritardo",
        "Prezzi anomali",
        "Ordini urgenti",
        "Consegne recenti",
        "Consumo storico",
        "Lead time fornitori",
        "Costi confronto"
      ],
      examples: [
        "Lista acquisti da fare oggi",
        "Fornitori con consegne in ritardo",
        "Prodotti con costo aumentato",
        "Priorità ordini urgenti",
      ],
    },
    {
      id: "haccp",
      name: "AI HACCP",
      subtitle: "Sicurezza alimentare",
      icon: "🛡️",
      color: "var(--red)",
      colorBg: "var(--red-bg)",
      description: "Monitora sicurezza alimentare: temperature, scadenze, non conformità e piani correttivi.",
      capabilities: [
        "Controlli temperature",
        "Prodotti zona critica",
        "Non conformità",
        "Scadenze igieniche",
        "Azioni correttive",
        "Piani di pulizia",
        "Prodotti da smaltire",
        "Registrazioni mancanti"
      ],
      examples: [
        "Controlli temperature da registrare",
        "Prodotti in zona critica",
        "Non conformità rilevate",
        "Prossime scadenze igieniche",
      ],
    },
    {
      id: "turni",
      name: "AI Turni",
      subtitle: "Pianificazione staff",
      icon: "📋",
      color: "var(--blue)",
      colorBg: "var(--blue-bg)",
      description: "Ottimizza la pianificazione turni: copertura reparti, costi personale e conflitti.",
      capabilities: [
        "Copertura reparti",
        "Ore programmate",
        "Costo personale",
        "Sotto-organico",
        "Conflitti turni",
        "Assenze non coperte",
        "Ottimizzazione turni",
        "Storico presenze"
      ],
      examples: [
        "Chi manca nei turni questa settimana?",
        "Costo del personale stimato",
        "Reparti sotto organico",
        "Ottimizza i turni di domani",
      ],
    },
    {
      id: "archivio",
      name: "AI Archivio",
      subtitle: "Analisi storica",
      icon: "📈",
      color: "var(--accent)",
      colorBg: "var(--accent-bg)",
      description: "Analizza trend storici: vendite, piatti top, confronti periodi e pattern stagionali.",
      capabilities: [
        "Trend vendite",
        "Confronto periodi",
        "Giorni di punta",
        "Piatti più venduti",
        "Pattern stagionali",
        "Anomalie storiche",
        "Andamento coperti",
        "Performance menu"
      ],
      examples: [
        "Trend vendite ultimo mese",
        "Confronto con settimana scorsa",
        "Giorni di punta storici",
        "Piatti più venduti nel periodo",
      ],
    },
    {
      id: "asporto",
      name: "AI Asporto",
      subtitle: "Delivery e take-away",
      icon: "🛵",
      color: "var(--orange)",
      colorBg: "var(--orange-bg)",
      description: "Analizza ordini asporto, tempi di preparazione, fasce orarie di punta e promozioni.",
      capabilities: [
        "Ordini in coda",
        "Tempi preparazione",
        "Fasce orarie punta",
        "Ritardi da risolvere",
        "Prodotti top asporto",
        "Packaging",
        "Promozioni take-away",
        "Volume giornaliero"
      ],
      examples: [
        "Ordini asporto in coda",
        "Tempi di attesa stimati",
        "Prodotti più richiesti per asporto",
        "Suggerisci promozione take-away",
      ],
    },
    {
      id: "catering",
      name: "AI Catering",
      subtitle: "Eventi e banchetti",
      icon: "🎪",
      color: "var(--pink)",
      colorBg: "var(--pink-bg)",
      description: "Pianifica eventi catering: liste acquisti, prep list, timeline e criticità organizzative.",
      capabilities: [
        "Eventi pianificati",
        "Coperti e menu",
        "Liste acquisti",
        "Prep list evento",
        "Timeline produzione",
        "Criticità logistiche",
        "Scorte per evento",
        "Budget e margini"
      ],
      examples: [
        "Prossimo evento catering",
        "Lista acquisti per l'evento",
        "Prep list e timeline",
        "Criticità da risolvere",
      ],
    },
  ];

  let activeDept = null;
  let messages = [];
  let isLoading = false;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function $(id) { return document.getElementById(id); }

  // Check AI status
  async function checkAiStatus() {
    try {
      const r = await fetch("/api/ai/usage", { credentials: "same-origin" });
      if (r.ok) {
        $("ai-status-dot").classList.add("online");
        $("ai-status-text").textContent = "AI operativa";
      } else {
        $("ai-status-dot").classList.add("offline");
        $("ai-status-text").textContent = "AI non raggiungibile";
      }
    } catch {
      $("ai-status-dot").classList.add("offline");
      $("ai-status-text").textContent = "Connessione assente";
    }
  }

  // Render operational module cards
  function renderModules() {
    const container = $("ai-modules");
    if (!container) return;
    container.innerHTML = MODULES.map((m) => `
      <article class="ai-module-card" style="--module-accent:${m.accent};--module-bg:${m.accentBg}">
        <div class="ai-module-card-head">
          <div class="ai-module-icon">${m.icon}</div>
          <div>
            <div class="ai-module-name">${esc(m.name)}</div>
            <div class="ai-module-subtitle">${esc(m.subtitle)}</div>
            <span class="ai-module-badge">${esc(m.badge)}</span>
          </div>
        </div>
        <div class="ai-module-desc">${esc(m.description)}</div>
        <div class="ai-module-features">
          ${m.features.map((f) => `<span class="ai-module-tag">${esc(f)}</span>`).join("")}
        </div>
        <div class="ai-module-actions">
          <a class="ai-module-btn primary" href="${esc(m.href)}">Apri modulo →</a>
        </div>
      </article>
    `).join("");
  }

  // Render department cards
  function renderDepartments() {
    const container = $("ai-departments");
    container.innerHTML = DEPARTMENTS.map((d) => `
      <div class="ai-dept-card" data-dept="${d.id}">
        <div class="ai-dept-card-head">
          <div class="ai-dept-icon" style="background:${d.colorBg};color:${d.color}">${d.icon}</div>
          <div>
            <div class="ai-dept-name">${esc(d.name)}</div>
            <div class="ai-dept-subtitle">${esc(d.subtitle)}</div>
          </div>
        </div>
        <div class="ai-dept-desc">${esc(d.description)}</div>
        <div class="ai-dept-capabilities">
          ${d.capabilities.map((c) => `<span class="ai-cap-tag">${esc(c)}</span>`).join("")}
        </div>
        <div class="ai-dept-footer">
          <span class="ai-dept-cta">Apri chat AI →</span>
          <span class="ai-dept-examples">${d.examples.length} domande rapide</span>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".ai-dept-card").forEach((card) => {
      card.addEventListener("click", () => {
        const dept = DEPARTMENTS.find((d) => d.id === card.dataset.dept);
        if (dept) openChat(dept);
      });
    });
  }

  // Open chat for department
  function openChat(dept) {
    activeDept = dept;
    messages = [];
    isLoading = false;

    $("ai-chat-icon").textContent = dept.icon;
    $("ai-chat-title").textContent = dept.name;
    $("ai-chat-dept").textContent = dept.subtitle;
    $("ai-chat-backdrop").style.display = "flex";

    renderQuickPrompts();
    renderMessages();
    setTimeout(() => $("ai-chat-input").focus(), 150);
  }

  function closeChat() {
    $("ai-chat-backdrop").style.display = "none";
    activeDept = null;
    messages = [];
  }

  function renderQuickPrompts() {
    if (!activeDept) return;
    const container = $("ai-chat-quick");
    container.innerHTML = activeDept.examples.map((e) =>
      `<button class="ai-qp" data-q="${esc(e)}">${esc(e)}</button>`
    ).join("");
    container.querySelectorAll(".ai-qp").forEach((btn) => {
      btn.addEventListener("click", () => sendMessage(btn.dataset.q));
    });
  }

  function renderMessages() {
    const container = $("ai-chat-messages");
    if (messages.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--muted)">
          <div style="font-size:48px;margin-bottom:12px">${activeDept ? activeDept.icon : "🤖"}</div>
          <p style="font-size:15px;margin-bottom:6px">Ciao! Sono l'AI di <strong style="color:var(--ink)">${esc(activeDept ? activeDept.name : "")}</strong></p>
          <p style="font-size:13px">Usa le domande rapide o scrivi qualsiasi cosa.</p>
        </div>`;
      return;
    }
    container.innerHTML = messages.map((m) => {
      if (m.role === "user") return `<div class="ai-msg-user">${esc(m.content)}</div>`;
      if (m.role === "thinking") return `
        <div class="ai-msg-thinking">
          <div class="ai-thinking-dots"><span></span><span></span><span></span></div>
          AI sta elaborando…
        </div>`;
      if (m.role === "error") return `<div class="ai-msg-error">${esc(m.content)}</div>`;
      return renderAssistant(m);
    }).join("");
    container.scrollTop = container.scrollHeight;

    container.querySelectorAll(".ai-msg-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const label = btn.dataset.label;
        if (label) sendMessage("Esegui azione: " + label);
      });
    });
  }

  function renderAssistant(msg) {
    const r = msg.raw || {};
    const summary = r.summary || r.answer || msg.content || "";
    const title = r.title || "";
    const insights = Array.isArray(r.insights) ? r.insights : [];
    const warnings = Array.isArray(r.warnings) ? r.warnings.filter(Boolean) : [];
    const actions = Array.isArray(r.actions) ? r.actions : [];
    const dp = r.dataPoints && typeof r.dataPoints === "object" ? r.dataPoints : {};
    const dpKeys = Object.keys(dp);

    let h = `<div class="ai-msg-assistant"><div class="ai-msg-card">`;
    if (title) h += `<div class="ai-msg-card-title">${esc(title)}</div>`;
    if (summary) h += `<div class="ai-msg-summary">${esc(summary)}</div>`;
    if (insights.length) {
      h += `<div class="ai-msg-insights">` +
        insights.map((i) => `<div class="ai-msg-insight">${esc(String(i))}</div>`).join("") + `</div>`;
    }
    if (dpKeys.length) {
      h += `<div class="ai-msg-dp">` +
        dpKeys.map((k) => `<span class="ai-msg-dp-item"><strong>${esc(k)}:</strong> ${esc(String(dp[k]))}</span>`).join("") + `</div>`;
    }
    if (warnings.length) {
      h += `<div class="ai-msg-warnings">` +
        warnings.map((w) => `<div class="ai-msg-warning">${esc(String(w))}</div>`).join("") + `</div>`;
    }
    if (actions.length) {
      h += `<div class="ai-msg-actions">` +
        actions.map((a) =>
          `<button class="ai-msg-action" data-label="${esc(a.label || "")}" title="${esc(a.description || "")}">${esc(a.label || a.id || "Azione")}</button>`
        ).join("") + `</div>`;
    }
    h += `</div></div>`;
    return h;
  }

  async function sendMessage(question) {
    const q = (question || "").trim();
    if (!q || isLoading || !activeDept) return;

    isLoading = true;
    $("ai-chat-send").disabled = true;
    messages.push({ role: "user", content: q });
    messages.push({ role: "thinking" });
    renderMessages();
    $("ai-chat-input").value = "";

    try {
      let result;
      if (activeDept.id === "cantina-ai") {
        const resp = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, context: "cantina", enableTools: false }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || err.message || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        result = { summary: data.reply || data.answer || "Risposta ricevuta.", answer: data.reply };
      } else {
        const resp = await fetch(`/api/ai/${encodeURIComponent(activeDept.id)}/query`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, mode: "read" }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || err.message || `HTTP ${resp.status}`);
        }
        result = await resp.json();
      }
      messages = messages.filter((m) => m.role !== "thinking");
      messages.push({
        role: "assistant",
        content: result.summary || result.answer || "Risposta ricevuta.",
        raw: result,
      });
    } catch (err) {
      messages = messages.filter((m) => m.role !== "thinking");
      messages.push({ role: "error", content: err.message || "Errore AI" });
    } finally {
      isLoading = false;
      $("ai-chat-send").disabled = false;
      renderMessages();
    }
  }

  // Init
  function init() {
    checkAiStatus();
    renderModules();
    renderDepartments();

    $("ai-chat-close").addEventListener("click", closeChat);
    $("ai-chat-backdrop").addEventListener("mousedown", (e) => {
      if (e.target === $("ai-chat-backdrop")) closeChat();
    });

    const input = $("ai-chat-input");
    const sendBtn = $("ai-chat-send");
    input.addEventListener("input", () => {
      sendBtn.disabled = !input.value.trim() || isLoading;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });
    sendBtn.addEventListener("click", () => {
      if (input.value.trim()) sendMessage(input.value);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeDept) closeChat();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
